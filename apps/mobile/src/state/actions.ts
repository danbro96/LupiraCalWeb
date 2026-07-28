import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../data/db/expoDb';
import { deterministicIdFor } from '../data/ids';
import type { ReachChannel, SocialProfile } from '../domain/docTypes';
import { currentHorizon } from '../domain/materialize';
import type { ClientOp, ContactCore, ItemCore } from '../domain/ops';
import { stamp } from '../domain/ops';
import { enqueue } from '../sync/outbox';

/// The screens' entire write surface: build an op, enqueue it (optimistic mirror write + outbox row in one
/// exclusive transaction — outbox.ts), let the drain push it when the network allows. Creates mint a
/// sourceKey and derive the server's deterministic id up front, so navigation targets the final id.

async function submit(op: ClientOp): Promise<void> {
  await enqueue(await getDb(), [op], currentHorizon());
}

export async function createItem(calendarId: string, core: ItemCore): Promise<string> {
  const sourceKey = uuidv7();
  const itemId = await deterministicIdFor(sourceKey);
  await submit({ kind: 'item.create', itemId, sourceKey, calendarId, core, ...stamp() });
  return itemId;
}

export async function reviseItem(itemId: string, core: ItemCore): Promise<void> {
  await submit({ kind: 'item.revise', itemId, core, ...stamp() });
}

export async function mergeItemMetadata(itemId: string, patch: Record<string, unknown>): Promise<void> {
  await submit({ kind: 'item.metadata', itemId, patch, ...stamp() });
}

export async function deleteItem(itemId: string): Promise<void> {
  await submit({ kind: 'item.delete', itemId, ...stamp() });
}

export async function fileItem(itemId: string, calendarId: string, entryStatus: 'accepted' | 'proposed' = 'accepted'): Promise<void> {
  await submit({ kind: 'item.file', itemId, calendarId, entryStatus, ...stamp() });
}

export async function unfileItem(itemId: string, calendarId: string): Promise<void> {
  await submit({ kind: 'item.unfile', itemId, calendarId, ...stamp() });
}

export async function createContact(addressBookId: string, core: ContactCore): Promise<string> {
  const sourceKey = uuidv7();
  const contactId = await deterministicIdFor(sourceKey);
  await submit({ kind: 'contact.create', contactId, sourceKey, addressBookId, core, ...stamp() });
  return contactId;
}

export async function reviseContact(contactId: string, core: ContactCore): Promise<void> {
  await submit({ kind: 'contact.revise', contactId, core, ...stamp() });
}

export async function setContactChannels(contactId: string, channels: ReachChannel[]): Promise<void> {
  await submit({ kind: 'contact.channels', contactId, channels, ...stamp() });
}

export async function setContactTags(contactId: string, tags: string[]): Promise<void> {
  await submit({ kind: 'contact.tags', contactId, tags, ...stamp() });
}

export async function setContactProfiles(contactId: string, profiles: SocialProfile[]): Promise<void> {
  await submit({ kind: 'contact.profiles', contactId, profiles, ...stamp() });
}

export async function deleteContact(contactId: string): Promise<void> {
  await submit({ kind: 'contact.delete', contactId, ...stamp() });
}
