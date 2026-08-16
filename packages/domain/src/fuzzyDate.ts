// Residency-boundary dates known to year, year-month, or day precision — the precision carries the
// certainty. Structural mirror of LupiraContactApi's FuzzyDate (primitives only; domain stays
// independent of the generated API models). Distinct from PartialDate (year-unknown birthdays).

export interface FuzzyDate {
  year: number;
  month?: number | null;
  day?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2015", "Jun 2015", or "12 Jun 2015" — at the stated precision. */
export function fmtFuzzyDate(d: FuzzyDate): string {
  if (d.month == null) return String(d.year);
  const m = MONTHS[d.month - 1] ?? `M${d.month}`;
  return d.day == null ? `${m} ${d.year}` : `${d.day} ${m} ${d.year}`;
}

/** "2010–2015", "?–2015", "2010–" (still current is not rendered here — pass movedOut only for former). */
export function fmtResidencyPeriod(movedIn: FuzzyDate | null | undefined, movedOut: FuzzyDate | null | undefined): string {
  const from = movedIn ? fmtFuzzyDate(movedIn) : '?';
  const to = movedOut ? fmtFuzzyDate(movedOut) : '?';
  return `${from}–${to}`;
}

/** Parses "2015", "2015-06", "2015-06-12". Null on anything else (incl. out-of-range month/day). */
export function parseFuzzyInput(value: string): FuzzyDate | null {
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] === undefined ? null : Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  if (month != null && (month < 1 || month > 12)) return null;
  if (day != null && (month == null || day < 1 || day > daysInMonth(year, month))) return null;
  return { year, month, day };
}

/** Canonical input text: "2015", "2015-06", "2015-06-12"; empty for null. */
export function fuzzyToInput(d: FuzzyDate | null | undefined): string {
  if (!d) return '';
  if (d.month == null) return String(d.year);
  const m = String(d.month).padStart(2, '0');
  return d.day == null ? `${d.year}-${m}` : `${d.year}-${m}-${String(d.day).padStart(2, '0')}`;
}

/** Stable comparison key ("" for null) — for change diffs. */
export function fuzzyKey(d: FuzzyDate | null | undefined): string {
  return fuzzyToInput(d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
