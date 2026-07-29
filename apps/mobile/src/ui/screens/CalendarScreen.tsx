import { addDays, addMonths, fmtMonthTitle, fmtTime, parseYmd, startOfWeek, ymd } from '@lupira/cal-domain/time';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GridRow } from '../../data/mirror';
import { useDaysOccurrences } from '../../state/queries';
import { MonthView } from '../calendar/MonthView';
import { WeekView } from '../calendar/WeekView';
import { BridgePrompt } from '../components/BridgePrompt';
import { ACCENT, BIRTHDAY_COLOR, useCalendarColors } from '../components/palette';
import { SyncBanner } from '../components/SyncBanner';
import type { RootStackParamList } from '../navigation/types';

type Mode = 'month' | 'week';

/// Month mode: the grid flex-fills the screen; selecting a day slides up a draggable agenda sheet
/// (snap points ≈ 38% / 78%, drag below ~20% deselects). Changing month or jumping to today clears
/// the selection. Week mode: timed lanes with tap-to-create slots.
export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const containerH = useRef(0);
  const sheetH = useRef(new Animated.Value(0)).current;
  const sheetCommitted = useRef(0);

  const animateSheet = useCallback((to: number) => {
    sheetCommitted.current = to;
    Animated.spring(sheetH, { toValue: to, useNativeDriver: false, bounciness: 2, speed: 18 }).start();
  }, [sheetH]);

  const deselect = useCallback(() => {
    setSelectedDay(null);
    animateSheet(0);
  }, [animateSheet]);

  const selectDay = useCallback((day: string) => {
    setSelectedDay(day);
    const d = parseYmd(day);
    setAnchor((a) => (d.getMonth() !== a.getMonth() ? d : a));
    if (sheetCommitted.current < containerH.current * 0.3) animateSheet(containerH.current * 0.38);
  }, [animateSheet]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        const h = Math.max(0, Math.min(containerH.current * 0.85, sheetCommitted.current - g.dy));
        sheetH.setValue(h);
      },
      onPanResponderRelease: (_, g) => {
        const target = sheetCommitted.current - g.dy;
        const H = containerH.current;
        if (target < H * 0.2) deselect();
        else animateSheet(target > H * 0.58 ? H * 0.78 : H * 0.38);
      },
    }),
  ).current;

  const weekStart = startOfWeek(anchor);
  const title = mode === 'month'
    ? fmtMonthTitle(anchor)
    : `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const step = (dir: 1 | -1) => {
    setAnchor(mode === 'month' ? addMonths(anchor, dir) : addDays(anchor, dir * 7));
    if (mode === 'month') deselect();
  };
  const goToday = () => {
    setAnchor(new Date());
    deselect();
  };
  const openOccurrence = useCallback((row: GridRow) => {
    if (row.source === 'birthday') navigation.navigate('ContactDetail', { contactId: row.source_id });
    else navigation.navigate('ItemDetail', { itemId: row.source_id });
  }, [navigation]);
  const createSlot = useCallback((day: string, time: string) => {
    navigation.navigate('ItemEdit', { day, time });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <SyncBanner />
      <BridgePrompt />
      <View style={styles.toolbar}>
        <Pressable onPress={() => step(-1)} hitSlop={8}><Text style={styles.nav}>‹</Text></Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => step(1)} hitSlop={8}><Text style={styles.nav}>›</Text></Pressable>
        <Pressable style={styles.toolButton} onPress={goToday}>
          <Text style={styles.toolButtonText}>Today</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => setMode(mode === 'month' ? 'week' : 'month')}>
          <Text style={styles.toolButtonText}>{mode === 'month' ? 'Week' : 'Month'}</Text>
        </Pressable>
        {mode === 'week' && (
          <Pressable style={styles.add} onPress={() => navigation.navigate('ItemEdit', { day: ymd(anchor) })}>
            <Text style={styles.addText}>＋</Text>
          </Pressable>
        )}
      </View>

      {mode === 'month' ? (
        <View
          style={styles.monthArea}
          onLayout={(e) => {
            containerH.current = e.nativeEvent.layout.height;
          }}
        >
          <MonthView anchor={anchor} selectedDay={selectedDay} onSelectDay={selectDay} />
          {selectedDay && (
            <Animated.View style={[styles.sheet, { height: sheetH }]}>
              <View style={styles.sheetHeader} {...pan.panHandlers}>
                <View style={styles.handle} />
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetTitle}>
                    {parseYmd(selectedDay).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                  <Pressable style={styles.add} onPress={() => navigation.navigate('ItemEdit', { day: selectedDay })}>
                    <Text style={styles.addText}>＋</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView>
                <DayAgendaList day={selectedDay} onPress={openOccurrence} />
              </ScrollView>
            </Animated.View>
          )}
        </View>
      ) : (
        <WeekView weekStart={weekStart} onPressOccurrence={openOccurrence} onCreateSlot={createSlot} />
      )}
    </SafeAreaView>
  );
}

function DayAgendaList({ day, onPress }: { day: string; onPress: (row: GridRow) => void }) {
  const { rows } = useDaysOccurrences([day]);
  const colorOf = useCalendarColors();
  const sorted = [...rows].sort((a, b) => b.all_day - a.all_day || (a.start_utc < b.start_utc ? -1 : 1));

  return (
    <View style={styles.agenda}>
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
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  nav: { fontSize: 22, color: ACCENT, paddingHorizontal: 6 },
  title: { flexGrow: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  toolButton: { borderWidth: 1, borderColor: ACCENT, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, minWidth: 64, alignItems: 'center' },
  toolButtonText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  add: { backgroundColor: ACCENT, borderRadius: 16, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  monthArea: { flex: 1 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 0.5, borderColor: '#dcdce4',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -3 }, elevation: 8,
  },
  sheetHeader: { paddingTop: 6, paddingBottom: 4, paddingHorizontal: 14 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 6 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 14, fontWeight: '700', color: '#444' },
  agenda: { paddingHorizontal: 14, paddingBottom: 24, gap: 2 },
  agendaEmpty: { color: '#999', fontSize: 13, paddingVertical: 8 },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  agendaTime: { width: 52, fontSize: 12, color: '#777' },
  agendaText: { flex: 1, fontSize: 14 },
  cancelled: { fontSize: 11, color: '#b91c1c' },
});
