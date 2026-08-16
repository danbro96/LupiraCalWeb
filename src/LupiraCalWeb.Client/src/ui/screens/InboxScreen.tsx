import { useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import { useAcceptItemIntoCalendar, useRemoveItemFromCalendar } from '../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../data/api/models';
import { fmtDate, fmtDateTime, parseYmd } from '@lupira/cal-domain/time';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { useProposedByCalendar } from '../../state/useProposed';
import { errText } from '../components/errText';
import { useSnackbar } from '../components/SnackbarHost';
import { calendarColor } from '../theme/kinds';

/** The curation queue: everything proposed into any calendar, with accept/reject per membership. */
export function InboxScreen() {
  const { calendars } = useContainers();
  const proposed = useProposedByCalendar(calendars);
  const invalidate = useInvalidateItems();
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const accept = useAcceptItemIntoCalendar({ mutation: { onSuccess: invalidate, onError } });
  const remove = useRemoveItemFromCalendar({ mutation: { onSuccess: invalidate, onError } });
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
              <Button variant="outlined" size="small" onClick={() => accept.mutate({ itemId: item.id, calendarId: calendar.id })}>
                Accept
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => remove.mutate({ itemId: item.id, calendarId: calendar.id })}
              >
                Reject
              </Button>
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
