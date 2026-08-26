import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { debugEntries, onDebugLog } from '../../debug/log';
import { useColors } from '../theme';

export function DebugLogScreen() {
  const c = useColors();
  const [, setRev] = useState(0);
  useEffect(() => onDebugLog(() => setRev((n) => n + 1)), []);

  const entries = [...debugEntries()].reverse();
  return (
    <FlatList
      data={entries}
      keyExtractor={(e, i) => `${e.at}-${i}`}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderColor: c.divider }]}>
          <Text style={[styles.meta, { color: c.textMuted }]}>{item.at.slice(11, 19)} [{item.tag}]</Text>
          <Text style={styles.msg}>{item.message}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>Nothing logged yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { fontSize: 11 },
  msg: { fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 32 },
});
