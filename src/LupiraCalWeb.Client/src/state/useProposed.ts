import { useQueries } from '@tanstack/react-query';
import { getListProposedItemsQueryOptions } from '../data/api/lupiraCalApi';
import type { CalendarItemDto, ContainerDto } from '../data/api/models';

export interface ProposedByCalendar {
  calendar: ContainerDto;
  items: CalendarItemDto[];
}

/** Items proposed into each calendar (the curation queue) — full DTOs, so grids can ghost them. */
export function useProposedByCalendar(calendars: ContainerDto[]): ProposedByCalendar[] {
  const results = useQueries({
    queries: calendars.map((c) => getListProposedItemsQueryOptions(c.id)),
  });
  return calendars.map((calendar, i) => ({ calendar, items: results[i].data ?? [] }));
}
