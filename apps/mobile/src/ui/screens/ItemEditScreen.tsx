import { RRULE_PRESETS, describeRrule } from '@lupira/cal-domain/rrule';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HelperText, List, Switch, useTheme } from 'react-native-paper';
import type { ItemForm } from '../../domain/editors';
import { categoryAllDayDefault, emptyItemForm, itemCoreFromForm, itemFormFromDoc } from '../../domain/editors';
import { createItem, reviseItem } from '../../state/actions';
import { selectableCalendars, useCalendars, useItemState } from '../../state/queries';
import { ChoiceChips, DateField, Field, Input, TimeField } from '../components/form';
import type { RootStackParamList } from '../navigation/types';
import { useUnsavedGuard } from '../navigation/useUnsavedGuard';

const STATUS_OPTIONS = ['Tentative', 'Confirmed', 'Cancelled'].map((s) => ({ value: s, label: s }));
const CATEGORY_OPTIONS = ['General', 'Meeting', 'Appointment', 'Meal', 'Occasion', 'Outing', 'Trip', 'Stay', 'Activity', 'Focus', 'Chore']
  .map((c) => ({ value: c, label: c }));

export function ItemEditScreen() {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'ItemEdit'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const itemId = route.params?.itemId;
  const { data: state } = useItemState(itemId ?? '');
  const { data: calendars } = useCalendars();

  const [form, setForm] = useState<ItemForm>(() => emptyItemForm(route.params?.day, route.params?.time));
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [calendarId, setCalendarId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(!itemId);

  /// Pristine snapshot; the exit guard and the header's Save state key off differences from it.
  const baseline = useRef(JSON.stringify(emptyItemForm(route.params?.day, route.params?.time)));

  useEffect(() => {
    if (!seeded && itemId && state) {
      const seededForm = itemFormFromDoc(state.doc);
      setForm(seededForm);
      baseline.current = JSON.stringify(seededForm);
      setSeeded(true);
    }
  }, [seeded, itemId, state]);
  useEffect(() => {
    const pickable = selectableCalendars(calendars);
    if (!itemId && !calendarId && pickable.length) setCalendarId(pickable[0].id);
  }, [itemId, calendarId, calendars]);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline.current, [form]);
  /// Bridges the guard to the submit closure (assigned below) without re-subscribing every render.
  const submitRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const guard = useUnsavedGuard(dirty, {
    message: 'Save this event before leaving?',
    onSave: () => submitRef.current(),
  });

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSchedule = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => {
    setScheduleTouched(true);
    set(key, value);
  };
  // Category picked first on a NEW event steers the schedule shape — but never overrides user input.
  const pickCategory = (v: string) => {
    set('category', v);
    if (itemId || scheduleTouched) return;
    const allDay = categoryAllDayDefault(v);
    if (allDay !== null) set('isAllDay', allDay);
  };

  /// Persists without navigating; false = validation failed, so the guard keeps the user here.
  const submit = async (): Promise<boolean> => {
    const r = itemCoreFromForm(form, state?.doc);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    if (!itemId && !form.title.trim()) {
      setError('A new event needs a title');
      return false;
    }
    if (!itemId && !calendarId) {
      setError('Pick a calendar');
      return false;
    }
    setError(null);
    try {
      if (itemId) await reviseItem(itemId, r.value);
      else await createItem(calendarId, r.value);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    }
  };
  submitRef.current = submit;

  const saveAndLeave = () => {
    void submit().then((saved) => {
      if (!saved) return;
      guard.leave();
      navigation.goBack();
    });
  };

  // Save lives in the header (dimmed until something changes); leaving unsaved is guarded, so there
  // is no Cancel button. Dependency-free on purpose: saveAndLeave closes over live form state.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={saveAndLeave} hitSlop={8}>
          <Text style={[styles.headerSave, { color: theme.colors.primary }, !dirty && styles.headerSaveIdle]}>Save</Text>
        </Pressable>
      ),
    });
  });

  if (itemId && !seeded) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!itemId && (
        <Field label="Calendar">
          <ChoiceChips
            required
            options={selectableCalendars(calendars).map((c) => ({ value: c.id, label: c.displayName ?? c.id }))}
            value={calendarId}
            onChange={setCalendarId}
          />
        </Field>
      )}
      <Field label="Category">
        <ChoiceChips options={CATEGORY_OPTIONS} value={form.category} onChange={pickCategory} />
      </Field>
      <Input label="Title" value={form.title} onChangeText={(v) => set('title', v)} />
      <Input
        label="Description"
        multiline
        numberOfLines={3}
        style={{ minHeight: 72 }}
        value={form.description}
        onChangeText={(v) => set('description', v)}
      />

      <List.Item
        title="All-day"
        right={() => <Switch value={form.isAllDay} onValueChange={(v) => setSchedule('isAllDay', v)} />}
      />

      {form.isAllDay ? (
        <>
          <Field label="Start date">
            <DateField value={form.startDay} onChange={(v) => setSchedule('startDay', v)} />
          </Field>
          <Field label="End date (exclusive, optional)">
            <DateField value={form.endDay} onChange={(v) => setSchedule('endDay', v)} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Starts">
            <View style={styles.pair}>
              <View style={styles.pairItem}><DateField value={form.startDay} onChange={(v) => setSchedule('startDay', v)} /></View>
              <View style={styles.pairItem}><TimeField value={form.startTime} onChange={(v) => setSchedule('startTime', v)} /></View>
            </View>
          </Field>
          <Field label="Ends (optional)">
            <View style={styles.pair}>
              <View style={styles.pairItem}><DateField value={form.endDay} onChange={(v) => setSchedule('endDay', v)} /></View>
              <View style={styles.pairItem}><TimeField value={form.endTime} onChange={(v) => setSchedule('endTime', v)} /></View>
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
        <Input
          label="or a raw rule"
          placeholder="FREQ=WEEKLY;BYDAY=MO"
          autoCapitalize="characters"
          autoCorrect={false}
          value={form.recurrenceRule}
          onChangeText={(v) => set('recurrenceRule', v)}
        />
        {!!form.recurrenceRule && <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>{describeRrule(form.recurrenceRule)}</Text>}
      </Field>

      <Field label="Status">
        <ChoiceChips options={STATUS_OPTIONS} value={form.status} onChange={(v) => set('status', v)} />
      </Field>
      <Input label="Tags (comma-separated)" autoCapitalize="none" value={form.tagsCsv} onChangeText={(v) => set('tagsCsv', v)} />

      <HelperText type="error" visible={!!error}>{error}</HelperText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13 },
  pair: { flexDirection: 'row', gap: 8 },
  pairItem: { flex: 1 },
  headerSave: { fontSize: 16, fontWeight: '600', paddingRight: 4 },
  headerSaveIdle: { opacity: 0.45 },
});
