import { partialDateBadge } from '@lupira/cal-domain/partialDate';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, FAB, List, Searchbar, Text } from 'react-native-paper';
import type { ContactListRow } from '../../data/mirror';
import { useContactList } from '../../state/useContactList';
import { hashColor } from '../hooks/palette';
import { ScreenToolbar } from '../components/ScreenToolbar';
import { SyncBanner } from '../components/SyncBanner';
import type { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme';
import { ICONS } from '../icons';
import { Glyph } from '../components/Glyph';

export function ContactsScreen() {
  const c = useColors();
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
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <SyncBanner />
      <ScreenToolbar>
        <Searchbar
          style={styles.search}
          placeholder="Search contacts"
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
        <FAB size="small" icon={ICONS.add} onPress={() => navigation.navigate('ContactEdit', {})} />
      </ScreenToolbar>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            {data?.length ? 'No matches' : 'No contacts in the mirror yet'}
          </Text>
        }
        renderItem={({ item }) => (
          <ContactRow row={item} onPress={() => navigation.navigate('ContactDetail', { contactId: item.id })} />
        )}
      />
    </View>
  );
}

function ContactRow({ row, onPress }: { row: ContactListRow; onPress: () => void }) {
  const c = useColors();
  const firstChannel = (row.doc.channels ?? []).find((c) => c.preferred) ?? (row.doc.channels ?? [])[0];
  return (
    <List.Item
      onPress={onPress}
      title={row.displayName}
      description={firstChannel?.value}
      descriptionNumberOfLines={1}
      left={() => (
        <Avatar.Text size={38} label={initialsOf(row.displayName)} style={{ backgroundColor: hashColor(row.id) }} />
      )}
      right={() =>
        row.doc.birthday ? (
          <Text style={[styles.bday, { color: c.warning }]}><Glyph name={ICONS.cake} /> {partialDateBadge(row.doc.birthday)}</Text>
        ) : null
      }
    />
  );
}

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 32 },
  bday: { fontSize: 12 },
});
