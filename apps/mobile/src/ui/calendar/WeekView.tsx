import { clampToDay, layoutColumns } from '@lupira/cal-domain/occurrences';
import { daysFrom, isToday, ymd } from '@lupira/cal-domain/time';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GridRow } from '../../data/mirror';
import { useDaysOccurrences } from '../../state/queries';
import { BIRTHDAY_COLOR, availabilityColor, useCalendarColors } from '../components/palette';

const HOUR_H = 44;

const slotTime = (slot: number) => `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`;
const DEFAULT_END_MIN = 30;   // open-ended timed occurrences render as a half-hour block

/// Week grid: all-day chips on top, timed lanes below. Placement is the domain's clampToDay + layoutColumns
/// (the same math the web grid uses); data is the mirror's occurrence rows for the 7 day buckets.
export const WeekView = memo(function WeekView({ weekStart, onPressOccurrence, onCreateSlot }: {
  weekStart: Date;
  onPressOccurrence: (row: GridRow) => void;
  onCreateSlot: (day: string, time: string) => void;
}) {
  // First tap on an empty lane drops a ＋ chip on that hour; tapping the chip opens the prefilled editor.
  // Slot granularity is 30 min; the ＋ chip covers the tapped half hour (prefill length stays 1h).
  const [pendingSlot, setPendingSlot] = useState<{ day: string; slot: number } | null>(null);
  const days = daysFrom(weekStart, 7);
  const dayKeys = days.map(ymd);
  const { rows } = useDaysOccurrences(dayKeys);
  const colorOf = useCalendarColors();

  const allDayByDay = new Map<string, GridRow[]>();
  const timedByDay = new Map<string, GridRow[]>();
  const availByDay = new Map<string, string | null>();
  for (const r of rows) {
    if (r.is_availability === 1) {
      availByDay.set(r.start_day, r.avail_status);   // renders as the column tint, never a chip
      continue;
    }
    const map = r.all_day === 1 ? allDayByDay : timedByDay;
    const list = map.get(r.start_day) ?? [];
    list.push(r);
    map.set(r.start_day, list);
  }
  const rowColor = (r: GridRow) => (r.source === 'birthday' ? BIRTHDAY_COLOR : colorOf(r.calendar_id));
  const hasAllDay = allDayByDay.size > 0;

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.gutter} />
        {days.map((d) => (
          <View key={ymd(d)} style={styles.dayHeader}>
            <Text style={[styles.dayHeaderText, isToday(d) && styles.today]}>
              {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)} {d.getDate()}
            </Text>
          </View>
        ))}
      </View>

      {hasAllDay && (
        <View style={styles.allDayRow}>
          <View style={styles.gutter} />
          {days.map((d) => (
            <View key={ymd(d)} style={styles.allDayCell}>
              {(allDayByDay.get(ymd(d)) ?? []).map((r) => (
                <Pressable
                  key={`${r.source}-${r.source_id}-${r.start_utc}`}
                  style={[styles.allDayChip, { backgroundColor: rowColor(r) }]}
                  onPress={() => onPressOccurrence(r)}
                >
                  <Text style={styles.chipText} numberOfLines={1}>
                    {r.source === 'birthday' ? `🎂 ${r.title ?? ''}` : (r.title ?? '(untitled)')}
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
              <Text key={h} style={[styles.hourLabel, { top: h * HOUR_H - 6 }]}>
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
                style={[styles.dayColumn, availByDay.has(dayKey) && { backgroundColor: `${availabilityColor(availByDay.get(dayKey) ?? null)}14` }]}
                onPress={(e) => {
                  const slot = Math.max(0, Math.min(47, Math.floor(e.nativeEvent.locationY / (HOUR_H / 2))));
                  setPendingSlot((cur) => (cur && cur.day === dayKey && cur.slot === slot ? null : { day: dayKey, slot }));
                }}
              >
                {Array.from({ length: 48 }, (_, i) => (
                  <View key={i} style={[i % 2 ? styles.halfLine : styles.hourLine, { top: (i * HOUR_H) / 2 }]} />
                ))}
                {pendingSlot?.day === dayKey && (
                  <Pressable
                    style={[styles.slotChip, { top: pendingSlot.slot * (HOUR_H / 2) + 1 }]}
                    onPress={() => {
                      onCreateSlot(dayKey, slotTime(pendingSlot.slot));
                      setPendingSlot(null);
                    }}
                  >
                    <Text style={styles.slotChipText}>＋ {slotTime(pendingSlot.slot)}</Text>
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
  headerRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#e4e4e8' },
  gutter: { width: 34 },
  dayHeader: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayHeaderText: { fontSize: 12, color: '#555' },
  today: { color: '#4457c2', fontWeight: '700' },
  allDayRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#e4e4e8', paddingVertical: 1 },
  allDayCell: { flex: 1, gap: 1, paddingHorizontal: 0.5 },
  allDayChip: { borderRadius: 3, paddingHorizontal: 2, paddingVertical: 1 },
  chipText: { fontSize: 9, color: '#fff' },
  lanes: { flexDirection: 'row', height: 24 * HOUR_H },
  hourLabel: { position: 'absolute', right: 4, fontSize: 9, color: '#999' },
  dayColumn: { flex: 1, borderLeftWidth: 0.5, borderColor: '#ececf0' },
  hourLine: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: '#ececf0' },
  halfLine: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: '#f5f5f8' },
  event: { position: 'absolute', borderRadius: 4, padding: 2, borderWidth: 0.5, borderColor: '#ffffff88' },
  slotChip: { position: 'absolute', left: 2, right: 2, height: HOUR_H / 2 - 2, borderRadius: 6, borderWidth: 1.5, borderColor: '#4457c2', borderStyle: 'dashed', backgroundColor: '#eef0fbee', alignItems: 'center', justifyContent: 'center' },
  slotChipText: { color: '#4457c2', fontWeight: '600', fontSize: 13 },
});
