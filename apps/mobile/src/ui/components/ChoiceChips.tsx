import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { spacing } from '../theme';

export type ChipOption = { value: string; label: string };

/** Single-select chips; tapping the active chip clears it (value '') unless required. */
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

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
});
