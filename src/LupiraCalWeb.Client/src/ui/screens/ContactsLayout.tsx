import { Link, Outlet, useMatch, useSearchParams } from 'react-router-dom';
import { ContactsTree } from '../components/contacts/ContactsTree';
import { ContactList } from '../components/contacts/ContactList';
import { useIsPhone } from '../useIsPhone';

/** Contacts three-pane shell: address-book/group tree | filtered contact list | detail Outlet.
 *  The tree and list stay mounted; the right pane is driven by the nested route.
 *  Phones stack one step at a time instead: tree → list (?book / ?pane=list) → detail route,
 *  each with a back bar carrying the book/q filters. */
export function ContactsLayout() {
  const isPhone = useIsPhone();
  const [params] = useSearchParams();
  const contactMatch = useMatch('/contacts/:contactId');
  const groupMatch = useMatch('/contacts/groups/:groupId');

  if (!isPhone)
    return (
      <div className="contacts-3pane">
        <ContactsTree />
        <ContactList />
        <Outlet />
      </div>
    );

  if (contactMatch || groupMatch) {
    const back = new URLSearchParams({ pane: 'list' });
    const book = params.get('book');
    const q = params.get('q');
    if (book) back.set('book', book);
    if (q) back.set('q', q);
    return (
      <div className="contacts-stack">
        <div className="pane-back">
          <Link className="linklike" to={{ pathname: '/contacts', search: back.toString() }}>
            ‹ Contacts
          </Link>
        </div>
        <Outlet />
      </div>
    );
  }

  if (params.has('book') || params.get('pane') === 'list')
    return (
      <div className="contacts-stack">
        <div className="pane-back">
          <Link className="linklike" to="/contacts">
            ‹ Books
          </Link>
        </div>
        <ContactList />
      </div>
    );

  return (
    <div className="contacts-stack">
      <ContactsTree />
    </div>
  );
}
