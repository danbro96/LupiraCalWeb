import { Link, useSearchParams } from 'react-router-dom';
import type { CalendarItemDto } from '../../data/api/models';
import { useSearchContacts } from '../../data/api-contact/lupiraContactApi';
import { formatCoords, osmUrl } from '../../domain/places';
import { fmtDate, fmtDateTime, parseYmd } from '../../domain/time';
import { useGeoPlace, usePlaceItems, useSearchPlaces } from '../../state/usePlaces';
import { ITEM_CATEGORY_ICONS } from '../theme/kinds';

/** Find a place in the LupiraGeoApi gazetteer and show what's anchored to it: containment, items, contacts. */
export function LocationsScreen() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const selectedId = params.get('place') ?? undefined;

  const placesQ = useSearchPlaces({ q: search || undefined });
  const places = placesQ.data ?? [];

  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="page locations-page">
      <div className="page-head">
        <h2>Locations</h2>
      </div>
      <div className="form-row">
        <input
          className="text-input"
          placeholder="Search places…"
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
        />
      </div>

      <div className="locations-split">
        <div className="location-list">
          {placesQ.isLoading && <p className="meta">Loading…</p>}
          {places.map((p) => (
            <button
              key={p.id}
              className={`location-row${p.id === selectedId ? ' active' : ''}`}
              onClick={() => setParam('place', p.id)}
            >
              <span className="location-name">{p.name}</span>
              <span className="badge">{p.category}</span>
            </button>
          ))}
          {!placesQ.isLoading && places.length === 0 && <p className="empty">No places match.</p>}
        </div>

        <div className="location-detail">
          {selectedId ? (
            <PlaceDetail placeId={selectedId} />
          ) : (
            <p className="empty">Select a place to see what’s connected to it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceDetail({ placeId }: { placeId: string }) {
  const { data: place, isLoading } = useGeoPlace(placeId);
  if (isLoading) return <p className="meta">Loading…</p>;
  if (!place) return <p className="empty">Place not found.</p>;

  const coords = formatCoords(place.latitude, place.longitude);
  const map = osmUrl(place.latitude, place.longitude);
  const containment = place.containment ?? [];

  return (
    <>
      <section className="card">
        <div className="drawer-title-row">
          <h3 style={{ margin: 0, flex: 1 }}>{place.name}</h3>
          <span className="badge">{place.category}</span>
        </div>
        {containment.length > 0 && (
          <div className="loc-breadcrumb">
            {containment.map((a, i) => (
              <span key={a.id}>
                {i > 0 && <span className="sep"> › </span>}
                {a.name}
              </span>
            ))}
          </div>
        )}
        {place.formattedAddress && <p className="field-value">{place.formattedAddress}</p>}
        {(coords || map) && (
          <p className="field-value">
            📍 {coords}
            {map && (
              <>
                {' '}
                <a className="linklike" href={map} target="_blank" rel="noreferrer">
                  map ↗
                </a>
              </>
            )}
          </p>
        )}
      </section>

      <ItemsPanel placeId={placeId} />
      <ContactsPanel placeId={placeId} />
    </>
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
