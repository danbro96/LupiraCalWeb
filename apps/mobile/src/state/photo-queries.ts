import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { searchItems } from '@lupira/cal-api/fetch/cal';
import { listRelationEdges } from '@lupira/cal-api/fetch/cal';
import { getDb } from '../data/db/expoDb';
import { loadItem } from '../data/mirror';
import { getPhoto, getPhotoStats, listPhotos, lookupPhotos } from '@lupira/cal-api/fetch/photo';
import type { AssetKind, AssetStatus, PhotoListItemDto, PhotoSort } from '@lupira/cal-api/models';
import { groupByDay as groupDays, photoEventLinks } from '@lupira/cal-domain/photoFormat';
import { useSyncStatus } from '../sync/syncStatus';

/** The gallery's read model. Photos are network-only — the SQLite mirror covers cal and contacts only —
 *  so every hook here gates on `serverReachable` and overrides the mirror-tuned query defaults
 *  (staleTime Infinity / retry false), exactly like useTaskDeadlines. Keys live under their own
 *  ['photos'] root, outside every sync-invalidation prefix. */

export const PHOTO_PAGE_SIZE = 90;

/** Comfortably inside the 24 h presigned-thumbnail expiry; a longer cache would serve dead URLs. */
const THUMB_SAFE_STALE_MS = 15 * 60_000;

export type PhotoQueryFilters = {
  sort: PhotoSort;
  kind?: AssetKind;
  status?: AssetStatus;
  located?: boolean;
  place?: string;
};

export const DEFAULT_PHOTO_FILTERS: PhotoQueryFilters = { sort: 'TakenAtDesc' };

export function usePhotoLibrary(filters: PhotoQueryFilters) {
  const reachable = useSyncStatus((s) => s.serverReachable);

  const query = useInfiniteQuery({
    queryKey: ['photos', 'list', filters],
    enabled: reachable,
    staleTime: THUMB_SAFE_STALE_MS,
    retry: 1,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const r = await listPhotos({ ...filters, limit: PHOTO_PAGE_SIZE, cursor: pageParam });
      if (r.status !== 200) throw new Error(`photos ${r.status}`);
      return r.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  return {
    items,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

export function usePhoto(photoId: string) {
  const reachable = useSyncStatus((s) => s.serverReachable);
  return useQuery({
    queryKey: ['photos', 'detail', photoId],
    enabled: reachable,
    staleTime: THUMB_SAFE_STALE_MS,
    retry: 1,
    queryFn: async () => {
      const r = await getPhoto(photoId);
      if (r.status !== 200) throw new Error(`photo ${r.status}`);
      return r.data;
    },
  });
}

/** Library totals — powers the upload-health chip without paging the whole library to count. */
export function usePhotoStats() {
  const reachable = useSyncStatus((s) => s.serverReachable);
  return useQuery({
    queryKey: ['photos', 'stats'],
    enabled: reachable,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const r = await getPhotoStats();
      if (r.status !== 200) throw new Error(`photo stats ${r.status}`);
      return r.data;
    },
  });
}

/** Every photo↔event edge the caller can see, in one call rather than a request per tile. */
function usePhotoEventEdges() {
  const reachable = useSyncStatus((s) => s.serverReachable);
  return useQuery({
    queryKey: ['photos', 'event-links'],
    enabled: reachable,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const r = await listRelationEdges({ toKind: 'photo' });
      if (r.status !== 200) throw new Error(`relation edges ${r.status}`);
      return r.data;
    },
  });
}

/** photoId → linked calendar item ids. */
export function usePhotoEventLinks(): Map<string, string[]> {
  const query = usePhotoEventEdges();
  return useMemo(() => photoEventLinks(query.data ?? []), [query.data]);
}

/** The photos linked to one calendar item, hydrated in a single batch lookup. */
export function useEventPhotos(itemId: string): PhotoListItemDto[] {
  const reachable = useSyncStatus((s) => s.serverReachable);
  const edges = usePhotoEventEdges();
  const ids = useMemo(
    () => (edges.data ?? []).filter((e) => e.fromId === itemId).map((e) => e.toRef),
    [edges.data, itemId],
  );

  const query = useQuery({
    queryKey: ['photos', 'lookup', ids],
    enabled: reachable && ids.length > 0,
    staleTime: THUMB_SAFE_STALE_MS,
    retry: 1,
    queryFn: async () => {
      const r = await lookupPhotos({ ids });
      if (r.status !== 200) throw new Error(`photo lookup ${r.status}`);
      return r.data.items;
    },
  });

  return query.data ?? [];
}

export type LinkedEvent = { id: string; title: string };

/** Titles for a photo's linked events, read from the mirror so they survive offline. Keys stay on the
 *  ['items', id] contract sync already invalidates. */
export function useLinkedEvents(itemIds: string[]): LinkedEvent[] {
  const results = useQueries({
    queries: itemIds.map((id) => ({
      queryKey: ['items', id] as const,
      queryFn: async () => loadItem(await getDb(), id),
    })),
  });

  return itemIds.map((id, i) => ({ id, title: results[i]?.data?.doc.title ?? 'Untitled event' }));
}

/** Events overlapping a capture time — offered as link candidates, never linked automatically: a photo
 *  taken during a 9-to-5 "work" block is not of it. */
export function useLinkCandidates(takenAt: string, enabled: boolean) {
  const reachable = useSyncStatus((s) => s.serverReachable);
  return useQuery({
    queryKey: ['photos', 'link-candidates', takenAt],
    enabled: enabled && reachable,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const t = new Date(takenAt).getTime();
      const r = await searchItems({
        from: new Date(t - 3600_000).toISOString(),
        to: new Date(t + 3600_000).toISOString(),
        take: 25,
      });
      if (r.status !== 200) throw new Error(`item search ${r.status}`);
      return r.data;
    },
  });
}

export type PhotoDay = { key: string; label: string; data: PhotoListItemDto[] };

/** SectionList wants the rows under `data`, so the shared groups are re-keyed on the way out. */
export function groupByDay(items: PhotoListItemDto[]): PhotoDay[] {
  return groupDays(items, (date) => date.toLocaleDateString(undefined, { dateStyle: 'medium' }))
    .map(({ key, label, items: rows }) => ({ key, label, data: rows }));
}
