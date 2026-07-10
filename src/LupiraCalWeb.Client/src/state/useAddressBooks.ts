import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAddressBooksQueryKey,
  useBootstrapMe,
  useListAddressBooks,
} from '../data/api-contact/lupiraContactApi';
import type { AddressBookDto } from '../data/api-contact/models';

export function useAddressBooks() {
  const query = useListAddressBooks();
  const addressBooks = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, addressBooks };
}

export function addressBookLabel(b: AddressBookDto): string {
  return b.displayName || b.slug;
}

/** First-login seeding: once books load with none, run contact /me/bootstrap (idempotent) once. */
export function useEnsureContactBootstrap() {
  const queryClient = useQueryClient();
  const { isSuccess, addressBooks } = useAddressBooks();
  const bootstrap = useBootstrapMe({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAddressBooksQueryKey() }),
    },
  });
  const started = useRef(false);
  const { mutate } = bootstrap;

  useEffect(() => {
    if (isSuccess && addressBooks.length === 0 && !started.current) {
      started.current = true;
      mutate();
    }
  }, [isSuccess, addressBooks.length, mutate]);

  return bootstrap.isPending;
}
