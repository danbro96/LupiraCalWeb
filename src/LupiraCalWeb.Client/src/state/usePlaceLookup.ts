import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lookupPlaces } from '@lupira/cal-api/query/geo';
import type { PlaceDto } from '@lupira/cal-api/models';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKUP_MAX = 200; // server cap per POST /places/lookup call

/**
 * Hydrate stored geo place ids (cal items, contact addresses) into coordinates in one batched query.
 * Hand-rolled with a prefixed key (per useTaskDeadlines): the id set is the key, not a URL path.
 * A merged id maps to its survivor under the *requested* id; unknown/deleted ids are absent.
 * Not seeded into useGeoPlace's per-id cache — lookup omits containment, the detail pane needs it.
 */
export function usePlaceCoords(ids: readonly (string | null | undefined)[]): {
  places: Map<string, PlaceDto>;
  isLoading: boolean;
} {
  const distinct = useMemo(
    () => [...new Set(ids.filter((id): id is string => !!id))].sort(),
    [ids],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['/geo-api/places/lookup', distinct],
    queryFn: async ({ signal }) => {
      const chunks: string[][] = [];
      for (let i = 0; i < distinct.length; i += LOOKUP_MAX) chunks.push(distinct.slice(i, i + LOOKUP_MAX));
      const results = await Promise.all(chunks.map((ids) => lookupPlaces({ ids }, { signal })));
      return results.flat();
    },
    enabled: distinct.length > 0,
    staleTime: DAY_MS,
  });

  const places = useMemo(() => {
    const map = new Map<string, PlaceDto>();
    for (const item of data ?? []) {
      if (item.place && item.place.latitude != null && item.place.longitude != null)
        map.set(item.requestedId, item.place);
    }
    return map;
  }, [data]);

  return { places, isLoading: distinct.length > 0 && isLoading };
}
