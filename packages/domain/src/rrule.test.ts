import { describe, expect, it } from 'vitest';
import { describeRrule } from './rrule';

describe('describeRrule', () => {
  it('describes simple frequencies', () => {
    expect(describeRrule('FREQ=DAILY')).toBe('Every day');
    expect(describeRrule('FREQ=WEEKLY')).toBe('Every week');
    expect(describeRrule('RRULE:FREQ=YEARLY')).toBe('Every year');
  });

  it('handles interval, byday, count and until', () => {
    expect(describeRrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')).toBe('Every 2 weeks on Mon, Wed');
    expect(describeRrule('FREQ=DAILY;COUNT=10')).toBe('Every day, 10 times');
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=15')).toBe('Every month on day 15');
    expect(describeRrule('FREQ=WEEKLY;UNTIL=20261231T000000Z')).toBe('Every week, until 2026-12-31');
  });

  it('falls back to the raw rule when unparseable', () => {
    expect(describeRrule('FREQ=SECONDLY')).toBe('FREQ=SECONDLY');
  });
});
