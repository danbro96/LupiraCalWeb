import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ContactForm } from '../../domain/editors';
import { contactCoreFromForm, contactFormFromDoc, emptyContactForm, parseCsv } from '../../domain/editors';
import { createContact, reviseContact } from '../../state/actions';
import { useAddressBooks, useContactState } from '../../state/queries';
import { Button, ChoiceChips, DateField, Field, formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

const KIND_OPTIONS = [{ value: 'Individual', label: 'Person' }, { value: 'Organization', label: 'Organization' }];
const NAME_FORMAT_OPTIONS = [
  { value: 'Full', label: 'Full name' },
  { value: 'FirstLast', label: 'First + last' },
  { value: 'NickName', label: 'Nickname' },
];

export function ContactEditScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ContactEdit'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const contactId = route.params?.contactId;
  const { data: state } = useContactState(contactId ?? '');
  const { data: books } = useAddressBooks();

  const [form, setForm] = useState<ContactForm>(emptyContactForm);
  const [bookId, setBookId] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(!contactId);

  useEffect(() => {
    if (!seeded && contactId && state) {
      setForm(contactFormFromDoc(state.doc));
      setSeeded(true);
    }
  }, [seeded, contactId, state]);
  useEffect(() => {
    if (!contactId && !bookId && books?.length) setBookId(books[0].id);
  }, [contactId, bookId, books]);

  const set = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const r = contactCoreFromForm(form);
    if (!r.ok) return setError(r.error);
    if (!contactId && !bookId) return setError('Pick an address book');
    setError(null);
    const core = contactId ? r.value : { ...r.value, tags: parseCsv(tagsCsv) };   // create-only: tags ride the core
    void (contactId ? reviseContact(contactId, core) : createContact(bookId, core)).then(() => navigation.goBack());
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
        <DateField value={form.birthday} onChange={(v) => set('birthday', v)} />
        {!!form.birthday && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Year is known</Text>
            <Switch value={form.birthdayYearKnown} onValueChange={(v) => set('birthdayYearKnown', v)} />
          </View>
        )}
        {contactId && <Text style={styles.muted}>Clearing a birthday isn’t supported — leave as is to keep it.</Text>}
      </Field>

      {!contactId && (
        <Field label="Tags (comma-separated)">
          <TextInput style={formStyles.input} autoCapitalize="none" value={tagsCsv} onChangeText={setTagsCsv} />
        </Field>
      )}

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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { fontSize: 14 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
