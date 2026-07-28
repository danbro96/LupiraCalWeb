/// On-device debug trail: a bounded ring buffer surfaced by the DebugLog screen, so auth/sync problems on a
/// phone are diagnosable without a cable. Mirrored to the console for `expo start` sessions.

export type DebugEntry = { at: string; tag: string; message: string };

const MAX_ENTRIES = 200;
const entries: DebugEntry[] = [];
const listeners = new Set<() => void>();

export function logDebug(tag: string, message: string): void {
  entries.push({ at: new Date().toISOString(), tag, message });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  console.log(`[${tag}] ${message}`);
  for (const l of listeners) l();
}

export function debugEntries(): readonly DebugEntry[] {
  return entries;
}

export function onDebugLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
