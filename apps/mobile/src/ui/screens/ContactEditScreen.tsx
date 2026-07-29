import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ReachChannel, SocialProfile } from '../../domain/docTypes';
import type { ContactForm } from '../../domain/editors';
import { contactCoreFromForm, contactFormFromDoc, emptyContactForm, parseCsv } from '../../domain/editors';
import { createContact, reviseContact, setContactChannels, setContactProfiles, setContactTags } from '../../state/actions';
import { useAddressBooks, useContactState } from '../../state/queries';
import { Button, ChoiceChips, DateField, Field, formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

const KIND_OPTIONS = [{ value: 'Individual', label: 'Person' }, { value: 'Organization', label: 'Organization' }];
const NAME_FORMAT_OPTIONS = [
  { value: 'Full', label: 'Full name' },
  { value: 'FirstLast', label: 'First + last' },
  { value: 'NickName', label: 'Nickname' },
];
/// One add-menu for every way to reach someone. Email/Phone are channels; the rest are social profiles
/// (the API models IM handles as profiles by design — see docs/mobile notes on the vCard hazard).
const REACH_OPTIONS = ['Email', 'Phone', 'Telegram', 'Signal', 'WhatsApp', 'Web', 'Other'] as const;
const CHANNEL_TYPES = [null, 'Home', 'Work', 'Mobile'] as const;

export function ContactEditScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ContactEdit'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const contactId = route.params?.contactId;
  const { data: state } = useContactState(contactId ?? '');
  const { data: books } = useAddressBooks();

  const [form, setForm] = useState<ContactForm>(() => ({ ...emptyContactForm(), displayNameFormat: contactId ? '' : 'FirstLast' }));
  const [channels, setChannels] = useState<ReachChannel[]>([]);
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [tagsCsv, setTagsCsv] = useState('');
  const [bookId, setBookId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(!contactId);

  useEffect(() => {
    if (!seeded && contactId && state) {
      setForm(contactFormFromDoc(state.doc));
      setChannels((state.doc.channels ?? []).map((c) => ({ ...c })));
      setProfiles((state.doc.profiles ?? []).map((p) => ({ ...p })));
      setTagsCsv((state.doc.tags ?? []).join(', '));
      setSeeded(true);
    }
  }, [seeded, contactId, state]);
  useEffect(() => {
    if (!contactId && !bookId && books?.length) setBookId(books[0].id);
  }, [contactId, bookId, books]);

  const set = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const addReach = (kind: (typeof REACH_OPTIONS)[number]) => {
    if (kind === 'Email' || kind === 'Phone') setChannels((c) => [...c, { medium: kind, value: '', preferred: false }]);
    else setProfiles((p) => [...p, { service: kind === 'Other' ? '' : kind, handle: '', preferred: false }]);
  };

  const save = () => {
    const r = contactCoreFromForm(form);
    if (!r.ok) return setError(r.error);
    if (!contactId && !bookId) return setError('Pick an address book');
    setError(null);

    const cleanChannels = channels.filter((c) => c.value.trim());
    const cleanProfiles = profiles.filter((p) => p.service.trim() && p.handle.trim());
    const tags = parseCsv(tagsCsv);

    void (async () => {
      if (!contactId) {
        const id = await createContact(bookId, { ...r.value, channels: cleanChannels, tags });
        if (cleanProfiles.length > 0) await setContactProfiles(id, cleanProfiles);
      } else {
        const doc = state?.doc;
        await reviseContact(contactId, r.value);
        if (JSON.stringify(cleanChannels) !== JSON.stringify(doc?.channels ?? [])) await setContactChannels(contactId, cleanChannels);
        if (JSON.stringify(tags) !== JSON.stringify(doc?.tags ?? [])) await setContactTags(contactId, tags);
        if (JSON.stringify(cleanProfiles) !== JSON.stringify(doc?.profiles ?? [])) await setContactProfiles(contactId, cleanProfiles);
      }
      navigation.goBack();
    })();
  };

  if (contactId && !seeded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!contactId && (books?.length ?? 0) > 1 && (
        <Field label="Address book">
          <ChoiceChips
            required
            options={(books ?? []).map((b) => ({ value: b.id, label: b.displayName ?? b.id }))}
            value={bookId}
            onChange={setBookId}
          />
        </Field>
      )}
      <Field label="Given name">
        <TextInput style={formStyles.input} value={form.givenName} onChangeText={(v) => set('givenName', v)} />
      </Field>
      <Field label="Middle name">
        <TextInput style={formStyles.input} value={form.middleName} onChangeText={(v) => set('middleName', v)} />
      </Field>
      <Field label="Family name">
        <TextInput style={formStyles.input} value={form.familyName} onChangeText={(v) => set('familyName', v)} />
      </Field>
      <Field label="Nickname">
        <TextInput style={formStyles.input} value={form.nickname} onChangeText={(v) => set('nickname', v)} />
      </Field>
      <Field label="Shown as">
        <ChoiceChips options={NAME_FORMAT_OPTIONS} value={form.displayNameFormat} onChange={(v) => set('displayNameFormat', v)} />
      </Field>
      <Field label="Kind">
        <ChoiceChips options={KIND_OPTIONS} value={form.kind} onChange={(v) => set('kind', v)} />
      </Field>
      <Field label="Pronouns">
        <TextInput style={formStyles.input} autoCapitalize="none" value={form.pronouns} onChangeText={(v) => set('pronouns', v)} />
      </Field>

      <Field label="Birthday">
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enter year</Text>
          <Switch
            value={form.birthdayYearKnown}
            onValueChange={(v) => setForm((f) => ({ ...f, birthdayYearKnown: v, birthday: '', birthdayMonth: '', birthdayDay: '' }))}
          />
        </View>
        {form.birthdayYearKnown ? (
          <DateField value={form.birthday} onChange={(v) => set('birthday', v)} />
        ) : (
          <View style={styles.pair}>
            <TextInput
              style={[formStyles.input, styles.pairItem]}
              placeholder="Month (1–12)"
              keyboardType="number-pad"
              maxLength={2}
              value={form.birthdayMonth}
              onChangeText={(v) => set('birthdayMonth', v.replace(/[^0-9]/g, ''))}
            />
            <TextInput
              style={[formStyles.input, styles.pairItem]}
              placeholder="Day (1–31)"
              keyboardType="number-pad"
              maxLength={2}
              value={form.birthdayDay}
              onChangeText={(v) => set('birthdayDay', v.replace(/[^0-9]/g, ''))}
            />
          </View>
        )}
        {contactId && <Text style={styles.muted}>Clearing a birthday isn't supported — leave empty to keep it.</Text>}
      </Field>

      <Text style={formStyles.section}>Reach</Text>
      {channels.map((c, i) => (
        <View key={`ch-${i}`} style={styles.reachRow}>
          <Text style={styles.reachKind}>{c.medium === 'Phone' ? '☎' : '✉'}</Text>
          <TextInput
            style={[formStyles.input, styles.reachValue]}
            placeholder={c.medium === 'Phone' ? '+46…' : 'name@example.com'}
            autoCapitalize="none"
            keyboardType={c.medium === 'Phone' ? 'phone-pad' : 'email-address'}
            value={c.value}
            onChangeText={(v) => setChannels((d) => d.map((x, j) => (j === i ? { ...x, value: v } : x)))}
          />
          <Pressable
            onPress={() => setChannels((d) => d.map((x, j) => (j === i
              ? { ...x, type: CHANNEL_TYPES[(CHANNEL_TYPES.indexOf((x.type as typeof CHANNEL_TYPES[number]) ?? null) + 1) % CHANNEL_TYPES.length] }
              : x)))}
            hitSlop={6}
          >
            <Text style={styles.typeChip}>{c.type ?? 'type'}</Text>
          </Pressable>
          <Pressable onPress={() => setChannels((d) => d.map((x, j) => (j === i ? { ...x, preferred: !x.preferred } : x)))} hitSlop={6}>
            <Text style={[styles.star, c.preferred && styles.starOn]}>★</Text>
          </Pressable>
          <Pressable onPress={() => setChannels((d) => d.filter((_, j) => j !== i))} hitSlop={6}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      {profiles.map((p, i) => (
        <View key={`pr-${i}`} style={styles.reachRow}>
          <TextInput
            style={[formStyles.input, styles.reachService]}
            placeholder="service"
            autoCapitalize="none"
            value={p.service}
            onChangeText={(v) => setProfiles((d) => d.map((x, j) => (j === i ? { ...x, service: v } : x)))}
          />
          <TextInput
            style={[formStyles.input, styles.reachValue]}
            placeholder="@handle or URL"
            autoCapitalize="none"
            value={p.handle}
            onChangeText={(v) => setProfiles((d) => d.map((x, j) => (j === i ? { ...x, handle: v } : x)))}
          />
          <Pressable onPress={() => setProfiles((d) => d.filter((_, j) => j !== i))} hitSlop={6}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        {REACH_OPTIONS.map((o) => (
          <Pressable key={o} style={styles.addChip} onPress={() => addReach(o)}>
            <Text style={styles.addChipText}>＋ {o}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Tags (comma-separated)">
        <TextInput style={formStyles.input} autoCapitalize="none" value={tagsCsv} onChangeText={setTagsCsv} />
      </Field>

      <Field label="Notes">
        <TextInput style={formStyles.multiline} multiline value={form.notes} onChangeText={(v) => set('notes', v)} />
      </Field>

      {error && <Text style={formStyles.error}>{error}</Text>}
      <View style={styles.buttons}>
        <Button title={contactId ? 'Save' : 'Create'} onPress={save} />
        <Button title="Cancel" kind="plain" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#888', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  switchLabel: { fontSize: 14 },
  pair: { flexDirection: 'row', gap: 8 },
  pairItem: { flex: 1 },
  reachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  reachKind: { fontSize: 18, width: 24, textAlign: 'center' },
  reachService: { flex: 2 },
  reachValue: { flex: 3 },
  typeChip: { fontSize: 11, color: '#4457c2', borderWidth: 1, borderColor: '#c6cbe8', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  star: { fontSize: 18, color: '#ccc' },
  starOn: { color: '#d97706' },
  remove: { fontSize: 14, color: '#999', paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  addChip: { borderWidth: 1, borderColor: '#bbb', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  addChipText: { fontSize: 13, color: '#444' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
