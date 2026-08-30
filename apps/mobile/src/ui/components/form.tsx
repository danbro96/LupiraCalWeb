import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button as PaperButton, IconButton, Text, TextInput } from 'react-native-paper';
import { localDay, localTime } from '../../domain/editors';
import { useColors } from '../theme';

export function Input({ style, ...props }: ComponentProps<typeof TextInput>) {
  return <TextInput mode="outlined" dense style={[styles.input, style]} {...props} />;
}

/** Wrapper for non-text controls (chips, date/time pickers, switches) — text inputs carry their own label. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="labelMedium">{label}</Text>
      {children}
    </View>
  );
}

/** Android system pickers writing back the editors' string forms ('yyyy-MM-dd' / 'HH:MM'). */
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
  const c = useColors();
  return (
    <View style={styles.pickerRow}>
      <PaperButton
        mode="outlined"
        style={styles.picker}
        textColor={isSet ? undefined : c.textMuted}
        onPress={onPress}
      >
        {text}
      </PaperButton>
      {isSet && <IconButton icon="close" size={16} onPress={onClear} />}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { marginTop: 10 },
  field: { gap: 4, marginTop: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picker: { flexGrow: 1 },
});
