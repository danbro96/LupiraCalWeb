import { addDays, addMonths, fmtMonthTitle, fmtTime, parseYmd, startOfWeek, ymd } from '@lupira/cal-domain/time';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GridRow } from '../../data/mirror';
import { useDaysOccurrences } from '../../state/queries';
import { MonthView } from '../calendar/MonthView';
import { WeekView } from '../calendar/WeekView';
import { ACCENT, BIRTHDAY_COLOR, useCalendarColors } from '../components/palette';
import { SyncBanner } from '../components/SyncBanner';
import type { RootStackParamList } from '../navigation/types';

type Mode = 'month' | 'week';

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => ymd(new Date()));

  const weekStart = startOfWeek(anchor);
  const title = mode === 'month'
    ? fmtMonthTitle(anchor)
    : `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const step = (dir: 1 | -1) => {
    const next = mode === 'month' ? addMonths(anchor, dir) : addDays(anchor, dir * 7);
    setAnchor(next);
    if (mode === 'month') setSelectedDay(ymd(next));
  };
  const goToday = () => {
    setAnchor(new Date());
    setSelectedDay(ymd(new Date()));
  };
  const openOccurrence = (row: GridRow) => {
    if (row.source === 'birthday') navigation.navigate('ContactDetail', { contactId: row.source_id });
    else navigation.navigate('ItemDetail', { itemId: row.source_id });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SyncBanner />
      <View style={styles.toolbar}>
        <Pressable onPress={() => step(-1)} hitSlop={8}><Text style={styles.nav}>‹</Text></Pressable>
        <Pressable onPress={goToday} style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
        </Pressable>
        <Pressable onPress={() => step(1)} hitSlop={8}><Text style={styles.nav}>›</Text></Pressable>
        <Pressable
          style={styles.modeToggle}
          onPress={() => setMode(mode === 'month' ? 'week' : 'month')}
        >
          <Text style={styles.modeText}>{mode === 'month' ? 'Week' : 'Month'}</Text>
        </Pressable>
        <Pressable
          style={styles.add}
          onPress={() => navigation.navigate('ItemEdit', { day: selectedDay })}
        >
          <Text style={styles.addText}>＋</Text>
        </Pressable>
      </View>

      {mode === 'month' ? (
        <ScrollView>
          <MonthView
            anchor={anchor}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              setSelectedDay(day);
              const d = parseYmd(day);
              if (d.getMonth() !== anchor.getMonth()) setAnchor(d);
            }}
          />
          <DayAgenda day={selectedDay} onPress={openOccurrence} />
        </ScrollView>
      ) : (
        <WeekView weekStart={weekStart} onPressOccurrence={openOccurrence} />
      )}
    </SafeAreaView>
  );
}

function DayAgenda({ day, onPress }: { day: string; onPress: (row: GridRow) => void }) {
  const { rows } = useDaysOccurrences([day]);
  const colorOf = useCalendarColors();
  const sorted = [...rows].sort((a, b) => b.all_day - a.all_day || (a.start_utc < b.start_utc ? -1 : 1));

  return (
    <View style={styles.agenda}>
      <Text style={styles.agendaTitle}>
        {parseYmd(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      {sorted.length === 0 && <Text style={styles.agendaEmpty}>Nothing scheduled</Text>}
      {sorted.map((r) => (
        <Pressable key={`${r.source}-${r.source_id}-${r.start_utc}`} style={styles.agendaRow} onPress={() => onPress(r)}>
          <View style={[styles.dot, { backgroundColor: r.source === 'birthday' ? BIRTHDAY_COLOR : colorOf(r.calendar_id) }]} />
          <Text style={styles.agendaTime}>
            {r.source === 'birthday' ? '🎂' : r.all_day === 1 ? 'all day' : fmtTime(new Date(r.start_utc))}
          </Text>
          <Text style={styles.agendaText} numberOfLines={1}>{r.title ?? '(untitled)'}</Text>
          {r.status === 'Cancelled' && <Text style={styles.cancelled}>cancelled</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 10 },
  nav: { fontSize: 22, color: ACCENT, paddingHorizontal: 6 },
  titleWrap: { flexGrow: 1 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  modeToggle: { borderWidth: 1, borderColor: ACCENT, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  modeText: { color: ACCENT, fontSize: 12 },
  add: { backgroundColor: ACCENT, borderRadius: 16, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  agenda: { padding: 12, gap: 6 },
  agendaTitle: { fontSize: 13, fontWeight: '700', color: '#666' },
  agendaEmpty: { color: '#999', fontSize: 13 },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  agendaTime: { width: 52, fontSize: 12, color: '#777' },
  agendaText: { flex: 1, fontSize: 14 },
  cancelled: { fontSize: 11, color: '#b91c1c' },
});
