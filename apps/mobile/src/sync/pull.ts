import { getChanges as calGetChanges } from '../data/api/generated/cal/sync/sync';
import { getSyncContainers as calGetContainers } from '../data/api/generated/cal/sync/sync';
import { getChanges as contactGetChanges, getSyncContainers as contactGetContainers } from '../data/api/generated/contact/sync/sync';
import type { Db, Tx } from '../data/db/types';
import * as mirror from '../data/mirror';
import type { ContactDoc, ContactGuards, ItemDoc, ItemGuards } from '../domain/docTypes';
import type { Horizon } from '../domain/materialize';
import { birthdayRows, monthKeyOf, occurrenceRowsForItem } from '../domain/materialize';
import type { MirrorContact, MirrorItem } from '../domain/mirrorReducers';
import { applyContactOp, applyItemOp } from '../domain/mirrorReducers';
import { ApiError } from '../domain/apiError';

/// Pull side of the engine: a paged delta loop that actually READS the cursor (the tasks app wrote and
/// ignored it), applies tombstones, and — the critical part — rebases every changed aggregate through the
/// pending (and parked) local ops so a fresh server base never clobbers un-pushed intent. Server guards seed
/// the local per-section guards, so the rebase decides each section exactly as the server eventually will.

export type ItemChange = { item: ItemDoc; guards: ItemGuards };
export type ContactChange = { contact: ContactDoc; guards: ContactGuards };
export type ChangesPage<TChange> = { cursor: string; hasMore: boolean; changed: TChange[]; deleted: string[] };

export type PullDeps = {
  calChanges(since: string | null): Promise<ChangesPage<ItemChange>>;
  contactChanges(since: string | null): Promise<ChangesPage<ContactChange>>;
  calContainers(): Promise<{ calendars: { id: string }[] }>;
  contactContainers(): Promise<{ addressBooks: { id: string }[]; groups: { id: string }[] }>;
  now(): Date;
};

export const realPullDeps: PullDeps = {
  calChanges: async (since) => {
    const r = await calGetChanges(since ? { since } : undefined);
    if (r.status !== 200) throw new ApiError(r.status, 'changes failed');
    return r.data as unknown as ChangesPage<ItemChange>;
  },
  contactChanges: async (since) => {
    const r = await contactGetChanges(since ? { since } : undefined);
    if (r.status !== 200) throw new ApiError(r.status, 'changes failed');
    return r.data as unknown as ChangesPage<ContactChange>;
  },
  calContainers: async () => {
    const r = await calGetContainers();
    if (r.status !== 200) throw new ApiError(r.status, 'containers failed');
    return r.data as unknown as { calendars: { id: string }[] };
  },
  contactContainers: async () => {
    const r = await contactGetContainers();
    if (r.status !== 200) throw new ApiError(r.status, 'containers failed');
    return r.data as unknown as { addressBooks: { id: string }[]; groups: { id: string }[] };
  },
  now: () => new Date(),
};

export async function pullContainers(db: Db, deps: PullDeps): Promise<void> {
  const [cal, contact] = [await deps.calContainers(), await deps.contactContainers()];
  await db.exclusive(async (tx) => {
    await mirror.replaceContainers(tx, 'calendars', cal.calendars);
    await mirror.replaceContainers(tx, 'address_books', contact.addressBooks);
    await mirror.replaceContainers(tx, 'contact_groups', contact.groups);
  });
}

/// Returns the touched month keys for query invalidation.
export async function pullCal(db: Db, horizon: Horizon, deps: PullDeps): Promise<Set<string>> {
  const monthKeys = new Set<string>();
  let cursor = await mirror.getCursor(db, 'cal');
  const full = cursor === null;
  const seen = new Set<string>();

  for (;;) {
    const page = await deps.calChanges(cursor);
    await db.exclusive(async (tx) => {
      for (const change of page.changed) {
        seen.add(change.item.id);
        await rebaseItem(tx, change, horizon, monthKeys);
      }
      for (const id of page.deleted) await tombstoneItem(tx, id, horizon, monthKeys);
      await mirror.setCursor(tx, 'cal', page.cursor, full, deps.now().toISOString());
    });
    cursor = page.cursor;
    if (!page.hasMore) break;
  }

  // Full sync = wholesale replace: anything the stream didn't mention is gone from the server. Local-only
  // aggregates with a pending create are the one exception — they haven't reached the server yet.
  if (full) {
    await db.exclusive(async (tx) => {
      const keep = await mirror.pendingCreateAggregates(tx);
      for (const id of await mirror.allItemIds(tx)) {
        if (seen.has(id) || keep.has(id)) continue;
        await collectItemMonths(tx, id, horizon, monthKeys);
        await mirror.removeItem(tx, id);
      }
    });
  }
  return monthKeys;
}

export async function pullContacts(db: Db, horizon: Horizon, deps: PullDeps): Promise<Set<string>> {
  const monthKeys = new Set<string>();
  let cursor = await mirror.getCursor(db, 'contact');
  const full = cursor === null;
  const seen = new Set<string>();

  for (;;) {
    const page = await deps.contactChanges(cursor);
    await db.exclusive(async (tx) => {
      for (const change of page.changed) {
        seen.add(change.contact.id);
        await rebaseContact(tx, change, horizon, monthKeys);
      }
      for (const id of page.deleted) {
        await collectBirthdayMonths(tx, id, monthKeys);
        await mirror.removeContact(tx, id);
      }
      await mirror.setCursor(tx, 'contact', page.cursor, full, deps.now().toISOString());
    });
    cursor = page.cursor;
    if (!page.hasMore) break;
  }

  if (full) {
    await db.exclusive(async (tx) => {
      const keep = await mirror.pendingCreateAggregates(tx);
      for (const id of await mirror.allContactIds(tx)) {
        if (seen.has(id) || keep.has(id)) continue;
        await collectBirthdayMonths(tx, id, monthKeys);
        await mirror.removeContact(tx, id);
      }
    });
  }
  return monthKeys;
}

/// Server truth + pending local ops replayed through the reducer twin = the state the server will converge
/// on once the outbox lands. Parked ops stay in the fold — they remain the user's intent until discarded.
async function rebaseItem(tx: Tx, change: ItemChange, horizon: Horizon, monthKeys: Set<string>): Promise<void> {
  await collectItemMonths(tx, change.item.id, horizon, monthKeys);
  let state: MirrorItem | null = { doc: change.item, guards: change.guards, deleted: false };
  for (const row of await mirror.opsForAggregate(tx, change.item.id))
    state = applyItemOp(state, mirror.opOfRow(row)) ?? state;
  const rows = occurrenceRowsForItem(state!.doc, state!.deleted, horizon);
  for (const r of rows) monthKeys.add(monthKeyOf(r.startDay));
  await mirror.saveItem(tx, state!, rows);
}

async function rebaseContact(tx: Tx, change: ContactChange, horizon: Horizon, monthKeys: Set<string>): Promise<void> {
  await collectBirthdayMonths(tx, change.contact.id, monthKeys);
  let state: MirrorContact | null = { doc: change.contact, guards: change.guards, deleted: false };
  for (const row of await mirror.opsForAggregate(tx, change.contact.id))
    state = applyContactOp(state, mirror.opOfRow(row)) ?? state;
  const rows = birthdayRows(state!.doc, state!.deleted, horizon);
  for (const r of rows) monthKeys.add(monthKeyOf(r.startDay));
  await mirror.saveContact(tx, state!, rows);
}

/// Delete-wins: the row and its occurrences go. Pending ops for it are left to 404-park on replay — the
/// Sync issues screen is where a user resurrects that intent deliberately.
async function tombstoneItem(tx: Tx, id: string, horizon: Horizon, monthKeys: Set<string>): Promise<void> {
  await collectItemMonths(tx, id, horizon, monthKeys);
  await mirror.removeItem(tx, id);
}

async function collectItemMonths(tx: Tx, id: string, horizon: Horizon, monthKeys: Set<string>): Promise<void> {
  const existing = await mirror.loadItem(tx, id);
  if (!existing) return;
  for (const r of occurrenceRowsForItem(existing.doc, existing.deleted, horizon)) monthKeys.add(monthKeyOf(r.startDay));
}

async function collectBirthdayMonths(tx: Tx, id: string, monthKeys: Set<string>): Promise<void> {
  const rows = await tx.all<{ start_day: string }>(
    "SELECT start_day FROM occurrences WHERE source = 'birthday' AND source_id = ?", [id]);
  for (const r of rows) monthKeys.add(monthKeyOf(r.start_day));
}
