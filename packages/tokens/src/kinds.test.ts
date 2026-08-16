import { describe, expect, it } from 'vitest';
import { familyAccent, hashColor } from './kinds.ts';

// The hash outputs are user-visible color assignments persisted nowhere — changing either function
// silently rescrambles every calendar/family color on both platforms. Pin known outputs.
describe('color hashes are stable', () => {
  it('familyAccent', () => {
    expect(familyAccent('a')).toBe('#ca8a04');
    expect(familyAccent('parent-item-id')).toBe('#0284c7');
  });

  it('hashColor', () => {
    expect(hashColor('a')).toBe('#0e7490');
    expect(hashColor('11111111-2222-3333-4444-555555555555')).toBe('#4457c2');
  });
});
