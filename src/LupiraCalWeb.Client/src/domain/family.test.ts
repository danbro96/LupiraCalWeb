import { describe, expect, it } from 'vitest';
import { familyKey, railsForDay, type RailSource } from './family';

const day = new Date(2026, 6, 7);

function rail(over: Partial<RailSource> & { itemId: string }): RailSource {
  return {
    title: over.itemId,
    start: day,
    end: null,
    isAllDay: true,
    childCount: 2,
    ...over,
  };
}

describe('familyKey', () => {
  it('groups a child under its parent', () => {
    expect(familyKey({ itemId: 'c', parentItemId: 'p' })).toBe('p');
  });

  it('uses the own id for a parent', () => {
    expect(familyKey({ itemId: 'p', childCount: 3 })).toBe('p');
  });

  it('is undefined for standalone items', () => {
    expect(familyKey({ itemId: 'x', childCount: 0 })).toBeUndefined();
  });

  it('prefers the parent when an item is both child and parent', () => {
    expect(familyKey({ itemId: 'm', parentItemId: 'p', childCount: 2 })).toBe('p');
  });
});

describe('railsForDay', () => {
  it('emits a rail for a single-day all-day parent', () => {
    expect(railsForDay([rail({ itemId: 'p', title: 'Trip' })], day)).toEqual([
      { itemId: 'p', title: 'Trip' },
    ]);
  });

  it('covers the middle day of a multi-day parent', () => {
    const trip = rail({ itemId: 'p', start: new Date(2026, 6, 6), end: new Date(2026, 6, 8) });
    expect(railsForDay([trip], day)).toHaveLength(1);
  });

  it('excludes timed parents', () => {
    expect(railsForDay([rail({ itemId: 'p', isAllDay: false })], day)).toEqual([]);
  });

  it('excludes childless entries', () => {
    expect(railsForDay([rail({ itemId: 'x', childCount: 0 })], day)).toEqual([]);
  });

  it('excludes entries not covering the day', () => {
    expect(railsForDay([rail({ itemId: 'p', start: new Date(2026, 6, 8) })], day)).toEqual([]);
  });

  it('dedups recurring parent occurrences by itemId', () => {
    const trip = rail({ itemId: 'p', end: new Date(2026, 6, 8) });
    expect(railsForDay([trip, { ...trip }], day)).toHaveLength(1);
  });

  it('caps at two rails, earliest starts first, ties broken by itemId', () => {
    const rails = railsForDay(
      [
        rail({ itemId: 'b' }),
        rail({ itemId: 'a' }),
        rail({ itemId: 'c', start: new Date(2026, 6, 6), end: new Date(2026, 6, 8) }),
      ],
      day,
    );
    expect(rails.map((r) => r.itemId)).toEqual(['c', 'a']);
  });
});
