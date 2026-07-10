import { useQueryClient } from '@tanstack/react-query';

/**
 * Invalidation helpers over the orval-generated query keys (which are URL-path based). Item
 * mutations touch searches, the item itself, and curation lists; contact mutations touch
 * contact searches and groups.
 */
export function useInvalidateItems() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = String(q.queryKey[0] ?? '');
        return key.startsWith('/items') || key.includes('/proposed');
      },
    });
}

export function useInvalidateContacts() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = String(q.queryKey[0] ?? '');
        return key.startsWith('/contacts') || key.includes('/groups') || key.startsWith('/groups');
      },
    });
}

export function useInvalidateContainers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? '').startsWith('/calendars') });
}

export function useInvalidateAddressBooks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? '').startsWith('/address-books') });
}
