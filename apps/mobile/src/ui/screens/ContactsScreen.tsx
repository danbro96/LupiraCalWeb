import { partialDateBadge } from '@lupira/cal-domain/partialDate';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, FAB, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ContactListRow } from '../../data/mirror';
import { useContactList } from '../../state/queries';
import { hashColor } from '../components/palette';
import { SyncBanner } from '../components/SyncBanner';
import type { RootStackParamList } from '../navigation/types';

export function ContactsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data } = useContactList();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const rows = (data ?? []).filter((r) =>
    !q
    || r.displayName.toLowerCase().includes(q)
    || (r.doc.nickname ?? '').toLowerCase().includes(q)
    || (r.doc.tags ?? []).some((t) => t.toLowerCase().includes(q)));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <SyncBanner />
      <View style={styles.toolbar}>
        <TextInput
          style={[styles.search, { borderColor: theme.colors.outline }]}
          placeholder="Search contacts"
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
        <FAB size="small" icon="plus" onPress={() => navigation.navigate('ContactEdit', {})} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
            {data?.length ? 'No matches' : 'No contacts in the mirror yet'}
          </Text>
        }
        renderItem={({ item }) => (
          <ContactRow row={item} onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })} />
        )}
      />
    </SafeAreaView>
  );
}

function ContactRow({ row, onPress }: { row: ContactListRow; onPress: () => void }) {
  const theme = useTheme();
  const firstChannel = (row.doc.channels ?? []).find((c) => c.preferred) ?? (row.doc.channels ?? [])[0];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar.Text size={38} label={initialsOf(row.displayName)} style={{ backgroundColor: hashColor(row.id) }} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>{row.displayName}</Text>
        {firstChannel && <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>{firstChannel.value}</Text>}
      </View>
      {row.doc.birthday && <Text style={styles.bday}>🎂 {partialDateBadge(row.doc.birthday)}</Text>}
    </Pressable>
  );
}

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  search: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, fontSize: 14 },
  empty: { textAlign: 'center', marginTop: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  rowBody: { flex: 1 },
  name: { fontSize: 15 },
  sub: { fontSize: 12 },
  bday: { fontSize: 12, color: '#b45309' },
});
