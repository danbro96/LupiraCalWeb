import { describe, expect, it } from 'vitest';
import { ymd } from '@lupira/cal-domain/time';
import { isTaskRow, monthUtcRange, taskDeadlineRows, taskDeepLink, type TaskLike } from './taskRows';

const task = (over: Partial<TaskLike>): TaskLike => ({
  id: 'i1',
  listId: 'l1',
  title: 'Renew passport',
  dueAt: '2026-08-15T10:00:00+02:00',
  status: 'Open',
  ...over,
});

describe('taskDeadlineRows', () => {
  it('pins a deadline to the LOCAL day of dueAt as an all-day row', () => {
    // Construct dueAt from a local Date so the assertion holds in every timezone.
    const local = new Date(2026, 7, 15, 23, 30);
    const rows = taskDeadlineRows([task({ dueAt: local.toISOString() })], new Date(2026, 7, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0].start_day).toBe(ymd(local));
    expect(rows[0].all_day).toBe(1);
    expect(rows[0].start_utc).toBe(local.toISOString());
    expect(rows[0].task).toEqual({ listId: 'l1', itemId: 'i1', dueAt: local.toISOString(), overdue: false });
  });

  it('marks overdue strictly when dueAt < now', () => {
    const due = new Date(2026, 7, 15, 12, 0);
    const at = (now: Date) => taskDeadlineRows([task({ dueAt: due.toISOString() })], now)[0].task.overdue;
    expect(at(new Date(2026, 7, 15, 11, 59))).toBe(false);
    expect(at(due)).toBe(false);
    expect(at(new Date(2026, 7, 15, 12, 1))).toBe(true);
  });

  it('drops undated and Cancelled tasks', () => {
    const rows = taskDeadlineRows(
      [task({ id: 'a', dueAt: null }), task({ id: 'b', status: 'Cancelled' }), task({ id: 'c' })],
      new Date(),
    );
    expect(rows.map((r) => r.source_id)).toEqual(['c']);
  });
});

describe('isTaskRow', () => {
  it('narrows on source', () => {
    const row = taskDeadlineRows([task({})], new Date())[0];
    expect(isTaskRow(row)).toBe(true);
    expect(isTaskRow({ source: 'item' })).toBe(false);
    expect(isTaskRow({ source: 'birthday' })).toBe(false);
  });
});

describe('monthUtcRange', () => {
  it('spans the local month half-open', () => {
    const { dueFrom, dueTo } = monthUtcRange('2026-08');
    expect(dueFrom).toBe(new Date(2026, 7, 1).toISOString());
    expect(dueTo).toBe(new Date(2026, 8, 1).toISOString());
  });

  it('rolls the year at December', () => {
    expect(monthUtcRange('2026-12').dueTo).toBe(new Date(2027, 0, 1).toISOString());
  });
});

describe('taskDeepLink', () => {
  it('builds the tasks-app route', () => {
    expect(taskDeepLink('l1', 'i1')).toBe('lupiratasks://task/l1/i1');
  });
});
