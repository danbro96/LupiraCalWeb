import { useInfiniteQuery } from '@tanstack/react-query';
import { getListTopicsQueryKey, listTopics } from '../data/api-comms/lupiraCommsApi';
import type { TopicSummaryDto } from '../data/api-comms/models';
import { SETTLED_TOPIC_STATUSES } from '@lupira/cal-domain/topics';

export const TOPIC_PAGE_SIZE = 50;

/** A contact's finished topics, newest activity first. comms pages on lastActivity, so the cursor is
 *  the last row's — not an offset. */
export function useContactTopics(contactId: string) {
  const params = { contactId, status: [...SETTLED_TOPIC_STATUSES], limit: TOPIC_PAGE_SIZE };
  const query = useInfiniteQuery({
    queryKey: [...getListTopicsQueryKey(params), 'infinite'],
    queryFn: ({ pageParam, signal }) => listTopics({ ...params, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: TopicSummaryDto[]) =>
      last.length === TOPIC_PAGE_SIZE ? last[last.length - 1].lastActivity : undefined,
  });

  return {
    topics: query.data?.pages.flat() ?? [],
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
