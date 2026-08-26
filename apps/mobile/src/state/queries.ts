import { useQueries, useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { usePrefs } from './prefs-store';
import type { ContactListRow, GridRow, OutboxRow } from '../data/mirror';
import { gridRowsBetween, listContacts, listContainerDocs, listParked, listPendingOps, loadContact, loadItem } from '../data/mirror';
import { listItems } from '../data/api/generated/tasks/items/items';
import { monthUtcRange, taskDeadlineRows, type TaskDeadlineRow } from '../domain/taskRows';
import { useSyncStatus } from '../sync/syncStatus';

/// Read hooks over the mirror. Invalidation contract (sync/reactivity.ts): grids per ['occurrences', monthKey];
/// item docs under ['items']; contacts (list + docs) under ['contacts']; containers under ['containers'];
/// outbox rows under ['outbox'].

const monthQuery = (monthKey: string, includeSystem: boolean) => ({
  // includeSystem rides the key AFTER the monthKey so per-month invalidation (prefix match) still works.
  queryKey: ['occurrences', monthKey, includeSystem] as const,
  queryFn: async () => gridRowsBetween(await getDb(), `${monthKey}-01`, `${monthKey}-31`, includeSystem),
});

export function useMonthOccurrences(monthKey: string) {
  const includeSystem = usePrefs((p) => p.showSystemCalendars);
  return useQuery<GridRow[]>(monthQuery(monthKey, includeSystem));
}

/// A run of days can straddle a month boundary (grid weeks do) — one query per touched month bucket keeps
/// the monthKey invalidation contract intact.
export function useDaysOccurrences(dayKeys: string[]): { rows: GridRow[]; loading: boolean } {
  const includeSystem = usePrefs((p) => p.showSystemCalendars);
  const monthKeys = [...new Set(dayKeys.map((d) => d.slice(0, 7)))];
  const results = useQueries({ queries: monthKeys.map((k) => monthQuery(k, includeSystem)) });
  const daySet = new Set(dayKeys);
  const rows = results
    .flatMap((r) => r.data ?? [])
    .filter((r) => daySet.has(r.start_day))
    .sort((a, b) => (a.start_utc < b.start_utc ? -1 : a.start_utc > b.start_utc ? 1 : 0));
  return { rows, loading: results.some((r) => r.isLoading) };
}

/// The grids' union row type: mirror rows plus the online-only task-deadline source.
export type CalRow = GridRow | TaskDeadlineRow;

/// Task deadlines for the visible days — the only network-backed grid query. Keyed ['tasks', monthKey]:
/// outside every sync-invalidation prefix (['items']/['occurrences'] are blanket-nuked by pulls). The
/// pref rides `enabled`, not the key (off means "don't fetch", not "different result set"). staleTime and
/// retry MUST override the mirror-tuned defaults (Infinity/false) or deadlines freeze forever. Offline or
/// toggled off the queries idle and grids simply lack deadlines — never an error surface, never a loading
/// gate on grid paint. serverReachable flipping back on is the de-facto reconnect refetch trigger
/// (onlineManager isn't wired to NetInfo in this app).
export function useTaskDeadlines(dayKeys: string[]): TaskDeadlineRow[] {
  const showTasks = usePrefs((p) => p.showTaskDeadlines);
  const reachable = useSyncStatus((s) => s.serverReachable);
  const monthKeys = [...new Set(dayKeys.map((d) => d.slice(0, 7)))];
  const results = useQueries({
    queries: monthKeys.map((monthKey) => ({
      queryKey: ['tasks', monthKey] as const,
      enabled: showTasks && reachable,
      staleTime: 60_000,
      retry: 1,
      queryFn: async () => {
        const r = await listItems({ ...monthUtcRange(monthKey), completed: false });
        if (r.status !== 200) throw new Error(`tasks fetch ${r.status}`);
        return taskDeadlineRows(r.data.items, new Date());
      },
    })),
  });
  const daySet = new Set(dayKeys);
  return results.flatMap((r) => r.data ?? []).filter((r) => daySet.has(r.start_day));
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

export type CalendarContainer = {
  id: string;
  displayName?: string | null;
  color?: string | null;
  access?: string;
  class?: string | null;
  kind?: string | null;
};

/// Calendars a user may deliberately put items into: never System-class scaffolding, never the
/// synthesized Birthdays calendar (the API 400s on it), never Availability (its entries go through
/// the dedicated quick-add, not the event editor).
export function selectableCalendars(calendars: CalendarContainer[] | undefined): CalendarContainer[] {
  return (calendars ?? []).filter((c) => c.class !== 'System' && c.kind !== 'Birthdays' && c.kind !== 'Availability');
}
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
