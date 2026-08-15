import { useMemo } from 'react';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { splitTrack } from '@lupira/cal-domain/geo';
import { useSearchContacts } from '../data/api-contact/lupiraContactApi';
import { useListSavedPlaces } from '../data/api-geo/lupiraGeoApi';
import type { LocationTripDto } from '../data/api-location/models';
import { useContainers } from './useContainers';
import { useCurrentFixes, useThinnedTrack, useTrips, useVisits } from './useMovement';
import { usePlaceCoords } from './usePlaceLookup';
import { useRangeOccurrences } from './useRangeOccurrences';

/** A recording hole longer than this breaks the drawn track (tracker off, retention edge). */
const TRACK_MAX_GAP_S = 10 * 60;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

function point(lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties };
}

export interface EventFeaturesResult {
  features: FeatureCollection;
  /** Occurrences in range whose item has only a free-text label (CalDAV imports) — unmappable. */
  unmappableCount: number;
  isLoading: boolean;
}

/** Event pins: occurrences in [from, to] across all readable calendars, hydrated placeId → coords. */
export function useEventFeatures(from: string, to: string, enabled: boolean): EventFeaturesResult {
  const { calendars } = useContainers();
  const { byCalendar, isLoading } = useRangeOccurrences(enabled ? calendars : [], from, to);

  const occurrences = useMemo(
    () => byCalendar.flatMap(({ calendar, occurrences }) =>
      occurrences.map((o) => ({ occurrence: o, calendarId: calendar.id, color: calendar.color ?? null }))),
    [byCalendar],
  );

  const { places, isLoading: hydrating } = usePlaceCoords(
    useMemo(() => occurrences.map(({ occurrence }) => occurrence.placeId), [occurrences]),
  );

  return useMemo(() => {
    const features: Feature<Point>[] = [];
    let unmappable = 0;
    const seen = new Set<string>(); // one pin per (item, place) — recurring items repeat occurrences
    for (const { occurrence, calendarId, color } of occurrences) {
      const place = occurrence.placeId ? places.get(occurrence.placeId) : undefined;
      if (!place) {
        if (!occurrence.placeId && occurrence.locationLabel) unmappable++;
        continue;
      }
      const key = `${occurrence.id}:${place.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push(point(place.longitude!, place.latitude!, {
        layer: 'event',
        itemId: occurrence.id,
        title: occurrence.title ?? place.name,
        start: occurrence.start,
        calendarId,
        color,
        placeId: place.id,
        placeName: place.name,
      }));
    }
    return {
      features: { type: 'FeatureCollection', features } satisfies FeatureCollection,
      unmappableCount: unmappable,
      isLoading: enabled && (isLoading || hydrating),
    };
  }, [occurrences, places, isLoading, hydrating, enabled]);
}

/** Contact pins: every address placeId hydrated; co-located contacts (shared household place) merge into one pin. */
export function useContactFeatures(enabled: boolean): { features: FeatureCollection; isLoading: boolean } {
  const contactsQ = useSearchContacts({}, { query: { enabled } });
  const contacts = useMemo(() => contactsQ.data ?? [], [contactsQ.data]);

  const { places, isLoading: hydrating } = usePlaceCoords(
    useMemo(() => contacts.flatMap((c) => c.addresses.map((a) => a.placeId)), [contacts]),
  );

  return useMemo(() => {
    const byPlace = new Map<string, { names: string[]; contactIds: string[]; types: string[] }>();
    for (const contact of contacts) {
      for (const address of contact.addresses) {
        if (!address.placeId || !places.has(address.placeId)) continue;
        const entry = byPlace.get(address.placeId) ?? { names: [], contactIds: [], types: [] };
        entry.names.push(contact.displayName);
        entry.contactIds.push(contact.id);
        entry.types.push(String(address.type));
        byPlace.set(address.placeId, entry);
      }
    }
    const features = [...byPlace.entries()].map(([placeId, entry]) => {
      const place = places.get(placeId)!;
      return point(place.longitude!, place.latitude!, {
        layer: 'contact',
        placeId,
        placeName: place.name,
        names: entry.names,
        contactIds: entry.contactIds,
        addressTypes: entry.types,
      });
    });
    return {
      features: { type: 'FeatureCollection', features } satisfies FeatureCollection,
      isLoading: enabled && (contactsQ.isLoading || hydrating),
    };
  }, [contacts, places, contactsQ.isLoading, hydrating, enabled]);
}

export interface MovementFeaturesResult {
  visits: FeatureCollection;
  track: FeatureCollection;
  current: FeatureCollection;
  trips: LocationTripDto[];
  isLoading: boolean;
}

/** Movement layer: visit dwell-circles, activity-segmented track lines, and the live position dot. */
export function useMovementFeatures(from: string, to: string, enabled: boolean): MovementFeaturesResult {
  const visitsQ = useVisits(from, to, enabled);
  const tripsQ = useTrips(from, to, enabled);
  const trackQ = useThinnedTrack(from, to, enabled);
  const currentQ = useCurrentFixes(enabled);

  return useMemo(() => {
    const visits: FeatureCollection = {
      type: 'FeatureCollection',
      features: (visitsQ.data ?? []).map((v) =>
        point(v.lon, v.lat, {
          layer: 'visit',
          visitId: v.id,
          placeLabel: v.placeLabel ?? null,
          arriveTs: v.arriveTs,
          departTs: v.departTs,
          durationMin: Math.max(1, Math.round((Date.parse(v.departTs) - Date.parse(v.arriveTs)) / 60_000)),
          radiusM: v.radiusM,
        })),
    };

    const segments = splitTrack(
      (trackQ.data ?? []).map((p) => ({ lat: p.lat, lon: p.lon, ts: p.ts, activity: p.activity ?? null })),
      TRACK_MAX_GAP_S,
    ).filter((s) => s.length >= 2);
    const track: FeatureCollection = {
      type: 'FeatureCollection',
      features: segments.map((segment): Feature<LineString> => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segment.map((p) => [p.lon, p.lat]) },
        properties: { layer: 'track', activity: segment[0].activity ?? 'Unknown' },
      })),
    };

    const current: FeatureCollection = {
      type: 'FeatureCollection',
      features: (currentQ.data ?? []).map((fix) =>
        point(fix.lon, fix.lat, {
          layer: 'current',
          deviceId: fix.deviceId,
          ts: fix.ts,
          batteryPct: fix.batteryPct ?? null,
        })),
    };

    return {
      visits,
      track,
      current,
      trips: tripsQ.data ?? [],
      isLoading: enabled && (visitsQ.isLoading || trackQ.isLoading || tripsQ.isLoading),
    };
  }, [visitsQ.data, visitsQ.isLoading, tripsQ.data, tripsQ.isLoading, trackQ.data, trackQ.isLoading, currentQ.data, enabled]);
}

/** Saved-place pins (favorites first is the API's order; either a gazetteer link or a raw pin). */
export function useSavedPlaceFeatures(enabled: boolean): { features: FeatureCollection; isLoading: boolean } {
  const savedQ = useListSavedPlaces({ query: { enabled } });

  return useMemo(() => {
    const features = (savedQ.data ?? [])
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) =>
        point(s.longitude!, s.latitude!, {
          layer: 'saved',
          savedPlaceId: s.id,
          placeId: s.placeId ?? null,
          label: s.label,
          icon: s.icon ?? null,
          isFavorite: s.isFavorite,
        }));
    return {
      features: { type: 'FeatureCollection', features } satisfies FeatureCollection,
      isLoading: enabled && savedQ.isLoading,
    };
  }, [savedQ.data, savedQ.isLoading, enabled]);
}

export { EMPTY as EMPTY_FEATURES };
