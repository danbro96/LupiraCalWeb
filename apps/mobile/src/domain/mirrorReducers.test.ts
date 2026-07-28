import { describe, expect, it } from 'vitest';
import type { ContactDoc, ItemDoc } from './docTypes';
import { emptyContactGuards, emptyItemGuards } from './docTypes';
import type { MirrorContact, MirrorItem } from './mirrorReducers';
import { applyContactOp, applyItemOp } from './mirrorReducers';
import type { ClientOp } from './ops';

const T = (m: number) => `2026-07-01T12:${String(m).padStart(2, '0')}:00.000Z`;
const cmd = (n: number) => `0198c0de-0000-7000-8000-${String(n).padStart(12, '0')}`;

const baseItem = (): MirrorItem => ({
  doc: {
    id: 'item-1', title: 'Original', isAllDay: false, startsAt: '2026-08-01T09:00:00Z',
    calendars: [{ calendarId: 'cal-1', status: 'Accepted' }],
  } as ItemDoc,
  guards: emptyItemGuards(),
  deleted: false,
});

const revise = (title: string, minute: number, n: number): ClientOp => ({
  kind: 'item.revise', itemId: 'item-1', occurredAt: T(minute), commandId: cmd(n),
  core: { title, isAllDay: false, startsAt: '2026-08-01T09:00:00Z' },
});

describe('applyItemOp', () => {
  it('applies a newer core revise and stamps the guard', () => {
    const after = applyItemOp(baseItem(), revise('Edited', 5, 1))!;
    expect(after.doc.title).toBe('Edited');
    expect(after.guards.core).toEqual({ ts: T(5), cmd: cmd(1) });
  });

  it('rejects a core revise staler than the guard (server-seeded)', () => {
    const state = baseItem();
    state.guards.core = { ts: T(10), cmd: cmd(9) };
    const after = applyItemOp(state, revise('Stale', 5, 1))!;
    expect(after.doc.title).toBe('Original');
  });

  it('keeps sections independent: a core guard never blocks metadata', () => {
    const state = baseItem();
    state.guards.core = { ts: T(10), cmd: cmd(9) };
    const after = applyItemOp(state, {
      kind: 'item.metadata', itemId: 'item-1', occurredAt: T(5), commandId: cmd(1), patch: { note: 'x' },
    })!;
    expect(after.doc.metadata).toEqual({ note: 'x' });
  });

  it('files per-calendar with independent guards', () => {
    const state = baseItem();
    state.guards.filing['cal-1'] = { ts: T(10), cmd: cmd(9) };
    const stale = applyItemOp(state, {
      kind: 'item.unfile', itemId: 'item-1', calendarId: 'cal-1', occurredAt: T(5), commandId: cmd(1),
    })!;
    expect(stale.doc.calendars[0].status).toBe('Accepted');   // stale unfile lost

    const other = applyItemOp(stale, {
      kind: 'item.file', itemId: 'item-1', calendarId: 'cal-2', entryStatus: 'proposed', occurredAt: T(5), commandId: cmd(2),
    })!;
    expect(other.doc.calendars).toContainEqual({ calendarId: 'cal-2', status: 'Proposed' });
  });

  it('delete absorbs later revisions', () => {
    const deleted = applyItemOp(baseItem(), { kind: 'item.delete', itemId: 'item-1', occurredAt: T(5), commandId: cmd(1) })!;
    const after = applyItemOp(deleted, revise('Zombie', 20, 2))!;
    expect(after.deleted).toBe(true);
    expect(after.doc.title).toBe('Original');
  });

  it('create is an idempotent hit over a live item', () => {
    const state = baseItem();
    const after = applyItemOp(state, {
      kind: 'item.create', itemId: 'item-1', sourceKey: 'k', calendarId: 'cal-9',
      occurredAt: T(5), commandId: cmd(1), core: { title: 'Dupe', isAllDay: false },
    });
    expect(after).toBe(state);
  });
});

const baseContact = (): MirrorContact => ({
  doc: {
    id: 'c-1', addressBookId: 'book-1', givenName: 'Jane', familyName: 'Doe',
    channels: [{ medium: 'Email', value: 'jane@x', preferred: true }],
    tags: ['friend'],
  } as ContactDoc,
  guards: emptyContactGuards(),
  deleted: false,
});

describe('applyContactOp', () => {
  it('revise merges (null keeps, channels/tags union) — mirroring ReviseContact', () => {
    const after = applyContactOp(baseContact(), {
      kind: 'contact.revise', contactId: 'c-1', occurredAt: T(5), commandId: cmd(1),
      core: { nickname: 'JJ', channels: [{ medium: 'Phone', value: '+4670', preferred: true }], tags: ['ski'] },
    })!;
    expect(after.doc.givenName).toBe('Jane');   // null = keep
    expect(after.doc.nickname).toBe('JJ');
    expect(after.doc.channels).toHaveLength(2);   // union, not replace
    expect(after.doc.tags).toEqual(['friend', 'ski']);
  });

  it('channels/tags wholesale ops share the core guard (one server event type)', () => {
    const first = applyContactOp(baseContact(), {
      kind: 'contact.channels', contactId: 'c-1', occurredAt: T(10), commandId: cmd(2),
      channels: [{ medium: 'Email', value: 'new@x', preferred: true }],
    })!;
    expect(first.doc.channels).toEqual([{ medium: 'Email', value: 'new@x', preferred: true }]);

    const stale = applyContactOp(first, {
      kind: 'contact.tags', contactId: 'c-1', occurredAt: T(5), commandId: cmd(1), tags: ['stale'],
    })!;
    expect(stale.doc.tags).toEqual(['friend']);   // lost to the newer channels write on the shared guard
  });

  it('profiles keep their own guard', () => {
    const state = baseContact();
    state.guards.core = { ts: T(10), cmd: cmd(9) };
    const after = applyContactOp(state, {
      kind: 'contact.profiles', contactId: 'c-1', occurredAt: T(5), commandId: cmd(1),
      profiles: [{ service: 'github', handle: 'jane', preferred: true }],
    })!;
    expect(after.doc.profiles).toHaveLength(1);
  });
});
