import type { SyncPhase } from './syncPhase';

// Pure derivation of the sync banner from the status store, kept framework-free so it can be
// unit-tested. Priority: in-progress sync → server reachability → parked changes → last sync error.
// Mirrors LupiraTasksMobile's domain/bannerState.ts; the inputs differ because this app parks
// changes rather than failing them, and reports a phase while syncing.

export interface BannerInput {
  syncing: boolean;
  serverReachable: boolean;
  pending: number;
  parked: number;
  /** Last sync/replay error message; surfaces a generic error banner when nothing higher applies. */
  lastError: string | null;
  progress: { phase: SyncPhase; count: number } | null;
}

export type BannerKind = 'syncing' | 'offline' | 'parked' | 'error';

export interface BannerState {
  kind: BannerKind;
  text: string;
}

const plural = (n: number) => (n === 1 ? '' : 's');

export function bannerState(s: BannerInput, phaseLabels: Record<SyncPhase, string>): BannerState | null {
  if (s.syncing) {
    const p = s.progress;
    return {
      kind: 'syncing',
      text: p && p.count > 0 ? `Syncing — ${p.count} ${phaseLabels[p.phase]}…` : 'Syncing…',
    };
  }
  if (!s.serverReachable) {
    return {
      kind: 'offline',
      text: s.pending > 0 ? `Offline — ${s.pending} change${plural(s.pending)} queued` : 'Offline',
    };
  }
  if (s.parked > 0) {
    return { kind: 'parked', text: `${s.parked} change${plural(s.parked)} need attention` };
  }
  if (s.lastError) {
    return { kind: 'error', text: 'Sync problem — tap for details' };
  }
  // Healthy: the banner says nothing, so it renders nothing. "Connected as …" was an M3
  // exit-criterion probe and outlived the milestone it proved.
  return null;
}
