// Coordinate helpers (primitives only; domain stays independent of the generated API models). Place hierarchy
// (containment) now comes pre-resolved from LupiraGeoApi as an AdminArea chain — no client-side walk needed.

/** OpenStreetMap deep-link for a coordinate, or null when either component is missing. Coords arrive as number|string (.NET). */
export function osmUrl(lat?: number | string | null, lon?: number | string | null): string | null {
  if (lat == null || lon == null) return null;
  const y = Number(lat);
  const x = Number(lon);
  if (Number.isNaN(y) || Number.isNaN(x)) return null;
  return `https://www.openstreetmap.org/?mlat=${y}&mlon=${x}#map=16/${y}/${x}`;
}

/** "59.32930, 18.06860" or null when either component is missing/unparseable. */
export function formatCoords(lat?: number | string | null, lon?: number | string | null): string | null {
  if (lat == null || lon == null) return null;
  const y = Number(lat);
  const x = Number(lon);
  if (Number.isNaN(y) || Number.isNaN(x)) return null;
  return `${y.toFixed(5)}, ${x.toFixed(5)}`;
}
