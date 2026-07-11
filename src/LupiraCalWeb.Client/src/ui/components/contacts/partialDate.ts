import type { PartialDate } from '../../../data/api-contact/models';

// A contact birthday is a PartialDate: month+day always, year optional (unknown-year birthdays).
// .NET emits the numeric fields as number | string, so coerce at the boundary.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Leap year so 29 Feb stays valid in the native date input when the real year is unknown.
const FALLBACK_YEAR = 2000;

function coerce(b: PartialDate): { year: number | null; month: number; day: number } {
  return {
    year: b.year == null || b.year === '' ? null : Number(b.year),
    month: Number(b.month),
    day: Number(b.day),
  };
}

/** "Jul 7, 1990", or "Jul 7" when the year is unknown. */
export function fmtPartialDate(b: PartialDate): string {
  const { year, month, day } = coerce(b);
  const md = `${MONTHS[month - 1] ?? month} ${day}`;
  return year == null ? md : `${md}, ${year}`;
}

/** Compact month/day label for list badges (year omitted). */
export function partialDateBadge(b: PartialDate): string {
  const { month, day } = coerce(b);
  return `${MONTHS[month - 1] ?? month} ${day}`;
}

/** PartialDate → "yyyy-MM-dd" for <input type="date">; leap-year fallback when year unknown. */
export function partialDateToInput(b: PartialDate | null | undefined): string {
  if (!b) return '';
  const { year, month, day } = coerce(b);
  const y = String(year ?? FALLBACK_YEAR).padStart(4, '0');
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A date-input value → PartialDate; year dropped when yearKnown is false. */
export function inputToPartialDate(value: string, yearKnown: boolean): PartialDate | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!m || !d) return null;
  return { year: yearKnown ? y : null, month: m, day: d };
}

/** Stable comparison key, tolerant of number-vs-string field encoding. */
export function partialDateKey(b: PartialDate | null | undefined): string {
  if (!b) return '';
  const { year, month, day } = coerce(b);
  return `${year ?? ''}-${month}-${day}`;
}
