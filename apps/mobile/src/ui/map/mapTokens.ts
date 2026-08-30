import type { MapTheme } from '../../data/mapStyle';

/** Web-canonical map layer palette (`src/LupiraCalWeb.Client/src/ui/components/map/mapTokens.ts`) —
 *  dataviz-validated; don't tweak hues casually. The activity set is the one true categorical scale
 *  (all segments co-visible); Unknown is the neutral non-category and renders DASHED grey, never as a
 *  fifth hue. Cross-layer hue reuse (saved≈Cycle) is disambiguated by mark shape, rings and toggles. */
export const ACTIVITY_COLORS: Record<MapTheme, Record<string, string>> = {
  light: { Walk: '#008300', Run: '#e87ba4', Cycle: '#eda100', Vehicle: '#2a78d6', Unknown: '#898781' },
  dark: { Walk: '#008300', Run: '#d55181', Cycle: '#c98500', Vehicle: '#3987e5', Unknown: '#898781' },
};

export const MAP_COLORS: Record<MapTheme, {
  visitFill: string; contact: string; saved: string; photo: string;
  eventFallback: string; currentFill: string; ring: string; ink: string;
}> = {
  light: {
    visitFill: '#4a3aa7',
    contact: '#e34948',
    saved: '#eda100',
    photo: '#7c3aed',
    eventFallback: '#2a78d6',
    currentFill: '#0b0b0b',
    ring: '#fcfcfb',
    ink: '#0b0b0b',
  },
  dark: {
    visitFill: '#9085e9',
    contact: '#e66767',
    saved: '#c98500',
    photo: '#a78bfa',
    eventFallback: '#3987e5',
    currentFill: '#ffffff',
    ring: '#1a1a19',
    ink: '#ffffff',
  },
};

/** MapLibre `match` expression over the feature's activity property. */
export function activityColorExpression(theme: MapTheme): unknown[] {
  const colors = ACTIVITY_COLORS[theme];
  return [
    'match', ['get', 'activity'],
    'Walk', colors.Walk,
    'Run', colors.Run,
    'Cycle', colors.Cycle,
    'Vehicle', colors.Vehicle,
    colors.Unknown,
  ];
}
