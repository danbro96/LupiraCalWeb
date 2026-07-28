import { create } from 'zustand';

/// Small shared status surface for banners/screens. Deliberately its own store so outbox and pull can both
/// write it without import cycles. Mirror reactivity is NOT here — that's per-monthKey query invalidation
/// (see reactivity.ts), not a global revision counter.
type SyncStatus = {
  syncing: boolean;
  serverReachable: boolean;
  pending: number;
  parked: number;
  lastError: string | null;
  lastSyncAt: string | null;
};

type SyncStatusActions = {
  set(partial: Partial<SyncStatus>): void;
};

export const useSyncStatus = create<SyncStatus & SyncStatusActions>((set) => ({
  syncing: false,
  serverReachable: true,
  pending: 0,
  parked: 0,
  lastError: null,
  lastSyncAt: null,
  set: (partial) => set(partial),
}));
