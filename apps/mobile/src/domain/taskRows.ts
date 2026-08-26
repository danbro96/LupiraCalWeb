import { ymd } from '@lupira/cal-domain/time';

/** Task deadlines are the grids' third entry source (after items and birthdays), fetched online-only —
 *  they never touch the SQLite mirror. Rows are GridRow-shaped so the render sites take them unchanged;
 *  `dueAt` means "done by", so a deadline pins to its local due day as an all-day entry (the exact time
 *  shows on the TaskDetail screen). */

export type TaskLike = {
  id: string;
  listId: string;
  title: string;
  dueAt?: string | null;
  status: string;
};

export type TaskDeadlineRow = {
  source: 'task';
  source_id: string;
  start_utc: string;
  end_utc: null;
  start_day: string;
  all_day: 1;
  title: string | null;
  status: string | null;
  calendar_id: null;
  is_availability: 0;
  avail_status: null;
  task: { listId: string; itemId: string; dueAt: string; overdue: boolean };
};

/** Drops undated tasks and Cancelled (closed but `completed: false` server-side, so the
 *  completed=false fetch still returns it). */
export function taskDeadlineRows(items: TaskLike[], now: Date): TaskDeadlineRow[] {
  return items.flatMap((t) => {
    if (!t.dueAt || t.status === 'Cancelled') return [];
    const due = new Date(t.dueAt);
    return [{
      source: 'task' as const,
      source_id: t.id,
      start_utc: t.dueAt,
      end_utc: null,
      start_day: ymd(due),
      all_day: 1 as const,
      title: t.title,
      status: t.status,
      calendar_id: null,
      is_availability: 0 as const,
      avail_status: null,
      task: { listId: t.listId, itemId: t.id, dueAt: t.dueAt, overdue: due < now },
    }];
  });
}

export function isTaskRow(r: { source: string }): r is TaskDeadlineRow {
  return r.source === 'task';
}

/** Half-open [dueFrom, dueTo) covering the LOCAL month, in the ISO instants the API filters on. */
export function monthUtcRange(monthKey: string): { dueFrom: string; dueTo: string } {
  const [y, m] = monthKey.split('-').map(Number);
  return {
    dueFrom: new Date(y, m - 1, 1).toISOString(),
    dueTo: new Date(y, m, 1).toISOString(),
  };
}

export function taskDeepLink(listId: string, itemId: string): string {
  return `lupiratasks://task/${listId}/${itemId}`;
}
