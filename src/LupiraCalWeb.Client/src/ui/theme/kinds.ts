import type { AvailabilityStatus, CalendarKind, ContainerDto, ItemCategory, ParticipationStatus } from '../../data/api/models';
import {
  AVAILABILITY_COLORS as TOKEN_AVAILABILITY_COLORS,
  FAMILY_ACCENTS,
  KIND_COLORS as TOKEN_KIND_COLORS,
  familyAccent,
} from '@lupira/cal-tokens/kinds';
import {
  CALENDAR_KIND_ICONS as TOKEN_CALENDAR_KIND_ICONS,
  ITEM_CATEGORY_ICONS as TOKEN_ITEM_CATEGORY_ICONS,
} from '@lupira/cal-tokens/icons';

// Re-typing the token records against the generated enums is the drift tripwire: when the API adds a
// kind/status/category the tokens package doesn't know, these assignments stop compiling.
const KIND_COLORS: Record<CalendarKind, string> = TOKEN_KIND_COLORS;
export const CALENDAR_KIND_ICONS: Record<CalendarKind, string> = TOKEN_CALENDAR_KIND_ICONS;
export const ITEM_CATEGORY_ICONS: Record<ItemCategory, string> = TOKEN_ITEM_CATEGORY_ICONS;
export const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = TOKEN_AVAILABILITY_COLORS;
export { FAMILY_ACCENTS, familyAccent };

export function calendarColor(c: ContainerDto): string {
  return c.color || (c.kind ? KIND_COLORS[c.kind] : KIND_COLORS.Generic);
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  NeedsAction: 'invited',
  Accepted: 'accepted',
  Declined: 'declined',
  Tentative: 'tentative',
  Delegated: 'delegated',
};
