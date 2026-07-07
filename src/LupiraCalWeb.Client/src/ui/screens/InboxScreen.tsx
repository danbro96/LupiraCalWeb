import { useSearchParams } from 'react-router-dom';
import { useAcceptItemIntoCalendar, useRemoveItemFromCalendar } from '../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../data/api/models';
import { fmtDate, fmtDateTime, parseYmd } from '../../domain/time';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { useProposedByCalendar } from '../../state/useProposed';
import { calendarColor } from '../theme/kinds';

/** The curation queue: everything proposed into any calendar, with accept/reject per membership. */
export function InboxScreen() {
  const { calendars } = useContainers();
  const proposed = useProposedByCalendar(calendars);
  const invalidate = useInvalidateItems();
  const accept = useAcceptItemIntoCalendar({ mutation: { onSuccess: invalidate } });
  const remove = useRemoveItemFromCalendar({ mutation: { onSuccess: invalidate } });
  const [, setSearchParams] = useSearchParams();

  const open = (id: string) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('item', id);
      return next;
    });

  const groups = proposed.filter((g) => g.items.length > 0);

  return (
    <div className="page">
      <h2>Inbox</h2>
      <p className="meta">Items proposed into your calendars, awaiting curation.</p>
      {groups.length === 0 && <p className="empty">Nothing to curate. 🎉</p>}
      {groups.map(({ calendar, items }) => (
        <section key={calendar.id} className="inbox-group">
          <div className="section-label">
            <span className="color-dot" style={{ background: calendarColor(calendar) }} /> {calendarLabel(calendar)}
          </div>
          {items.map((item) => (
            <div key={item.id} className="inbox-row">
              <button className="inbox-body" onClick={() => open(item.id)}>
                <span className="title">{item.title || '(untitled)'}</span>
                <span className="meta">{itemWhen(item)}</span>
              </button>
              <button className="btn" onClick={() => accept.mutate({ itemId: item.id, calendarId: calendar.id })}>
                Accept
              </button>
              <button className="btn destructive" onClick={() => remove.mutate({ itemId: item.id, calendarId: calendar.id })}>
                Reject
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function itemWhen(item: CalendarItemDto): string {
  if (item.startsAt) return fmtDateTime(new Date(item.startsAt));
  if (item.startDate) return fmtDate(parseYmd(item.startDate));
  return 'no date';
}
