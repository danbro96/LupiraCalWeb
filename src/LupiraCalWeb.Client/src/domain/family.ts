// Family identity and per-day parent rails for the calendar grids.

import { sameDay } from './time';

export interface FamilyFields {
  itemId: string;
  parentItemId?: string | null;
  childCount?: number;
}

/** Groups an entry with its parent/children; undefined for standalone items. */
export function familyKey(e: FamilyFields): string | undefined {
  return e.parentItemId ?? ((e.childCount ?? 0) > 0 ? e.itemId : undefined);
}

export interface RailSource extends FamilyFields {
  title: string;
  start: Date;
  end: Date | null;
  isAllDay: boolean;
}

export interface DayRail {
  /** Parent item id — also the family key. */
  itemId: string;
  title: string;
}

export const MAX_RAILS_PER_DAY = 2;

/**
 * Spine rails for one day: all-day parents (childCount > 0) covering the day, using the same
 * coverage predicate as the all-day chip strip so rails always match chips. Recurring parents
 * dedup by itemId; sorted by start then itemId (stable slots across days); capped, extras dropped.
 */
export function railsForDay(entries: RailSource[], day: Date): DayRail[] {
  const seen = new Set<string>();
  return entries
    .filter(
      (e) =>
        e.isAllDay &&
        (e.childCount ?? 0) > 0 &&
        (sameDay(e.start, day) || (e.end !== null && e.start <= day && e.end >= day)),
    )
    .filter((e) => !seen.has(e.itemId) && seen.add(e.itemId))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.itemId.localeCompare(b.itemId))
    .slice(0, MAX_RAILS_PER_DAY)
    .map((e) => ({ itemId: e.itemId, title: e.title }));
}
