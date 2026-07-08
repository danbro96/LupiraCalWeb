import { Outlet } from 'react-router-dom';
import { ContactsTree } from '../components/contacts/ContactsTree';
import { ContactList } from '../components/contacts/ContactList';

/** Contacts three-pane shell: address-book/group tree | filtered contact list | detail Outlet.
 *  The tree and list stay mounted; the right pane is driven by the nested route. */
export function ContactsLayout() {
  return (
    <div className="contacts-3pane">
      <ContactsTree />
      <ContactList />
      <Outlet />
    </div>
  );
}
