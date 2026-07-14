import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const PRIMARY = [
  { to: '/', end: true, icon: '📅', label: 'Calendar' },
  { to: '/items', icon: '🔎', label: 'Items' },
  { to: '/inbox', icon: '📥', label: 'Inbox' },
  { to: '/contacts', icon: '👤', label: 'Contacts' },
];

const MORE = [
  { to: '/locations', icon: '📍', label: 'Locations' },
  { to: '/calendars', icon: '⚙️', label: 'Manage' },
];

/** Phone shell navigation; hidden on desktop via CSS. Secondary sections live behind "More". */
export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav">
        {PRIMARY.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="bottom-tab">
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </NavLink>
        ))}
        <button className={`bottom-tab ${moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(true)}>
          <span className="tab-icon" aria-hidden>
            ⋯
          </span>
          More
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setMoreOpen(false)} />
          <nav className="more-sheet">
            {MORE.map((t) => (
              <NavLink key={t.to} to={t.to} className="more-item" onClick={() => setMoreOpen(false)}>
                <span className="tab-icon" aria-hidden>
                  {t.icon}
                </span>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
