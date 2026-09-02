import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { loadItem } from '../data/mirror';

/** One item's mirror doc, keyed ['items', id] — the contract sync/reactivity.ts invalidates. */
export function useItemState(id: string) {
  return useQuery({ queryKey: ['items', id], queryFn: async () => loadItem(await getDb(), id) });
}
