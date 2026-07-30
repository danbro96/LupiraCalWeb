import { describe, expect, it } from 'vitest';
import { formatCoords, osmUrl } from './places';

describe('osmUrl', () => {
  it('builds a map link from numeric coords', () => {
    expect(osmUrl(59.3293, 18.0686)).toBe('https://www.openstreetmap.org/?mlat=59.3293&mlon=18.0686#map=16/59.3293/18.0686');
  });

  it('is null when a component is missing or NaN', () => {
    expect(osmUrl(null, 18)).toBeNull();
    expect(osmUrl(59, undefined)).toBeNull();
    expect(osmUrl(Number.NaN, 18)).toBeNull();
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
