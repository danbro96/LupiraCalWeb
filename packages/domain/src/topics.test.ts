import { describe, expect, it } from 'vitest';
import { groupMessagesByDay, topicHeadline } from './topics';

const at = (iso: string) => ({ timestamp: iso });

describe('topicHeadline', () => {
  it('quotes the provisional label until a model has titled the topic', () => {
    expect(topicHeadline({ label: 'So ready', titled: false })).toBe('“So ready”');
    expect(topicHeadline({ label: 'Sailboat maintenance', titled: true })).toBe('Sailboat maintenance');
  });

  it('falls back when the label is blank', () => {
    expect(topicHeadline({ label: '   ', titled: false })).toBe('(untitled)');
  });
});

describe('groupMessagesByDay', () => {
  it('breaks on each new local day, keeping input order', () => {
    const grouped = groupMessagesByDay([
      at('2026-07-27T21:41:43+02:00'),
      at('2026-07-27T23:10:00+02:00'),
      at('2026-07-28T06:25:32+02:00'),
    ]);
    expect(grouped.map((d) => [d.day, d.messages.length])).toEqual([
      ['2026-07-27', 2],
      ['2026-07-28', 1],
    ]);
  });

  it('starts a new group when a day repeats non-consecutively', () => {
    const grouped = groupMessagesByDay([
      at('2026-07-27T10:00:00Z'),
      at('2026-07-28T10:00:00Z'),
      at('2026-07-27T11:00:00Z'),
    ]);
    expect(grouped).toHaveLength(3);
  });

  it('is empty for no messages', () => {
    expect(groupMessagesByDay([])).toEqual([]);
  });
});
