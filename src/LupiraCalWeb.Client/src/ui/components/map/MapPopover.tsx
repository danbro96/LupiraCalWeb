import { useEffect, useState, type ReactNode } from 'react';
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
    <div className="map-popover" style={{ left: point.x, top: point.y }}>
      <button className="map-popover-close" onClick={onClose} aria-label="Close">×</button>
      {children}
    </div>
  );
}
