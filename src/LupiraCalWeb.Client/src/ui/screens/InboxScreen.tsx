import { useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useAcceptItemIntoCalendar, useRemoveItemFromCalendar } from '../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../data/api/models';
import { fmtDate, fmtDateTime, parseYmd } from '@lupira/cal-domain/time';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { useProposedByCalendar } from '../../state/useProposed';
import { errText } from '../components/errText';
import { useSnackbar } from '../components/SnackbarHost';
import { calendarColor } from '../theme/kinds';
import { Page } from '../components/Page';

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
    <Page>
      <h2>Inbox</h2>
      <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Items proposed into your calendars, awaiting curation.</Typography>
      {groups.length === 0 && <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Nothing to curate. 🎉</Typography>}
      {groups.map(({ calendar, items }) => (
        <section key={calendar.id} className="inbox-group">
          <Typography variant="overline" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2, pb: 1, color: 'text.subtle' }}>
            <Box component="span" sx={{ width: 13, height: 13, borderRadius: '999px', border: 1, borderColor: 'border', flex: 'none', display: 'inline-block' }} style={{ background: calendarColor(calendar) }} /> {calendarLabel(calendar)}
          </Typography>
          {items.map((item) => (
            <div key={item.id} className="inbox-row">
              <button className="inbox-body" onClick={() => open(item.id)}>
                <Typography component="span">{item.title || '(untitled)'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{itemWhen(item)}</Typography>
              </button>
              <Button variant="outlined" onClick={() => accept.mutate({ itemId: item.id, calendarId: calendar.id })}>
                Accept
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => remove.mutate({ itemId: item.id, calendarId: calendar.id })}
              >
                Reject
              </Button>
            </div>
          ))}
        </section>
      ))}
    </Page>
  );
}

function itemWhen(item: CalendarItemDto): string {
  if (item.startsAt) return fmtDateTime(new Date(item.startsAt));
  if (item.startDate) return fmtDate(parseYmd(item.startDate));
  return 'no date';
}
