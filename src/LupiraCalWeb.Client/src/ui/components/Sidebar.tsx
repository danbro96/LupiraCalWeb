import type { ContainerDto } from '../../data/api/models';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { CALENDAR_KIND_ICONS, calendarColor } from '../theme/kinds';
import { useCalendarVisibility } from './CalendarVisibility';

/** Calendar toggles grouped by class — System calendars are the agent-facing set no DAV client sees. */
export function Sidebar() {
  const { calendars } = useContainers();
  const agenda = calendars.filter((c) => c.class !== 'System');
  const system = calendars.filter((c) => c.class === 'System');

  return (
    <aside className="sidebar">
      <CalendarGroup title="Agenda" calendars={agenda} />
      <CalendarGroup title="System" calendars={system} />
    </aside>
  );
}

function CalendarGroup({ title, calendars }: { title: string; calendars: ContainerDto[] }) {
  const { isVisible, toggle } = useCalendarVisibility();
  if (calendars.length === 0) return null;
  return (
    <div className="cal-group">
      <div className="section-label">{title}</div>
      {calendars.map((c) => (
        <label key={c.id} className="cal-toggle" title={`${c.kind ?? ''} · ${c.access}`}>
          <input type="checkbox" checked={isVisible(c)} onChange={() => toggle(c)} />
          <span className="color-dot" style={{ background: calendarColor(c) }} />
          <span className="cal-toggle-name">
            {c.kind ? `${CALENDAR_KIND_ICONS[c.kind]} ` : ''}
            {calendarLabel(c)}
          </span>
        </label>
      ))}
    </div>
  );
}
