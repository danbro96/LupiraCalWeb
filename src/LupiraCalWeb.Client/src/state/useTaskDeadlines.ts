import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getItems } from '../data/api-tasks/lupiraTasksApi';
import { ItemStatus, type ItemResponse } from '../data/api-tasks/models';

/**
 * Open tasks due inside [from, to) — the calendar's third entry source. Hand-rolled rather than the
 * generated useGetItems: orval's URL-path key would be ['/items', …], colliding with cal-api's search
 * key (same path, different API) and getting nuked by useInvalidateItems's startsWith('/items')
 * predicate on every item mutation. Cancelled is closed but `completed: false`, so drop it here.
 */
export function useTaskDeadlines(from: string, to: string, enabled: boolean): ItemResponse[] {
  const params = { dueFrom: from, dueTo: to, completed: false };
  const { data } = useQuery({
    queryKey: ['/tasks-api/items', params],
    queryFn: ({ signal }) => getItems(params, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    select: (r) => r.items.filter((i) => i.status !== ItemStatus.Cancelled),
  });
  return (enabled ? data : undefined) ?? [];
}
