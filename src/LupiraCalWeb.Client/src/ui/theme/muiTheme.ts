import { createTheme } from '@mui/material/styles';
import { DARK, LIGHT, type ColorScheme } from '@lupira/cal-tokens/color';
import { PHONE_BREAKPOINT } from '@lupira/cal-tokens/breakpoints';
import { RADII, SPACING } from '@lupira/cal-tokens/spacing';
import { FONT_FAMILY } from '@lupira/cal-tokens/typography';
import {
  CATEGORY_COLORS_DARK,
  CATEGORY_COLORS_LIGHT,
  type ContactCategoryName,
} from '@lupira/cal-tokens/contactCategories';

declare module '@mui/material/styles' {
  interface Palette {
    border: string;
  }
  interface PaletteOptions {
    border?: string;
  }
  interface TypeText {
    subtle: string;
  }
}

function palette(c: ColorScheme) {
  return {
    background: { default: c.bg, paper: c.surface },
    primary: { main: c.primary, contrastText: c.onPrimary },
    divider: c.divider,
    border: c.border,
    text: { primary: c.text, secondary: c.textMuted, disabled: c.textDisabled, subtle: c.textSubtle },
    error: { main: c.danger },
    warning: { main: c.warning },
    success: { main: c.success },
  };
}

// Domain palette with no MUI slot; @theme re-exports these as Tailwind cat-* utilities.
const catVars = (o: Record<ContactCategoryName, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [`--cat-${k.toLowerCase()}`, v]));

export const theme = createTheme({
  // 'media' = system-driven scheme; MUI emits the dark var overrides in a prefers-color-scheme block.
  cssVariables: { colorSchemeSelector: 'media' },
  // Emotion injects unlayered, which outranks every layer — utilities would silently lose.
  // 'bespoke' before 'mui' keeps MUI winning that tie for the few structural hooks left.
  modularCssLayers: '@layer theme, base, bespoke, mui, utilities;',
  colorSchemes: {
    light: { palette: palette(LIGHT) },
    dark: { palette: palette(DARK) },
  },
  // index.html loads no webfont — without this MUI would assume Roboto and change every font.
  typography: { fontFamily: FONT_FAMILY },
  shape: { borderRadius: RADII.md },
  spacing: SPACING.sm,
  breakpoints: {
    // 'md' doubles as the phone breakpoint (down('md') === max-width PHONE_BREAKPOINT.95px);
    // responsive sx values key off it, and useIsPhone wraps the same query.
    values: { xs: 0, sm: 600, md: PHONE_BREAKPOINT + 1, lg: 1200, xl: 1536 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          ...catVars(CATEGORY_COLORS_LIGHT),
          '@media (prefers-color-scheme: dark)': catVars(CATEGORY_COLORS_DARK),
        },
      },
    },
    // The app is uniformly compact; opt out per-instance rather than repeating size="small".
    MuiButton: { defaultProps: { size: 'small' } },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiChip: { defaultProps: { size: 'small' } },
    MuiToggleButtonGroup: { defaultProps: { size: 'small' } },
    MuiLink: { defaultProps: { underline: 'hover' } },
  },
});
