import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { SwipeHint as Hint } from './useHorizontalSwipe';
import { useColors } from '../theme';

/** Floating drag feedback: a pill on the edge you are dragging toward, naming the period you would
 *  land on. Outlined while the drag is still too short to count, filled once releasing will commit —
 *  the fill is the whole signal, no instructional text. */
export function SwipeHint({ hint, prevLabel, nextLabel }: {
  hint: Hint | null;
  prevLabel: string;
  nextLabel: string;
}) {
  const c = useColors();
  if (!hint) return null;
  const next = hint.dir === 'next';
  return (
    <View pointerEvents="none" style={[styles.wrap, next ? styles.right : styles.left]}>
      <View
        style={[
          styles.pill,
          { borderColor: c.primary, backgroundColor: hint.armed ? c.primary : c.surface + 'ee' },
        ]}
      >
        <Text style={[styles.text, { color: hint.armed ? c.onPrimary : c.primary }]}>
          {next ? `${nextLabel} ›` : `‹ ${prevLabel}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: '42%' },
  left: { left: 8 },
  right: { right: 8 },
  pill: {
    borderWidth: 1.5,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  text: { fontSize: 14, fontWeight: '700' },
});
