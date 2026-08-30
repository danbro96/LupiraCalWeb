import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuthPort } from './api/authProvider';
import { fallbackStyle, loadMapStyle, type BasemapStyle } from './mapStyle';

const ORIGIN = 'http://10.0.2.2:5181';

setAuthPort({
  getApiUrl: () => `${ORIGIN}/`, // trailing slash: the loader must not emit '//geo-api'
  getToken: () => 'tok',
  refresh: async () => 'tok',
  onSignIn: () => () => {},
});

const style = (over: Partial<BasemapStyle> = {}): BasemapStyle => ({
  version: 8,
  glyphs: '/geo-api/basemap/fonts/{fontstack}/{range}.pbf',
  sprite: '/geo-api/basemap/sprite',
  sources: { basemap: { url: 'pmtiles:///geo-api/basemap/tiles.pmtiles' } },
  layers: [],
  ...over,
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('loadMapStyle', () => {
  it('makes root-relative glyph, sprite and pmtiles URLs absolute', async () => {
    fetchMock.mockResolvedValueOnce(ok(style())).mockResolvedValueOnce({ ok: true, status: 206 });

    const out = await loadMapStyle('light');

    expect(out.glyphs).toBe(`${ORIGIN}/geo-api/basemap/fonts/{fontstack}/{range}.pbf`);
    expect(out.sprite).toBe(`${ORIGIN}/geo-api/basemap/sprite`);
    expect(out.sources.basemap.url).toBe(`pmtiles://${ORIGIN}/geo-api/basemap/tiles.pmtiles`);
  });

  it('sends the bearer on both the style request and the asset probe', async () => {
    fetchMock.mockResolvedValueOnce(ok(style())).mockResolvedValueOnce({ ok: true, status: 206 });
    await loadMapStyle('dark');
    for (const [, init] of fetchMock.mock.calls) {
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    }
  });

  it('Range-probes the tiles so an unprovisioned volume fails loudly instead of stalling the map', async () => {
    fetchMock.mockResolvedValueOnce(ok(style())).mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(loadMapStyle('light')).rejects.toThrow(/assets unavailable \(404\)/);
    expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Range).toBe('bytes=0-0');
  });

  it('skips the probe when the style declares no pmtiles source', async () => {
    fetchMock.mockResolvedValueOnce(ok(style({ sources: {} })));
    await loadMapStyle('light');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves already-absolute URLs alone', async () => {
    const absolute = 'https://cdn.example/sprite';
    fetchMock.mockResolvedValueOnce(ok(style({ sprite: absolute, sources: {} })));
    expect((await loadMapStyle('light')).sprite).toBe(absolute);
  });

  it('throws when the style itself is unavailable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(loadMapStyle('light')).rejects.toThrow(/style unavailable \(503\)/);
  });
});

describe('fallbackStyle', () => {
  it('keeps a real glyph URL so symbol layers stay valid', () => {
    expect(fallbackStyle('light').glyphs).toBe(`${ORIGIN}/geo-api/basemap/fonts/{fontstack}/{range}.pbf`);
  });

  it('washes the background per theme', () => {
    const paint = (t: 'light' | 'dark') =>
      (fallbackStyle(t).layers[0] as { paint: Record<string, string> }).paint['background-color'];
    expect(paint('dark')).not.toBe(paint('light'));
  });
});
