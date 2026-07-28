import { isToday, monthMatrix, ymd } from '@lupira/cal-domain/time';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { GridRow } from '../../data/mirror';
import { useDaysOccurrences } from '../../state/queries';
import { BIRTHDAY_COLOR, useCalendarColors } from '../components/palette';

/// Month grid straight off the mirror: monthMatrix (domain) for the day layout, one occurrence query per
/// touched month bucket, up to three title bars per cell. Day selection drives the agenda in CalendarScreen.
export const MonthView = memo(function MonthView({ anchor, selectedDay, onSelectDay }: {
  anchor: Date;
  selectedDay: string;
  onSelectDay: (day: string) => void;
}) {
  const weeks = monthMatrix(anchor);
  const dayKeys = weeks.flat().map(ymd);
  const { rows } = useDaysOccurrences(dayKeys);
  const colorOf = useCalendarColors();

  const byDay = new Map<string, GridRow[]>();
  for (const r of rows) {
    const list = byDay.get(r.start_day) ?? [];
    list.push(r);
    byDay.set(r.start_day, list);
  }

  return (
    <View style={styles.grid}>
      <View style={styles.weekRow}>
        {weeks[0].map((d) => (
          <Text key={ymd(d)} style={styles.weekday}>
            {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((d) => {
            const key = ymd(d);
            const dayRows = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === anchor.getMonth();
            const selected = key === selectedDay;
            return (
              <Pressable key={key} style={[styles.cell, selected && styles.cellSelected]} onPress={() => onSelectDay(key)}>
                <Text style={[styles.dayNum, !inMonth && styles.dayNumDim, isToday(d) && styles.dayNumToday]}>
                  {d.getDate()}
                </Text>
                {dayRows.slice(0, 3).map((r) => (
                  <View
                    key={`${r.source}-${r.source_id}-${r.start_utc}`}
                    style={[styles.bar, { backgroundColor: r.source === 'birthday' ? BIRTHDAY_COLOR : colorOf(r.calendar_id) }]}
                  >
                    <Text style={styles.barText} numberOfLines={1}>
                      {r.source === 'birthday' ? `🎂 ${r.title ?? ''}` : (r.title ?? '(untitled)')}
                    </Text>
                  </View>
                ))}
                {dayRows.length > 3 && <Text style={styles.more}>+{dayRows.length - 3}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { paddingHorizontal: 2 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: '#888', paddingVertical: 2 },
  cell: { flex: 1, minHeight: 74, borderWidth: 0.5, borderColor: '#e4e4e8', padding: 1, gap: 1 },
  cellSelected: { borderColor: '#4457c2', borderWidth: 1.5 },
  dayNum: { fontSize: 11, color: '#333', paddingLeft: 2 },
  dayNumDim: { color: '#bbb' },
  dayNumToday: { color: '#4457c2', fontWeight: '700' },
  bar: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 0.5 },
  barText: { fontSize: 8.5, color: '#fff' },
  more: { fontSize: 9, color: '#888', paddingLeft: 2 },
});
