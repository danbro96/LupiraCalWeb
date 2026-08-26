import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from '../../App';
import { RequireAuth } from './RequireAuth';
import { AppShell } from '../AppShell';
import { CalendarScreen } from '../screens/CalendarScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ItemsScreen } from '../screens/ItemsScreen';
import { ContactsLayout } from '../screens/ContactsLayout';
import { EmptyDetail } from '../components/contacts/EmptyDetail';
import { ContactDetailPane } from '../components/contacts/ContactDetailPane';
import { GroupDetailPane } from '../components/contacts/GroupDetailPane';
import { CalendarsScreen } from '../screens/CalendarsScreen';
import Typography from '@mui/material/Typography';
import { Page } from '../components/Page';

// Lazy: MapScreen pulls in maplibre-gl (+ CSS), which stays out of the main bundle.
const MapScreen = lazy(() => import('../screens/MapScreen'));
const PlacesScreen = lazy(() => import('../screens/PlacesScreen'));

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
              { path: 'items', element: <ItemsScreen /> },
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
              {
                path: 'locations',
                element: (
                  <Suspense fallback={<Page><Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading map…</Typography></Page>}>
                    <MapScreen />
                  </Suspense>
                ),
              },
              { path: 'calendars', element: <CalendarsScreen /> },
              {
                path: 'places',
                element: (
                  <Suspense fallback={<Page><Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading…</Typography></Page>}>
                    <PlacesScreen />
                  </Suspense>
                ),
              },
              { path: '*', element: <CalendarScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
