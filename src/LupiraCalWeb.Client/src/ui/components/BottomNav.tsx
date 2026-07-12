import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', end: true, icon: '📅', label: 'Calendar' },
  { to: '/items', icon: '🔎', label: 'Items' },
  { to: '/inbox', icon: '📥', label: 'Inbox' },
  { to: '/contacts', icon: '👤', label: 'Contacts' },
  { to: '/locations', icon: '📍', label: 'Locations' },
  { to: '/calendars', icon: '⚙️', label: 'Manage' },
];

/** Phone shell navigation; hidden on desktop via CSS. */
export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="bottom-tab">
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
