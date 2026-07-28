import { turningAge } from '@lupira/cal-domain/birthday';
import { nextBirthday } from '@lupira/cal-domain/birthday';
import { coercePartialDate, fmtPartialDate } from '@lupira/cal-domain/partialDate';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { composeDisplayName } from '../../data/mirror';
import type { PartialDateDto, ReachChannel, SocialProfile } from '../../domain/docTypes';
import { parseCsv } from '../../domain/editors';
import { deleteContact, setContactChannels, setContactProfiles, setContactTags } from '../../state/actions';
import { useContactState } from '../../state/queries';
import { Button, formStyles } from '../components/form';
import { hashColor } from '../components/palette';
import type { RootStackParamList } from '../navigation/types';
import { initialsOf } from './ContactsScreen';

export function ContactDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ContactDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { contactId } = route.params;
  const { data: state, isLoading } = useContactState(contactId);

  if (isLoading) return <Centered text="Loading…" />;
  if (!state) return <Centered text="This contact is not in the offline mirror." />;
  const doc = state.doc;
  const displayName = composeDisplayName(doc);

  const confirmDelete = () =>
    Alert.alert('Delete contact', `Delete ${displayName}? It syncs to everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteContact(contactId).then(() => navigation.goBack());
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {state.deleted && <Text style={styles.deletedNote}>Deleted — pending sync</Text>}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: hashColor(contactId) }]}>
          <Text style={styles.avatarText}>{initialsOf(displayName)}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.h1}>{displayName}</Text>
          <Text style={styles.sub}>
            {[doc.pronouns, doc.kind === 'Organization' ? 'Organization' : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {doc.birthday && <BirthdayRow birthday={doc.birthday} />}

      <ChannelsPanel contactId={contactId} channels={doc.channels ?? []} />
      <TagsPanel contactId={contactId} tags={doc.tags ?? []} />
      <ProfilesPanel contactId={contactId} profiles={doc.profiles ?? []} />

      {Array.isArray(doc.addresses) && doc.addresses.length > 0 && (
        <>
          <Text style={formStyles.section}>Addresses</Text>
          <Text style={styles.muted}>
            {doc.addresses.length} linked place{doc.addresses.length === 1 ? '' : 's'} — places are managed on the web (needs place search)
          </Text>
        </>
      )}

      {doc.notes ? (
        <>
          <Text style={formStyles.section}>Notes</Text>
          <Text style={styles.notes}>{doc.notes}</Text>
        </>
      ) : null}

      <View style={styles.buttons}>
        <Button title="Edit" onPress={() => navigation.navigate('ContactEdit', { contactId })} />
        <Button title="Delete" kind="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function BirthdayRow({ birthday }: { birthday: PartialDateDto }) {
  const { year, month, day } = coercePartialDate(birthday);
  const next = nextBirthday(month, day, new Date());
  const age = turningAge(year, next);
  return (
    <Text style={styles.birthday}>
      🎂 {fmtPartialDate(birthday)}
      {age != null ? ` — turns ${age} on ${next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
    </Text>
  );
}

/// Wholesale channel editor → one contact.channels op (the removing counterpart to revise's UNION-merge).
function ChannelsPanel({ contactId, channels }: { contactId: string; channels: ReachChannel[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReachChannel[]>([]);

  const begin = () => {
    setDraft(channels.map((c) => ({ ...c })));
    setEditing(true);
  };
  const save = () => {
    void setContactChannels(contactId, draft.filter((c) => c.value.trim()));
    setEditing(false);
  };
  const patch = (i: number, p: Partial<ReachChannel>) =>
    setDraft((d) => d.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <View>
      <SectionHeader title="Channels" editing={editing} onEdit={begin} onSave={save} onCancel={() => setEditing(false)} />
      {!editing && channels.length === 0 && <Text style={styles.muted}>No channels</Text>}
      {!editing && channels.map((c, i) => (
        <Text key={i} style={styles.row}>
          {c.medium === 'Phone' ? '☎' : '✉'} {c.value}{c.type ? `  (${c.type})` : ''}{c.preferred ? '  ★' : ''}
        </Text>
      ))}
      {editing && (
        <View style={styles.editBlock}>
          {draft.map((c, i) => (
            <View key={i} style={styles.editRow}>
              <Pressable onPress={() => patch(i, { medium: c.medium === 'Phone' ? 'Email' : 'Phone' })}>
                <Text style={styles.mediumToggle}>{c.medium === 'Phone' ? '☎' : '✉'}</Text>
              </Pressable>
              <TextInput
                style={[formStyles.input, styles.editValue]}
                autoCapitalize="none"
                value={c.value}
                onChangeText={(v) => patch(i, { value: v })}
              />
              <Pressable onPress={() => patch(i, { preferred: !c.preferred })} hitSlop={6}>
                <Text style={[styles.star, c.preferred && styles.starOn]}>★</Text>
              </Pressable>
              <Pressable onPress={() => setDraft((d) => d.filter((_, j) => j !== i))} hitSlop={6}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Button title="Add channel" kind="plain" onPress={() => setDraft((d) => [...d, { medium: 'Phone', value: '', preferred: false }])} />
        </View>
      )}
    </View>
  );
}

function TagsPanel({ contactId, tags }: { contactId: string; tags: string[] }) {
  const [editing, setEditing] = useState(false);
  const [csv, setCsv] = useState('');

  const begin = () => {
    setCsv(tags.join(', '));
    setEditing(true);
  };
  const save = () => {
    void setContactTags(contactId, parseCsv(csv));
    setEditing(false);
  };

  return (
    <View>
      <SectionHeader title="Tags" editing={editing} onEdit={begin} onSave={save} onCancel={() => setEditing(false)} />
      {!editing && (
        tags.length === 0
          ? <Text style={styles.muted}>No tags</Text>
          : <View style={styles.chipRow}>{tags.map((t) => <Text key={t} style={styles.tagChip}>#{t}</Text>)}</View>
      )}
      {editing && (
        <TextInput style={formStyles.input} autoCapitalize="none" placeholder="family, school" value={csv} onChangeText={setCsv} />
      )}
    </View>
  );
}

function ProfilesPanel({ contactId, profiles }: { contactId: string; profiles: SocialProfile[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SocialProfile[]>([]);

  const begin = () => {
    setDraft(profiles.map((p) => ({ ...p })));
    setEditing(true);
  };
  const save = () => {
    void setContactProfiles(contactId, draft.filter((p) => p.service.trim() && p.handle.trim()));
    setEditing(false);
  };
  const patch = (i: number, p: Partial<SocialProfile>) =>
    setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <View>
      <SectionHeader title="Profiles" editing={editing} onEdit={begin} onSave={save} onCancel={() => setEditing(false)} />
      {!editing && profiles.length === 0 && <Text style={styles.muted}>No profiles</Text>}
      {!editing && profiles.map((p, i) => (
        <Text key={i} style={styles.row}>{p.service}: {p.handle}{p.preferred ? '  ★' : ''}</Text>
      ))}
      {editing && (
        <View style={styles.editBlock}>
          {draft.map((p, i) => (
            <View key={i} style={styles.editRow}>
              <TextInput
                style={[formStyles.input, styles.editService]}
                placeholder="service"
                autoCapitalize="none"
                value={p.service}
                onChangeText={(v) => patch(i, { service: v })}
              />
              <TextInput
                style={[formStyles.input, styles.editValue]}
                placeholder="handle"
                autoCapitalize="none"
                value={p.handle}
                onChangeText={(v) => patch(i, { handle: v })}
              />
              <Pressable onPress={() => setDraft((d) => d.filter((_, j) => j !== i))} hitSlop={6}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Button title="Add profile" kind="plain" onPress={() => setDraft((d) => [...d, { service: '', handle: '', preferred: false }])} />
        </View>
      )}
    </View>
  );
}

function SectionHeader({ title, editing, onEdit, onSave, onCancel }: {
  title: string; editing: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={formStyles.section}>{title}</Text>
      {editing ? (
        <View style={styles.sectionActions}>
          <Pressable onPress={onSave}><Text style={styles.link}>Save</Text></Pressable>
          <Pressable onPress={onCancel}><Text style={styles.mutedLink}>Cancel</Text></Pressable>
        </View>
      ) : (
        <Pressable onPress={onEdit}><Text style={styles.link}>Edit</Text></Pressable>
      )}
    </View>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  deletedNote: { color: '#b91c1c', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  headerBody: { flex: 1 },
  h1: { fontSize: 20, fontWeight: '600' },
  sub: { color: '#888', fontSize: 13 },
  birthday: { fontSize: 14, color: '#b45309', marginTop: 6 },
  row: { fontSize: 14, paddingVertical: 3 },
  muted: { color: '#999', fontSize: 13 },
  notes: { fontSize: 14, color: '#333' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { fontSize: 12, color: '#4457c2', backgroundColor: '#eef0fb', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionActions: { flexDirection: 'row', gap: 14 },
  link: { color: '#4457c2', fontSize: 13 },
  mutedLink: { color: '#999', fontSize: 13 },
  editBlock: { gap: 6 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediumToggle: { fontSize: 18, width: 26, textAlign: 'center' },
  editValue: { flex: 1 },
  editService: { flex: 1 },
  star: { fontSize: 18, color: '#ccc' },
  starOn: { color: '#d97706' },
  remove: { fontSize: 14, color: '#999', paddingHorizontal: 4 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
