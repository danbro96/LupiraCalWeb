import { useQuery } from '@tanstack/react-query';
import { getDb } from '../data/db/expoDb';
import { listContacts, loadContact, type ContactListRow } from '../data/mirror';

/** Contact reads from the mirror. Both the list and the per-contact doc sit under ['contacts'],
 *  which is what sync/reactivity.ts invalidates after a pull. */

export function useContactList() {
  return useQuery<ContactListRow[]>({ queryKey: ['contacts', 'list'], queryFn: async () => listContacts(await getDb()) });
}

export function useContactState(id: string) {
  return useQuery({ queryKey: ['contacts', id], queryFn: async () => loadContact(await getDb(), id) });
}
