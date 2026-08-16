// Orphan-place curation policy. Field names mirror geo's OrphanCandidateDto so rows pass
// structurally, but the type stays hand-written (domain never imports generated models).

export type OrphanRefCounts = {
  contactRefs: number;
  calendarLiveRefs: number;
  calendarDeletedRefs: number;
  savedPlaceRefs: number;
};

export type OrphanClass = 'prunable' | 'referencedByDeletedOnly' | 'referenced';

/** Live references (contacts, live calendar items, saved places) win over deleted-item references. */
export function classifyOrphan(refs: OrphanRefCounts): OrphanClass {
  if (refs.contactRefs > 0 || refs.calendarLiveRefs > 0 || refs.savedPlaceRefs > 0) return 'referenced';
  if (refs.calendarDeletedRefs > 0) return 'referencedByDeletedOnly';
  return 'prunable';
}

/** Default bulk-prune selection: only unambiguously prunable rows — deleted-only rows stay opt-in. */
export function defaultPruneSelection<T extends OrphanRefCounts & { placeId: string }>(rows: readonly T[]): string[] {
  return rows.filter((r) => classifyOrphan(r) === 'prunable').map((r) => r.placeId);
}
