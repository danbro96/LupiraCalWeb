import { create } from 'zustand';

/** Small shared status surface for banners/screens. Deliberately its own store so outbox and pull can both
 *  write it without import cycles. Mirror reactivity is NOT here — that's per-monthKey query invalidation
 *  (see reactivity.ts), not a global revision counter. */

export type { SyncPhase } from '../domain/syncPhase';
export { PHASE_LABELS } from '../domain/syncPhase';
import type { SyncPhase } from '../domain/syncPhase';

type SyncStatus = {
  syncing: boolean;
  serverReachable: boolean;
  pending: number;
  parked: number;
  lastError: string | null;
  lastSyncAt: string | null;
  /** Live phase + processed count while a sync runs (cursor paging has no total — counts, not percent). */
  progress: { phase: SyncPhase; count: number } | null;
};

type SyncStatusActions = {
  set(partial: Partial<SyncStatus>): void;
  setPhase(phase: SyncPhase | null): void;
  bumpProgress(phase: SyncPhase, n: number): void;
};

export const useSyncStatus = create<SyncStatus & SyncStatusActions>((set, get) => ({
  syncing: false,
  serverReachable: true,
  pending: 0,
  parked: 0,
  lastError: null,
  lastSyncAt: null,
  progress: null,
  set: (partial) => set(partial),
  setPhase: (phase) => set({ progress: phase ? { phase, count: 0 } : null }),
  bumpProgress: (phase, n) => {
    const p = get().progress;
    if (p?.phase === phase) set({ progress: { phase, count: p.count + n } });
  },
}));

