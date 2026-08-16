import { nextBirthday, turningAge } from '@lupira/cal-domain/birthday';
import { fmtPartialDate } from '@lupira/cal-domain/partialDate';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from 'react-native-paper';
import { getPlace } from '../../data/api/generated/geo/places/places';
import { getDb } from '../../data/db/expoDb';
import { composeDisplayName, loadContact } from '../../data/mirror';
import type { PartialDateDto } from '../../domain/docTypes';
import { reachLink } from '../../domain/reach';
import { deleteContact } from '../../state/actions';
import { useContactState } from '../../state/queries';
import { Centered } from '../components/Centered';
import { useConfirm } from '../components/ConfirmDialog';
import { formStyles } from '../components/form';
import { ACCENT, hashColor } from '../components/palette';
import { ReachIcon } from '../components/ReachIcon';
import type { RootStackParamList } from '../navigation/types';
import { initialsOf } from './ContactsScreen';

/// Read-only overview — ALL editing lives on the edit screen. Shows everything the mirror doc carries:
/// names, kind, pronouns, birthday+age, deceased, unified reach (channels + profiles), tags, addresses
/// (tap → Google Maps via a geo place lookup), notes, metadata, emergency contacts and relations with
/// names resolved from the mirror.
export function ContactDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ContactDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { contactId } = route.params;
  const { data: state, isLoading } = useContactState(contactId);
  const confirm = useConfirm();
  const [relationsOpen, setRelationsOpen] = useState(false);
  const name = state ? composeDisplayName(state.doc) : '';

  // Edit/Delete live in the native header; delete always confirms (it syncs to the whole family).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('ContactEdit', { contactId })} hitSlop={8}>
            <Text style={styles.headerAction}>Edit</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() =>
              void confirm({
                title: 'Delete contact',
                message: `Delete ${name || 'this contact'}? It syncs to everyone.`,
                confirmLabel: 'Delete',
                destructive: true,
              }).then((ok) => {
                if (ok) void deleteContact(contactId).then(() => navigation.goBack());
              })
            }
          >
            <Text style={styles.headerDanger}>Delete</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, contactId, name, confirm]);

  if (isLoading) return <Centered text="Loading…" />;
  if (!state) return <Centered text="This contact is not in the offline mirror." />;
  const doc = state.doc;
  const displayName = composeDisplayName(doc);
  const relations = (doc.relations as { toContactId?: string; kind?: string; label?: string | null; ended?: boolean }[] | undefined) ?? [];
  const emergency = (doc.emergencyContactIds as string[] | undefined) ?? [];
  const addresses = (doc.addresses as { placeId?: string | null; type?: string }[] | undefined) ?? [];
  const metadata = Object.entries(doc.metadata ?? {});
  const deceased = doc.deceased === true;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {state.deleted && <Text style={styles.deletedNote}>Deleted — pending sync</Text>}
      <View style={styles.header}>
        <Avatar.Text size={52} label={initialsOf(displayName)} style={{ backgroundColor: hashColor(contactId) }} />
        <View style={styles.headerBody}>
          <Text style={styles.h1}>{displayName}{deceased ? ' ✝' : ''}</Text>
          <Text style={styles.sub}>
            {[doc.pronouns, doc.kind === 'Organization' ? 'Organization' : null, doc.nickname ? `“${doc.nickname}”` : null]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {doc.birthday != null && <BirthdayRow birthday={doc.birthday} deceased={deceased} />}
      {deceased && (
        <Text style={styles.deceased}>
          Deceased{typeof doc.deathDate === 'string' ? ` — ${doc.deathDate}` : ''}
        </Text>
      )}

      <Text style={formStyles.section}>Reach</Text>
      {(doc.channels ?? []).length === 0 && (doc.profiles ?? []).length === 0 && <Text style={styles.muted}>Nothing yet</Text>}
      {(doc.channels ?? []).map((c, i) => (
        <Pressable key={`ch-${i}`} onPress={() => openReach(c.medium, c.value)}>
          <View style={styles.reachRow}>
            <ReachIcon kind={c.medium} />
            <Text style={styles.reachText}>
              <Text style={styles.rowKind}>{c.medium}{c.type ? ` (${c.type})` : ''}  </Text>
              {c.value}{c.preferred ? '  ★' : ''}
            </Text>
          </View>
        </Pressable>
      ))}
      {(doc.profiles ?? []).map((p, i) => (
        <Pressable key={`pr-${i}`} onPress={() => openReach(p.service, p.handle)}>
          <View style={styles.reachRow}>
            <ReachIcon kind={p.service} />
            <Text style={styles.reachText}>
              <Text style={styles.rowKind}>{p.service}  </Text>
              {p.handle}{p.preferred ? '  ★' : ''}
            </Text>
          </View>
        </Pressable>
      ))}

      {(doc.tags ?? []).length > 0 && (
        <>
          <Text style={formStyles.section}>Tags</Text>
          <View style={styles.chipRow}>{(doc.tags ?? []).map((t) => <Text key={t} style={styles.tagChip}>#{t}</Text>)}</View>
        </>
      )}

      {addresses.length > 0 && (
        <>
          <Text style={formStyles.section}>Addresses</Text>
          {addresses.map((a, i) => <AddressRow key={i} placeId={a.placeId ?? null} type={a.type ?? 'Home'} />)}
        </>
      )}

      {doc.notes ? (
        <>
          <Text style={formStyles.section}>Notes</Text>
          <Text style={styles.notes}>{doc.notes}</Text>
        </>
      ) : null}

      {emergency.length > 0 && (
        <>
          <Text style={formStyles.section}>Emergency contacts</Text>
          {emergency.map((id, i) => <ResolvedName key={id} contactId={id} prefix={`${i + 1}. `} navigation={navigation} />)}
        </>
      )}

      {relations.filter((r) => !r.ended).length > 0 && (
        <>
          <Pressable style={styles.sectionToggle} onPress={() => setRelationsOpen((o) => !o)}>
            <Text style={formStyles.section}>
              Relations ({relations.filter((r) => !r.ended).length})
            </Text>
            <Text style={styles.chevron}>{relationsOpen ? '▾' : '▸'}</Text>
          </Pressable>
          {relationsOpen && relations.filter((r) => !r.ended).map((r, i) => (
            <ResolvedName
              key={`${r.toContactId}-${i}`}
              contactId={r.toContactId ?? ''}
              prefix={`${r.label ?? r.kind ?? 'Related'} — `}
              navigation={navigation}
            />
          ))}
        </>
      )}

      {metadata.length > 0 && (
        <>
          <Text style={formStyles.section}>Metadata</Text>
          {metadata.map(([k, v]) => (
            <Text key={k} style={styles.row}>
              <Text style={styles.rowKind}>{k}  </Text>
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </Text>
          ))}
        </>
      )}

      {typeof doc.updatedAt === 'string' && (
        <Text style={styles.footer}>Updated {new Date(doc.updatedAt).toLocaleString()}</Text>
      )}

    </ScrollView>
  );
}

function openReach(kind: string, value: string): void {
  const url = reachLink(kind, value);
  if (url) void Linking.openURL(url).catch(() => undefined);
}

function BirthdayRow({ birthday, deceased }: { birthday: PartialDateDto; deceased: boolean }) {
  const { year, month, day } = birthday;
  const next = nextBirthday(month, day, new Date());
  const age = deceased ? null : turningAge(year, next);
  return (
    <Text style={styles.birthday}>
      🎂 {fmtPartialDate(birthday)}
      {age != null ? ` — turns ${age} on ${next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
    </Text>
  );
}

/// Address rows are place refs — resolving to something mappable needs the geo API (online). Tap-to-open
/// keeps the offline path clean: nothing is fetched until asked.
function AddressRow({ placeId, type }: { placeId: string | null; type: string }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!placeId || busy) return;
    setBusy(true);
    try {
      const r = await getPlace(placeId);
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const place = r.data as { lat?: number; lon?: number; displayName?: string | null; name?: string | null };
      const { lat, lon } = place;
      const query = Number.isFinite(lat) && Number.isFinite(lon)
        ? `${lat},${lon}`
        : (place.displayName ?? place.name ?? '');
      if (!query) throw new Error('place has no location');
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
    } catch {
      Alert.alert('Cannot open map', 'Resolving the address needs a connection to the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={() => void open()} disabled={!placeId}>
      <Text style={styles.row}>
        <Text style={styles.rowKind}>{type}  </Text>
        {placeId ? (busy ? 'Opening map…' : 'Open in Google Maps ↗') : '(no place linked)'}
      </Text>
    </Pressable>
  );
}

function ResolvedName({ contactId, prefix, navigation }: {
  contactId: string;
  prefix: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await loadContact(await getDb(), contactId);
      if (!cancelled) setName(state ? composeDisplayName(state.doc) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <Pressable onPress={() => name && navigation.push('ContactDetail', { contactId })}>
      <Text style={styles.row}>
        <Text style={styles.rowKind}>{prefix}</Text>
        {name ?? '(not in mirror)'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  deletedNote: { color: '#b91c1c', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBody: { flex: 1 },
  h1: { fontSize: 20, fontWeight: '600' },
  sub: { color: '#888', fontSize: 13 },
  birthday: { fontSize: 14, color: '#b45309', marginTop: 6 },
  deceased: { fontSize: 13, color: '#666', fontStyle: 'italic' },
  row: { fontSize: 14, paddingVertical: 4 },
  rowKind: { color: '#888', fontSize: 13 },
  muted: { color: '#999', fontSize: 13 },
  notes: { fontSize: 14, color: '#333' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { fontSize: 12, color: '#4457c2', backgroundColor: '#eef0fb', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  footer: { color: '#aaa', fontSize: 11, marginTop: 12, marginBottom: 16 },
  headerActions: { flexDirection: 'row', gap: 16, paddingRight: 4 },
  headerAction: { color: ACCENT, fontSize: 15 },
  headerDanger: { color: '#b91c1c', fontSize: 15 },
  reachRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  reachText: { flex: 1, fontSize: 14 },
  sectionToggle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  chevron: { color: '#888', fontSize: 13 },
});
