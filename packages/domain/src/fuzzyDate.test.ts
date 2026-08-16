import { describe, expect, it } from 'vitest';
import { fmtFuzzyDate, fmtResidencyPeriod, fuzzyToInput, parseFuzzyInput, residencyStatus } from './fuzzyDate';

describe('fmtFuzzyDate / fmtResidencyPeriod', () => {
  it('formats each precision', () => {
    expect(fmtFuzzyDate({ year: 2015 })).toBe('2015');
    expect(fmtFuzzyDate({ year: 2015, month: 6 })).toBe('Jun 2015');
    expect(fmtFuzzyDate({ year: 2015, month: 6, day: 12 })).toBe('12 Jun 2015');
  });

  it('renders open-ended periods with ?', () => {
    expect(fmtResidencyPeriod({ year: 2010 }, { year: 2015 })).toBe('2010–2015');
    expect(fmtResidencyPeriod(null, { year: 2015 })).toBe('?–2015');
    expect(fmtResidencyPeriod({ year: 2010 }, null)).toBe('2010–?');
  });
});

describe('parseFuzzyInput / fuzzyToInput', () => {
  it('round-trips all precisions', () => {
    for (const s of ['2015', '2015-06', '2015-06-12']) {
      expect(fuzzyToInput(parseFuzzyInput(s))).toBe(s);
    }
  });

  it('accepts single-digit month/day and canonicalizes', () => {
    expect(fuzzyToInput(parseFuzzyInput('2015-6-2'))).toBe('2015-06-02');
  });

  it('rejects invalid values', () => {
    expect(parseFuzzyInput('2015-13')).toBeNull();
    expect(parseFuzzyInput('2015-06-31')).toBeNull();
    expect(parseFuzzyInput('2015-00')).toBeNull();
    expect(parseFuzzyInput('june 2015')).toBeNull();
    expect(parseFuzzyInput('15')).toBeNull();
    expect(parseFuzzyInput('')).toBeNull();
  });

  it('accepts leap day only in leap years', () => {
    expect(parseFuzzyInput('2016-02-29')).not.toBeNull();
    expect(parseFuzzyInput('2015-02-29')).toBeNull();
  });

  it('fuzzyToInput of null is empty', () => {
    expect(fuzzyToInput(null)).toBe('');
  });
});

describe('residencyStatus', () => {
  const today = new Date(2026, 7, 16); // 16 Aug 2026

  it('no dates = active', () => {
    expect(residencyStatus(null, null, today)).toBe('active');
  });

  it('past move-out = former; future or ambiguous move-out = active', () => {
    expect(residencyStatus(null, { year: 2015 }, today)).toBe('former');
    expect(residencyStatus(null, { year: 2026, month: 7 }, today)).toBe('former');
    expect(residencyStatus(null, { year: 2026, month: 12 }, today)).toBe('active'); // planned move
    expect(residencyStatus(null, { year: 2026 }, today)).toBe('active');            // could still be ahead
  });

  it('future move-in = future; ambiguous move-in = active', () => {
    expect(residencyStatus({ year: 2027 }, null, today)).toBe('future');
    expect(residencyStatus({ year: 2026 }, null, today)).toBe('active');
    expect(residencyStatus({ year: 2026, month: 9 }, null, today)).toBe('future');
  });

  it('future move-in wins over past move-out ordering edge', () => {
    expect(residencyStatus({ year: 2027 }, { year: 2028 }, today)).toBe('future');
  });
});
