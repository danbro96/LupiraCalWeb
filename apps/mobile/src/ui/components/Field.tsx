import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

/** Wrapper for non-text controls (chips, date/time pickers, switches) — text inputs carry their own label. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="labelMedium">{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ field: { gap: 4, marginTop: 10 } });
