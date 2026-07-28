import { describe, expect, it } from 'vitest';
import type { ItemDoc } from './docTypes';
import type { CalCapturePayload, ParsedCalRow } from './bridgeTranslate';
import { parseRfc2445Duration, sourceKeyOfPendingMarker, translateCalRow } from './bridgeTranslate';

const payload = (over: Partial<CalCapturePayload> = {}): CalCapturePayload => ({
  title: 'From stock app', description: null, location: null,
  dtstart: Date.UTC(2026, 7, 3, 12, 0), dtend: Date.UTC(2026, 7, 3, 13, 0), duration: null,
  allDay: false, rrule: null, calendarSyncId: 'cal-1', ...over,
});

const row = (kind: ParsedCalRow['kind'], p: Partial<CalCapturePayload> = {}, over: Partial<ParsedCalRow> = {}): ParsedCalRow => ({
  kind, itemId: 'item-1', payload: payload(p), occurredAt: '2026-08-03T12:30:00.000Z', ...over,
});

const existing: ItemDoc = {
  id: 'item-1', title: 'Old', isAllDay: false,
  status: 'Confirmed', category: 'Meeting', tags: ['work'], parentItemId: 'p1',
  calendars: [{ calendarId: 'cal-1', status: 'Accepted' }],
};

describe('translateCalRow', () => {
  it('revise: schedule from capture, untouchable sections from the mirror doc', () => {
    const t = translateCalRow(row('revised'), existing);
    if (t.kind !== 'revise') throw new Error(t.kind);
    expect(t.core.startsAt).toBe('2026-08-03T12:00:00.000Z');
    expect(t.core.endsAt).toBe('2026-08-03T13:00:00.000Z');
    expect(t.core).toMatchObject({ title: 'From stock app', status: 'Confirmed', category: 'Meeting', tags: ['work'], parentItemId: 'p1' });
    expect(t.occurredAt).toBe('2026-08-03T12:30:00.000Z');
  });

  it('revise without mirror context keeps unknown sections null (= keep server-side)', () => {
    const t = translateCalRow(row('revised'), null);
    if (t.kind !== 'revise') throw new Error(t.kind);
    expect(t.core.status).toBeNull();
    expect(t.core.tags).toBeNull();
  });

  it('all-day capture maps to date fields', () => {
    const t = translateCalRow(row('revised', {
      allDay: true, dtstart: Date.UTC(2026, 7, 10), dtend: Date.UTC(2026, 7, 12),
    }), existing);
    if (t.kind !== 'revise') throw new Error(t.kind);
    expect(t.core).toMatchObject({ isAllDay: true, startDate: '2026-08-10', endDate: '2026-08-12', startsAt: null });
  });

  it('recurring capture: duration replaces dtend, RRULE prefix stripped', () => {
    const t = translateCalRow(row('revised', { dtend: null, duration: 'PT3600S', rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO' }), existing);
    if (t.kind !== 'revise') throw new Error(t.kind);
    expect(t.core.endsAt).toBe('2026-08-03T13:00:00.000Z');
    expect(t.core.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('create needs a sourceKey and calendar mapping', () => {
    const ok = translateCalRow(row('created', {}, { sourceKey: 'bridge:u1' }), null);
    expect(ok).toMatchObject({ kind: 'create', calendarId: 'cal-1', sourceKey: 'bridge:u1' });
    expect(translateCalRow(row('created', { calendarSyncId: null }, { sourceKey: 'bridge:u1' }), null)).toMatchObject({ kind: 'skip' });
    expect(translateCalRow(row('created'), null)).toMatchObject({ kind: 'skip' });
  });

  it('delete translates regardless of payload; startless non-deletes skip', () => {
    expect(translateCalRow(row('deleted', { dtstart: null }), existing)).toMatchObject({ kind: 'delete', itemId: 'item-1' });
    expect(translateCalRow(row('revised', { dtstart: null }), existing)).toMatchObject({ kind: 'skip' });
  });
});

describe('parseRfc2445Duration', () => {
  it('parses the provider subset', () => {
    expect(parseRfc2445Duration('P1D')).toBe(86_400_000);
    expect(parseRfc2445Duration('PT1800S')).toBe(1_800_000);
    expect(parseRfc2445Duration('PT30M')).toBe(1_800_000);
    expect(parseRfc2445Duration('P2W')).toBe(14 * 86_400_000);
    expect(parseRfc2445Duration('P1DT12H')).toBe(129_600_000);
    expect(parseRfc2445Duration('nonsense')).toBeNull();
    expect(parseRfc2445Duration('P')).toBeNull();
  });
});

describe('sourceKeyOfPendingMarker', () => {
  it('maps the capture marker to the deterministic sourceKey', () => {
    expect(sourceKeyOfPendingMarker('pending:abc-123')).toBe('bridge:abc-123');
    expect(sourceKeyOfPendingMarker('item-guid')).toBeNull();
    expect(sourceKeyOfPendingMarker('pending:')).toBeNull();
  });
});
