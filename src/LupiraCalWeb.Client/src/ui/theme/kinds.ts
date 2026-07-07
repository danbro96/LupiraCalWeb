import type { AvailabilityStatus, CalendarKind, ContainerDto, ItemKind, ParticipationStatus } from '../../data/api/models';

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

export const ITEM_KIND_ICONS: Partial<Record<ItemKind, string>> = {
  Travel: '🧳',
  Flight: '✈️',
  Train: '🚆',
  Bus: '🚌',
  Car: '🚗',
  Lodging: '🏨',
  Appointment: '🩺',
  Ticketed: '🎫',
  Delivery: '📦',
  Bill: '💰',
  Availability: '🕘',
};

export const AVAILABILITY_COLORS: Record<AvailabilityStatus, string> = {
  Office: '#2563eb',
  Home: '#16a34a',
  Vacation: '#f59e0b',
  Sick: '#dc2626',
  Leave: '#9333ea',
};

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  NeedsAction: 'invited',
  Accepted: 'accepted',
  Declined: 'declined',
  Tentative: 'tentative',
  Delegated: 'delegated',
};
