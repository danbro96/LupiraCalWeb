import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FeatureCollection } from 'geojson';
import { getDb } from '../data/db/expoDb';
import { lookupPlaces } from '@lupira/cal-api/fetch/geo';
import { listSavedPlaces } from '@lupira/cal-api/fetch/geo';
import { getPhotoMap } from '@lupira/cal-api/fetch/photo';
import { getCurrentLocation, getThinnedTrack, listVisits } from '@lupira/cal-api/fetch/location';
import type { PlaceDto } from '@lupira/cal-api/models';
import { loadMapStyle, type BasemapStyle, type MapTheme } from '../data/mapStyle';
import { mapContactAddresses, mapEventRowsBetween } from '../data/mirror';
import type { FuzzyDate } from '@lupira/cal-domain/fuzzyDate';
import {
  EMPTY_FEATURES,
  contactFeatures,
  currentFixFeatures,
  eventFeatures,
  photoFeatures,
  savedPlaceFeatures,
  trackFeatures,
  visitFeatures,
} from '@lupira/cal-domain/mapFeatures';
import { useCalendars } from './queries';
import { useSyncStatus } from '../sync/syncStatus';

/** Map read hooks. Mirror-backed queries key under ['occurrences', ...] so sync pulls invalidate them;
 *  network-backed ones override the mirror-tuned defaults (staleTime Infinity / retry false) exactly like
 *  useTaskDeadlines — offline the map simply lacks those layers, never an error surface. */

const LOOKUP_MAX = 200; // server cap per POST /places/lookup call

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
    if (!enabled) return EMPTY_FEATURES;
    const colorByCalendar = new Map((calendarsQ.data ?? []).map((c) => [c.id, c.color ?? null]));
    return eventFeatures(
      rows.map((row) => ({
        itemId: row.source_id,
        title: row.title,
        start: row.start_utc,
        calendarId: row.calendar_id,
        color: (row.calendar_id ? colorByCalendar.get(row.calendar_id) : null) ?? null,
        placeId: row.place_id,
      })),
      places,
    ).features;
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

  return useMemo(
    () => (enabled ? photoFeatures(q.data?.features ?? []) : EMPTY_FEATURES),
    [enabled, q.data],
  );
}

/** A recording hole longer than this breaks the drawn track (tracker off, retention edge). */
const TRACK_MAX_GAP_S = 10 * 60;

/** Raw GPS is append-only and the server's rollup only reworks yesterday and today, so a window that
 *  ended before yesterday can never change — cache it forever instead of re-fetching on every pan. */
function staleTimeFor(toIso: string): number {
  const yesterdayMidnight = new Date();
  yesterdayMidnight.setHours(0, 0, 0, 0);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
  return Date.parse(toIso) < yesterdayMidnight.getTime() ? Infinity : 5 * 60_000;
}

export type MovementFeatures = { visits: FeatureCollection; track: FeatureCollection; current: FeatureCollection };

const EMPTY_MOVEMENT: MovementFeatures = { visits: EMPTY_FEATURES, track: EMPTY_FEATURES, current: EMPTY_FEATURES };

/** Where you've been: dwell circles, an activity-coloured track, and the last fix each device reported.
 *  Empty until something uploads — this app's own recorder is the only producer. */
export function useMovementFeatures(fromIso: string, toIso: string, enabled: boolean): MovementFeatures {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const on = enabled && reachable;
  const staleTime = staleTimeFor(toIso);

  const visitsQ = useQuery({
    queryKey: ['map', 'visits', fromIso, toIso],
    enabled: on,
    staleTime,
    retry: 1,
    queryFn: async () => {
      const r = await listVisits({ from: fromIso, to: toIso });
      if (r.status !== 200) throw new Error(`visits ${r.status}`);
      return r.data;
    },
  });

  const trackQ = useQuery({
    queryKey: ['map', 'track', fromIso, toIso],
    enabled: on,
    staleTime,
    retry: 1,
    queryFn: async () => {
      // Raw /location/track caps at 50k points; the thinned form is one best fix per bucket.
      const r = await getThinnedTrack({ from: fromIso, to: toIso, bucketSeconds: 30 });
      if (r.status !== 200) throw new Error(`track ${r.status}`);
      return r.data;
    },
  });

  const currentQ = useQuery({
    queryKey: ['map', 'current'],
    enabled: on,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      const r = await getCurrentLocation();
      if (r.status !== 200) throw new Error(`current ${r.status}`);
      return r.data;
    },
  });

  return useMemo(() => {
    if (!enabled) return EMPTY_MOVEMENT;
    return {
      visits: visitFeatures(visitsQ.data ?? []),
      track: trackFeatures(
        (trackQ.data ?? []).map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts, activity: p.activity ?? null })),
        TRACK_MAX_GAP_S,
      ),
      current: currentFixFeatures(currentQ.data ?? []),
    };
  }, [enabled, visitsQ.data, trackQ.data, currentQ.data]);
}

/** Contact pins from the local mirror — co-located contacts (a household) merge into one pin.
 *  Current addresses only; residency history is a web-only nicety not worth the phone screen. */
export function useContactFeatures(enabled: boolean): FeatureCollection {
  const rowsQ = useQuery({
    queryKey: ['contacts', 'map'],
    enabled,
    queryFn: async () => mapContactAddresses(await getDb()),
  });
  const rows = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);
  const places = usePlaceCoords(useMemo(() => rows.map((r) => r.place_id), [rows]));

  return useMemo(() => {
    if (!enabled) return EMPTY_FEATURES;
    const parse = (raw: string | null): FuzzyDate | null => (raw ? (JSON.parse(raw) as FuzzyDate) : null);
    return contactFeatures(
      rows.map((row) => ({
        contactId: row.contact_id,
        displayName: row.display_name,
        placeId: row.place_id,
        addressType: row.address_type,
        movedIn: parse(row.moved_in),
        movedOut: parse(row.moved_out),
      })),
      places,
    ).features;
  }, [enabled, rows, places]);
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

  return useMemo(
    () => (enabled ? savedPlaceFeatures(q.data ?? []) : EMPTY_FEATURES),
    [enabled, q.data],
  );
}
