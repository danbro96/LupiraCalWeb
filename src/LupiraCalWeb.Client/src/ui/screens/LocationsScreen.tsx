import { Link, useSearchParams } from 'react-router-dom';
import { useGetPlace, useSearchContacts } from '../../data/api/lupiraCalApi';
import { PlaceKind, type CalendarItemDto } from '../../data/api/models';
import { buildParentChain, formatCoords, osmUrl, type PlaceNode } from '../../domain/places';
import { fmtDate, fmtDateTime, parseYmd } from '../../domain/time';
import { usePlaceItems, usePlaces, useSearchPlaces } from '../../state/usePlaces';
import { ITEM_KIND_ICONS } from '../theme/kinds';

const KIND_LABEL: Record<PlaceKind, string> = {
  Country: 'Country',
  City: 'City',
  Address: 'Address',
  Venue: 'Venue',
};

/** Find a place in the shared catalog and show what's anchored to it: hierarchy, items, contacts. */
export function LocationsScreen() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const kind = (params.get('kind') ?? '') as PlaceKind | '';
  const selectedId = params.get('place') ?? undefined;

  const placesQ = useSearchPlaces({ search, kind });
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
        <select value={kind} onChange={(e) => setParam('kind', e.target.value)}>
          <option value="">All kinds</option>
          {Object.values(PlaceKind).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
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
              <span className="badge">{KIND_LABEL[p.kind]}</span>
            </button>
          ))}
          {!placesQ.isLoading && places.length === 0 && <p className="empty">No places match.</p>}
        </div>

        <div className="location-detail">
          {selectedId ? (
            <PlaceDetail placeId={selectedId} onSelect={(id) => setParam('place', id)} />
          ) : (
            <p className="empty">Select a place to see what’s connected to it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceDetail({ placeId, onSelect }: { placeId: string; onSelect: (id: string) => void }) {
  const { data: place, isLoading } = useGetPlace(placeId);

  // Resolve the ancestor chain to build the breadcrumb. The catalog is shallow (Country→City→Address→Venue),
  // so a fixed number of hops covers it; each hop is enabled only once its child resolves.
  const l1 = usePlaces([place?.parentPlaceId]);
  const p1 = place?.parentPlaceId ? l1.get(place.parentPlaceId) : undefined;
  const l2 = usePlaces([p1?.parentPlaceId]);
  const p2 = p1?.parentPlaceId ? l2.get(p1.parentPlaceId) : undefined;
  const l3 = usePlaces([p2?.parentPlaceId]);
  const p3 = p2?.parentPlaceId ? l3.get(p2.parentPlaceId) : undefined;

  if (isLoading) return <p className="meta">Loading…</p>;
  if (!place) return <p className="empty">Place not found.</p>;

  const byId = new Map<string, PlaceNode>();
  for (const n of [place, p1, p2, p3]) if (n) byId.set(n.id, { id: n.id, parentPlaceId: n.parentPlaceId, name: n.name, kind: n.kind });
  const chain = buildParentChain(place.id, byId);
  const coords = formatCoords(place.latitude, place.longitude);
  const map = osmUrl(place.latitude, place.longitude);

  return (
    <>
      <section className="card">
        <div className="drawer-title-row">
          <h3 style={{ margin: 0, flex: 1 }}>{place.name}</h3>
          <span className="badge">{KIND_LABEL[place.kind]}</span>
        </div>
        {chain.length > 1 && (
          <div className="loc-breadcrumb">
            {chain.map((n, i) => (
              <span key={n.id}>
                {i > 0 && <span className="sep"> › </span>}
                {n.id === place.id ? (
                  n.name
                ) : (
                  <button className="linklike" onClick={() => onSelect(n.id)}>
                    {n.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
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

      <ChildrenPanel placeId={placeId} onSelect={onSelect} />
      <ItemsPanel placeId={placeId} />
      <ContactsPanel placeId={placeId} />
    </>
  );
}

function ChildrenPanel({ placeId, onSelect }: { placeId: string; onSelect: (id: string) => void }) {
  const query = useSearchPlaces({ parentPlaceId: placeId });
  const children = query.data ?? [];
  if (children.length === 0) return null;
  return (
    <section className="drawer-section">
      <h3>Contains</h3>
      <div className="location-list">
        {children.map((c) => (
          <button key={c.id} className="location-row" onClick={() => onSelect(c.id)}>
            <span className="location-name">{c.name}</span>
            <span className="badge">{KIND_LABEL[c.kind]}</span>
          </button>
        ))}
      </div>
    </section>
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
          {item.kind && ITEM_KIND_ICONS[item.kind] && <span className="kind-icon">{ITEM_KIND_ICONS[item.kind]}</span>}
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

/** Which role the place plays for an item: its location, or a travel/car endpoint. */
function roleOf(item: CalendarItemDto, placeId: string): string {
  if (item.placeId === placeId) return 'At';
  const t = item.kindDetails?.travel;
  if (t?.toPlaceId === placeId) return 'To';
  if (t?.fromPlaceId === placeId) return 'From';
  const car = item.kindDetails?.car;
  if (car?.pickupPlaceId === placeId) return 'Pickup';
  if (car?.dropoffPlaceId === placeId) return 'Dropoff';
  return '';
}

function whenOf(item: CalendarItemDto): string {
  if (item.isAllDay) return item.startDate ? fmtDate(parseYmd(item.startDate)) : '';
  return item.startsAt ? fmtDateTime(new Date(item.startsAt)) : '';
}
