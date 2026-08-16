import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button as PaperButton, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { localDay, localTime } from '../../domain/editors';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="labelMedium">{label}</Text>
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
          <Chip
            key={o.value}
            mode="outlined"
            compact
            selected={active}
            onPress={() => onChange(active && !required ? '' : o.value)}
          >
            {o.label}
          </Chip>
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
  const theme = useTheme();
  return (
    <View style={styles.pickerRow}>
      <PaperButton
        mode="outlined"
        style={styles.picker}
        textColor={isSet ? undefined : theme.colors.onSurfaceVariant}
        onPress={onPress}
      >
        {text}
      </PaperButton>
      {isSet && <IconButton icon="close" size={16} onPress={onClear} />}
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled = false }: {
  title: string; onPress: () => void; kind?: 'primary' | 'danger' | 'plain'; disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PaperButton
      mode={kind === 'plain' ? 'outlined' : 'contained'}
      buttonColor={kind === 'danger' ? theme.colors.error : undefined}
      textColor={kind === 'danger' ? theme.colors.onError : undefined}
      style={styles.button}
      disabled={disabled}
      onPress={onPress}
    >
      {title}
    </PaperButton>
  );
}

export const formStyles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 15 },
  multiline: { borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 15, minHeight: 72, textAlignVertical: 'top' },
  error: {},
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16 },
});

const styles = StyleSheet.create({
  field: { gap: 4, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picker: { flexGrow: 1 },
  button: { alignSelf: 'flex-start' },
});
