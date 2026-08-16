import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

export function Centered({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
