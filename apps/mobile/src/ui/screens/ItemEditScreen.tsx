import { RRULE_PRESETS, describeRrule } from '@lupira/cal-domain/rrule';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { ItemForm } from '../../domain/editors';
import { emptyItemForm, itemCoreFromForm, itemFormFromDoc } from '../../domain/editors';
import { createItem, reviseItem } from '../../state/actions';
import { useCalendars, useItemState } from '../../state/queries';
import { Button, ChoiceChips, DateField, Field, TimeField, formStyles } from '../components/form';
import type { RootStackParamList } from '../navigation/types';

const STATUS_OPTIONS = ['Tentative', 'Confirmed', 'Cancelled'].map((s) => ({ value: s, label: s }));
const CATEGORY_OPTIONS = ['General', 'Meeting', 'Appointment', 'Meal', 'Occasion', 'Outing', 'Trip', 'Stay', 'Activity', 'Focus', 'Chore']
  .map((c) => ({ value: c, label: c }));

export function ItemEditScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ItemEdit'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const itemId = route.params?.itemId;
  const { data: state } = useItemState(itemId ?? '');
  const { data: calendars } = useCalendars();

  const [form, setForm] = useState<ItemForm>(() => emptyItemForm(route.params?.day));
  const [calendarId, setCalendarId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(!itemId);

  useEffect(() => {
    if (!seeded && itemId && state) {
      setForm(itemFormFromDoc(state.doc));
      setSeeded(true);
    }
  }, [seeded, itemId, state]);
  useEffect(() => {
    if (!itemId && !calendarId && calendars?.length) setCalendarId(calendars[0].id);
  }, [itemId, calendarId, calendars]);

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const r = itemCoreFromForm(form, state?.doc);
    if (!r.ok) return setError(r.error);
    if (!itemId && !form.title.trim()) return setError('A new event needs a title');
    if (!itemId && !calendarId) return setError('Pick a calendar');
    setError(null);
    void (itemId ? reviseItem(itemId, r.value) : createItem(calendarId, r.value)).then(() => navigation.goBack());
  };

  if (itemId && !seeded) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!itemId && (
        <Field label="Calendar">
          <ChoiceChips
            required
            options={(calendars ?? []).map((c) => ({ value: c.id, label: c.displayName ?? c.id }))}
            value={calendarId}
            onChange={setCalendarId}
          />
        </Field>
      )}
      <Field label="Title">
        <TextInput style={formStyles.input} value={form.title} onChangeText={(v) => set('title', v)} />
      </Field>
      <Field label="Description">
        <TextInput style={formStyles.multiline} multiline value={form.description} onChangeText={(v) => set('description', v)} />
      </Field>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>All-day</Text>
        <Switch value={form.isAllDay} onValueChange={(v) => set('isAllDay', v)} />
      </View>

      {form.isAllDay ? (
        <>
          <Field label="Start date">
            <DateField value={form.startDay} onChange={(v) => set('startDay', v)} />
          </Field>
          <Field label="End date (exclusive, optional)">
            <DateField value={form.endDay} onChange={(v) => set('endDay', v)} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Starts">
            <View style={styles.pair}>
              <View style={styles.pairItem}><DateField value={form.startDay} onChange={(v) => set('startDay', v)} /></View>
              <View style={styles.pairItem}><TimeField value={form.startTime} onChange={(v) => set('startTime', v)} /></View>
            </View>
          </Field>
          <Field label="Ends (optional)">
            <View style={styles.pair}>
              <View style={styles.pairItem}><DateField value={form.endDay} onChange={(v) => set('endDay', v)} /></View>
              <View style={styles.pairItem}><TimeField value={form.endTime} onChange={(v) => set('endTime', v)} /></View>
            </View>
          </Field>
        </>
      )}

      <Field label="Repeats">
        <ChoiceChips
          options={[{ value: '', label: 'Never' }, ...RRULE_PRESETS.map((p) => ({ value: p.rrule, label: p.label }))]}
          value={form.recurrenceRule}
          onChange={(v) => set('recurrenceRule', v)}
          required
        />
        <TextInput
          style={formStyles.input}
          placeholder="or a raw rule: FREQ=WEEKLY;BYDAY=MO"
          autoCapitalize="characters"
          autoCorrect={false}
          value={form.recurrenceRule}
          onChangeText={(v) => set('recurrenceRule', v)}
        />
        {!!form.recurrenceRule && <Text style={styles.muted}>{describeRrule(form.recurrenceRule)}</Text>}
      </Field>

      <Field label="Status">
        <ChoiceChips options={STATUS_OPTIONS} value={form.status} onChange={(v) => set('status', v)} />
      </Field>
      <Field label="Category">
        <ChoiceChips options={CATEGORY_OPTIONS} value={form.category} onChange={(v) => set('category', v)} />
      </Field>
      <Field label="Tags (comma-separated)">
        <TextInput style={formStyles.input} autoCapitalize="none" value={form.tagsCsv} onChangeText={(v) => set('tagsCsv', v)} />
      </Field>

      {error && <Text style={formStyles.error}>{error}</Text>}
      <View style={styles.buttons}>
        <Button title={itemId ? 'Save' : 'Create'} onPress={save} />
        <Button title="Cancel" kind="plain" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#888', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontSize: 15 },
  pair: { flexDirection: 'row', gap: 8 },
  pairItem: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
