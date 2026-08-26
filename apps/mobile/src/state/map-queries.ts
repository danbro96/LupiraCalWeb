import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { getDb } from '../data/db/expoDb';
import { lookupPlaces } from '../data/api/generated/geo/places/places';
import { listSavedPlaces } from '../data/api/generated/geo/saved-places/saved-places';
import { getPhotoMap } from '../data/api/generated/photo/photos/photos';
import type { PlaceDto } from '../data/api/generated/geo/models';
import { loadMapStyle, type BasemapStyle, type MapTheme } from '../data/mapStyle';
import { mapEventRowsBetween } from '../data/mirror';
import { useCalendars } from './queries';
import { useSyncStatus } from '../sync/syncStatus';

/** Map read hooks. Mirror-backed queries key under ['occurrences', ...] so sync pulls invalidate them;
 *  network-backed ones override the mirror-tuned defaults (staleTime Infinity / retry false) exactly like
 *  useTaskDeadlines — offline the map simply lacks those layers, never an error surface. */

const LOOKUP_MAX = 200; // server cap per POST /places/lookup call

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function point(lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties };
}

export function useMapStyle(theme: MapTheme): { style: BasemapStyle | undefined; degraded: boolean } {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const q = useQuery<BasemapStyle>({
    queryKey: ['map', 'style', theme],
    enabled: reachable,
    staleTime: 60 * 60_000,
    retry: 1,
    queryFn: () => loadMapStyle(theme),
  });
  return { style: q.data, degraded: q.isError };
}

function usePlaceCoords(placeIds: (string | null | undefined)[]): Map<string, PlaceDto> {
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

/** Event pins: placed items with an occurrence in [fromDay, toDay], hydrated placeId → coords. */
export function useEventFeatures(fromDay: string, toDay: string, enabled: boolean): FeatureCollection {
  const rowsQ = useQuery({
    queryKey: ['occurrences', 'map', fromDay, toDay],
    enabled,
    queryFn: async () => mapEventRowsBetween(await getDb(), fromDay, toDay),
  });
  const rows = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const calendarsQ = useCalendars();
  const places = usePlaceCoords(useMemo(() => rows.map((r) => r.place_id), [rows]));

  return useMemo(() => {
    if (!enabled) return EMPTY;
    const colorByCalendar = new Map((calendarsQ.data ?? []).map((c) => [c.id, c.color ?? null]));
    const features: Feature<Point>[] = [];
    for (const row of rows) {
      const place = places.get(row.place_id);
      if (!place) continue;
      features.push(point(place.longitude!, place.latitude!, {
        layer: 'event',
        itemId: row.source_id,
        title: row.title ?? place.name,
        start: row.start_utc,
        color: (row.calendar_id ? colorByCalendar.get(row.calendar_id) : null) ?? null,
        placeName: place.name,
      }));
    }
    return { type: 'FeatureCollection', features } satisfies FeatureCollection;
  }, [enabled, rows, places, calendarsQ.data]);
}

/** Geotagged photo pins in the viewport. Bbox-scoped and server-capped, so panning refetches rather
 *  than holding the whole library; thumbnails are presigned URLs valid for hours. */
export function usePhotoFeatures(bbox: string | null, enabled: boolean): FeatureCollection {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const q = useQuery({
    queryKey: ['map', 'photos', bbox],
    enabled: enabled && reachable && bbox !== null,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const r = await getPhotoMap({ bbox: bbox! });
      if (r.status !== 200) throw new Error(`photos map ${r.status}`);
      return r.data;
    },
  });

  return useMemo(() => {
    if (!enabled) return EMPTY;
    const features = (q.data?.features ?? []).map((f) => point(f.geometry.coordinates[0], f.geometry.coordinates[1], {
      layer: 'photo',
      photoId: f.properties.id,
      kind: f.properties.kind,
      takenAt: f.properties.takenAt,
      placeLabel: f.properties.placeLabel ?? null,
      thumbUrl: f.properties.thumbUrl ?? null,
    }));
    return { type: 'FeatureCollection', features } satisfies FeatureCollection;
  }, [enabled, q.data]);
}

/** Saved-place pins (favorites first is the API's order; gazetteer link or raw pin). */
export function useSavedPlaceFeatures(enabled: boolean): FeatureCollection {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const q = useQuery({
    queryKey: ['map', 'saved-places'],
    enabled: enabled && reachable,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const r = await listSavedPlaces();
      if (r.status !== 200) throw new Error(`saved places ${r.status}`);
      return r.data;
    },
  });

  return useMemo(() => {
    if (!enabled) return EMPTY;
    const features = (q.data ?? [])
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => point(s.longitude!, s.latitude!, {
        layer: 'saved',
        savedPlaceId: s.id,
        label: s.label,
        isFavorite: s.isFavorite,
      }));
    return { type: 'FeatureCollection', features } satisfies FeatureCollection;
  }, [enabled, q.data]);
}
