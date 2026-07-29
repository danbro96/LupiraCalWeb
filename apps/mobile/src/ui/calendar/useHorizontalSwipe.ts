import { useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';

const DISTANCE = 60;
/// Only claim clearly-horizontal gestures: vertical ones belong to the day sheet's drag and the
/// week view's hour scroll.
const HORIZONTAL_RATIO = 1.6;

/// While a horizontal drag is live, `hint` says which way it is heading and whether releasing now
/// would actually step the period — the grids render that as a floating arrow. State updates only on
/// direction/armed transitions, not per pixel, so dragging doesn't re-render the whole grid.
export type SwipeHint = { dir: 'prev' | 'next'; armed: boolean };

export function useHorizontalSwipe(onNext: () => void, onPrev: () => void) {
  const handlers = useRef({ onNext, onPrev });
  handlers.current = { onNext, onPrev };
  const [hint, setHint] = useState<SwipeHint | null>(null);
  const shown = useRef<SwipeHint | null>(null);

  const update = (next: SwipeHint | null) => {
    const cur = shown.current;
    if (cur?.dir === next?.dir && cur?.armed === next?.armed) return;
    shown.current = next;
    setHint(next);
  };

  const panHandlers = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * HORIZONTAL_RATIO,
      onPanResponderMove: (_, g) => {
        update({ dir: g.dx < 0 ? 'next' : 'prev', armed: Math.abs(g.dx) >= DISTANCE });
      },
      onPanResponderRelease: (_, g) => {
        update(null);
        if (g.dx <= -DISTANCE) handlers.current.onNext();
        else if (g.dx >= DISTANCE) handlers.current.onPrev();
      },
      onPanResponderTerminate: () => update(null),
    }),
    [],
  ).panHandlers;

  return { panHandlers, hint };
}
