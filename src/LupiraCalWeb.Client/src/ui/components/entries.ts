import type { CalendarItemDto, CalendarItemOccurrenceDto, ContainerDto } from '../../data/api/models';
import { parseYmd } from '../../domain/time';
import { CALENDAR_KIND_ICONS, calendarColor } from '../theme/kinds';

/** One renderable occurrence on a grid — accepted occurrences and ghosted proposed items. */
export interface GridEntry {
  key: string;
  itemId: string;
  title: string;
  start: Date;
  end: Date | null;
  isAllDay: boolean;
  color: string;
  icon?: string;
  ghost?: boolean;
  completeness?: number | null;
}

export function fromOccurrence(o: CalendarItemOccurrenceDto, calendar: ContainerDto): GridEntry {
  return {
    key: `${o.id}:${o.start}`,
    itemId: o.id,
    title: o.title || '(untitled)',
    start: new Date(o.start),
    end: o.end ? new Date(o.end) : null,
    isAllDay: o.isAllDay,
    color: calendarColor(calendar),
    icon: calendar.class === 'System' && calendar.kind ? CALENDAR_KIND_ICONS[calendar.kind] : undefined,
    completeness: o.completeness ? Number(o.completeness.score) : null,
  };
}

/** A proposed item ghosted at its (first) date; recurring proposals ghost once. */
export function fromProposed(item: CalendarItemDto, calendar: ContainerDto): GridEntry | null {
  const start = item.startsAt ? new Date(item.startsAt) : item.startDate ? parseYmd(item.startDate) : null;
  if (!start) return null;
  const end = item.endsAt ? new Date(item.endsAt) : null;
  return {
    key: `ghost:${item.id}:${calendar.id}`,
    itemId: item.id,
    title: item.title || '(untitled)',
    start,
    end,
    isAllDay: item.isAllDay,
    color: calendarColor(calendar),
    ghost: true,
  };
}
