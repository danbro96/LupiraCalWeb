import { Link, Outlet, useMatch, useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import { ContactsTree } from '../components/contacts/ContactsTree';
import { ContactList } from '../components/contacts/ContactList';
import { useIsPhone } from '../useIsPhone';
import Box from '@mui/material/Box';
import { PaneFrame } from '../components/contacts/panes';

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
      <PaneFrame>
        <ContactsTree />
        <ContactList />
        <Outlet />
      </PaneFrame>
    );

  if (contactMatch || groupMatch) {
    const back = new URLSearchParams({ pane: 'list' });
    const book = params.get('book');
    const q = params.get('q');
    if (book) back.set('book', book);
    if (q) back.set('q', q);
    return (
      <PaneFrame column>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 44,
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            flex: 'none',
          }}
        >
          <Button variant="text" component={Link} to={{ pathname: '/contacts', search: back.toString() }}>
            ‹ Contacts
          </Button>
        </Box>
        <Outlet />
      </PaneFrame>
    );
  }

  if (params.has('book') || params.get('pane') === 'list')
    return (
      <PaneFrame column>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 44,
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            flex: 'none',
          }}
        >
          <Button variant="text" component={Link} to="/contacts">
            ‹ Books
          </Button>
        </Box>
        <ContactList />
      </PaneFrame>
    );

  return (
    <PaneFrame column>
      <ContactsTree />
    </PaneFrame>
  );
}
