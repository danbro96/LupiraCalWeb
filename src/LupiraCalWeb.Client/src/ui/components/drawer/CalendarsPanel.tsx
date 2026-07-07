import { useState } from 'react';
import {
  useAcceptItemIntoCalendar,
  useFileItemToCalendar,
  useRemoveItemFromCalendar,
} from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { calendarLabel, useContainers } from '../../../state/useContainers';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { calendarColor } from '../../theme/kinds';

/** The item's calendar memberships (Proposed/Accepted) + curation actions and file-to-calendar. */
export function CalendarsPanel({ item }: { item: CalendarItemDto }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const accept = useAcceptItemIntoCalendar({ mutation: { onSuccess: invalidate } });
  const remove = useRemoveItemFromCalendar({ mutation: { onSuccess: invalidate } });
  const file = useFileItemToCalendar({ mutation: { onSuccess: invalidate } });
  const [target, setTarget] = useState('');

  const memberships = item.calendars.filter((m) => m.status !== 'Removed');
  const memberIds = new Set(memberships.map((m) => m.calendarId));
  const fileable = calendars.filter((c) => !memberIds.has(c.id));

  return (
    <section className="drawer-section">
      <h3>Calendars</h3>
      {memberships.map((m) => {
        const cal = calendars.find((c) => c.id === m.calendarId);
        return (
          <div key={m.calendarId} className="membership-row">
            <span className="color-dot" style={{ background: cal ? calendarColor(cal) : 'var(--border)' }} />
            <span className="membership-name">{cal ? calendarLabel(cal) : m.calendarId.slice(0, 8)}</span>
            {m.status === 'Proposed' ? <span className="badge severity-weak">proposed</span> : <span className="badge">accepted</span>}
            {m.status === 'Proposed' && (
              <button className="chip" onClick={() => accept.mutate({ itemId: item.id, calendarId: m.calendarId })}>
                Accept
              </button>
            )}
            <button className="icon-btn" title="Remove from calendar" onClick={() => remove.mutate({ itemId: item.id, calendarId: m.calendarId })}>
              ×
            </button>
          </div>
        );
      })}
      <div className="form-row">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">File into calendar…</option>
          {fileable.map((c) => (
            <option key={c.id} value={c.id}>
              {calendarLabel(c)}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!target || file.isPending}
          onClick={() => {
            file.mutate({ itemId: item.id, calendarId: target, params: { status: 'accepted' } });
            setTarget('');
          }}
        >
          File
        </button>
      </div>
    </section>
  );
}
