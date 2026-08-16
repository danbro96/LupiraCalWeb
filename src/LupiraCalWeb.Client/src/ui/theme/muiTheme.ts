import { createTheme } from '@mui/material/styles';
import { DARK, LIGHT, type ColorScheme } from '@lupira/cal-tokens/color';
import { PHONE_BREAKPOINT } from '@lupira/cal-tokens/breakpoints';
import { RADII, SPACING } from '@lupira/cal-tokens/spacing';
import { FONT_FAMILY } from '@lupira/cal-tokens/typography';

function palette(c: ColorScheme) {
  return {
    background: { default: c.bg, paper: c.surface },
    primary: { main: c.primary, contrastText: c.onPrimary },
    divider: c.divider,
    text: { primary: c.text, secondary: c.textMuted, disabled: c.textDisabled },
    error: { main: c.danger },
  };
}

export const theme = createTheme({
  // 'media' = system-driven scheme; MUI emits the dark var overrides in a prefers-color-scheme block.
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: { palette: palette(LIGHT) },
    dark: { palette: palette(DARK) },
  },
  // index.html loads no webfont — without this MUI would assume Roboto and change every font.
  typography: { fontFamily: FONT_FAMILY },
  shape: { borderRadius: RADII.md },
  spacing: SPACING.sm,
  breakpoints: {
    // 'md' doubles as the phone breakpoint (down('md') === max-width PHONE_BREAKPOINT.95px),
    // matching the raw 820px media queries in index.css.
    values: { xs: 0, sm: 600, md: PHONE_BREAKPOINT + 1, lg: 1200, xl: 1536 },
  },
});
