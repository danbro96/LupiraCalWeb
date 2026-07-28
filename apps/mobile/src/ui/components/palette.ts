import { useCalendars } from '../../state/queries';

const FALLBACK = ['#4457c2', '#0e7490', '#b45309', '#15803d', '#a21caf', '#be123c', '#4d7c0f', '#0f766e'];

export const BIRTHDAY_COLOR = '#d97706';
export const ACCENT = '#4457c2';

export function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return FALLBACK[Math.abs(h) % FALLBACK.length];
}

/// Calendar color: the container's own color when it set one, else a stable hash — same idea as the web grid.
export function useCalendarColors(): (calendarId: string | null) => string {
  const { data } = useCalendars();
  const explicit = new Map((data ?? []).map((c) => [c.id, c.color ?? null] as const));
  return (calendarId) => {
    if (!calendarId) return '#8a8a8a';
    return explicit.get(calendarId) || hashColor(calendarId);
  };
}
