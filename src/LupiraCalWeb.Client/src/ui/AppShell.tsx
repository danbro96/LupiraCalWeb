import { useState } from 'react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { logout } from '../data/session';
import { useSession } from '../state/useSession';
import { useEnsureBootstrap } from '../state/useContainers';
import { useEnsureContactBootstrap } from '../state/useAddressBooks';
import { BottomNav } from './components/BottomNav';
import { CalendarVisibilityProvider } from './components/CalendarVisibility';
import { Sidebar } from './components/Sidebar';
import { ItemDrawer } from './components/drawer/ItemDrawer';
import { NewItemModal } from './components/NewItemModal';

/** Full-width app frame: topbar, calendar sidebar, routed content, and the ?item= drawer host. */
export function AppShell() {
  const { data: user } = useSession();
  useEnsureBootstrap();
  useEnsureContactBootstrap();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const itemId = searchParams.get('item');
  // Contacts and Locations own their own layout, so the calendar sidebar is hidden there.
  const path = useLocation().pathname;
  const showSidebar = !path.startsWith('/contacts') && !path.startsWith('/locations');

  const closeDrawer = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('item');
      return next;
    });
  };

  return (
    <CalendarVisibilityProvider>
      <div className="shell">
        <header className="topbar">
          <span className="brand">Lupira Calendar</span>
          <nav className="topnav">
            <NavLink to="/" end>
              Calendar
            </NavLink>
            <NavLink to="/items">Items</NavLink>
            <NavLink to="/inbox">Inbox</NavLink>
            <NavLink to="/contacts">Contacts</NavLink>
            <NavLink to="/locations">Locations</NavLink>
            <NavLink to="/calendars">Manage</NavLink>
          </nav>
          <button className="btn primary" onClick={() => setCreating(true)}>
            + New
          </button>
          <div className="account">
            <span className="account-email">{user?.name ?? user?.email}</span>
            <button className="linklike" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <div className="shell-body">
          {showSidebar && <Sidebar />}
          <main className="content">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
      {itemId && <ItemDrawer itemId={itemId} onClose={closeDrawer} />}
      {creating && <NewItemModal onClose={() => setCreating(false)} />}
    </CalendarVisibilityProvider>
  );
}
