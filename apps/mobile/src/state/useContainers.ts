import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { listContainerDocs } from '../data/mirror';

/** Container docs from the mirror, keyed ['containers', kind]. */

export type CalendarContainer = {
  id: string;
  displayName?: string | null;
  color?: string | null;
  access?: string;
  class?: string | null;
  kind?: string | null;
};

/** Calendars a user may deliberately put items into: never System-class scaffolding, never the
 *  synthesized Birthdays calendar (the API 400s on it), never Availability (its entries go through
 *  the dedicated quick-add, not the event editor). */
export function selectableCalendars(calendars: CalendarContainer[] | undefined): CalendarContainer[] {
  return (calendars ?? []).filter((c) => c.class !== 'System' && c.kind !== 'Birthdays' && c.kind !== 'Availability');
}

export function useCalendars() {
  return useQuery<CalendarContainer[]>({
    queryKey: ['containers', 'calendars'],
    queryFn: async () => listContainerDocs<CalendarContainer>(await getDb(), 'calendars'),
  });
}
