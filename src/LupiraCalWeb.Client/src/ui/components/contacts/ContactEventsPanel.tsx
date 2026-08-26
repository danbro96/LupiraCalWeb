import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Link, useSearchParams } from 'react-router-dom';
import { useSearchItems } from '../../../data/api/lupiraCalApi';
import { fmtWhen } from '@lupira/cal-domain/time';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';
import { DrawerSection } from '../DrawerSection';

const FETCH_SIZE = 50;
const SHOWN = 10;

/** Items across readable calendars where this contact is an attendee (all-time, newest first).
 *  Rows open the shared ?item= drawer; "open in list" drills into /items?contact=. */
export function ContactEventsPanel({ contactId }: { contactId: string }) {
  const [params] = useSearchParams();
  const { data: occs } = useSearchItems({ contactId, take: FETCH_SIZE, desc: true });

  // Recurring items repeat per occurrence — keep the first (most recent) per item.
  const events = [...new Map((occs ?? []).map((o) => [o.id, o])).values()].slice(0, SHOWN);
  if (events.length === 0) return null;

  const itemHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('item', id);
    return `?${next.toString()}`;
  };

  return (
    <DrawerSection title="Events">
      {events.map((e) => (
        <Link key={e.id} to={itemHref(e.id)} className="location-row">
          <Box component="span" sx={{ fontSize: 22 }}>{(e.category && ITEM_CATEGORY_ICONS[e.category]) || '📅'}</Box>
          <span className="location-name">{e.title || '(untitled)'}</span>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtWhen(e.start, e.isAllDay)}</Typography>
        </Link>
      ))}
      <MuiLink
        component={Link}
        to={`/items?contact=${contactId}`}
        underline="hover"
        sx={{ fontSize: 13, fontWeight: 600, p: '2px', whiteSpace: 'nowrap', '@media (pointer: coarse)': { p: '6px 2px' } }}
      >
        open in list
      </MuiLink>
    </DrawerSection>
  );
}
