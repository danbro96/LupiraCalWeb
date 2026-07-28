import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { localDay, localTime } from '../../domain/editors';
import { ACCENT } from './palette';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export type ChipOption = { value: string; label: string };

/// Single-select chips; tapping the active chip clears it (value '') unless required.
export function ChoiceChips({ options, value, onChange, required = false }: {
  options: ChipOption[]; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active && !required ? '' : o.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/// Android system pickers writing back the editors' string forms ('yyyy-MM-dd' / 'HH:MM').
export function DateField({ value, onChange, placeholder = 'Set date' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const open = () =>
    DateTimePickerAndroid.open({
      value: value ? new Date(`${value}T12:00:00`) : new Date(),
      mode: 'date',
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(localDay(d));
      },
    });
  return <PickerButton text={value || placeholder} isSet={!!value} onPress={open} onClear={() => onChange('')} />;
}

export function TimeField({ value, onChange, placeholder = 'Set time' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const open = () => {
    const base = new Date();
    if (value) {
      const [hh, mm] = value.split(':').map(Number);
      base.setHours(hh, mm, 0, 0);
    }
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      is24Hour: true,
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(localTime(d));
      },
    });
  };
  return <PickerButton text={value || placeholder} isSet={!!value} onPress={open} onClear={() => onChange('')} />;
}

function PickerButton({ text, isSet, onPress, onClear }: {
  text: string; isSet: boolean; onPress: () => void; onClear: () => void;
}) {
  return (
    <View style={styles.pickerRow}>
      <Pressable style={styles.picker} onPress={onPress}>
        <Text style={[styles.pickerText, !isSet && styles.pickerPlaceholder]}>{text}</Text>
      </Pressable>
      {isSet && (
        <Pressable style={styles.clear} onPress={onClear} hitSlop={8}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled = false }: {
  title: string; onPress: () => void; kind?: 'primary' | 'danger' | 'plain'; disabled?: boolean;
}) {
  const color = kind === 'danger' ? '#b91c1c' : ACCENT;
  return (
    <Pressable
      style={[styles.button, { borderColor: color }, disabled && styles.buttonDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={{ color }}>{title}</Text>
    </Pressable>
  );
}

export const formStyles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 6, padding: 8, fontSize: 15 },
  multiline: { borderWidth: 1, borderColor: '#bbb', borderRadius: 6, padding: 8, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  error: { color: '#b91c1c' },
  section: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginTop: 16 },
});

const styles = StyleSheet.create({
  field: { gap: 4, marginTop: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#777' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#bbb', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipActive: { borderColor: ACCENT, backgroundColor: '#eef0fb' },
  chipText: { fontSize: 13, color: '#444' },
  chipTextActive: { color: ACCENT, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picker: { borderWidth: 1, borderColor: '#bbb', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, flexGrow: 1 },
  pickerText: { fontSize: 15 },
  pickerPlaceholder: { color: '#999' },
  clear: { padding: 4 },
  clearText: { color: '#999', fontSize: 14 },
  button: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  buttonDisabled: { opacity: 0.4 },
});
