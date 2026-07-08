import { createBrowserRouter } from 'react-router-dom';
import App from '../../App';
import { RequireAuth } from './RequireAuth';
import { AppShell } from '../AppShell';
import { CalendarScreen } from '../screens/CalendarScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ContactsLayout } from '../screens/ContactsLayout';
import { EmptyDetail } from '../components/contacts/EmptyDetail';
import { ContactDetailPane } from '../components/contacts/ContactDetailPane';
import { GroupDetailPane } from '../components/contacts/GroupDetailPane';
import { CalendarsScreen } from '../screens/CalendarsScreen';
import { LocationsScreen } from '../screens/LocationsScreen';

// Everything requires the SSO session — LupiraCalApi has no anonymous surface. The drawer rides
// the ?item= search param on any route, so occurrences deep-link from every screen.
export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <CalendarScreen /> },
              { path: 'inbox', element: <InboxScreen /> },
              {
                path: 'contacts',
                element: <ContactsLayout />,
                children: [
                  { index: true, element: <EmptyDetail /> },
                  { path: 'groups/:groupId', element: <GroupDetailPane /> },
                  { path: ':contactId', element: <ContactDetailPane /> },
                ],
              },
              { path: 'locations', element: <LocationsScreen /> },
              { path: 'calendars', element: <CalendarsScreen /> },
              { path: '*', element: <CalendarScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
