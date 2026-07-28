import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareInstant, wins } from './lww';

type LwwVector = {
  Name: string;
  OccurredAt: string;
  CommandId: string;
  GuardTs: string;
  GuardCmd: string;
  Wins: boolean;
};

const vectors = JSON.parse(
  readFileSync(new URL('../test/fixtures/lww-vectors.json', import.meta.url), 'utf8'),
) as LwwVector[];

describe('wins parity with the server rule', () => {
  it.each(vectors.map((v) => [v.Name, v] as const))('%s', (_, v) => {
    expect(wins(v.OccurredAt, v.CommandId, v.GuardTs, v.GuardCmd)).toBe(v.Wins);
  });
});

describe('compareInstant', () => {
  it('treats Z and +00:00 as the same instant', () => {
    expect(compareInstant('2026-07-01T12:00:00Z', '2026-07-01T12:00:00+00:00')).toBe(0);
  });

  it('compares across differing fractional precision', () => {
    expect(compareInstant('2026-07-01T12:00:00.123Z', '2026-07-01T12:00:00.1230000+00:00')).toBe(0);
    expect(compareInstant('2026-07-01T12:00:00.0000001+00:00', '2026-07-01T12:00:00Z')).toBe(1);
  });

  it('applies non-UTC offsets', () => {
    expect(compareInstant('2026-07-01T14:00:00+02:00', '2026-07-01T12:00:00Z')).toBe(0);
  });
});
