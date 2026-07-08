import { useListContactGroups } from '../../../data/api/lupiraCalApi';

/** Resolve a group by id within its address book. No get-by-id endpoint exists, so group
 *  navigation carries ?book= and we pick from the book's group list (cached, shared with the tree). */
export function useGroup(bookId: string | undefined, groupId: string | undefined) {
  const { data: groups } = useListContactGroups(bookId ?? '', { query: { enabled: !!bookId } });
  return (groups ?? []).find((g) => g.id === groupId);
}
