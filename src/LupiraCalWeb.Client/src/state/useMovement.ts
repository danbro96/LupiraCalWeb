import { keepPreviousData } from '@tanstack/react-query';
import {
  useGetLocationCurrent,
  useGetLocationTrackThinned,
  useGetLocationTrips,
  useGetLocationVisits,
} from '../data/api-location/lupiraLocationApi';

/**
 * GPS read models for the map, online-only. Query keys are collision-free with the other APIs
 * (everything lives under /location/*) — the generated hooks are safe as-is; never wrap location's
 * /me here. Windows fully before today are immutable (raw points are append-only and the visit/trip
 * rollup only reworks yesterday+today), so they cache forever.
 */
const FIVE_MIN_MS = 5 * 60 * 1000;

function staleTimeFor(to: string): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // The hourly rollup still touches yesterday — only windows ending before then are frozen.
  const frozenBefore = startOfToday.getTime() - 24 * 60 * 60 * 1000;
  return Date.parse(to) < frozenBefore ? Infinity : FIVE_MIN_MS;
}

export function useVisits(from: string, to: string, enabled: boolean) {
  return useGetLocationVisits(
    { from, to },
    { query: { enabled, staleTime: staleTimeFor(to), placeholderData: keepPreviousData } },
  );
}

export function useTrips(from: string, to: string, enabled: boolean) {
  return useGetLocationTrips(
    { from, to },
    { query: { enabled, staleTime: staleTimeFor(to), placeholderData: keepPreviousData } },
  );
}

/** One best-accuracy fix per bucket — the drawable form of a track (raw /location/track caps at 50k). */
export function useThinnedTrack(from: string, to: string, enabled: boolean, bucketSeconds = 30) {
  return useGetLocationTrackThinned(
    { from, to, bucketSeconds },
    { query: { enabled, staleTime: staleTimeFor(to), placeholderData: keepPreviousData } },
  );
}

/** Latest fix per device, polled while the movement layer is visible. */
export function useCurrentFixes(enabled: boolean) {
  return useGetLocationCurrent(undefined, {
    query: { enabled, refetchInterval: 30_000, staleTime: 15_000 },
  });
}
