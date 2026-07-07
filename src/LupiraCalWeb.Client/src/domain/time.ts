// Local-time calendar math for the grids. Dates are JS Dates at local midnight; keys are 'yyyy-MM-dd'.

export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday-first week start. */
export function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -dow);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** The full Monday-first weeks covering d's month (4–6 rows of 7 days). */
export function monthMatrix(d: Date): Date[][] {
  const first = startOfMonth(d);
  const gridStart = startOfWeek(first);
  const weeks: Date[][] = [];
  let cursor = gridStart;
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  } while (cursor.getMonth() === d.getMonth());
  return weeks;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtMonthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function fmtDayTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}
