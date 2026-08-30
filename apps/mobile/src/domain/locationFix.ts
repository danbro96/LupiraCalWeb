/** GPS recording: the wire shape, activity classification, and the cadence profiles that follow from it.
 *  Pure — every rule here is unit-tested, because a mistake costs a day of silently wrong tracks. */

/** Matches LupiraLocationApi's `MotionActivity` enum exactly; sent as the string name. */
export type MotionActivity = 'Unknown' | 'Still' | 'Walk' | 'Run' | 'Cycle' | 'Vehicle';

/** Matches LupiraLocationApi's `LocationProvider` enum. Android's fused provider is what we get. */
export type LocationProvider = 'Unknown' | 'Gps' | 'Network' | 'Fused' | 'Passive';

/** One recorded fix, already in the server's units. `seq` is device-assigned and monotonic; together
 *  with `ts` it forms the server's idempotency key, so neither may change once queued. */
export type LocationFix = {
  seq: number;
  ts: string;
  lat: number;
  lon: number;
  accuracyM: number | null;
  altitudeM: number | null;
  headingDeg: number | null;
  speedMps: number | null;
  activity: MotionActivity;
  provider: LocationProvider;
  batteryPct: number | null;
  isMoving: boolean;
  isMock: boolean;
};

/** The server drops fixes worse than this from stats AND from the visit/trip rollup, so anything
 *  above it contributes nothing but storage. Kept as the queue's admission gate. */
export const MAX_USEFUL_ACCURACY_M = 50;

/** expo-location reports no activity — Android's ActivityRecognition API isn't exposed, and
 *  `activityType` is an iOS input hint, not an output. Speed is the only signal we actually have,
 *  so classification is a speed ladder. Thresholds are deliberately wide: the value drives cadence
 *  and the server's trip segmentation, and over-reacting to a noisy sample is worse than lagging. */
export function classifyActivity(speedMps: number | null): MotionActivity {
  if (speedMps == null || speedMps < 0) return 'Unknown';
  if (speedMps < 0.5) return 'Still';
  if (speedMps < 2.2) return 'Walk';
  if (speedMps < 4.5) return 'Run';
  if (speedMps < 8) return 'Cycle';
  return 'Vehicle';
}

/** How hard to sample, per activity class. Still is cheap because a parked phone is the common case;
 *  Vehicle trades interval for distance because 30 s at road speed is already ~400 m.
 *
 *  Accuracy stays HIGH in every profile, including Still. Dropping to Balanced would ask Android for
 *  ~100 m fixes — above the server's 50 m cutoff — and Still is precisely when visits are detected
 *  (80 m radius, ≥8 min), so a "cheap" still profile would silently yield zero visits and no trips.
 *  The battery saving comes from the five-minute interval, not from a worse fix. */
export type CadenceProfile = { timeIntervalMs: number; distanceIntervalM: number };

export const CADENCE: Record<MotionActivity, CadenceProfile> = {
  Unknown: { timeIntervalMs: 60_000, distanceIntervalM: 100 },
  Still: { timeIntervalMs: 300_000, distanceIntervalM: 200 },
  Walk: { timeIntervalMs: 60_000, distanceIntervalM: 50 },
  Run: { timeIntervalMs: 60_000, distanceIntervalM: 50 },
  Cycle: { timeIntervalMs: 30_000, distanceIntervalM: 150 },
  Vehicle: { timeIntervalMs: 30_000, distanceIntervalM: 150 },
};

/** Profiles that are identical don't warrant a restart — Walk/Run and Cycle/Vehicle share one. */
export function sameCadence(a: MotionActivity, b: MotionActivity): boolean {
  return CADENCE[a].timeIntervalMs === CADENCE[b].timeIntervalMs
    && CADENCE[a].distanceIntervalM === CADENCE[b].distanceIntervalM;
}

/** Consecutive disagreeing fixes required before the cadence actually switches. Changing options means
 *  stopping and restarting the OS updates, so a single GPS glitch must never trigger it. */
export const CADENCE_SWITCH_AFTER = 3;

export type CadenceDecision = { activity: MotionActivity; streak: number; restart: boolean };

/** Hysteresis gate. Feed every fix's classified activity; `restart: true` means the caller should
 *  stop+start location updates with the new profile. */
export function nextCadence(
  current: MotionActivity,
  streakActivity: MotionActivity,
  streak: number,
  observed: MotionActivity,
): CadenceDecision {
  if (sameCadence(observed, current)) return { activity: current, streak: 0, restart: false };
  const nextStreak = observed === streakActivity ? streak + 1 : 1;
  if (nextStreak < CADENCE_SWITCH_AFTER) return { activity: current, streak: nextStreak, restart: false };
  return { activity: observed, streak: 0, restart: true };
}

/** One NDJSON line. Field names are snake_case — the ingest parser's shape, NOT the REST DTOs' camelCase.
 *  Nulls are omitted rather than sent, and identity fields are never included: the server stamps
 *  principal/device from the DeviceKey and rejects any line that carries them (`body_ids_forbidden`). */
export function toNdjsonLine(fix: LocationFix): string {
  const line: Record<string, unknown> = { seq: fix.seq, ts: fix.ts, lat: fix.lat, lon: fix.lon };
  if (fix.accuracyM != null) line.accuracy_m = fix.accuracyM;
  if (fix.altitudeM != null) line.altitude_m = fix.altitudeM;
  if (fix.headingDeg != null) line.heading_deg = fix.headingDeg;
  if (fix.speedMps != null) line.speed_mps = fix.speedMps;
  line.activity = fix.activity;
  line.provider = fix.provider;
  if (fix.batteryPct != null) line.battery_pct = fix.batteryPct;
  line.is_moving = fix.isMoving;
  if (fix.isMock) line.is_mock = true;
  return JSON.stringify(line);
}

/** Rejects that will never succeed on a retry — the row is dropped instead of parked forever.
 *  `batch_too_large` is excluded deliberately: it means the batch was truncated, not that the row is bad.
 *  `ts_out_of_range` is excluded too — see `rejectDisposition`, where a future timestamp is deferrable. */
const PERMANENT_REJECTS = new Set([
  'invalid_json', 'body_ids_forbidden', 'missing_seq',
  'invalid_ts', 'missing_latlon', 'invalid_latlon',
]);

export type RejectDisposition = 'drop' | 'retain' | { deferUntil: string };

/** What to do with one rejected row. A `ts_out_of_range` caused by a clock that was running FAST at
 *  capture time becomes valid as wall-clock catches up, so it is deferred rather than thrown away —
 *  but only within a day, beyond which the clock was wrong enough that the fix would poison the
 *  timeline anyway. Anything older than retention can never be accepted. */
export function rejectDisposition(reason: string, ts: string, now: number): RejectDisposition {
  if (reason === 'batch_too_large') return 'retain';
  if (PERMANENT_REJECTS.has(reason)) return 'drop';
  if (reason !== 'ts_out_of_range') return 'retain';

  const t = Date.parse(ts);
  if (Number.isNaN(t) || t < now - RETENTION_DAYS * 86_400_000) return 'drop';
  if (t > now + 86_400_000) return 'drop';
  // Becomes acceptable once wall-clock passes (ts − the server's 5 min tolerance).
  return { deferUntil: new Date(t - MAX_FUTURE_SKEW_MS + 60_000).toISOString() };
}

/** True when the receipt's own arithmetic doesn't add up — a proxy that truncated or re-encoded the
 *  NDJSON body would otherwise look like a clean ack and silently destroy the batch. */
export function receiptIsCoherent(sentCount: number, r: {
  submitted: number; inserted: number; duplicates: number; rejected: number;
}): boolean {
  return r.submitted === sentCount && r.inserted + r.duplicates + r.rejected === r.submitted;
}

/** The server's window: fixes further ahead than +5 min or older than retention are rejected outright.
 *  Checked before queueing so a device with a bad clock doesn't fill the queue with doomed rows. */
export const MAX_FUTURE_SKEW_MS = 5 * 60_000;
export const RETENTION_DAYS = 90;

export function isTimestampAcceptable(ts: string, now: number): boolean {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return false;
  return t <= now + MAX_FUTURE_SKEW_MS && t >= now - RETENTION_DAYS * 86_400_000;
}
