/** Formatters for photo metadata, shared by the web and mobile galleries. */

const KB = 1024;

/** File size for a metadata line: "842 kB", "3.7 MB". Binary units, one decimal above kB. */
export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < KB) return `${Math.round(bytes)} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let value = bytes / KB;
  let unit = 0;
  while (value >= KB && unit < units.length - 1) {
    value /= KB;
    unit++;
  }
  // Whole numbers past a thousand read as noise at one decimal ("1024.0 MB").
  return `${value >= 100 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`;
}

/** Video length as a clock: "0:09", "1:23", "1:02:03". Seconds may be fractional. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "4032 × 3024" — the × is deliberate, an ASCII x reads as a variable. */
export function fmtDimensions(width: number | null | undefined, height: number | null | undefined): string | null {
  return width && height ? `${width} × ${height}` : null;
}
