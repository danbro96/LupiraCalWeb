import type { AvailabilityStatus, CalendarKind, ContainerDto, ItemCategory, ParticipationStatus } from '../../data/api/models';

/** Fallback calendar colors by kind (used when the container has no stored color). */
const KIND_COLORS: Record<CalendarKind, string> = {
  Personal: '#1d6feb',
  Group: '#0e7490',
  Birthdays: '#db2777',
  Availability: '#16a34a',
  Inbox: '#6b7280',
  LlmPrompts: '#9333ea',
  UserCheckIn: '#ea580c',
  DevOps: '#475569',
  FoodPlan: '#65a30d',
  Generic: '#64748b',
};

export function calendarColor(c: ContainerDto): string {
  return c.color || (c.kind ? KIND_COLORS[c.kind] : KIND_COLORS.Generic);
}

export const CALENDAR_KIND_ICONS: Record<CalendarKind, string> = {
  Personal: '👤',
  Group: '👥',
  Birthdays: '🎂',
  Availability: '🕘',
  Inbox: '📥',
  LlmPrompts: '🤖',
  UserCheckIn: '☑️',
  DevOps: '🛠️',
  FoodPlan: '🍽️',
  Generic: '📅',
};

export const ITEM_CATEGORY_ICONS: Partial<Record<ItemCategory, string>> = {
  General: '📅',
  Meeting: '👥',
  Appointment: '🩺',
  Meal: '🍽️',
  Occasion: '🎉',
  Outing: '🚶',
  Trip: '🧳',
  Stay: '🏨',
  Activity: '🏃',
  Focus: '🎯',
  Chore: '🧹',
};

export const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
  Office: '#2563eb',
  Home: '#16a34a',
  Vacation: '#f59e0b',
  Sick: '#dc2626',
  Leave: '#9333ea',
};

/** Accents for parent/child item families — a separate color channel from calendar colors. */
export const FAMILY_ACCENTS = [
  '#e11d48', // rose
  '#d97706', // amber
  '#7c3aed', // violet
  '#059669', // emerald
  '#c026d3', // fuchsia
  '#0284c7', // sky
  '#ca8a04', // dark yellow
  '#dc2626', // red
] as const;

export function familyAccent(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  return FAMILY_ACCENTS[h % FAMILY_ACCENTS.length];
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  NeedsAction: 'invited',
  Accepted: 'accepted',
  Declined: 'declined',
  Tentative: 'tentative',
  Delegated: 'delegated',
};
