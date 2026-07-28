import type { ItemDoc } from './docTypes';
import type { ItemCore } from './ops';

/// Pure half of the bridge write-back: a captured provider edit → the op the engine should enqueue.
/// The impure half (id resolution, mirror lookup, enqueue, ack) lives in sync/bridge.ts. Warts are
/// inherited from the REST contract: title/description cleared in the stock app stay unchanged
/// server-side (null = keep), and EVENT_LOCATION is publish-only (ItemCore has no location field).

export type CalCapturePayload = {
  title: string | null;
  description: string | null;
  location: string | null;
  dtstart: number | null;
  dtend: number | null;
  duration: string | null;   // RFC2445, recurring rows carry this instead of dtend
  allDay: boolean;
  rrule: string | null;
  calendarSyncId: string | null;
};

export type ParsedCalRow = {
  kind: 'created' | 'revised' | 'deleted';
  itemId: string;
  sourceKey?: string;
  payload: CalCapturePayload;
  occurredAt: string;
};

export type CalTranslation =
  | { kind: 'create'; itemId: string; sourceKey: string; calendarId: string; core: ItemCore; occurredAt: string }
  | { kind: 'revise'; itemId: string; core: ItemCore; occurredAt: string }
  | { kind: 'delete'; itemId: string; occurredAt: string }
  | { kind: 'skip'; reason: string };

export function translateCalRow(row: ParsedCalRow, existing: ItemDoc | null): CalTranslation {
  if (row.kind === 'deleted') return { kind: 'delete', itemId: row.itemId, occurredAt: row.occurredAt };

  const p = row.payload;
  if (p.dtstart === null) return { kind: 'skip', reason: 'captured row has no start' };

  const core: ItemCore = {
    title: p.title?.trim() || null,
    description: p.description?.trim() || null,
    // Sections the stock app can't touch ride through from the mirror (whole-section write).
    status: existing?.status ?? null,
    category: existing?.category ?? null,
    tags: existing?.tags ?? null,
    parentItemId: existing?.parentItemId ?? null,
    isAllDay: p.allDay,
    startsAt: null, endsAt: null, startDate: null, endDate: null,
    startTimezone: null, endTimezone: null,
    recurrenceRule: p.rrule ? p.rrule.replace(/^RRULE:/i, '') : null,
  };

  const endMs = p.dtend ?? (p.duration ? p.dtstart + (parseRfc2445Duration(p.duration) ?? 0) : null);
  if (p.allDay) {
    core.startDate = utcDayKey(p.dtstart);
    core.endDate = endMs && endMs > p.dtstart ? utcDayKey(endMs) : null;
  } else {
    core.startsAt = new Date(p.dtstart).toISOString();
    core.endsAt = endMs && endMs > p.dtstart ? new Date(endMs).toISOString() : null;
  }

  if (row.kind === 'created') {
    if (!row.sourceKey) return { kind: 'skip', reason: 'created row without sourceKey' };
    if (!p.calendarSyncId) return { kind: 'skip', reason: 'created row without a mapped calendar' };
    return { kind: 'create', itemId: row.itemId, sourceKey: row.sourceKey, calendarId: p.calendarSyncId, core, occurredAt: row.occurredAt };
  }
  return { kind: 'revise', itemId: row.itemId, core, occurredAt: row.occurredAt };
}

/// RFC2445 duration subset the calendar provider emits (P1D, PT1800S, P1DT12H, P2W …).
export function parseRfc2445Duration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, sign, w, d, h, min, s] = m;
  const ms =
    (Number(w ?? 0) * 7 * 86_400 + Number(d ?? 0) * 86_400 + Number(h ?? 0) * 3_600 + Number(min ?? 0) * 60 + Number(s ?? 0)) * 1000;
  if (ms === 0 && !w && !d && !h && !min && !s) return null;
  return sign === '-' ? -ms : ms;
}

export const PENDING_PREFIX = 'pending:';

/// The capturer's pending marker doubles as the deterministic sourceKey, so re-drains converge on the
/// same aggregate: "pending:<uuid>" → sourceKey "bridge:<uuid>".
export function sourceKeyOfPendingMarker(marker: string): string | null {
  if (!marker.startsWith(PENDING_PREFIX)) return null;
  const uuid = marker.slice(PENDING_PREFIX.length);
  return uuid ? `bridge:${uuid}` : null;
}

function utcDayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
