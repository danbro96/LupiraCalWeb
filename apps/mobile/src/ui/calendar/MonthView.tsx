import { isToday, monthMatrix, ymd } from '@lupira/cal-domain/time';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isTaskRow } from '../../domain/taskRows';
import { useDaysOccurrences, useTaskDeadlines, type CalRow } from '../../state/queries';
import { BIRTHDAY_COLOR, availabilityColor, useCalendarColors } from '../components/palette';

/// Month grid straight off the mirror: monthMatrix (domain) for the day layout, one occurrence query per
/// touched month bucket, up to three title bars per cell. Day selection drives the agenda in CalendarScreen.
export const MonthView = memo(function MonthView({ anchor, selectedDay, onSelectDay }: {
  anchor: Date;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  const weeks = monthMatrix(anchor);
  const dayKeys = weeks.flat().map(ymd);
  const { rows } = useDaysOccurrences(dayKeys);
  const taskRows = useTaskDeadlines(dayKeys);
  const colorOf = useCalendarColors();

  const byDay = new Map<string, CalRow[]>();
  const availByDay = new Map<string, string | null>();
  const merged: CalRow[] = [...rows, ...taskRows].sort((a, b) => (a.start_utc < b.start_utc ? -1 : a.start_utc > b.start_utc ? 1 : 0));
  for (const r of merged) {
    if (r.is_availability === 1) {
      availByDay.set(r.start_day, r.avail_status);   // the band, never a chip
      continue;
    }
    const list = byDay.get(r.start_day) ?? [];
    list.push(r);
    byDay.set(r.start_day, list);
  }

  return (
    <View style={styles.grid}>
      <View style={styles.weekdayRow}>
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
                {availByDay.has(key) && (
                  <View style={[styles.availStrip, { backgroundColor: availabilityColor(availByDay.get(key) ?? null) }]} />
                )}
                <Text style={[styles.dayNum, !inMonth && styles.dayNumDim, isToday(d) && styles.dayNumToday]}>
                  {d.getDate()}
                </Text>
                {dayRows.slice(0, 3).map((r) =>
                  isTaskRow(r) ? (
                    <View
                      key={`${r.source}-${r.source_id}-${r.start_utc}`}
                      style={[styles.taskBar, r.task.overdue && styles.taskBarOverdue]}
                    >
                      <Text style={[styles.taskBarText, r.task.overdue && styles.taskBarTextOverdue]} numberOfLines={1}>
                        ⏰ {r.title ?? '(untitled)'}
                      </Text>
                    </View>
                  ) : (
                    <View
                      key={`${r.source}-${r.source_id}-${r.start_utc}`}
                      style={[styles.bar, { backgroundColor: r.source === 'birthday' ? BIRTHDAY_COLOR : colorOf(r.calendar_id) }]}
                    >
                      <Text style={styles.barText} numberOfLines={1}>
                        {r.source === 'birthday' ? `🎂 ${r.title ?? ''}` : (r.title ?? '(untitled)')}
                      </Text>
                    </View>
                  ),
                )}
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
  // Fills whatever height the parent gives: weeks flex-share it, so collapsing the day sheet
  // stretches the grid to the whole screen.
  grid: { paddingHorizontal: 2, flex: 1 },
  weekRow: { flexDirection: 'row', flex: 1 },
  weekdayRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: '#888', paddingVertical: 2 },
  cell: { flex: 1, minHeight: 56, borderWidth: 0.5, borderColor: '#e4e4e8', padding: 1, gap: 1, overflow: 'hidden' },
  cellSelected: { borderColor: '#4457c2', borderWidth: 1.5 },
  availStrip: { height: 3, borderRadius: 2, marginBottom: 1 },
  dayNum: { fontSize: 11, color: '#333', paddingLeft: 2 },
  dayNumDim: { color: '#bbb' },
  dayNumToday: { color: '#4457c2', fontWeight: '700' },
  bar: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 0.5 },
  barText: { fontSize: 8.5, color: '#fff' },
  // Deadlines read as outlines, not filled calendar bars (web parity: muted, danger when overdue).
  taskBar: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 0.5, backgroundColor: '#f1f1f4', borderWidth: 0.5, borderColor: '#c8c8d0' },
  taskBarOverdue: { borderColor: '#dc2626', backgroundColor: '#fdf0ef' },
  taskBarText: { fontSize: 8.5, color: '#555' },
  taskBarTextOverdue: { color: '#dc2626' },
  more: { fontSize: 9, color: '#888', paddingLeft: 2 },
});
