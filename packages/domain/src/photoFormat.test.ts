import { describe, expect, it } from 'vitest';
import { fmtBytes, fmtDimensions, fmtDuration } from './photoFormat';

describe('fmtBytes', () => {
  it('scales through the binary units', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(1024)).toBe('1 kB');
    expect(fmtBytes(1536)).toBe('1.5 kB');
    expect(fmtBytes(4.2 * 1024 * 1024)).toBe('4.2 MB');
    expect(fmtBytes(3 * 1024 ** 3)).toBe('3 GB');
  });

  it('drops the decimal once it is noise', () => {
    expect(fmtBytes(742 * 1024)).toBe('742 kB');
  });

  it('handles zero and rejects nonsense', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(-1)).toBe('—');
    expect(fmtBytes(Number.NaN)).toBe('—');
  });
});

describe('fmtDuration', () => {
  it('reads as a clock', () => {
    expect(fmtDuration(9)).toBe('0:09');
    expect(fmtDuration(83)).toBe('1:23');
    expect(fmtDuration(600)).toBe('10:00');
  });

  it('grows an hours field only when needed', () => {
    expect(fmtDuration(3723)).toBe('1:02:03');
    expect(fmtDuration(3599)).toBe('59:59');
  });

  it('rounds fractional seconds and rejects nonsense', () => {
    expect(fmtDuration(12.4)).toBe('0:12');
    expect(fmtDuration(-5)).toBe('—');
    expect(fmtDuration(Number.NaN)).toBe('—');
  });
});

describe('fmtDimensions', () => {
  it('formats a pair and nothing else', () => {
    expect(fmtDimensions(4032, 3024)).toBe('4032 × 3024');
    // An unprocessed asset has no dimensions yet — the caller renders nothing rather than "null × null".
    expect(fmtDimensions(null, 3024)).toBeNull();
    expect(fmtDimensions(undefined, undefined)).toBeNull();
  });
});
