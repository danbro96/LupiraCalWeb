import { useMemo } from 'react';
import { useSearchContacts } from '../data/api-contact/lupiraContactApi';
import type { SearchContactsParams } from '../data/api-contact/models';
import { useGetParticipationSummary } from '../data/api/lupiraCalApi';
import { partitionByActivity } from '../domain/contactTiers';

/**
 * Contact list split into Active / Dormant tiers by behavioral signal. Joins the contact search with
 * cal participation (the two sources stay independent — the join lives here, in state). Fails open:
 * while the summary loads, contacts with a relation/pin/recency signal still surface as Active.
 */
export function useTieredContacts(params: SearchContactsParams) {
  const contactsQ = useSearchContacts(params);
  const { data: summary } = useGetParticipationSummary();

  const { active, dormant, contacts } = useMemo(() => {
    const contacts = contactsQ.data ?? [];
    return { ...partitionByActivity(contacts, summary), contacts };
  }, [contactsQ.data, summary]);

  return { active, dormant, contacts, isLoading: contactsQ.isLoading };
}
