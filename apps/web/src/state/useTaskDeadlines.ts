import { keepPreviousData } from '@tanstack/react-query';
import { useListItems } from '@lupira/cal-api/query/tasks';
import { ItemStatus, type ItemDto } from '@lupira/cal-api/models';

/**
 * Open tasks due inside [from, to) — the calendar's third entry source. Cancelled is closed but
 * `completed: false`, so it is dropped here rather than by the query.
 *
 * This used to be hand-rolled with a hand-prefixed key, because orval derived keys from the path
 * alone and tasks' `/items` collided with cal-api's — `useInvalidateItems` nuked task deadlines on
 * every cal item mutation. The merged spec puts the BFF route in the path, so the generated hook
 * now keys `['/tasks-api/items', params]` on its own.
 */
export function useTaskDeadlines(from: string, to: string, enabled: boolean): ItemDto[] {
  const { data } = useListItems(
    { dueFrom: from, dueTo: to, completed: false },
    {
      query: {
        enabled,
        placeholderData: keepPreviousData,
        select: (items) => items.filter((i) => i.status !== ItemStatus.Cancelled),
      },
    },
  );
  return (enabled ? data : undefined) ?? [];
}
