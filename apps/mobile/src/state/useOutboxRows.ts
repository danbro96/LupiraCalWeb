import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { listParked, listPendingOps, type OutboxRow } from '../data/mirror';

export function useOutboxRows() {
  return useQuery<{ parked: OutboxRow[]; pending: OutboxRow[] }>({
    queryKey: ['outbox'],
    queryFn: async () => {
      const db = await getDb();
      return { parked: await listParked(db), pending: await listPendingOps(db) };
    },
  });
}
