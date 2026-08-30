import { describe, expect, it } from 'vitest';
import {
  CADENCE_SWITCH_AFTER, classifyActivity, isTimestampAcceptable, nextCadence,
  receiptIsCoherent, rejectDisposition, toNdjsonLine, type LocationFix,
} from './locationFix';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');

const fix = (over: Partial<LocationFix> = {}): LocationFix => ({
  seq: 1,
  ts: '2026-08-30T11:59:00.000Z',
  lat: 59.33,
  lon: 18.07,
  accuracyM: 8,
  altitudeM: 21,
  headingDeg: 180,
  speedMps: 1.4,
  activity: 'Walk',
  provider: 'Fused',
  batteryPct: 72,
  isMoving: true,
  isMock: false,
  ...over,
});

describe('classifyActivity', () => {
  it('maps the speed ladder', () => {
    expect(classifyActivity(0)).toBe('Still');
    expect(classifyActivity(1.3)).toBe('Walk');
    expect(classifyActivity(3.2)).toBe('Run');
    expect(classifyActivity(6)).toBe('Cycle');
    expect(classifyActivity(25)).toBe('Vehicle');
  });

  it('is Unknown without a usable speed', () => {
    expect(classifyActivity(null)).toBe('Unknown');
    expect(classifyActivity(-1)).toBe('Unknown');
  });
});

describe('nextCadence', () => {
  it('ignores a single disagreeing fix', () => {
    const d = nextCadence('Still', 'Still', 0, 'Walk');
    expect(d.restart).toBe(false);
    expect(d.activity).toBe('Still');
  });

  it('switches only after a sustained streak', () => {
    let activity = 'Still' as const;
    let streak = 0;
    let restart = false;
    for (let i = 0; i < CADENCE_SWITCH_AFTER; i++) {
      const d = nextCadence(activity, 'Walk', streak, 'Walk');
      streak = d.streak;
      restart = d.restart;
      if (d.restart) expect(d.activity).toBe('Walk');
    }
    expect(restart).toBe(true);
  });

  it('resets the streak when the observation changes', () => {
    const first = nextCadence('Still', 'Walk', 2, 'Vehicle');
    expect(first.streak).toBe(1);
    expect(first.restart).toBe(false);
  });

  it('never restarts for an activity that shares the current profile', () => {
    // Walk and Run map to the same interval/distance — restarting would drop the OS subscription
    // for nothing every time a walk breaks into a jog.
    const d = nextCadence('Walk', 'Walk', 0, 'Run');
    expect(d.restart).toBe(false);
    expect(d.streak).toBe(0);
  });
});

describe('toNdjsonLine', () => {
  it('emits snake_case keys the ingest parser understands', () => {
    const line = JSON.parse(toNdjsonLine(fix())) as Record<string, unknown>;
    expect(line).toMatchObject({
      seq: 1, ts: '2026-08-30T11:59:00.000Z', lat: 59.33, lon: 18.07,
      accuracy_m: 8, altitude_m: 21, heading_deg: 180, speed_mps: 1.4,
      activity: 'Walk', provider: 'Fused', battery_pct: 72, is_moving: true,
    });
  });

  it('never emits identity fields — the server rejects the whole line if it sees them', () => {
    const serialized = toNdjsonLine(fix());
    for (const forbidden of ['principal_id', 'principalId', 'device_id', 'deviceId']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('omits nulls and a false is_mock rather than sending them', () => {
    const line = JSON.parse(toNdjsonLine(fix({
      accuracyM: null, altitudeM: null, headingDeg: null, speedMps: null, batteryPct: null,
    }))) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(['activity', 'is_moving', 'lat', 'lon', 'provider', 'seq', 'ts']);
  });

  it('marks mock fixes so the server can exclude them from the rollup', () => {
    expect(JSON.parse(toNdjsonLine(fix({ isMock: true })))).toMatchObject({ is_mock: true });
  });

  it('serializes the timestamp byte-identically on every call — (ts, seq) is half the server PK', () => {
    const f = fix();
    expect(toNdjsonLine(f)).toBe(toNdjsonLine(f));
  });
});

describe('rejectDisposition', () => {
  it('drops rejects that can never succeed', () => {
    expect(rejectDisposition('invalid_latlon', fix().ts, NOW)).toBe('drop');
    expect(rejectDisposition('body_ids_forbidden', fix().ts, NOW)).toBe('drop');
    expect(rejectDisposition('missing_seq', fix().ts, NOW)).toBe('drop');
  });

  it('retains a truncated batch — the row itself was never judged', () => {
    expect(rejectDisposition('batch_too_large', fix().ts, NOW)).toBe('retain');
  });

  it('defers a future timestamp, because a fast clock catches up', () => {
    const ts = new Date(NOW + 30 * 60_000).toISOString();
    const d = rejectDisposition('ts_out_of_range', ts, NOW);
    expect(d).not.toBe('drop');
    expect(Date.parse((d as { deferUntil: string }).deferUntil)).toBeGreaterThan(NOW);
  });

  it('drops a wildly future or expired timestamp', () => {
    expect(rejectDisposition('ts_out_of_range', new Date(NOW + 5 * 86_400_000).toISOString(), NOW)).toBe('drop');
    expect(rejectDisposition('ts_out_of_range', new Date(NOW - 200 * 86_400_000).toISOString(), NOW)).toBe('drop');
  });
});

describe('receiptIsCoherent', () => {
  it('accepts a receipt whose arithmetic adds up', () => {
    expect(receiptIsCoherent(10, { submitted: 10, inserted: 8, duplicates: 1, rejected: 1 })).toBe(true);
  });

  it('rejects a truncated or re-encoded body', () => {
    expect(receiptIsCoherent(10, { submitted: 7, inserted: 7, duplicates: 0, rejected: 0 })).toBe(false);
    expect(receiptIsCoherent(10, { submitted: 10, inserted: 5, duplicates: 0, rejected: 0 })).toBe(false);
  });
});

describe('isTimestampAcceptable', () => {
  it('mirrors the server window so doomed rows never reach the queue', () => {
    expect(isTimestampAcceptable(new Date(NOW - 60_000).toISOString(), NOW)).toBe(true);
    expect(isTimestampAcceptable(new Date(NOW + 10 * 60_000).toISOString(), NOW)).toBe(false);
    expect(isTimestampAcceptable(new Date(NOW - 100 * 86_400_000).toISOString(), NOW)).toBe(false);
    expect(isTimestampAcceptable('not-a-date', NOW)).toBe(false);
  });
});
