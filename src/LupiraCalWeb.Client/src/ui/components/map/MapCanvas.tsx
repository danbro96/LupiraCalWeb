import { addProtocol, Map as MapLibreMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fallbackStyle, loadMapStyle } from './mapStyle';
import type { MapTheme } from './mapTokens';

// MapLibre's default worker URL (a sibling of the entry module) 404s under bundlers, and bundling the
// worker ourselves gets tree-shaken to an empty file (maplibre's sideEffects allowlist). The worker +
// its shared-module import are served verbatim from public/maplibre/ instead (sync:maplibre script).
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
addProtocol('pmtiles', new Protocol().tile);

const MapContext = createContext<MapLibreMap | null>(null);

/** The live map instance — usable only beneath MapCanvas. */
export function useMap(): MapLibreMap {
  const map = useContext(MapContext);
  if (!map) throw new Error('useMap must be used inside MapCanvas');
  return map;
}

export function useMapTheme(): MapTheme {
  const [theme, setTheme] = useState<MapTheme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return theme;
}

/** Nordics default view until data arrives (matches the basemap extract's coverage). */
const DEFAULT_CENTER: [number, number] = [18.07, 59.33];
const DEFAULT_ZOOM = 9;

export function MapCanvas({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [basemapMissing, setBasemapMissing] = useState(false);
  const theme = useMapTheme();
  const themeRef = useRef(theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let created: MapLibreMap | undefined;
    (async () => {
      let style;
      try {
        style = await loadMapStyle(themeRef.current);
      } catch {
        style = fallbackStyle(themeRef.current);
        if (!disposed) setBasemapMissing(true);
      }
      if (disposed) return;
      created = new MapLibreMap({
        container,
        style,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
      created.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      created.addControl(new ScaleControl(), 'bottom-left');
      // The lazy route can mount mid-layout: a 0-width container at construction leaves MapLibre's
      // 400px fallback buffer behind, and its own observer misses the catch-up. One explicit resize heals it.
      requestAnimationFrame(() => { if (!disposed) created?.resize(); });
      created.once('load', () => { if (!disposed) created?.resize(); });
      if (import.meta.env.DEV) (window as unknown as { __map?: MapLibreMap }).__map = created;
      setMap(created);
    })();
    return () => {
      disposed = true;
      created?.remove();
      setMap(null);
    };
  }, []);

  // Theme flips restyle in place; data layers re-add themselves on styledata (useGeoJsonLayer).
  useEffect(() => {
    themeRef.current = theme;
    if (!map) return;
    let stale = false;
    (async () => {
      try {
        const style = await loadMapStyle(theme);
        if (!stale) map.setStyle(style);
      } catch {
        if (!stale) map.setStyle(fallbackStyle(theme));
      }
    })();
    return () => { stale = true; };
  }, [theme, map]);

  return (
    <div className="map-canvas" ref={containerRef}>
      {basemapMissing && (
        <div className="map-error">Basemap unavailable — pins and tracks still render.</div>
      )}
      {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
    </div>
  );
}
