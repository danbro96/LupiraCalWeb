import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/** Fills the remaining height; children lay out as a row (desktop) or a column (phone stack). */
export function PaneFrame({ column, children }: { column?: boolean; children?: ReactNode }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: column ? 'column' : 'row' }}>
      {children}
    </Box>
  );
}

/** Left/middle pane: a fixed rail on desktop, full width once the panes stack. */
export function SidePane({ width, component, children }: { width: number; component?: 'aside' | 'div'; children?: ReactNode }) {
  return (
    <Box
      component={component ?? 'div'}
      sx={{
        width: { xs: 'auto', md: width },
        flex: { xs: 1, md: 'none' },
        borderRight: { xs: 0, md: 1 },
        borderColor: 'divider',
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {children}
    </Box>
  );
}

/** Right pane: the routed detail. */
export function DetailPane({ children }: { children?: ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: { xs: 2, md: '16px 24px' } }}>{children}</Box>
  );
}
