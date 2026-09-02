import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { listContainerDocs } from '../data/mirror';

export type AddressBookContainer = { id: string; displayName?: string | null; access?: string };

export function useAddressBooks() {
  return useQuery<AddressBookContainer[]>({
    queryKey: ['containers', 'address_books'],
    queryFn: async () => listContainerDocs<AddressBookContainer>(await getDb(), 'address_books'),
  });
}
