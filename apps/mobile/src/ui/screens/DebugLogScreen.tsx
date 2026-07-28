import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { debugEntries, onDebugLog } from '../../debug/log';

export function DebugLogScreen() {
  const [, setRev] = useState(0);
  useEffect(() => onDebugLog(() => setRev((n) => n + 1)), []);

  const entries = [...debugEntries()].reverse();
  return (
    <FlatList
      data={entries}
      keyExtractor={(e, i) => `${e.at}-${i}`}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.meta}>{item.at.slice(11, 19)} [{item.tag}]</Text>
          <Text style={styles.msg}>{item.message}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Nothing logged yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  meta: { color: '#888', fontSize: 11 },
  msg: { fontSize: 13 },
  empty: { color: '#777', textAlign: 'center', marginTop: 32 },
});
