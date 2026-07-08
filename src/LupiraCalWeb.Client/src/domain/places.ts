// Place hierarchy + coordinate helpers (primitives only; domain stays independent of the generated API models).

export interface PlaceNode {
  id: string;
  parentPlaceId?: string | null;
  name: string;
  kind: string;
}

/**
 * The breadcrumb chain from the outermost known ancestor down to `startId` (inclusive), walking `parentPlaceId`.
 * Stops at the first parent not present in `byId` (unresolved) and guards against cycles.
 */
export function buildParentChain(startId: string, byId: Map<string, PlaceNode>): PlaceNode[] {
  const chain: PlaceNode[] = [];
  const seen = new Set<string>();
  let cursor: string | null | undefined = startId;
  while (cursor && !seen.has(cursor)) {
    const node = byId.get(cursor);
    if (!node) break;
    seen.add(cursor);
    chain.push(node);
    cursor = node.parentPlaceId;
  }
  return chain.reverse();
}

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
