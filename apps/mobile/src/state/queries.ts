import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { occurrencesBetween, type OccurrenceQueryRow } from '../data/mirror';

/// Grid read path: one indexed range query per month, invalidated per-monthKey by the sync engine
/// (sync/reactivity.ts). M5's grids consume this.
export function useMonthOccurrences(monthKey: string) {
  return useQuery<OccurrenceQueryRow[]>({
    queryKey: ['occurrences', monthKey],
    queryFn: async () => occurrencesBetween(await getDb(), `${monthKey}-01`, `${monthKey}-31`),
  });
}
