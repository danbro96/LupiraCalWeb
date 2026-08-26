import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** Full-height centered message — used for loading, invalid-link, and error states. */
export function Centered({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Stack
      spacing={1}
      sx={{ minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}
    >
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
