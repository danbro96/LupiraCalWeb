import type { CalendarItemDto, SyncChangesResponse as CalChangesDto } from '../data/api/generated/cal/models';
import type { ContactDto, SyncChangesResponse as ContactChangesDto } from '../data/api/generated/contact/models';
import type { ContactDoc, ItemDoc, SocialProfile } from '../domain/docTypes';
import type { ChangesPage, ContactChange, ItemChange } from './pull';

/// Wire DTO → mirror doc. Assignment is unasserted so a spec change that drops or retypes a field the
/// mirror reads fails to compile here; the two shapes below are the only ones the generated types
/// can't express.

/// Arbitrary JSON, which orval renders as the structurally-empty `JsonNode`.
const metadataOf = (m: unknown) => m as Record<string, unknown> | null | undefined;

/// The spec marks every profile field optional; one missing service or handle is unusable, and
/// `normalizeProfiles` drops it on the write path anyway.
function profilesOf(profiles: ContactDto['profiles']): SocialProfile[] | null | undefined {
  return profiles?.flatMap((p) =>
    p.service && p.handle
      ? [{ service: p.service, handle: p.handle, url: p.url, preferred: p.preferred ?? false }]
      : [],
  );
}

export function toItemDoc(dto: CalendarItemDto): ItemDoc {
  return { ...dto, metadata: metadataOf(dto.metadata) };
}

export function toContactDoc(dto: ContactDto): ContactDoc {
  return { ...dto, metadata: metadataOf(dto.metadata), profiles: profilesOf(dto.profiles) };
}

export function toItemChangesPage(dto: CalChangesDto): ChangesPage<ItemChange> {
  return { ...dto, changed: dto.changed.map((c) => ({ item: toItemDoc(c.item), guards: c.guards })) };
}

export function toContactChangesPage(dto: ContactChangesDto): ChangesPage<ContactChange> {
  return { ...dto, changed: dto.changed.map((c) => ({ contact: toContactDoc(c.contact), guards: c.guards })) };
}
