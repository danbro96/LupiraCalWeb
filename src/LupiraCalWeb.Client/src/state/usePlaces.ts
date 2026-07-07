import { useMemo } from 'react';
import { useGetPlaces } from '../data/api/lupiraCalApi';
import type { PlaceDto } from '../data/api/models';

/** Batch-resolve place ids → PlaceDto (place ids are opaque GUIDs everywhere else in the API). */
export function usePlaces(ids: Array<string | null | undefined>): Map<string, PlaceDto> {
  const unique = useMemo(() => [...new Set(ids.filter((id): id is string => !!id))].sort(), [ids]);
  const query = useGetPlaces({ ids: unique }, { query: { enabled: unique.length > 0 } });
  return useMemo(() => new Map((query.data ?? []).map((p) => [p.id, p])), [query.data]);
}
