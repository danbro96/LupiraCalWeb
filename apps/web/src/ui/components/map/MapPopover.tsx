import { useEffect, useState, type ReactNode } from 'react';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import { useMap } from './MapCanvas';

export interface PopoverAnchor {
  lngLat: [number, number];
}

/** HTML overlay anchored to a map coordinate (site styling, no MapLibre Popup DOM). */
export function MapPopover({ anchor, onClose, children }: {
  anchor: PopoverAnchor;
  onClose: () => void;
  children: ReactNode;
}) {
  const map = useMap();
  const [point, setPoint] = useState(() => map.project(anchor.lngLat));

  useEffect(() => {
    const update = () => setPoint(map.project(anchor.lngLat));
    update();
    map.on('move', update);
    return () => { map.off('move', update); };
  }, [map, anchor]);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        zIndex: 7,
        transform: 'translate(-50%, calc(-100% - 12px))',
        borderRadius: '10px',
        p: '8px 12px',
        minWidth: 180,
        maxWidth: 280,
      }}
      style={{ left: point.x, top: point.y }}
    >
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', top: 0, right: 0 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      {children}
    </Paper>
  );
}
