import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { localDay } from '../../domain/editors';
import { PickerButton } from './PickerButton';

/** Android system picker writing back the editors' string form ('yyyy-MM-dd'). */
export function DateField({ value, onChange, placeholder = 'Set date' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const open = () =>
    DateTimePickerAndroid.open({
      // Midday so a DST shift cannot roll the date back a day.
      value: value ? new Date(`${value}T12:00:00`) : new Date(),
      mode: 'date',
      onChange: (e, d) => {
        if (e.type === 'set' && d) onChange(localDay(d));
      },
    });
  return <PickerButton text={value || placeholder} isSet={!!value} onPress={open} onClear={() => onChange('')} />;
}
