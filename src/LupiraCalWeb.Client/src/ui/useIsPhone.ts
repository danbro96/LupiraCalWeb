import useMediaQuery from '@mui/material/useMediaQuery';
import { theme } from './theme/muiTheme';

/** True below the phone breakpoint; drives structural (non-CSS) layout switches only. */
export function useIsPhone(): boolean {
  // down('md') === (max-width: PHONE_BREAKPOINT.95px) — equivalent to the raw 820px queries in index.css.
  return useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
}
