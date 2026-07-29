import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

const DISTANCE = 60;
/// Only claim clearly-horizontal gestures: vertical ones belong to the day sheet's drag and the
/// week view's hour scroll.
const HORIZONTAL_RATIO = 1.6;

export function useHorizontalSwipe(onNext: () => void, onPrev: () => void) {
  const handlers = useRef({ onNext, onPrev });
  handlers.current = { onNext, onPrev };

  return useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * HORIZONTAL_RATIO,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -DISTANCE) handlers.current.onNext();
        else if (g.dx >= DISTANCE) handlers.current.onPrev();
      },
    }),
    [],
  );
}
