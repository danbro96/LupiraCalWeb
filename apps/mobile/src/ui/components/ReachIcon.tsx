import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { StyleSheet, View } from 'react-native';
import { reachGlyph } from '../../domain/reach';

/** Real brand marks (FontAwesome 6 brands: telegram / whatsapp / signal-messenger) instead of
 *  look-alike emoji, in each service's own color. Non-brand kinds fall back to solid glyphs. */
export function ReachIcon({ kind, size = 16 }: { kind: string | null | undefined; size?: number }) {
  const { name, color, brand } = reachGlyph(kind);
  return (
    <View style={[styles.slot, { width: size + 8 }]}>
      <FontAwesome6 name={name} size={size} color={color} iconStyle={brand ? 'brand' : 'solid'} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center' },
});
