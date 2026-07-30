// A contact birthday is a PartialDate: month+day always, year optional (unknown-year birthdays).
// Structural mirror of the contact API DTO. Kept generated-code-free: this package never imports DTO types.
export type PartialDate = {
  year: number | null;
  month: number;
  day: number;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Leap year so 29 Feb stays valid in the native date input when the real year is unknown.
const FALLBACK_YEAR = 2000;

/** "Jul 7, 1990", or "Jul 7" when the year is unknown. */
export function fmtPartialDate(b: PartialDate): string {
  const md = partialDateBadge(b);
  return b.year == null ? md : `${md}, ${b.year}`;
}

/** Compact month/day label for list badges (year omitted). */
export function partialDateBadge(b: PartialDate): string {
  return `${MONTHS[b.month - 1] ?? b.month} ${b.day}`;
}

/** PartialDate → "yyyy-MM-dd" for <input type="date">; leap-year fallback when year unknown. */
export function partialDateToInput(b: PartialDate | null | undefined): string {
  if (!b) return '';
  const y = String(b.year ?? FALLBACK_YEAR).padStart(4, '0');
  return `${y}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
}

/** A date-input value → PartialDate; year dropped when yearKnown is false. */
export function inputToPartialDate(value: string, yearKnown: boolean): PartialDate | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!m || !d) return null;
  return { year: yearKnown ? y : null, month: m, day: d };
}

/** Stable comparison key. */
export function partialDateKey(b: PartialDate | null | undefined): string {
  if (!b) return '';
  return `${b.year ?? ''}-${b.month}-${b.day}`;
}
