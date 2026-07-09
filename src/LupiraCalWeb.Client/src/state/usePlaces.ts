import { useGetItemsByPlace } from '../data/api/lupiraCalApi';
import { useGetPlace, useSearchPlaces as useSearchGeoPlaces } from '../data/api-geo/lupiraGeoApi';
import type { SearchPlacesParams } from '../data/api-geo/models';

/** Browse/search the LupiraGeoApi gazetteer (text `q`, category, spatial `near`/`bbox`). */
export function useSearchPlaces(params: SearchPlacesParams) {
  return useSearchGeoPlaces(params);
}

/** A single gazetteer place with its containment chain (outermost→innermost). */
export function useGeoPlace(placeId: string | undefined) {
  return useGetPlace(placeId ?? '', { query: { enabled: !!placeId } });
}

/** Calendar items anchored to a geo place (its location, or a travel endpoint). */
export function usePlaceItems(placeId: string | undefined) {
  return useGetItemsByPlace(placeId ?? '', { query: { enabled: !!placeId } });
}
