import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemDoc } from '../domain/docTypes';
import { emptyItemGuards } from '../domain/docTypes';
import type { OccurrenceRow } from '../domain/materialize';
import { openNodeDb } from './db/nodeDb';
import { migrate } from './db/schema';
import type { Db } from './db/types';
import { mapEventRowsBetween, saveItem } from './mirror';

let db: Db;

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
});

const doc = (id: string, placeId: string | null, calendars: { calendarId: string; status: string }[]): ItemDoc => ({
  id, title: `Item ${id}`, isAllDay: false, placeId,
  calendars: calendars as ItemDoc['calendars'],
});

const occ = (sourceId: string, day: string, time = '09:00'): OccurrenceRow => ({
  source: 'item', sourceId, startUtc: `${day}T${time}:00.000Z`, endUtc: null, startDay: day, allDay: false,
});

describe('mapEventRowsBetween', () => {
  it('returns placed items in range with the Accepted calendar preferred', async () => {
    await db.exclusive(async (tx) => {
      await saveItem(tx, { doc: doc('a', 'place-1', [
        { calendarId: 'cal-z', status: 'Proposed' },
        { calendarId: 'cal-a', status: 'Accepted' },
      ]), guards: emptyItemGuards(), deleted: false }, [occ('a', '2026-08-10')]);
    });

    const rows = await mapEventRowsBetween(db, '2026-08-01', '2026-08-31');
    expect(rows).toEqual([{
      source_id: 'a', start_utc: '2026-08-10T09:00:00.000Z', title: 'Item a',
      place_id: 'place-1', calendar_id: 'cal-a',
    }]);
  });

  it('collapses a recurring item to its earliest occurrence in the window', async () => {
    await db.exclusive(async (tx) => {
      await saveItem(tx, { doc: doc('r', 'place-1', [{ calendarId: 'cal-a', status: 'Accepted' }]),
        guards: emptyItemGuards(), deleted: false },
      [occ('r', '2026-08-20'), occ('r', '2026-08-06'), occ('r', '2026-08-13')]);
    });

    const rows = await mapEventRowsBetween(db, '2026-08-01', '2026-08-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].start_utc).toBe('2026-08-06T09:00:00.000Z');
  });

  it('excludes unplaced items, deleted items, and occurrences outside the range', async () => {
    await db.exclusive(async (tx) => {
      await saveItem(tx, { doc: doc('unplaced', null, [{ calendarId: 'cal-a', status: 'Accepted' }]),
        guards: emptyItemGuards(), deleted: false }, [occ('unplaced', '2026-08-10')]);
      await saveItem(tx, { doc: doc('deleted', 'place-2', [{ calendarId: 'cal-a', status: 'Accepted' }]),
        guards: emptyItemGuards(), deleted: true }, [occ('deleted', '2026-08-11')]);
      await saveItem(tx, { doc: doc('outside', 'place-3', [{ calendarId: 'cal-a', status: 'Accepted' }]),
        guards: emptyItemGuards(), deleted: false }, [occ('outside', '2026-09-05')]);
    });

    expect(await mapEventRowsBetween(db, '2026-08-01', '2026-08-31')).toEqual([]);
  });
});
