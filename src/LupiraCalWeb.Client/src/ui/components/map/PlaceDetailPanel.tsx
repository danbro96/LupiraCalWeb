import { Link, useSearchParams } from 'react-router-dom';
import type { CalendarItemDto } from '../../../data/api/models';
import { useSearchContacts } from '../../../data/api-contact/lupiraContactApi';
import { formatCoords, osmUrl } from '@lupira/cal-domain/places';
import { fmtDate, fmtDateTime, parseYmd } from '@lupira/cal-domain/time';
import { useGeoPlace, usePlaceItems } from '../../../state/usePlaces';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';

/** The ?place= detail pane (extracted from the former LocationsScreen): containment, items, contacts. */
export function PlaceDetailPanel({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { data: place, isLoading } = useGeoPlace(placeId);

  return (
    <aside className="map-detail">
      <button className="map-popover-close" onClick={onClose} aria-label="Close">×</button>
      {isLoading && <p className="meta">Loading…</p>}
      {!isLoading && !place && <p className="empty">Place not found.</p>}
      {place && (
        <>
          <section className="card">
            <div className="drawer-title-row">
              <h3 style={{ margin: 0, flex: 1 }}>{place.name}</h3>
              <span className="badge">{place.category}</span>
            </div>
            {(place.containment ?? []).length > 0 && (
              <div className="loc-breadcrumb">
                {(place.containment ?? []).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <span className="sep"> › </span>}
                    {a.name}
                  </span>
                ))}
              </div>
            )}
            {place.formattedAddress && <p className="field-value">{place.formattedAddress}</p>}
            {formatCoords(place.latitude, place.longitude) && (
              <p className="field-value">
                📍 {formatCoords(place.latitude, place.longitude)}
                {osmUrl(place.latitude, place.longitude) && (
                  <>
                    {' '}
                    <a className="linklike" href={osmUrl(place.latitude, place.longitude)!} target="_blank" rel="noreferrer">
                      OSM ↗
                    </a>
                  </>
                )}
              </p>
            )}
          </section>
          <ItemsPanel placeId={placeId} />
          <ContactsPanel placeId={placeId} />
        </>
      )}
    </aside>
  );
}

function ItemsPanel({ placeId }: { placeId: string }) {
  const [params] = useSearchParams();
  const { data: items, isLoading } = usePlaceItems(placeId);

  const itemHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('item', id);
    return `?${next.toString()}`;
  };

  return (
    <section className="drawer-section">
      <h3>Items here</h3>
      {isLoading && <p className="meta">Loading…</p>}
      {!isLoading && (items ?? []).length === 0 && <p className="empty">No items reference this place.</p>}
      {(items ?? []).map((item) => (
        <Link key={item.id} to={itemHref(item.id)} className="location-row">
          {item.category && ITEM_CATEGORY_ICONS[item.category] && (
            <span className="kind-icon">{ITEM_CATEGORY_ICONS[item.category]}</span>
          )}
          <span className="location-name">{item.title || '(untitled)'}</span>
          <span className="meta">{whenOf(item)}</span>
          {roleOf(item, placeId) && <span className="loc-role">{roleOf(item, placeId)}</span>}
        </Link>
      ))}
    </section>
  );
}

function ContactsPanel({ placeId }: { placeId: string }) {
  const { data: contacts } = useSearchContacts({});
  const here = (contacts ?? []).filter((c) => (c.addresses ?? []).some((a) => a.placeId === placeId));
  if (here.length === 0) return null;
  return (
    <section className="drawer-section">
      <h3>Contacts here</h3>
      {here.map((c) => (
        <Link key={c.id} to={`/contacts/${c.id}`} className="location-row">
          <span className="location-name">{c.displayName}</span>
        </Link>
      ))}
    </section>
  );
}

/** Which role the place plays for an item: its location, or a travel endpoint. */
function roleOf(item: CalendarItemDto, placeId: string): string {
  if (item.placeId === placeId) return 'At';
  const t = item.details?.travel;
  if (t?.toPlaceId === placeId) return 'To';
  if (t?.fromPlaceId === placeId) return 'From';
  return '';
}

function whenOf(item: CalendarItemDto): string {
  if (item.isAllDay) return item.startDate ? fmtDate(parseYmd(item.startDate)) : '';
  return item.startsAt ? fmtDateTime(new Date(item.startsAt)) : '';
}
