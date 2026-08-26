import { authPort } from './api/authProvider';

/** Minimal slice of the MapLibre style spec this loader touches — the native map consumes the
 *  document as opaque JSON, so no dependency on the full style-spec types from data/. */
export type BasemapStyle = {
  version: number;
  glyphs?: string;
  sprite?: string;
  sources: Record<string, Record<string, unknown>>;
  layers: unknown[];
};

export type MapTheme = 'light' | 'dark';

async function authedFetch(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const token = authPort().getToken();
  return fetch(url, { headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers });
}

/**
 * Basemap style from geo-api via the BFF (`/geo-api` prefix). Root-relative URLs are normalized to
 * absolute — the native map resolves sprite/glyph URLs against nothing for an inline style document.
 * Ported from the web client's mapStyle.ts; keep the two in behavioral lockstep.
 */
export async function loadMapStyle(theme: MapTheme): Promise<BasemapStyle> {
  const origin = authPort().getApiUrl().replace(/\/$/, '');
  const res = await authedFetch(`${origin}/geo-api/basemap/style.json?theme=${theme}`);
  if (!res.ok) throw new Error(`Basemap style unavailable (${res.status})`);
  const style = (await res.json()) as BasemapStyle;

  const abs = (url: string) => (url.startsWith('/') ? `${origin}${url}` : url);
  if (typeof style.glyphs === 'string') style.glyphs = abs(style.glyphs);
  if (typeof style.sprite === 'string') style.sprite = abs(style.sprite);
  let pmtilesUrl: string | undefined;
  for (const source of Object.values(style.sources)) {
    const url = source.url;
    if (typeof url === 'string' && url.startsWith('pmtiles://')) {
      pmtilesUrl = abs(url.slice('pmtiles://'.length));
      source.url = `pmtiles://${pmtilesUrl}`;
    }
  }

  // style.json serves even when the assets volume isn't provisioned (bundled template) — but a
  // missing sprite/tiles stalls the native style load. One Range probe decides fallback.
  if (pmtilesUrl) {
    const probe = await authedFetch(pmtilesUrl, { Range: 'bytes=0-0' });
    if (!probe.ok) throw new Error(`Basemap assets unavailable (${probe.status})`);
  }
  return style;
}

/** Blank fallback when the basemap isn't provisioned — data layers still render on a flat wash. */
export function fallbackStyle(theme: MapTheme): BasemapStyle {
  const origin = authPort().getApiUrl().replace(/\/$/, '');
  return {
    version: 8,
    // Real glyph URL so cluster-count symbol layers stay valid; a 404 just drops the text.
    glyphs: `${origin}/geo-api/basemap/fonts/{fontstack}/{range}.pbf`,
    sources: {},
    layers: [{
      id: 'background',
      type: 'background',
      paint: { 'background-color': theme === 'dark' ? '#1a1a19' : '#e8e6e0' },
    }],
  };
}
