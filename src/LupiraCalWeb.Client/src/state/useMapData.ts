import { useMemo } from 'react';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { fmtFuzzyDate, fmtResidencyPeriod, residencyStatus } from '@lupira/cal-domain/fuzzyDate';
import { splitTrack } from '@lupira/cal-domain/geo';
import { useSearchContacts } from '@lupira/cal-api/query/contact';
import { useListSavedPlaces } from '@lupira/cal-api/query/geo';
import { useGetPhotoMap } from '@lupira/cal-api/query/photo';
import type { LocationTripDto } from '@lupira/cal-api/models';
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

/** "Astrid Park, Erik Park · Home" — households share a pin; the kind list dedupes (usually to one). */
export function contactPinLabel(names: readonly string[], types: readonly string[]): string {
  const shown = names.length > 3 ? [...names.slice(0, 2), `+${names.length - 2}`] : [...names];
  const kinds = [...new Set(types)];
  return `${shown.join(', ')} · ${kinds.join('/')}`;
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

/** Contact pins: every address placeId hydrated; co-located contacts (shared household place) merge into one pin.
 * `features` = current addresses; `former` = residency history (movedOut set), labeled with the period. */
export function useContactFeatures(enabled: boolean): {
  features: FeatureCollection;
  former: FeatureCollection;
  isLoading: boolean;
} {
  const contactsQ = useSearchContacts({}, { query: { enabled } });
  const contacts = useMemo(() => contactsQ.data ?? [], [contactsQ.data]);

  // One hydration serves both current and former pins.
  const { places, isLoading: hydrating } = usePlaceCoords(
    useMemo(() => contacts.flatMap((c) => c.addresses.map((a) => a.placeId)), [contacts]),
  );

  return useMemo(() => {
    interface Entry { status: string; names: string[]; contactIds: string[]; types: string[]; periods: string[] }
    // Active pins group per place; former/future group per (place, status) so a pin carries one status.
    const group = (wantActive: boolean) => {
      const byKey = new Map<string, { placeId: string } & Entry>();
      for (const contact of contacts) {
        for (const address of contact.addresses) {
          const status = residencyStatus(address.movedIn, address.movedOut);
          if ((status === 'active') !== wantActive) continue;
          if (!address.placeId || !places.has(address.placeId)) continue;
          const key = wantActive ? address.placeId : `${address.placeId}|${status}`;
          const entry = byKey.get(key) ?? { placeId: address.placeId, status, names: [], contactIds: [], types: [], periods: [] };
          entry.names.push(contact.displayName);
          entry.contactIds.push(contact.id);
          entry.types.push(String(address.type));
          entry.periods.push(status === 'future'
            ? `from ${fmtFuzzyDate(address.movedIn!)}`
            : fmtResidencyPeriod(address.movedIn, address.movedOut));
          byKey.set(key, entry);
        }
      }
      return byKey;
    };

    const toFeatures = (byKey: Map<string, { placeId: string } & Entry>, layer: 'contact' | 'contact-former') =>
      [...byKey.values()].map((entry) => {
        const place = places.get(entry.placeId)!;
        const periods = [...new Set(entry.periods)];
        return point(place.longitude!, place.latitude!, {
          layer,
          status: entry.status,
          placeId: entry.placeId,
          placeName: place.name,
          names: entry.names,
          contactIds: entry.contactIds,
          addressTypes: entry.types,
          periods: entry.periods,
          label: layer === 'contact'
            ? contactPinLabel(entry.names, entry.types)
            : `${contactPinLabel(entry.names, entry.types)} · ${periods.join(', ')}`,
        });
      });

    return {
      features: { type: 'FeatureCollection', features: toFeatures(group(true), 'contact') } satisfies FeatureCollection,
      former: { type: 'FeatureCollection', features: toFeatures(group(false), 'contact-former') } satisfies FeatureCollection,
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

/** Geotagged photo/video pins in the current viewport. Bbox-scoped (the endpoint caps its result set),
 *  so panning refetches instead of holding the whole library; thumbnail URLs are presigned. */
export function usePhotoFeatures(bbox: string | null, enabled: boolean): { features: FeatureCollection; isLoading: boolean } {
  const photosQ = useGetPhotoMap({ bbox: bbox ?? '' }, { query: { enabled: enabled && bbox !== null } });

  return useMemo(() => {
    const features = (photosQ.data?.features ?? []).map((f) =>
      point(f.geometry.coordinates[0], f.geometry.coordinates[1], {
        layer: 'photo',
        photoId: f.properties.id,
        kind: f.properties.kind,
        takenAt: f.properties.takenAt,
        placeLabel: f.properties.placeLabel ?? null,
        thumbUrl: f.properties.thumbUrl ?? null,
      }));
    return {
      features: { type: 'FeatureCollection', features } satisfies FeatureCollection,
      isLoading: enabled && photosQ.isLoading,
    };
  }, [photosQ.data, photosQ.isLoading, enabled]);
}

export { EMPTY as EMPTY_FEATURES };
