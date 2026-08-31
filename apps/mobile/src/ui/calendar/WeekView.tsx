import { clampToDay, layoutColumns } from '@lupira/cal-domain/occurrences';
import { daysFrom, isToday, ymd } from '@lupira/cal-domain/time';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { GridRow } from '../../data/mirror';
import { isTaskRow } from '../../domain/taskRows';
import { useDaysOccurrences, useTaskDeadlines, type CalRow } from '../../state/queries';
import { BIRTHDAY_COLOR, availabilityColor, useCalendarColors } from '../hooks/palette';
import { useColors } from '../theme';
import { ICONS } from '../icons';
import { Glyph } from '../components/Glyph';

const HOUR_H = 44;

const slotTime = (slot: number) => `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`;
const DEFAULT_END_MIN = 30;   // open-ended timed occurrences render as a half-hour block

/** Week grid: all-day chips on top, timed lanes below. Placement is the domain's clampToDay + layoutColumns
 *  (the same math the web grid uses); data is the mirror's occurrence rows for the 7 day buckets. */
export const WeekView = memo(function WeekView({ weekStart, onPressOccurrence, onCreateSlot }: {
  weekStart: Date;
  onPressOccurrence: (row: CalRow) => void;
  onCreateSlot: (day: string, time: string) => void;
}) {
  // First tap on an empty lane drops a ＋ chip on that hour; tapping the chip opens the prefilled editor.
  // Slot granularity is 30 min; the ＋ chip covers the tapped half hour (prefill length stays 1h).
  const c = useColors();
  const [pendingSlot, setPendingSlot] = useState<{ day: string; slot: number } | null>(null);
  const days = daysFrom(weekStart, 7);
  const dayKeys = days.map(ymd);
  const { rows } = useDaysOccurrences(dayKeys);
  const taskRows = useTaskDeadlines(dayKeys);
  const colorOf = useCalendarColors();

  // Task rows are always all_day, so they land in the all-day strip; timed lanes stay mirror-only.
  const allDayByDay = new Map<string, CalRow[]>();
  const timedByDay = new Map<string, GridRow[]>();
  const availByDay = new Map<string, string | null>();
  for (const r of [...rows, ...taskRows]) {
    if (r.is_availability === 1) {
      availByDay.set(r.start_day, r.avail_status);   // renders as the column tint, never a chip
      continue;
    }
    if (r.all_day === 1) {
      const list = allDayByDay.get(r.start_day) ?? [];
      list.push(r);
      allDayByDay.set(r.start_day, list);
    } else {
      const list = timedByDay.get(r.start_day) ?? [];
      list.push(r as GridRow);
      timedByDay.set(r.start_day, list);
    }
  }
  const rowColor = (r: CalRow) => (r.source === 'birthday' ? BIRTHDAY_COLOR : colorOf(r.calendar_id));
  const hasAllDay = allDayByDay.size > 0;

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { borderColor: c.divider }]}>
        <View style={styles.gutter} />
        {days.map((d) => (
          <View key={ymd(d)} style={styles.dayHeader}>
            <Text style={[styles.dayHeaderText, { color: isToday(d) ? c.primary : c.textMuted }, isToday(d) && styles.today]}>
              {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)} {d.getDate()}
            </Text>
          </View>
        ))}
      </View>

      {hasAllDay && (
        <View style={[styles.allDayRow, { borderColor: c.divider }]}>
          <View style={styles.gutter} />
          {days.map((d) => (
            <View key={ymd(d)} style={styles.allDayCell}>
              {(allDayByDay.get(ymd(d)) ?? []).map((r) => (
                <Pressable
                  key={`${r.source}-${r.source_id}-${r.start_utc}`}
                  style={[
                    styles.allDayChip,
                    isTaskRow(r)
                      ? [
                          styles.taskChip,
                          { backgroundColor: c.surface, borderColor: c.border },
                          r.task.overdue && { borderColor: c.danger, backgroundColor: c.danger + '22' },
                        ]
                      : { backgroundColor: rowColor(r) },
                  ]}
                  onPress={() => onPressOccurrence(r)}
                >
                  <Text
                    style={[styles.chipText, isTaskRow(r) && { color: r.task.overdue ? c.danger : c.textMuted }]}
                    numberOfLines={1}
                  >
                    {isTaskRow(r) ? <><Glyph name={ICONS.schedule} /> {r.title ?? ''}</> : r.source === 'birthday' ? <><Glyph name={ICONS.cake} /> {r.title ?? ''}</> : (r.title ?? '(untitled)')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      <ScrollView contentOffset={{ x: 0, y: 7.5 * HOUR_H }}>
        <View style={styles.lanes}>
          <View style={styles.gutter}>
            {Array.from({ length: 24 }, (_, h) => (
              <Text key={h} style={[styles.hourLabel, { top: h * HOUR_H - 6, color: c.textMuted }]}>
                {String(h).padStart(2, '0')}
              </Text>
            ))}
          </View>
          {days.map((day) => {
            const spans = (timedByDay.get(ymd(day)) ?? []).flatMap((r) => {
              const start = new Date(r.start_utc);
              const end = r.end_utc ? new Date(r.end_utc) : new Date(start.getTime() + DEFAULT_END_MIN * 60_000);
              const span = clampToDay(start, end, day);
              return span ? [{ ...span, item: r }] : [];
            });
            const placed = layoutColumns(spans, 30);
            const dayKey = ymd(day);
            return (
              <Pressable
                key={dayKey}
                style={[
                  styles.dayColumn,
                  { borderColor: c.divider },
                  availByDay.has(dayKey) && { backgroundColor: `${availabilityColor(availByDay.get(dayKey) ?? null)}14` },
                ]}
                onPress={(e) => {
                  const slot = Math.max(0, Math.min(47, Math.floor(e.nativeEvent.locationY / (HOUR_H / 2))));
                  setPendingSlot((cur) => (cur && cur.day === dayKey && cur.slot === slot ? null : { day: dayKey, slot }));
                }}
              >
                {Array.from({ length: 48 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      i % 2 ? styles.halfLine : styles.hourLine,
                      { top: (i * HOUR_H) / 2, backgroundColor: i % 2 ? c.surface : c.divider },
                    ]}
                  />
                ))}
                {pendingSlot?.day === dayKey && (
                  <Pressable
                    style={[styles.slotChip, {
                      top: pendingSlot.slot * (HOUR_H / 2) + 1,
                      borderColor: c.primary,
                      backgroundColor: c.primary + '22',
                    }]}
                    onPress={() => {
                      onCreateSlot(dayKey, slotTime(pendingSlot.slot));
                      setPendingSlot(null);
                    }}
                  >
                    <Text style={[styles.slotChipText, { color: c.primary }]}>＋ {slotTime(pendingSlot.slot)}</Text>
                  </Pressable>
                )}
                {placed.map((p) => (
                  <Pressable
                    key={`${p.item.source_id}-${p.item.start_utc}`}
                    style={[styles.event, {
                      top: (p.startMin / 60) * HOUR_H,
                      height: Math.max(((p.endMin - p.startMin) / 60) * HOUR_H, 18),
                      left: `${(p.col / p.cols) * 100}%`,
                      width: `${(1 / p.cols) * 100}%`,
                      backgroundColor: rowColor(p.item),
                    }]}
                    onPress={() => onPressOccurrence(p.item)}
                  >
                    <Text style={styles.chipText} numberOfLines={2}>{p.item.title ?? '(untitled)'}</Text>
                  </Pressable>
                ))}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  gutter: { width: 34 },
  dayHeader: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayHeaderText: { fontSize: 12 },
  today: { fontWeight: '700' },
  allDayRow: { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 1 },
  allDayCell: { flex: 1, gap: 1, paddingHorizontal: 0.5 },
  allDayChip: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  chipText: { fontSize: 9, color: '#fff' },
  // Deadlines read as outlines with dark text, distinct from the white-on-color calendar chips.
  taskChip: { borderWidth: 0.5 },
  lanes: { flexDirection: 'row', height: 24 * HOUR_H },
  hourLabel: { position: 'absolute', right: 4, fontSize: 9 },
  dayColumn: { flex: 1, borderLeftWidth: 0.5 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 0.5 },
  halfLine: { position: 'absolute', left: 0, right: 0, height: 0.5 },
  event: { position: 'absolute', borderRadius: 4, padding: 2, borderWidth: 0.5, borderColor: '#ffffff88' },
  slotChip: { position: 'absolute', left: 2, right: 2, height: HOUR_H / 2 - 2, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  slotChipText: { fontWeight: '600', fontSize: 13 },
});
