import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getSearchItemsQueryKey, searchItems } from '../data/api/lupiraCalApi';
import type { SearchItemsParams } from '../data/api/models';
import { RANGE_PRESETS, rangeToWindow, type RangePreset } from '../domain/searchRange';

export const SEARCH_PAGE_SIZE = 200;

/**
 * Search across all readable calendars in one query (the enriched occurrence DTO carries
 * calendarIds, so no per-calendar fan-out). Filters live in URL params; pagination depth is
 * react-query cache state, keyed by the filter set.
 */
export function useItemSearch() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const cal = searchParams.get('cal') ?? '';
  const category = searchParams.get('category') ?? '';
  const status = searchParams.get('status') ?? '';
  const rangeParam = searchParams.get('range');
  const range: RangePreset = RANGE_PRESETS.includes(rangeParam as RangePreset) ? (rangeParam as RangePreset) : 'upcoming';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const parent = searchParams.get('parent') ?? '';

  // A parent drill-down lists all of an item's children regardless of date — the API defaults
  // parentId searches to all-time, so no window is sent.
  const window = parent ? { from: undefined, to: undefined, desc: false } : rangeToWindow(range, from || null, to || null, new Date());
  const params: SearchItemsParams = {
    query: q || undefined,
    tag: tag || undefined,
    calendarId: cal || undefined,
    category: category || undefined,
    status: status || undefined,
    parentId: parent || undefined,
    from: window.from,
    to: window.to,
    desc: window.desc,
  };

  const query = useInfiniteQuery({
    queryKey: [...getSearchItemsQueryKey(params), 'infinite'],
    queryFn: ({ pageParam, signal }) => searchItems({ ...params, skip: pageParam, take: SEARCH_PAGE_SIZE }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.length === SEARCH_PAGE_SIZE ? all.reduce((n, p) => n + p.length, 0) : undefined,
    placeholderData: keepPreviousData,
  });

  return {
    filters: { q, tag, cal, category, status, range, from, to, parent },
    occurrences: query.data?.pages.flat() ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
