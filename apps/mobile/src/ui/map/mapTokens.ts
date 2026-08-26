import type { MapTheme } from '../../data/mapStyle';

/**
 * Web-canonical map layer palette (src/LupiraCalWeb.Client/src/ui/components/map/mapTokens.ts) —
 * dataviz-validated; don't tweak hues casually. Only the layers the mobile map renders are copied.
 */
export const MAP_COLORS: Record<MapTheme, { saved: string; eventFallback: string; photo: string; ring: string; ink: string }> = {
  light: { saved: '#eda100', eventFallback: '#2a78d6', photo: '#4a3aa7', ring: '#fcfcfb', ink: '#0b0b0b' },
  dark: { saved: '#c98500', eventFallback: '#3987e5', photo: '#9085e9', ring: '#1a1a19', ink: '#ffffff' },
};
