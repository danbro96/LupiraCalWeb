// Client twin of the servers' SectionLww (LupiraCalApi/LupiraContactApi): the same wins decision must fall out
// on both sides or offline rebase diverges from what the server actually kept. Parity is pinned by
// test/fixtures/lww-vectors.json, emitted from the server rule itself.
//
// Timestamps are compared at full ISO precision, NOT via Date.parse: .NET serializes DateTimeOffset with up
// to 7 fractional digits, and a 100ns difference must still win a comparison JS milliseconds would call a tie.

export type SectionGuard = { ts: string; cmd: string };

/// True when an incoming write keyed (occurredAt, commandId) is strictly newer than a section's guard:
/// later occurredAt, or equal occurredAt with a greater commandId. An equal pair (a replay) loses.
export function wins(occurredAt: string, commandId: string, guardTs: string, guardCmd: string): boolean {
  const c = compareInstant(occurredAt, guardTs);
  return c > 0 || (c === 0 && compareCommandId(commandId, guardCmd) > 0);
}

/// Ordinal comparison of canonical lowercase GUID strings — the JS-reproducible tiebreak the servers use
/// (deliberately not .NET Guid.CompareTo, whose byte-group ordering can't be mirrored here).
export function compareCommandId(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/// Compares two ISO-8601 instants preserving sub-millisecond precision. Accepts Z or ±hh:mm offsets and any
/// number of fractional digits (JS emits 3, .NET up to 7).
export function compareInstant(a: string, b: string): number {
  const ka = instantKey(a);
  const kb = instantKey(b);
  if (ka.seconds !== kb.seconds) return ka.seconds < kb.seconds ? -1 : 1;
  return ka.fraction < kb.fraction ? -1 : ka.fraction > kb.fraction ? 1 : 0;
}

function instantKey(iso: string): { seconds: number; fraction: string } {
  const m = /^(\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(.*)$/.exec(iso);
  if (!m) return { seconds: Date.parse(iso) / 1000, fraction: '000000000' };
  const [, base, frac = '', offset] = m;
  const seconds = Date.parse(base + (offset || 'Z')) / 1000;
  return { seconds, fraction: frac.padEnd(9, '0') };
}
