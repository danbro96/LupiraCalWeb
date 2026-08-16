import type { CalendarKindName } from './kinds.ts';

export type ItemCategoryName =
  | 'General'
  | 'Meeting'
  | 'Appointment'
  | 'Meal'
  | 'Occasion'
  | 'Outing'
  | 'Trip'
  | 'Stay'
  | 'Activity'
  | 'Focus'
  | 'Chore';

export const CALENDAR_KIND_ICONS: Record<CalendarKindName, string> = {
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

export const ITEM_CATEGORY_ICONS: Record<ItemCategoryName, string> = {
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
