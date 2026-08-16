import { MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavDarkBase, DefaultTheme as NavLightBase } from '@react-navigation/native';
import { DARK, LIGHT, type ColorScheme } from '@lupira/cal-tokens/color';

function md3Colors(c: ColorScheme) {
  return {
    primary: c.primary,
    onPrimary: c.onPrimary,
    background: c.bg,
    onBackground: c.text,
    surface: c.surface,
    onSurface: c.text,
    onSurfaceVariant: c.textMuted,
    outline: c.border,
    outlineVariant: c.divider,
    error: c.danger,
  };
}

export const paperLight = { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, ...md3Colors(LIGHT) } };
export const paperDark = { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, ...md3Colors(DARK) } };

const adapted = adaptNavigationTheme({
  reactNavigationLight: NavLightBase,
  reactNavigationDark: NavDarkBase,
  materialLight: paperLight,
  materialDark: paperDark,
});

export const navLight = adapted.LightTheme;
export const navDark = adapted.DarkTheme;
