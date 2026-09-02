import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getPhoto, getPhotoStats, listPhotos } from '@lupira/cal-api/fetch/photo';
import type { AssetKind, AssetStatus, PhotoListItemDto, PhotoSort } from '@lupira/cal-api/models';
import { groupByDay as groupDays } from '@lupira/cal-domain/photoFormat';
import { useSyncStatus } from '../sync/syncStatus';

/** The gallery's read model. Photos are network-only — the SQLite mirror covers cal and contacts only —
 *  so every hook here gates on `serverReachable` and overrides the mirror-tuned query defaults
 *  (staleTime Infinity / retry false), exactly like useTaskDeadlines. Keys live under their own
 *  ['photos'] root, outside every sync-invalidation prefix. */

export const PHOTO_PAGE_SIZE = 90;

/** Comfortably inside the 24 h presigned-thumbnail expiry; a longer cache would serve dead URLs. */
export const THUMB_SAFE_STALE_MS = 15 * 60_000;

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

export type PhotoDay = { key: string; label: string; data: PhotoListItemDto[] };

/** SectionList wants the rows under `data`, so the shared groups are re-keyed on the way out. */
export function groupByDay(items: PhotoListItemDto[]): PhotoDay[] {
  return groupDays(items, (date) => date.toLocaleDateString(undefined, { dateStyle: 'medium' }))
    .map(({ key, label, items: rows }) => ({ key, label, data: rows }));
}
