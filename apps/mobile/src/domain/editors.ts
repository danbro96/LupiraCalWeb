import { inputToPartialDate, partialDateToInput } from '@lupira/cal-domain/partialDate';
import type { ContactDoc, ItemDoc } from './docTypes';
import type { ContactCore, ItemCore } from './ops';

/** Form ⇄ op-core translation, kept pure so the wart-heavy parts are vitest-covered: which empty field means
 *  "keep" (title/description/status/category have no REST clear) vs "clear" (the sentinel-backed schedule
 *  fields and tags), and the timed/all-day duality. Screens own only widgets and submission. */

export type ItemForm = {
  title: string;
  description: string;
  status: string;          // '' = keep unset
  category: string;
  tagsCsv: string;
  isAllDay: boolean;
  startDay: string;        // 'yyyy-MM-dd', '' = none
  startTime: string;       // 'HH:MM' (timed only)
  endDay: string;
  endTime: string;
  recurrenceRule: string;  // '' = none
};

export function emptyItemForm(day?: string, time?: string): ItemForm {
  let endDay = '';
  let endTime = '';
  if (day && time) {
    // Slot-created events default to one hour; the end may roll past midnight.
    const [y, m, d] = day.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const end = new Date(y, m - 1, d, hh + 1, mm);
    endDay = localDay(end);
    endTime = localTime(end);
  }
  return {
    title: '', description: '', status: '', category: '', tagsCsv: '', isAllDay: false,
    startDay: day ?? '', startTime: time ?? '', endDay, endTime, recurrenceRule: '',
  };
}

/** Smart default when picking a category on a NEW event with an untouched schedule: some categories are
 *  obviously day-scoped, some obviously timed. null = no opinion, leave the form alone. */
export function categoryAllDayDefault(category: string): boolean | null {
  if (category === 'Occasion' || category === 'Trip' || category === 'Stay') return true;
  if (category === 'Meeting' || category === 'Appointment' || category === 'Focus') return false;
  return null;
}

export function itemFormFromDoc(doc: ItemDoc): ItemForm {
  const timedPart = (iso: string | null | undefined) => {
    if (!iso) return { day: '', time: '' };
    const d = new Date(iso);
    return { day: localDay(d), time: localTime(d) };
  };
  const start = timedPart(doc.startsAt);
  const end = timedPart(doc.endsAt);
  return {
    title: doc.title ?? '',
    description: doc.description ?? '',
    status: doc.status ?? '',
    category: doc.category ?? '',
    tagsCsv: (doc.tags ?? []).join(', '),
    isAllDay: doc.isAllDay === true,
    startDay: doc.isAllDay ? (doc.startDate ?? '') : start.day,
    startTime: doc.isAllDay ? '' : start.time,
    endDay: doc.isAllDay ? (doc.endDate ?? '') : end.day,
    endTime: doc.isAllDay ? '' : end.time,
    recurrenceRule: doc.recurrenceRule ?? '',
  };
}

export type EditResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** `base` supplies the fields the form doesn't edit (parentItemId) so the whole-section write keeps them. */
export function itemCoreFromForm(form: ItemForm, base?: ItemDoc): EditResult<ItemCore> {
  const core: ItemCore = {
    title: form.title.trim() || null,
    description: form.description.trim() || null,
    status: form.status || null,
    category: form.category || null,
    tags: parseCsv(form.tagsCsv),
    parentItemId: base?.parentItemId ?? null,
    isAllDay: form.isAllDay,
    startsAt: null, endsAt: null, startDate: null, endDate: null,
    startTimezone: null, endTimezone: null,   // v1 is UTC-only, same as web
    recurrenceRule: form.recurrenceRule.trim() || null,
  };

  if (form.isAllDay) {
    core.startDate = form.startDay || null;
    core.endDate = form.endDay || null;
    if (core.endDate && core.startDate && core.endDate < core.startDate)
      return { ok: false, error: 'End date is before the start date' };
    if (core.endDate && !core.startDate) return { ok: false, error: 'End date needs a start date' };
  } else {
    if (form.startDay && !form.startTime) return { ok: false, error: 'Start needs a time' };
    if (form.startTime && !form.startDay) return { ok: false, error: 'Start needs a date' };
    if ((form.endDay || form.endTime) && !(form.endDay && form.endTime))
      return { ok: false, error: 'End needs both date and time' };
    core.startsAt = form.startDay ? localToIso(form.startDay, form.startTime) : null;
    core.endsAt = form.endDay ? localToIso(form.endDay, form.endTime) : null;
    if (core.endsAt && !core.startsAt) return { ok: false, error: 'End needs a start' };
    if (core.endsAt && core.startsAt && core.endsAt <= core.startsAt)
      return { ok: false, error: 'End is not after the start' };
  }
  if (core.recurrenceRule && !core.startsAt && !core.startDate)
    return { ok: false, error: 'Recurrence needs a start' };
  return { ok: true, value: core };
}

export type ContactForm = {
  givenName: string;
  middleName: string;
  familyName: string;
  nickname: string;
  displayNameFormat: string;   // '' = keep unset
  kind: string;
  /** Two input shapes: with a known year, `birthday` holds 'yyyy-MM-dd' (date picker); without one,
   *  month/day live in their own fields and no fake year ever exists anywhere. */
  birthday: string;
  birthdayYearKnown: boolean;
  birthdayMonth: string;       // '1'..'12' when the year is unknown
  birthdayDay: string;         // '1'..'31'
  notes: string;
  pronouns: string;
};

export function emptyContactForm(): ContactForm {
  return {
    givenName: '', middleName: '', familyName: '', nickname: '', displayNameFormat: '', kind: '',
    birthday: '', birthdayYearKnown: true, birthdayMonth: '', birthdayDay: '', notes: '', pronouns: '',
  };
}

export function contactFormFromDoc(doc: ContactDoc): ContactForm {
  const yearKnown = doc.birthday ? doc.birthday.year != null : true;
  return {
    givenName: doc.givenName ?? '',
    middleName: doc.middleName ?? '',
    familyName: doc.familyName ?? '',
    nickname: doc.nickname ?? '',
    displayNameFormat: doc.displayNameFormat ?? '',
    kind: doc.kind ?? '',
    birthday: yearKnown ? partialDateToInput(doc.birthday) : '',
    birthdayYearKnown: yearKnown,
    birthdayMonth: !yearKnown && doc.birthday ? String(Number(doc.birthday.month)) : '',
    birthdayDay: !yearKnown && doc.birthday ? String(Number(doc.birthday.day)) : '',
    notes: doc.notes ?? '',
    pronouns: doc.pronouns ?? '',
  };
}

/** Channels and tags stay null here — ReviseContact UNION-merges them (adds, never removes), so editing
 *  them goes through the wholesale contact.channels / contact.tags ops instead. */
export function contactCoreFromForm(form: ContactForm): EditResult<ContactCore> {
  if (!form.givenName.trim() && !form.familyName.trim() && !form.nickname.trim())
    return { ok: false, error: 'A contact needs at least a name or nickname' };
  return {
    ok: true,
    value: {
      givenName: form.givenName.trim() || null,
      middleName: form.middleName.trim() || null,
      familyName: form.familyName.trim() || null,
      nickname: form.nickname.trim() || null,
      displayNameFormat: form.displayNameFormat || null,
      kind: form.kind || null,
      // null = keep (no REST clear). Year-unknown birthdays come from the month/day fields directly.
      birthday: form.birthdayYearKnown
        ? inputToPartialDate(form.birthday, true)
        : (form.birthdayMonth && form.birthdayDay
          ? { year: null, month: Number(form.birthdayMonth), day: Number(form.birthdayDay) }
          : null),
      notes: form.notes.trim() || null,
      pronouns: form.pronouns.trim() || null,
      channels: null,
      tags: null,
    },
  };
}

export function parseCsv(csv: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of csv.split(',')) {
    const t = raw.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');
