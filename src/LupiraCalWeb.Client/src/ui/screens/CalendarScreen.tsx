import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SearchIcon from '@mui/icons-material/Search';
import { familyKey } from '@lupira/cal-domain/family';
import { useContainers } from '../../state/useContainers';
import { useRangeOccurrences } from '../../state/useRangeOccurrences';
import { useProposedByCalendar } from '../../state/useProposed';
import { useAvailabilitySegments } from '../../state/useAvailability';
import { useTaskDeadlines } from '../../state/useTaskDeadlines';
import { useCalendarVisibility } from '../components/CalendarVisibility';
import { OriginKind } from '../../data/api/models';
import { fromOccurrence, fromProposed, fromTask, type GridEntry } from '../components/entries';
import { MiniMonthPicker } from '../components/MiniMonthPicker';
import { MonthGrid } from '../components/MonthGrid';
import { WeekGrid } from '../components/WeekGrid';
import { Sidebar } from '../components/Sidebar';
import { useCalendarRange } from '../useCalendarRange';
import { useIsPhone } from '../useIsPhone';

export function CalendarScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
  const { view, date, weeks, days, range, title, setView, setDate, navigate, openDay } = useCalendarRange({
    defaultView: isPhone ? 'day' : 'week',
    weekDayCount: isPhone ? 3 : 7,
  });
  const tag = searchParams.get('tag') ?? '';
  const q = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState<HTMLElement | null>(null);

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const from = range.start.toISOString();
  const to = range.end.toISOString();
  const now = new Date();
  const todayVisible = now >= range.start && now < range.end;

  const { calendars } = useContainers();
  const { isVisible, tasksVisible } = useCalendarVisibility();
  const visible = calendars.filter(isVisible);

  const { byCalendar, isLoading } = useRangeOccurrences(visible, from, to, {
    query: q || undefined,
    tag: tag || undefined,
  });
  const proposed = useProposedByCalendar(visible);
  const tasks = useTaskDeadlines(from, to, tasksVisible);
  const availabilityCalendar = calendars.find((c) => c.kind === 'Availability' && isVisible(c));
  const segments = useAvailabilitySegments(availabilityCalendar, from, to);

  const entries = useMemo<GridEntry[]>(() => {
    const accepted = byCalendar
      // The availability calendar renders as the background band, not as chips.
      .filter(({ calendar }) => calendar.kind !== 'Availability')
      .flatMap(({ calendar, occurrences }) => occurrences.map((o) => fromOccurrence(o, calendar)));
    const ghosts = proposed.flatMap(({ calendar, items }) =>
      items.flatMap((i) => {
        const g = fromProposed(i, calendar);
        return g && g.start < range.end && (g.end ?? g.start) >= range.start ? [g] : [];
      }),
    );
    // Server range-filters on dueAt; overdue is judged at render time, not clock-tick-live.
    const rightNow = new Date();
    const deadlines = tasks.flatMap((t) => fromTask(t, rightNow) ?? []);
    return [...accepted, ...ghosts, ...deadlines];
  }, [byCalendar, proposed, tasks, range]);

  // Birthdays are read-time contact projections, not stored items — route them to the read-only card
  // (the ?item= drawer would 404 on their synthetic id) instead of the editable item drawer.
  // Task deadlines likewise live in LupiraTasks, so they route to the TaskCard.
  const openItem = (id: string) => {
    const e = entries.find((x) => x.itemId === id);
    if (e?.task) {
      const { listId, itemId } = e.task;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('task', `${listId}:${itemId}`);
        next.delete('item');
        next.delete('birthday');
        next.delete('year');
        return next;
      });
    } else if (e?.origin?.kind === OriginKind.Birthday) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('birthday', e.origin!.sourceId);
        next.set('year', String(e.start.getUTCFullYear()));
        next.delete('item');
        return next;
      });
    } else {
      setParam('item', id);
    }
  };

  const selectedItemId = searchParams.get('item');
  const selectedFamilyKey = useMemo(() => {
    if (!selectedItemId) return undefined;
    for (const e of entries) {
      if (e.itemId === selectedItemId) {
        const k = familyKey(e);
        if (k) return k;
      }
      // The selected item may be an out-of-range parent whose children are on-screen.
      if (e.parentItemId === selectedItemId) return selectedItemId;
    }
    return undefined;
  }, [entries, selectedItemId]);

  return (
    <div className="cal-screen">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <IconButton size="small" onClick={() => navigate(-1)} aria-label="Previous">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <button
            className="cal-title"
            onClick={(e) => {
              const el = e.currentTarget;
              setDateAnchor((a) => (a ? null : el));
            }}
            aria-haspopup="dialog"
            aria-expanded={!!dateAnchor}
          >
            {title}
            <span className="dp-caret" aria-hidden>
              ▾
            </span>
          </button>
          <IconButton size="small" onClick={() => navigate(1)} aria-label="Next">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
          {!todayVisible && (
            <Button variant="outlined" size="small" onClick={() => setDate(null)}>
              Today
            </Button>
          )}
          {isLoading && <CircularProgress size={14} aria-label="loading" sx={{ flex: 'none' }} />}
          <MiniMonthPicker
            selected={date}
            anchorEl={dateAnchor}
            onPick={(d) => {
              setDate(d);
              setDateAnchor(null);
            }}
            onClose={() => setDateAnchor(null)}
          />
        </div>
        <div className="cal-right">
          <div className="cal-actions">
            <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, nv) => nv != null && setView(nv)}>
              {(['month', 'week', 'day'] as const).map((v) => (
                <ToggleButton key={v} value={v}>
                  {v}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <IconButton
              size="small"
              sx={{ display: { md: 'none' } }}
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              aria-pressed={searchOpen}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              sx={{ display: { md: 'none' } }}
              onClick={() => setSheetOpen(true)}
              aria-label="Calendars"
            >
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </div>
          <div className={`cal-search ${searchOpen ? 'open' : ''}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setParam('q', search || null);
              }}
            >
              <TextField
                size="small"
                placeholder="Search title/description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <TextField
              size="small"
              placeholder="tag"
              defaultValue={tag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setParam('tag', (e.target as HTMLInputElement).value || null);
              }}
              onBlur={(e) => setParam('tag', e.target.value || null)}
            />
          </div>
        </div>
      </div>
      {view === 'month' ? (
        <MonthGrid
          date={date}
          weeks={weeks}
          entries={entries}
          segments={segments}
          compact={isPhone}
          onOpenItem={openItem}
          onOpenDay={openDay}
          selectedFamilyKey={selectedFamilyKey}
        />
      ) : (
        <WeekGrid days={days} entries={entries} segments={segments} onOpenItem={openItem} selectedFamilyKey={selectedFamilyKey} />
      )}
      <SwipeableDrawer
        anchor="bottom"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onOpen={() => setSheetOpen(true)}
        disableSwipeToOpen
        slotProps={{ paper: { sx: { maxHeight: '85dvh' } } }}
      >
        <Sidebar />
      </SwipeableDrawer>
    </div>
  );
}
