import Stack from '@mui/material/Stack';
import type { StackProps } from '@mui/material/Stack';
import type { ElementType } from 'react';

// useFlexGap because Stack's default margin spacing breaks on wrap.
const ROW = { direction: 'row', alignItems: 'center', spacing: 1, useFlexGap: true, flexWrap: 'wrap' } as const;

/** Wrapping row of form controls. Pass component="form" to submit from the row itself. */
export function FormRow({ sx, component, ...props }: StackProps & { component?: ElementType }) {
  const merged = { ...ROW, sx: { my: 1, ...sx }, ...props };
  return component ? <Stack component={component} {...merged} /> : <Stack {...merged} />;
}
