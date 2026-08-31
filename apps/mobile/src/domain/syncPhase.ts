/** What a sync pass is currently doing, and how to say it. Lives in domain so the banner
 *  derivation can stay pure — `sync/syncStatus.ts` re-exports both for existing callers. */
export type SyncPhase = 'containers' | 'items' | 'contacts' | 'push' | 'bridge';

export const PHASE_LABELS: Record<SyncPhase, string> = {
  containers: 'calendars',
  items: 'events',
  contacts: 'contacts',
  push: 'changes sent',
  bridge: 'device sync',
};
