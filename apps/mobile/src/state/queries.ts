import { useQueries, useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import type { ContactListRow, GridRow, OutboxRow } from '../data/mirror';
import { gridRowsBetween, listContacts, listContainerDocs, listParked, listPendingOps, loadContact, loadItem } from '../data/mirror';

/// Read hooks over the mirror. Invalidation contract (sync/reactivity.ts): grids per ['occurrences', monthKey];
/// item docs under ['items']; contacts (list + docs) under ['contacts']; containers under ['containers'];
/// outbox rows under ['outbox'].

const monthQuery = (monthKey: string) => ({
  queryKey: ['occurrences', monthKey] as const,
  queryFn: async () => gridRowsBetween(await getDb(), `${monthKey}-01`, `${monthKey}-31`),
});

export function useMonthOccurrences(monthKey: string) {
  return useQuery<GridRow[]>(monthQuery(monthKey));
}

/// A run of days can straddle a month boundary (grid weeks do) — one query per touched month bucket keeps
/// the monthKey invalidation contract intact.
export function useDaysOccurrences(dayKeys: string[]): { rows: GridRow[]; loading: boolean } {
  const monthKeys = [...new Set(dayKeys.map((d) => d.slice(0, 7)))];
  const results = useQueries({ queries: monthKeys.map(monthQuery) });
  const daySet = new Set(dayKeys);
  const rows = results
    .flatMap((r) => r.data ?? [])
    .filter((r) => daySet.has(r.start_day))
    .sort((a, b) => (a.start_utc < b.start_utc ? -1 : a.start_utc > b.start_utc ? 1 : 0));
  return { rows, loading: results.some((r) => r.isLoading) };
}

export function useItemState(id: string) {
  return useQuery({ queryKey: ['items', id], queryFn: async () => loadItem(await getDb(), id) });
}

export function useContactState(id: string) {
  return useQuery({ queryKey: ['contacts', id], queryFn: async () => loadContact(await getDb(), id) });
}

export function useContactList() {
  return useQuery<ContactListRow[]>({ queryKey: ['contacts', 'list'], queryFn: async () => listContacts(await getDb()) });
}

export type CalendarContainer = { id: string; displayName?: string | null; color?: string | null; access?: string };
export type AddressBookContainer = { id: string; displayName?: string | null; access?: string };

export function useCalendars() {
  return useQuery<CalendarContainer[]>({
    queryKey: ['containers', 'calendars'],
    queryFn: async () => listContainerDocs<CalendarContainer>(await getDb(), 'calendars'),
  });
}

export function useAddressBooks() {
  return useQuery<AddressBookContainer[]>({
    queryKey: ['containers', 'address_books'],
    queryFn: async () => listContainerDocs<AddressBookContainer>(await getDb(), 'address_books'),
  });
}

export function useOutboxRows() {
  return useQuery<{ parked: OutboxRow[]; pending: OutboxRow[] }>({
    queryKey: ['outbox'],
    queryFn: async () => {
      const db = await getDb();
      return { parked: await listParked(db), pending: await listPendingOps(db) };
    },
  });
}
