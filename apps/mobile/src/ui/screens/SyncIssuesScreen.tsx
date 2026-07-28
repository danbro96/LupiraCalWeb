import { StyleSheet, Text, View } from 'react-native';

export function SyncIssuesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.note}>
        Parked offline changes will be reviewable here once the sync engine lands (M4).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  note: { color: '#777', textAlign: 'center' },
});
