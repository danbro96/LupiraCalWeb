import { describe, expect, it } from 'vitest';
import { describeFire } from './fire';

describe('describeFire', () => {
  it('describes the flattened fire union', () => {
    expect(describeFire('OnStart')).toBe('at start');
    expect(describeFire('OnEnd')).toBe('at end');
    expect(describeFire('Offset', -30)).toBe('30 min before start');
    expect(describeFire('Offset', -120)).toBe('2 h before start');
    expect(describeFire('Offset', 15)).toBe('15 min after start');
    expect(describeFire('AllDayAt', null, '09:00:00')).toBe('at 09:00 on the day');
  });
});
