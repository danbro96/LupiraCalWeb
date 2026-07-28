import { requireNativeModule } from 'expo-modules-core';

export type PublishEvent = {
  key: string;
  title: string;
  startMs: number;
  endMs?: number | null;
  allDay: boolean;
};

export type BridgeState = {
  accountPresent: boolean;
  calendarId: number | null;
  lastSyncAt: number | null;
};

export type ContactsSampleRow = {
  id: number;
  accountType: string | null;
  accountName: string | null;
  sourceId: string | null;
  dirty: number;
  deleted: number;
  displayName: string | null;
};

type LupiraBridgeNative = {
  ensureAccount(): Promise<boolean>;
  removeAccount(): Promise<boolean>;
  requestSync(): Promise<void>;
  getBridgeState(): Promise<BridgeState>;
  publishEvents(events: PublishEvent[]): Promise<number>;
  readContactsSample(limit: number): Promise<{ total: number; rows: ContactsSampleRow[] }>;
};

export const LupiraBridge = requireNativeModule<LupiraBridgeNative>('LupiraBridge');
