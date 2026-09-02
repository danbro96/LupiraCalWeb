import { describe, expect, it } from 'vitest';
import { getListItemsQueryKey } from '@lupira/cal-api/query/tasks';
import { getSearchItemsQueryKey, getListContainersQueryKey } from '@lupira/cal-api/query/cal';
import { getSearchContactsQueryKey, getListAddressBooksQueryKey } from '@lupira/cal-api/query/contact';
import { getSearchPlacesQueryKey } from '@lupira/cal-api/query/geo';

// The predicates in useInvalidate match generated keys by prefix, and those keys are the BFF's
// paths. Nothing else asserts that the two agree: a prefix that stops matching invalidates nothing,
// which typechecks, passes every other test, and only shows up as a stale screen after a mutation.
// These pin the real generated keys against the real predicate strings.
const first = (k: readonly unknown[]) => String(k[0]);

const items = (key: string) => key.startsWith('/api/items') || key.includes('/proposed');
const contacts = (key: string) => key.startsWith('/contact-api/contacts') || key.includes('/groups');
const containers = (key: string) => key.startsWith('/api/calendars');
const addressBooks = (key: string) => key.startsWith('/contact-api/address-books');
const places = (key: string) =>
  key.startsWith('/geo-api/places') || key.startsWith('/geo-api/me/places') || key.startsWith('/geo-api/curation');

describe('invalidation predicates match the generated keys', () => {
  it('items matches cal item queries', () => {
    expect(items(first(getSearchItemsQueryKey()))).toBe(true);
  });

  // The whole reason the merge happened: /items existed in cal and tasks, so a bare '/items' prefix
  // nuked task deadlines on every cal item mutation. The prefixes make them separable.
  it('items does NOT match task deadlines', () => {
    expect(items(first(getListItemsQueryKey()))).toBe(false);
    expect(first(getListItemsQueryKey())).toMatch(/^\/tasks-api\//);
  });

  it('contacts, containers and address books match their own APIs', () => {
    expect(contacts(first(getSearchContactsQueryKey()))).toBe(true);
    expect(containers(first(getListContainersQueryKey()))).toBe(true);
    expect(addressBooks(first(getListAddressBooksQueryKey()))).toBe(true);
  });

  it('places matches geo', () => {
    expect(places(first(getSearchPlacesQueryKey()))).toBe(true);
  });

  it('no predicate reaches into another API', () => {
    const contactKey = first(getSearchContactsQueryKey());
    expect(items(contactKey)).toBe(false);
    expect(containers(contactKey)).toBe(false);
    expect(places(contactKey)).toBe(false);
  });
});
