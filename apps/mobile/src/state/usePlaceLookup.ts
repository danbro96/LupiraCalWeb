import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lookupPlaces } from '@lupira/cal-api/fetch/geo';
import type { PlaceDto } from '@lupira/cal-api/models';
import { useSyncStatus } from '../sync/syncStatus';

const LOOKUP_MAX = 200; // server cap per POST /places/lookup call

/** Hydrate stored geo place ids into coordinates in one batched query. The id set is the key, not a
 *  URL path — lookup is a POST, which orval generates as a mutation. */
export function usePlaceCoords(placeIds: (string | null | undefined)[]): Map<string, PlaceDto> {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const distinct = useMemo(() => [...new Set(placeIds.filter((id): id is string => !!id))].sort(), [placeIds]);
  const q = useQuery({
    queryKey: ['map', 'places', distinct],
    enabled: reachable && distinct.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < distinct.length; i += LOOKUP_MAX) chunks.push(distinct.slice(i, i + LOOKUP_MAX));
      const results = await Promise.all(chunks.map((ids) => lookupPlaces({ ids })));
      const map = new Map<string, PlaceDto>();
      for (const r of results) {
        if (r.status !== 200) throw new Error(`places lookup ${r.status}`);
        for (const item of r.data) {
          if (item.place && item.place.latitude != null && item.place.longitude != null)
            map.set(item.requestedId, item.place);
        }
      }
      return map;
    },
  });
  return q.data ?? new Map<string, PlaceDto>();
}
