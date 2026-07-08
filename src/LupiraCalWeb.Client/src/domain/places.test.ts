import { describe, expect, it } from 'vitest';
import { buildParentChain, formatCoords, osmUrl, type PlaceNode } from './places';

const nodes: PlaceNode[] = [
  { id: 'se', parentPlaceId: null, name: 'Sweden', kind: 'Country' },
  { id: 'sto', parentPlaceId: 'se', name: 'Stockholm', kind: 'City' },
  { id: 'cafe', parentPlaceId: 'sto', name: 'Café Central', kind: 'Venue' },
];
const byId = new Map(nodes.map((n) => [n.id, n]));

describe('buildParentChain', () => {
  it('returns ancestors root-first, self last', () => {
    expect(buildParentChain('cafe', byId).map((n) => n.name)).toEqual(['Sweden', 'Stockholm', 'Café Central']);
  });

  it('is just the node itself when it has no parent', () => {
    expect(buildParentChain('se', byId).map((n) => n.name)).toEqual(['Sweden']);
  });

  it('stops at the first unresolved parent', () => {
    const orphan = new Map<string, PlaceNode>([['v', { id: 'v', parentPlaceId: 'missing', name: 'Venue', kind: 'Venue' }]]);
    expect(buildParentChain('v', orphan).map((n) => n.name)).toEqual(['Venue']);
  });

  it('returns empty for an unknown start id', () => {
    expect(buildParentChain('nope', byId)).toEqual([]);
  });

  it('terminates on a cycle', () => {
    const cyclic = new Map<string, PlaceNode>([
      ['a', { id: 'a', parentPlaceId: 'b', name: 'A', kind: 'City' }],
      ['b', { id: 'b', parentPlaceId: 'a', name: 'B', kind: 'City' }],
    ]);
    expect(buildParentChain('a', cyclic).map((n) => n.name)).toEqual(['B', 'A']);
  });
});

describe('osmUrl', () => {
  it('builds a map link from numeric coords', () => {
    expect(osmUrl(59.3293, 18.0686)).toBe('https://www.openstreetmap.org/?mlat=59.3293&mlon=18.0686#map=16/59.3293/18.0686');
  });

  it('coerces string coords (.NET numeric-as-string)', () => {
    expect(osmUrl('59.3293', '18.0686')).toContain('mlat=59.3293&mlon=18.0686');
  });

  it('is null when a component is missing or unparseable', () => {
    expect(osmUrl(null, 18)).toBeNull();
    expect(osmUrl(59, undefined)).toBeNull();
    expect(osmUrl('abc', 18)).toBeNull();
  });
});

describe('formatCoords', () => {
  it('formats to 5 decimals', () => {
    expect(formatCoords(59.3293, 18.0686)).toBe('59.32930, 18.06860');
  });

  it('is null when incomplete', () => {
    expect(formatCoords(null, null)).toBeNull();
  });
});
