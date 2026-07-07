import { useQueries } from '@tanstack/react-query';
import { getSearchItemsQueryOptions } from '../data/api/lupiraCalApi';
import type { CalendarItemOccurrenceDto, ContainerDto } from '../data/api/models';

export interface CalendarOccurrences {
  calendar: ContainerDto;
  occurrences: CalendarItemOccurrenceDto[];
}

/**
 * Occurrences per calendar for a window. The occurrence DTO carries no calendarId, so the grid
 * needs one (cached) query per visible calendar to color/filter by source calendar.
 */
export function useRangeOccurrences(
  calendars: ContainerDto[],
  from: string,
  to: string,
  filters?: { query?: string; tag?: string },
): { byCalendar: CalendarOccurrences[]; isLoading: boolean } {
  const results = useQueries({
    queries: calendars.map((c) =>
      getSearchItemsQueryOptions({ calendarId: c.id, from, to, query: filters?.query, tag: filters?.tag }),
    ),
  });
  return {
    byCalendar: calendars.map((calendar, i) => ({ calendar, occurrences: results[i].data ?? [] })),
    isLoading: results.some((r) => r.isLoading),
  };
}
