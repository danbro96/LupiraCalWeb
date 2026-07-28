import { describe, expect, it } from 'vitest';
import type { ContactDoc, ItemDoc } from './docTypes';
import { contactCoreFromForm, contactFormFromDoc, emptyContactForm, emptyItemForm, itemCoreFromForm, itemFormFromDoc, parseCsv } from './editors';

const timedDoc: ItemDoc = {
  id: 'i1',
  title: 'Dentist',
  description: 'Annual check',
  status: 'Confirmed',
  category: 'Appointment',
  tags: ['health', 'kids'],
  isAllDay: false,
  startsAt: new Date(2026, 7, 3, 14, 30).toISOString(),
  endsAt: new Date(2026, 7, 3, 15, 0).toISOString(),
  recurrenceRule: null,
  parentItemId: 'parent-1',
  calendars: [{ calendarId: 'c1', status: 'Accepted' }],
};

describe('item editor', () => {
  it('round-trips a timed doc through form and core', () => {
    const form = itemFormFromDoc(timedDoc);
    expect(form.startDay).toBe('2026-08-03');
    expect(form.startTime).toBe('14:30');
    expect(form.tagsCsv).toBe('health, kids');

    const r = itemCoreFromForm(form, timedDoc);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.startsAt).toBe(timedDoc.startsAt);
    expect(r.value.endsAt).toBe(timedDoc.endsAt);
    expect(r.value.startDate).toBeNull();
    expect(r.value.tags).toEqual(['health', 'kids']);
    expect(r.value.parentItemId).toBe('parent-1');   // unedited field survives the whole-section write
  });

  it('round-trips an all-day doc', () => {
    const doc: ItemDoc = { ...timedDoc, isAllDay: true, startsAt: null, endsAt: null, startDate: '2026-08-10', endDate: '2026-08-12' };
    const form = itemFormFromDoc(doc);
    expect(form.startDay).toBe('2026-08-10');
    expect(form.startTime).toBe('');

    const r = itemCoreFromForm(form, doc);
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toMatchObject({ isAllDay: true, startDate: '2026-08-10', endDate: '2026-08-12', startsAt: null, endsAt: null });
  });

  it('flipping to all-day moves the schedule to the date fields', () => {
    const form = { ...itemFormFromDoc(timedDoc), isAllDay: true, startTime: '', endTime: '', endDay: '' };
    const r = itemCoreFromForm(form, timedDoc);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.startDate).toBe('2026-08-03');
    expect(r.value.startsAt).toBeNull();
  });

  it('empty title/description mean keep (null), never clear', () => {
    const r = itemCoreFromForm({ ...emptyItemForm() }, undefined);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.title).toBeNull();
    expect(r.value.description).toBeNull();
    expect(r.value.tags).toEqual([]);   // tags DO clear — server replaces on non-null
  });

  it('rejects end before start, timed and all-day', () => {
    const timed = itemCoreFromForm({ ...emptyItemForm(), startDay: '2026-08-03', startTime: '15:00', endDay: '2026-08-03', endTime: '14:00' });
    expect(timed.ok).toBe(false);
    const allDay = itemCoreFromForm({ ...emptyItemForm(), isAllDay: true, startDay: '2026-08-03', endDay: '2026-08-01' });
    expect(allDay.ok).toBe(false);
  });

  it('rejects half-specified timed instants and recurrence without a start', () => {
    expect(itemCoreFromForm({ ...emptyItemForm(), startDay: '2026-08-03' }).ok).toBe(false);
    expect(itemCoreFromForm({ ...emptyItemForm(), endDay: '2026-08-03', endTime: '10:00' }).ok).toBe(false);
    expect(itemCoreFromForm({ ...emptyItemForm(), recurrenceRule: 'FREQ=DAILY' }).ok).toBe(false);
  });
});

describe('contact editor', () => {
  const doc: ContactDoc = {
    id: 'c1', addressBookId: 'b1',
    givenName: 'Alva', familyName: 'B', nickname: null,
    birthday: { year: 2019, month: 3, day: 7 },
    channels: [{ medium: 'Phone', value: '070', preferred: true }],
    tags: ['family'],
  };

  it('round-trips core fields and keeps channels/tags out of revise', () => {
    const form = contactFormFromDoc(doc);
    expect(form.birthday).toBe('2019-03-07');
    expect(form.birthdayYearKnown).toBe(true);

    const r = contactCoreFromForm(form);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.givenName).toBe('Alva');
    expect(r.value.birthday).toEqual({ year: 2019, month: 3, day: 7 });
    expect(r.value.channels).toBeNull();   // UNION-merge wart: never send via revise
    expect(r.value.tags).toBeNull();
  });

  it('drops the year for year-unknown birthdays', () => {
    const form = { ...emptyContactForm(), givenName: 'X', birthday: '2000-06-15', birthdayYearKnown: false };
    const r = contactCoreFromForm(form);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.birthday).toEqual({ year: null, month: 6, day: 15 });
  });

  it('requires some name', () => {
    expect(contactCoreFromForm(emptyContactForm()).ok).toBe(false);
  });
});

describe('parseCsv', () => {
  it('trims, drops empties, dedupes case-insensitively', () => {
    expect(parseCsv(' a, B ,a, ,b')).toEqual(['a', 'B']);
    expect(parseCsv('')).toEqual([]);
  });
});
