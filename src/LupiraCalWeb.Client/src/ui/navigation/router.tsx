import { createBrowserRouter } from 'react-router-dom';
import App from '../../App';
import { RequireAuth } from './RequireAuth';
import { AppShell } from '../AppShell';
import { CalendarScreen } from '../screens/CalendarScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { ContactDetailScreen } from '../screens/ContactDetailScreen';
import { CalendarsScreen } from '../screens/CalendarsScreen';

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
              { path: 'contacts', element: <ContactsScreen /> },
              { path: 'contacts/:contactId', element: <ContactDetailScreen /> },
              { path: 'calendars', element: <CalendarsScreen /> },
              { path: '*', element: <CalendarScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
