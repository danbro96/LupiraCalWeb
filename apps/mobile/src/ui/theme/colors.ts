import { DARK, LIGHT, type ColorScheme } from '@lupira/cal-tokens/color';

/** The shared estate core. This app adds no semantics of its own — its banner rides MD3's
 *  errorContainer, and calendar/availability hues come from `@lupira/cal-tokens/kinds`. */
export type Palette = ColorScheme;

export const lightColors: Palette = LIGHT;
export const darkColors: Palette = DARK;
