import type { ReactNode } from 'react';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import { useIsPhone } from '../../useIsPhone';

/** Shared shell for the ?item= / ?task= / birthday detail cards: right drawer on desktop, bottom sheet on phones. */
export function DetailDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const isPhone = useIsPhone();
  return (
    <Drawer
      anchor={isPhone ? 'bottom' : 'right'}
      open
      onClose={onClose}
      slotProps={{ paper: { sx: isPhone ? { maxHeight: '85dvh' } : { width: 'min(480px, 100vw)' } } }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, position: 'sticky', top: 0, bgcolor: 'background.default', zIndex: 1 }}>
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      {children}
    </Drawer>
  );
}
