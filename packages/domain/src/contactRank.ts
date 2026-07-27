// Interaction-ranked ordering for contact pickers: most shared calendar items first, then most
// recent shared occurrence, ties keeping the caller's base order (alphabetical from the API).

export interface InteractionLike {
  contactId?: string;
  count?: number | string;
  lastAt?: string | null;
}

export function rankByInteraction<T extends { id?: string }>(
  contacts: readonly T[],
  summary: readonly InteractionLike[] | undefined,
): T[] {
  if (!summary?.length) return [...contacts];
  const byContact = new Map(summary.map((e) => [e.contactId ?? '', e]));
  const count = (c: T) => Number(byContact.get(c.id ?? '')?.count ?? 0) || 0;
  const lastAt = (c: T) => {
    const at = byContact.get(c.id ?? '')?.lastAt;
    return (at && Date.parse(at)) || 0;
  };
  return [...contacts].sort((a, b) => count(b) - count(a) || lastAt(b) - lastAt(a));
}
