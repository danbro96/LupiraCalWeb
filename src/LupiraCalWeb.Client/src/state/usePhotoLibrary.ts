import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getListPhotosQueryKey, listPhotos } from '../data/api-photo/lupiraPhotoApi';
import type { ListPhotosParams, PhotoListItemDto } from '../data/api-photo/models';
import { listRelationEdges } from '../data/api/lupiraCalApi';

/** The gallery's read model. Filters live in URL params so a view is linkable and survives a reload,
 *  exactly as useItemSearch does it. */

export const PHOTO_PAGE_SIZE = 120;

/** Well inside the 24 h presigned-thumbnail expiry — a longer cache would serve dead URLs. */
const THUMB_SAFE_STALE_MS = 15 * 60_000;

export type PhotoFilters = {
  sort: 'TakenAtDesc' | 'TakenAtAsc';
  kind: string;
  located: string;
  place: string;
  status: string;
  event: string;
};

export function usePhotoFilters(): PhotoFilters {
  const [params] = useSearchParams();
  const sort = params.get('sort') === 'TakenAtAsc' ? 'TakenAtAsc' : 'TakenAtDesc';
  return {
    sort,
    kind: params.get('kind') ?? '',
    located: params.get('located') ?? '',
    place: params.get('place') ?? '',
    status: params.get('status') ?? '',
    event: params.get('event') ?? '',
  };
}

export function usePhotoLibrary(filters: PhotoFilters) {
  const params: ListPhotosParams = {
    sort: filters.sort,
    kind: (filters.kind || undefined) as ListPhotosParams['kind'],
    status: (filters.status || undefined) as ListPhotosParams['status'],
    located: filters.located === '' ? undefined : filters.located === 'true',
    place: filters.place || undefined,
    limit: PHOTO_PAGE_SIZE,
  };

  const query = useInfiniteQuery({
    queryKey: [...getListPhotosQueryKey(params), 'infinite'],
    queryFn: ({ pageParam, signal }) => listPhotos({ ...params, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: THUMB_SAFE_STALE_MS,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

/** photoId → the calendar items it's linked to, from one call. Powers the "linked" badge, the event
 *  filter, and the viewer's event list without a request per tile. */
export function usePhotoEventLinks() {
  const query = useQuery({
    queryKey: ['/relations/edges', 'photo'],
    queryFn: ({ signal }) => listRelationEdges({ toKind: 'photo' }, { signal }),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const byPhoto = new Map<string, string[]>();
    for (const edge of query.data ?? []) {
      byPhoto.set(edge.toRef, [...(byPhoto.get(edge.toRef) ?? []), edge.fromId]);
    }
    return byPhoto;
  }, [query.data]);
}

/** Groups a page-flattened list into calendar days, preserving the incoming order. */
export type PhotoDay = { key: string; label: string; items: PhotoListItemDto[] };

export function groupByDay(items: PhotoListItemDto[]): PhotoDay[] {
  const days: PhotoDay[] = [];
  for (const item of items) {
    const date = new Date(item.takenAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, label: date.toLocaleDateString(undefined, { dateStyle: 'full' }), items: [item] });
  }
  return days;
}
