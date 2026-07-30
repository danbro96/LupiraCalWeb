// Coordinate helpers (primitives only; domain stays independent of the generated API models). Place hierarchy
// (containment) now comes pre-resolved from LupiraGeoApi as an AdminArea chain — no client-side walk needed.

/** OpenStreetMap deep-link for a coordinate, or null when either component is missing. */
export function osmUrl(lat?: number | null, lon?: number | null): string | null {
  if (lat == null || lon == null) return null;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

/** "59.32930, 18.06860" or null when either component is missing/unparseable. */
export function formatCoords(lat?: number | null, lon?: number | null): string | null {
  if (lat == null || lon == null) return null;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
