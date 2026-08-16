import { describeRrule } from '@lupira/cal-domain/rrule';
import { fmtWhen } from '@lupira/cal-domain/time';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteItem, fileItem, mergeItemMetadata, unfileItem } from '../../state/actions';
import { selectableCalendars, useCalendars, useItemState } from '../../state/queries';
import { Centered } from '../components/Centered';
import { useConfirm } from '../components/ConfirmDialog';
import { Button, formStyles } from '../components/form';
import { useCalendarColors } from '../components/palette';
import type { RootStackParamList } from '../navigation/types';

export function ItemDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ItemDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { itemId } = route.params;
  const { data: state, isLoading } = useItemState(itemId);
  const confirm = useConfirm();

  if (isLoading) return <Centered text="Loading…" />;
  if (!state) return <Centered text="This item is not in the offline mirror." />;
  const doc = state.doc;

  const start = doc.isAllDay ? doc.startDate : doc.startsAt;
  const end = doc.isAllDay ? doc.endDate : doc.endsAt;
  const attendees = Array.isArray(doc.attendees) ? doc.attendees.length : 0;

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete event',
      message: `Delete “${doc.title ?? 'this event'}”? It syncs to everyone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) void deleteItem(itemId).then(() => navigation.goBack());
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {state.deleted && <Text style={styles.deleted}>Deleted — pending sync</Text>}
      <Text style={styles.h1}>{doc.title ?? '(untitled)'}</Text>
      {start && (
        <Text style={styles.when}>
          {fmtWhen(start, doc.isAllDay)}
          {end ? ` → ${fmtWhen(end, doc.isAllDay)}` : ''}
        </Text>
      )}
      {doc.recurrenceRule && <Text style={styles.recur}>{describeRrule(doc.recurrenceRule)}</Text>}
      <View style={styles.chipRow}>
        {doc.status && <Text style={styles.metaChip}>{doc.status}</Text>}
        {doc.category && <Text style={styles.metaChip}>{doc.category}</Text>}
        {(doc.tags ?? []).map((t) => <Text key={t} style={styles.tagChip}>#{t}</Text>)}
      </View>
      {doc.description ? <Text style={styles.description}>{doc.description}</Text> : null}
      {attendees > 0 && <Text style={styles.note}>{attendees} participant{attendees === 1 ? '' : 's'} (manage on web)</Text>}
      {doc.prompt != null && <Text style={styles.note}>Has a prompt payload (view on web)</Text>}
      {doc.action != null && <Text style={styles.note}>Has an action payload (view on web)</Text>}

      <CalendarsPanel itemId={itemId} memberships={doc.calendars} />
      <MetadataPanel itemId={itemId} metadata={doc.metadata ?? null} />

      <View style={styles.buttons}>
        <Button title="Edit" onPress={() => navigation.navigate('ItemEdit', { itemId })} />
        <Button title="Delete" kind="danger" onPress={() => void confirmDelete()} />
      </View>
    </ScrollView>
  );
}

/// Filing manager: every mirror calendar with a membership toggle → item.file / item.unfile ops.
function CalendarsPanel({ itemId, memberships }: {
  itemId: string;
  memberships: { calendarId: string; status: string }[];
}) {
  const { data: calendars } = useCalendars();
  const colorOf = useCalendarColors();
  const statusOf = (calId: string) => memberships.find((m) => m.calendarId === calId)?.status;

  return (
    <View>
      <Text style={formStyles.section}>Calendars</Text>
      {selectableCalendars(calendars).map((c) => {
        const status = statusOf(c.id);
        const member = status === 'Accepted' || status === 'Proposed';
        return (
          <Pressable
            key={c.id}
            style={styles.calRow}
            onPress={() => void (member ? unfileItem(itemId, c.id) : fileItem(itemId, c.id))}
          >
            <View style={[styles.calDot, { backgroundColor: colorOf(c.id) }]} />
            <Text style={styles.calName}>{c.displayName ?? c.id}</Text>
            {status === 'Proposed' && <Text style={styles.proposed}>proposed</Text>}
            <Text style={styles.calCheck}>{member ? '✓' : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/// Merge-patch editor: add or overwrite one key at a time (the REST surface has no key removal).
function MetadataPanel({ itemId, metadata }: { itemId: string; metadata: Record<string, unknown> | null }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const entries = Object.entries(metadata ?? {});

  const save = () => {
    const k = key.trim();
    if (!k) return;
    void mergeItemMetadata(itemId, { [k]: value });
    setKey('');
    setValue('');
  };

  return (
    <View>
      <Text style={formStyles.section}>Metadata</Text>
      {entries.map(([k, v]) => (
        <Pressable key={k} style={styles.metaRow} onPress={() => { setKey(k); setValue(typeof v === 'string' ? v : JSON.stringify(v)); }}>
          <Text style={styles.metaKey}>{k}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>
        </Pressable>
      ))}
      <View style={styles.metaEdit}>
        <TextInput style={[formStyles.input, styles.metaKeyInput]} placeholder="key" autoCapitalize="none" value={key} onChangeText={setKey} />
        <TextInput style={[formStyles.input, styles.metaValueInput]} placeholder="value" value={value} onChangeText={setValue} />
        <Button title="Set" onPress={save} disabled={!key.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 6 },
  deleted: { color: '#b91c1c', fontWeight: '600' },
  h1: { fontSize: 20, fontWeight: '600' },
  when: { fontSize: 14, color: '#555' },
  recur: { fontSize: 13, color: '#4457c2' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip: { fontSize: 12, color: '#555', borderWidth: 1, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagChip: { fontSize: 12, color: '#4457c2', backgroundColor: '#eef0fb', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  description: { fontSize: 14, color: '#333', marginTop: 6 },
  note: { color: '#888', fontSize: 13, marginTop: 4 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  calDot: { width: 10, height: 10, borderRadius: 5 },
  calName: { flex: 1, fontSize: 15 },
  proposed: { fontSize: 11, color: '#b45309' },
  calCheck: { width: 20, color: '#4457c2', fontSize: 16, textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  metaKey: { fontWeight: '600', fontSize: 13, color: '#555' },
  metaValue: { flex: 1, fontSize: 13, color: '#333' },
  metaEdit: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 },
  metaKeyInput: { flex: 2 },
  metaValueInput: { flex: 3 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
