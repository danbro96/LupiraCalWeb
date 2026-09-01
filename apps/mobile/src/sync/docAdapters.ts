import type { CalendarItemDto, SyncChangesResponse as CalChangesDto } from '@lupira/cal-api/models';
import type { ContactDto, ContactSyncChangesResponse as ContactChangesDto } from '@lupira/cal-api/models';
import type { ContactDoc, ItemDoc } from '../domain/docTypes';
import type { ChangesPage, ContactChange, ItemChange } from './pull';

/** Wire DTO → mirror doc. Assignment is unasserted so a spec change that drops or retypes a field the
 *  mirror reads fails to compile here. */

/** Arbitrary JSON, which orval renders as the structurally-empty `JsonNode`. */
const metadataOf = (m: unknown) => m as Record<string, unknown> | null | undefined;

export function toItemDoc(dto: CalendarItemDto): ItemDoc {
  return { ...dto, metadata: metadataOf(dto.metadata) };
}

export function toContactDoc(dto: ContactDto): ContactDoc {
  return { ...dto, metadata: metadataOf(dto.metadata) };
}

export function toItemChangesPage(dto: CalChangesDto): ChangesPage<ItemChange> {
  return { ...dto, changed: dto.changed.map((c) => ({ item: toItemDoc(c.item), guards: c.guards })) };
}

export function toContactChangesPage(dto: ContactChangesDto): ChangesPage<ContactChange> {
  return { ...dto, changed: dto.changed.map((c) => ({ contact: toContactDoc(c.contact), guards: c.guards })) };
}
