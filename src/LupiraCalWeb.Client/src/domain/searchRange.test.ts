import { describe, expect, it } from 'vitest';
import { rangeToWindow } from './searchRange';

const now = new Date(2026, 6, 12, 14, 30); // local 2026-07-12 14:30
const midnight = new Date(2026, 6, 12).toISOString();

describe('rangeToWindow', () => {
  it('upcoming starts at local midnight today, ascending', () => {
    expect(rangeToWindow('upcoming', null, null, now)).toEqual({ from: midnight, desc: false });
  });

  it('past ends at local midnight today, newest first', () => {
    expect(rangeToWindow('past', null, null, now)).toEqual({ to: midnight, desc: true });
  });

  it('all sets no bounds', () => {
    expect(rangeToWindow('all', null, null, now)).toEqual({ desc: false });
  });

  it('custom bounds are local days with an inclusive end', () => {
    const w = rangeToWindow('custom', '2026-01-01', '2026-01-31', now);
    expect(w.from).toBe(new Date(2026, 0, 1).toISOString());
    // inclusive end day → exclusive bound at the next local midnight
    expect(w.to).toBe(new Date(2026, 1, 1).toISOString());
    expect(w.desc).toBe(false);
  });

  it('custom tolerates missing bounds', () => {
    expect(rangeToWindow('custom', null, '2026-01-31', now).from).toBeUndefined();
    expect(rangeToWindow('custom', '2026-01-01', null, now).to).toBeUndefined();
  });
});
