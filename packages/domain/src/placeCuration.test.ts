import { describe, expect, it } from 'vitest';
import { classifyOrphan, defaultPruneSelection } from './placeCuration';

const zero = { contactRefs: 0, calendarLiveRefs: 0, calendarDeletedRefs: 0, savedPlaceRefs: 0 };

describe('classifyOrphan', () => {
  it('is prunable with no references at all', () => {
    expect(classifyOrphan(zero)).toBe('prunable');
  });

  it('is referencedByDeletedOnly when only deleted calendar items point at it', () => {
    expect(classifyOrphan({ ...zero, calendarDeletedRefs: 3 })).toBe('referencedByDeletedOnly');
  });

  it('any live reference wins over deleted-only', () => {
    expect(classifyOrphan({ ...zero, calendarDeletedRefs: 3, contactRefs: 1 })).toBe('referenced');
    expect(classifyOrphan({ ...zero, calendarLiveRefs: 1 })).toBe('referenced');
    expect(classifyOrphan({ ...zero, savedPlaceRefs: 2 })).toBe('referenced');
  });
});

describe('defaultPruneSelection', () => {
  it('selects prunable rows only, excluding deleted-only and referenced', () => {
    const rows = [
      { placeId: 'a', ...zero },
      { placeId: 'b', ...zero, calendarDeletedRefs: 1 },
      { placeId: 'c', ...zero, contactRefs: 1 },
      { placeId: 'd', ...zero },
    ];
    expect(defaultPruneSelection(rows)).toEqual(['a', 'd']);
  });

  it('is empty for no rows', () => {
    expect(defaultPruneSelection([])).toEqual([]);
  });
});
