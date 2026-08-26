import { nextBirthday, turningAge } from '@lupira/cal-domain/birthday';
import { fmtPartialDate } from '@lupira/cal-domain/partialDate';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, List, Text, useTheme } from 'react-native-paper';
import { getPlace } from '../../data/api/generated/geo/places/places';
import { getDb } from '../../data/db/expoDb';
import { composeDisplayName, loadContact } from '../../data/mirror';
import type { PartialDateDto } from '../../domain/docTypes';
import { reachLink } from '../../domain/reach';
import { deleteContact } from '../../state/actions';
import { useContactState } from '../../state/queries';
import { Centered } from '../components/Centered';
import { useConfirm } from '../components/ConfirmDialog';

import { hashColor } from '../components/palette';
import { ReachIcon } from '../components/ReachIcon';
import type { RootStackParamList } from '../navigation/types';
import { initialsOf } from './ContactsScreen';
import type { AppTheme } from '../theme/paperTheme';

/// Read-only overview — ALL editing lives on the edit screen. Shows everything the mirror doc carries:
/// names, kind, pronouns, birthday+age, deceased, unified reach (channels + profiles), tags, addresses
/// (tap → Google Maps via a geo place lookup), notes, metadata, emergency contacts and relations with
/// names resolved from the mirror.
export function ContactDetailScreen() {
  const theme = useTheme<AppTheme>();
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
          <Button mode="text" compact onPress={() => navigation.navigate('ContactEdit', { contactId })}>
            Edit
          </Button>
          <Button
            mode="text"
            compact
            textColor={theme.colors.error}
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
            Delete
          </Button>
        </View>
      ),
    });
  }, [navigation, contactId, name, confirm, theme]);

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
      {state.deleted && <Text style={[styles.deletedNote, { color: theme.colors.error }]}>Deleted — pending sync</Text>}
      <View style={styles.header}>
        <Avatar.Text size={52} label={initialsOf(displayName)} style={{ backgroundColor: hashColor(contactId) }} />
        <View style={styles.headerBody}>
          <Text style={styles.h1}>{displayName}{deceased ? ' ✝' : ''}</Text>
          <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
            {[doc.pronouns, doc.kind === 'Organization' ? 'Organization' : null, doc.nickname ? `“${doc.nickname}”` : null]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {doc.birthday != null && <BirthdayRow birthday={doc.birthday} deceased={deceased} />}
      {deceased && (
        <Text style={[styles.deceased, { color: theme.colors.onSurfaceVariant }]}>
          Deceased{typeof doc.deathDate === 'string' ? ` — ${doc.deathDate}` : ''}
        </Text>
      )}

      <List.Subheader>Reach</List.Subheader>
      {(doc.channels ?? []).length === 0 && (doc.profiles ?? []).length === 0 && (
        <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>Nothing yet</Text>
      )}
      {(doc.channels ?? []).map((c, i) => (
        <List.Item
          key={`ch-${i}`}
          onPress={() => openReach(c.medium, c.value)}
          title={`${c.value}${c.preferred ? '  ★' : ''}`}
          description={`${c.medium}${c.type ? ` (${c.type})` : ''}`}
          left={() => <ReachIcon kind={c.medium} />}
        />
      ))}
      {(doc.profiles ?? []).map((p, i) => (
        <List.Item
          key={`pr-${i}`}
          onPress={() => openReach(p.service, p.handle)}
          title={`${p.handle}${p.preferred ? '  ★' : ''}`}
          description={p.service}
          left={() => <ReachIcon kind={p.service} />}
        />
      ))}

      {(doc.tags ?? []).length > 0 && (
        <>
          <List.Subheader>Tags</List.Subheader>
          <View style={styles.chipRow}>
            {(doc.tags ?? []).map((t) => (
              <Chip key={t} compact>{`#${t}`}</Chip>
            ))}
          </View>
        </>
      )}

      {addresses.length > 0 && (
        <>
          <List.Subheader>Addresses</List.Subheader>
          {addresses.map((a, i) => <AddressRow key={i} placeId={a.placeId ?? null} type={a.type ?? 'Home'} />)}
        </>
      )}

      {doc.notes ? (
        <>
          <List.Subheader>Notes</List.Subheader>
          <Text style={styles.notes}>{doc.notes}</Text>
        </>
      ) : null}

      {emergency.length > 0 && (
        <>
          <List.Subheader>Emergency contacts</List.Subheader>
          {emergency.map((id, i) => <ResolvedName key={id} contactId={id} prefix={`${i + 1}. `} navigation={navigation} />)}
        </>
      )}

      {relations.filter((r) => !r.ended).length > 0 && (
        <>
          <List.Accordion
            title={`Relations (${relations.filter((r) => !r.ended).length})`}
            expanded={relationsOpen}
            onPress={() => setRelationsOpen((o) => !o)}
          >
            {relations.filter((r) => !r.ended).map((r, i) => (
              <ResolvedName
                key={`${r.toContactId}-${i}`}
                contactId={r.toContactId ?? ''}
                prefix={`${r.label ?? r.kind ?? 'Related'} — `}
                navigation={navigation}
              />
            ))}
          </List.Accordion>
        </>
      )}

      {metadata.length > 0 && (
        <>
          <List.Subheader>Metadata</List.Subheader>
          {metadata.map(([k, v]) => (
            <Text key={k} style={styles.row}>
              <Text style={[styles.rowKind, { color: theme.colors.onSurfaceVariant }]}>{k}  </Text>
              {typeof v === 'string' ? v : JSON.stringify(v)}
            </Text>
          ))}
        </>
      )}

      {typeof doc.updatedAt === 'string' && (
        <Text style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>Updated {new Date(doc.updatedAt).toLocaleString()}</Text>
      )}

    </ScrollView>
  );
}

function openReach(kind: string, value: string): void {
  const url = reachLink(kind, value);
  if (url) void Linking.openURL(url).catch(() => undefined);
}

function BirthdayRow({ birthday, deceased }: { birthday: PartialDateDto; deceased: boolean }) {
  const theme = useTheme<AppTheme>();
  const { year, month, day } = birthday;
  const next = nextBirthday(month, day, new Date());
  const age = deceased ? null : turningAge(year, next);
  return (
    <Text style={[styles.birthday, { color: theme.colors.warning }]}>
      🎂 {fmtPartialDate(birthday)}
      {age != null ? ` — turns ${age} on ${next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
    </Text>
  );
}

/// Address rows are place refs — resolving to something mappable needs the geo API (online). Tap-to-open
/// keeps the offline path clean: nothing is fetched until asked.
function AddressRow({ placeId, type }: { placeId: string | null; type: string }) {
  const theme = useTheme<AppTheme>();
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
        <Text style={[styles.rowKind, { color: theme.colors.onSurfaceVariant }]}>{type}  </Text>
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
  const theme = useTheme<AppTheme>();
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
        <Text style={[styles.rowKind, { color: theme.colors.onSurfaceVariant }]}>{prefix}</Text>
        {name ?? '(not in mirror)'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  deletedNote: { fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBody: { flex: 1 },
  h1: { fontSize: 20, fontWeight: '600' },
  sub: { fontSize: 13 },
  birthday: { fontSize: 14, marginTop: 6 },
  deceased: { fontSize: 13, fontStyle: 'italic' },
  row: { fontSize: 14, paddingVertical: 4 },
  rowKind: { fontSize: 13 },
  muted: { fontSize: 13 },
  notes: { fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: { fontSize: 11, marginTop: 12, marginBottom: 16 },
  headerActions: { flexDirection: 'row', paddingRight: 4 },
});
