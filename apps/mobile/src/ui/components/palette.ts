import { AVAILABILITY_COLORS, BIRTHDAY_COLOR, hashColor, isAvailabilityStatus } from '@lupira/cal-tokens/kinds';
import { useCalendars } from '../../state/queries';

export { AVAILABILITY_COLORS, BIRTHDAY_COLOR, hashColor };

const UNKNOWN_AVAILABILITY = '#94a3b8';

export function availabilityColor(status: string | null): string {
  return isAvailabilityStatus(status) ? AVAILABILITY_COLORS[status] : UNKNOWN_AVAILABILITY;
}

/** Calendar color: the container's own color when it set one, else a stable hash — same idea as the web grid. */
export function useCalendarColors(): (calendarId: string | null) => string {
  const { data } = useCalendars();
  const explicit = new Map((data ?? []).map((c) => [c.id, c.color ?? null] as const));
  return (calendarId) => {
    if (!calendarId) return '#8a8a8a';
    return explicit.get(calendarId) || hashColor(calendarId);
  };
}
