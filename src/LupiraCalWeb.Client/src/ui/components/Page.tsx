import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

/** Standard content column. Narrow screens drop the wider horizontal padding. */
export function Page({ children }: { children?: ReactNode }) {
  return <Box sx={{ p: { xs: 2, md: '16px 24px' }, maxWidth: 900 }}>{children}</Box>;
}

/** Title row: heading left, actions right. */
export function PageHead({ children }: { children?: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      {children}
    </Stack>
  );
}
