import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addDays, fmtTime, parseYmd } from '@lupira/cal-domain/time';
import {
  useContactFeatures,
  useEventFeatures,
  useMovementFeatures,
  useSavedPlaceFeatures,
} from '../../state/useMapData';
import { MapCanvas, useMap, useMapTheme } from '../components/map/MapCanvas';
import {
  DEFAULT_LAYERS,
  LayerToggles,
  TimeRangeBar,
  defaultRange,
  type DateRange,
  type LayerKey,
} from '../components/map/MapControls';
import { MapPopover } from '../components/map/MapPopover';
import { MapSearch, type SearchTarget } from '../components/map/MapSearch';
import { PlaceDetailPanel } from '../components/map/PlaceDetailPanel';
import { ContactsLayer, EventsLayer, MovementLayer, SavedPlacesLayer, type PinSelection } from '../components/map/layers';
import { FitToData, FlyToPlace } from '../components/map/mapEffects';

/** The map over everything located: events, GPS movement, contacts, saved places. Route stays
 * /locations so ?place=/?q= deep links keep working; state rides the URL (?from ?to ?layers). */
export default function MapScreen() {
  const [params, setParams] = useSearchParams();
  const theme = useMapTheme();
  const selectedPlaceId = params.get('place') ?? undefined;

  const setParam = useCallback((key: string, value: string | undefined) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true }), [setParams]);

  const range: DateRange = useMemo(() => {
    const from = params.get('from');
    const to = params.get('to');
    return from && to ? { fromYmd: from, toYmd: to } : defaultRange();
  }, [params]);
  const setRange = (r: DateRange) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', r.fromYmd);
      next.set('to', r.toYmd);
      return next;
    }, { replace: true });

  const activeLayers: LayerKey[] = useMemo(() => {
    const raw = params.get('layers');
    return raw ? (raw.split(',').filter(Boolean) as LayerKey[]) : DEFAULT_LAYERS;
  }, [params]);
  const toggleLayer = (key: LayerKey) => {
    const next = activeLayers.includes(key)
      ? activeLayers.filter((k) => k !== key)
      : [...activeLayers, key];
    setParam('layers', next.join(','));
  };

  // Inclusive local dates → half-open UTC instants for the APIs.
  const fromIso = useMemo(() => parseYmd(range.fromYmd).toISOString(), [range.fromYmd]);
  const toIso = useMemo(() => addDays(parseYmd(range.toYmd), 1).toISOString(), [range.toYmd]);

  const events = useEventFeatures(fromIso, toIso, activeLayers.includes('events'));
  const movement = useMovementFeatures(fromIso, toIso, activeLayers.includes('movement'));
  const contacts = useContactFeatures(activeLayers.includes('contacts'));
  const saved = useSavedPlaceFeatures(activeLayers.includes('saved'));

  const [popover, setPopover] = useState<PinSelection>();
  const onSelect = useCallback((selection: PinSelection) => setPopover(selection), []);
  const openItem = useCallback((itemId: string) => setParam('item', itemId), [setParam]);
  const openPlace = useCallback((placeId: string) => {
    setPopover(undefined);
    setParam('place', placeId);
  }, [setParam]);

  const onSearchPick = (target: SearchTarget) => {
    if (target.placeId) setParam('place', target.placeId);
    else setParam('place', undefined);
    setFlyTarget([target.lon, target.lat]);
  };
  const [flyTarget, setFlyTarget] = useState<[number, number]>();

  const fitCollections = useMemo(
    () => [events.features, movement.visits, contacts.features, saved.features],
    [events.features, movement.visits, contacts.features, saved.features],
  );
  const anyLoading = events.isLoading || movement.isLoading || contacts.isLoading || saved.isLoading;

  return (
    <div className="map-page">
      <MapCanvas>
        {activeLayers.includes('movement') && (
          <MovementLayer theme={theme} visits={movement.visits} track={movement.track} current={movement.current} onSelect={onSelect} />
        )}
        {activeLayers.includes('events') && (
          <EventsLayer theme={theme} features={events.features} onOpenItem={openItem} />
        )}
        {activeLayers.includes('contacts') && (
          <ContactsLayer theme={theme} features={contacts.features} onSelect={onSelect} />
        )}
        {activeLayers.includes('saved') && (
          <SavedPlacesLayer theme={theme} features={saved.features} onSelect={onSelect} onOpenPlace={openPlace} />
        )}
        <FlyToPlace placeId={selectedPlaceId} />
        <FlyTo target={flyTarget} />
        <FitToData collections={fitCollections} skip={!!selectedPlaceId} />
        {popover && (
          <MapPopover anchor={{ lngLat: popover.lngLat }} onClose={() => setPopover(undefined)}>
            <PopoverBody selection={popover} />
          </MapPopover>
        )}
      </MapCanvas>

      <div className="map-overlay map-topbar">
        <MapSearch onPick={onSearchPick} />
        <TimeRangeBar range={range} onChange={setRange} />
        <LayerToggles active={activeLayers} onToggle={toggleLayer} theme={theme} unmappableCount={events.unmappableCount} />
        {anyLoading && <span className="meta">Loading…</span>}
      </div>

      {selectedPlaceId && (
        <PlaceDetailPanel placeId={selectedPlaceId} onClose={() => setParam('place', undefined)} />
      )}
    </div>
  );
}

function PopoverBody({ selection }: { selection: PinSelection }) {
  const { kind, props } = selection;
  if (kind === 'contact') {
    const names = (props.names as string[]) ?? [];
    const ids = (props.contactIds as string[]) ?? [];
    return (
      <>
        {props.placeName != null && <h4>{String(props.placeName)}</h4>}
        {names.map((name, i) => (
          <Link key={ids[i] ?? name} to={`/contacts/${ids[i]}`} className="location-row">
            <span className="location-name">{name}</span>
          </Link>
        ))}
      </>
    );
  }
  if (kind === 'visit') {
    const arrive = props.arriveTs ? fmtTime(new Date(String(props.arriveTs))) : '';
    const depart = props.departTs ? fmtTime(new Date(String(props.departTs))) : '';
    return (
      <>
        <h4>{String(props.placeLabel ?? 'Stay')}</h4>
        <p className="meta">{arrive}–{depart} · {String(props.durationMin)} min</p>
      </>
    );
  }
  if (kind === 'current') {
    return (
      <>
        <h4>Current position</h4>
        <p className="meta">
          {props.ts ? fmtTime(new Date(String(props.ts))) : ''}
          {props.batteryPct != null ? ` · 🔋${String(props.batteryPct)}%` : ''}
        </p>
      </>
    );
  }
  return <h4>{String(props.icon ?? '⭐')} {String(props.label ?? 'Saved place')}</h4>;
}

function FlyTo({ target }: { target: [number, number] | undefined }) {
  return target ? <FlyToPoint target={target} /> : null;
}

function FlyToPoint({ target }: { target: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo({ center: target, zoom: Math.max(map.getZoom(), 13) });
  }, [map, target]);
  return null;
}
