import { useMemo } from 'react';
import { useGetPlaceItems, useGetPlaces } from '../data/api/lupiraCalApi';
import type { GetPlacesParams, PlaceDto, PlaceKind } from '../data/api/models';

/** Batch-resolve place ids → PlaceDto (place ids are opaque GUIDs everywhere else in the API). */
export function usePlaces(ids: Array<string | null | undefined>): Map<string, PlaceDto> {
  const unique = useMemo(() => [...new Set(ids.filter((id): id is string => !!id))].sort(), [ids]);
  const query = useGetPlaces({ ids: unique }, { query: { enabled: unique.length > 0 } });
  return useMemo(() => new Map((query.data ?? []).map((p) => [p.id, p])), [query.data]);
}

/** Browse/search the shared catalog by name/kind/parent. Empty filters list the whole catalog (server-capped). */
export function useSearchPlaces(filters: { search?: string; kind?: PlaceKind | ''; parentPlaceId?: string }) {
  const params: GetPlacesParams = {
    search: filters.search?.trim() || undefined,
    kind: filters.kind || undefined,
    parentPlaceId: filters.parentPlaceId || undefined,
  };
  return useGetPlaces(params);
}

/** Calendar items anchored to a place (its location, or a travel/car endpoint). */
export function usePlaceItems(placeId: string | undefined) {
  return useGetPlaceItems(placeId ?? '', { query: { enabled: !!placeId } });
}
