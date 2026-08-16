import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button as PaperButton, Chip, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import { localDay, localTime } from '../../domain/editors';

export function Input({ style, ...props }: ComponentProps<typeof TextInput>) {
  return <TextInput mode="outlined" dense style={[styles.input, style]} {...props} />;
}

/// Wrapper for non-text controls (chips, date/time pickers, switches) — text inputs carry their own label.
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
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginTop: 16 },
});

const styles = StyleSheet.create({
  input: { marginTop: 10 },
  field: { gap: 4, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picker: { flexGrow: 1 },
  button: { alignSelf: 'flex-start' },
});
