import type { StyleSpecification } from 'maplibre-gl';
import { GEO_API_BASE_URL } from '../../../config';
import type { MapTheme } from './mapTokens';

/**
 * Basemap style from geo-api (Protomaps template with {BASE} already substituted server-side).
 * Root-relative URLs are normalized to absolute here — MapLibre resolves sprite/glyph URLs
 * against the style origin, which for a fetched object is undefined.
 */
export async function loadMapStyle(theme: MapTheme): Promise<StyleSpecification> {
  const res = await fetch(`${GEO_API_BASE_URL}/basemap/style.json?theme=${theme}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Basemap style unavailable (${res.status})`);
  const style = (await res.json()) as StyleSpecification;

  const abs = (url: string) => (url.startsWith('/') ? `${window.location.origin}${url}` : url);
  if (typeof style.glyphs === 'string') style.glyphs = abs(style.glyphs);
  if (typeof style.sprite === 'string') style.sprite = abs(style.sprite);
  let pmtilesUrl: string | undefined;
  for (const source of Object.values(style.sources)) {
    if ('url' in source && typeof source.url === 'string' && source.url.startsWith('pmtiles://')) {
      source.url = `pmtiles://${abs(source.url.slice('pmtiles://'.length))}`;
      pmtilesUrl = source.url.slice('pmtiles://'.length);
    }
  }

  // style.json serves even when the assets volume isn't provisioned (bundled template) — but a
  // missing sprite is FATAL to MapLibre (the style never finishes loading and data layers stall).
  // One Range probe on the tiles decides: assets absent → let the caller use fallbackStyle.
  if (pmtilesUrl) {
    const probe = await fetch(pmtilesUrl, { headers: { Range: 'bytes=0-0' }, credentials: 'include' });
    if (!probe.ok) throw new Error(`Basemap assets unavailable (${probe.status})`);
  }
  return style;
}

/** Blank fallback when the basemap isn't provisioned — data layers still render on a flat wash. */
export function fallbackStyle(theme: MapTheme): StyleSpecification {
  return {
    version: 8,
    // Real glyph URL so cluster-count symbol layers stay valid; a 404 just drops the text.
    glyphs: `${window.location.origin}${GEO_API_BASE_URL}/basemap/fonts/{fontstack}/{range}.pbf`,
    sources: {},
    layers: [{
      id: 'background',
      type: 'background',
      paint: { 'background-color': theme === 'dark' ? '#1a1a19' : '#e8e6e0' },
    }],
  };
}
