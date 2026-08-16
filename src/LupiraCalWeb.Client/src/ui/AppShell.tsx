import { useState } from 'react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useEnsureBootstrap } from '../state/useContainers';
import { useEnsureContactBootstrap } from '../state/useAddressBooks';
import { BottomNav } from './components/BottomNav';
import { CalendarVisibilityProvider } from './components/CalendarVisibility';
import { Sidebar } from './components/Sidebar';
import { ItemDrawer } from './components/drawer/ItemDrawer';
import { BirthdayCard } from './components/drawer/BirthdayCard';
import { TaskCard } from './components/drawer/TaskCard';
import { AvailabilityModal } from './components/AvailabilityModal';
import { NewItemModal } from './components/NewItemModal';

/** Full-width app frame: section nav, calendar sidebar, routed content, and the ?item= drawer host. */
export function AppShell() {
  useEnsureBootstrap();
  useEnsureContactBootstrap();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [settingAvailability, setSettingAvailability] = useState(false);
  const itemId = searchParams.get('item');
  const birthdayContactId = searchParams.get('birthday');
  const birthdayYear = searchParams.get('year');
  // ?task=<listId>:<itemId> — the tasks API addresses items list-scoped, so the ref carries both GUIDs.
  const [taskListId, taskItemId] = (searchParams.get('task') ?? '').split(':');
  // Contacts and the Map own their own layout, so the calendar sidebar is hidden there.
  const path = useLocation().pathname;
  const showSidebar = !path.startsWith('/contacts') && !path.startsWith('/locations');

  const dropParams = (...keys: string[]) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const k of keys) next.delete(k);
      return next;
    });

  return (
    <CalendarVisibilityProvider>
      <div className="shell">
        <AppBar
          position="static"
          color="transparent"
          elevation={0}
          sx={{ display: { xs: 'none', md: 'block' }, borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar variant="dense">
            <nav className="topnav">
              <NavLink to="/" end>
                Calendar
              </NavLink>
              <NavLink to="/items">Items</NavLink>
              <NavLink to="/inbox">Inbox</NavLink>
              <NavLink to="/contacts">Contacts</NavLink>
              <NavLink to="/locations">Map</NavLink>
              <NavLink to="/calendars">Manage</NavLink>
            </nav>
          </Toolbar>
        </AppBar>
        <div className="shell-body">
          {showSidebar && <Sidebar />}
          <main className="content">
            <Outlet />
          </main>
        </div>
        <Box
          sx={{
            position: 'fixed',
            right: 16,
            bottom: { xs: 'calc(56px + env(safe-area-inset-bottom) + 12px)', md: 16 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 'fab',
          }}
        >
          <Tooltip title="Set availability">
            <Fab size="small" onClick={() => setSettingAvailability(true)} aria-label="Set availability">
              <EventAvailableIcon fontSize="small" />
            </Fab>
          </Tooltip>
          <Tooltip title="New item">
            <Fab color="primary" onClick={() => setCreating(true)} aria-label="New item">
              <AddIcon />
            </Fab>
          </Tooltip>
        </Box>
        <BottomNav />
      </div>
      {itemId && <ItemDrawer itemId={itemId} onClose={() => dropParams('item')} />}
      {birthdayContactId && (
        <BirthdayCard contactId={birthdayContactId} year={birthdayYear} onClose={() => dropParams('birthday', 'year')} />
      )}
      {taskListId && taskItemId && <TaskCard listId={taskListId} itemId={taskItemId} onClose={() => dropParams('task')} />}
      {creating && <NewItemModal onClose={() => setCreating(false)} />}
      {settingAvailability && <AvailabilityModal onClose={() => setSettingAvailability(false)} />}
    </CalendarVisibilityProvider>
  );
}
