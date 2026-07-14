import { Link, useSearchParams } from 'react-router-dom';
import { useSearchItems } from '../../../data/api/lupiraCalApi';
import { fmtWhen } from '../../../domain/time';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';

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
    <section className="drawer-section">
      <h3>Events</h3>
      {events.map((e) => (
        <Link key={e.id} to={itemHref(e.id)} className="location-row">
          <span className="kind-icon">{(e.category && ITEM_CATEGORY_ICONS[e.category]) || '📅'}</span>
          <span className="location-name">{e.title || '(untitled)'}</span>
          <span className="meta">{fmtWhen(e.start, e.isAllDay)}</span>
        </Link>
      ))}
      <Link className="linklike" to={`/items?contact=${contactId}`}>
        open in list
      </Link>
    </section>
  );
}
