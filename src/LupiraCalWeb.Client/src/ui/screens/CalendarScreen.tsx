import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, addMonths, fmtDayTitle, fmtMonthTitle, monthMatrix, parseYmd, startOfWeek, ymd, fmtDate } from '../../domain/time';
import { useContainers } from '../../state/useContainers';
import { useRangeOccurrences } from '../../state/useRangeOccurrences';
import { useProposedByCalendar } from '../../state/useProposed';
import { useAvailabilitySegments } from '../../state/useAvailability';
import { useCalendarVisibility } from '../components/CalendarVisibility';
import { fromOccurrence, fromProposed, type GridEntry } from '../components/entries';
import { MonthGrid } from '../components/MonthGrid';
import { WeekGrid } from '../components/WeekGrid';

type View = 'month' | 'week' | 'day';

export function CalendarScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as View) ?? 'week';
  const dateParam = searchParams.get('d');
  const date = useMemo(() => (dateParam ? parseYmd(dateParam) : new Date()), [dateParam]);
  const tag = searchParams.get('tag') ?? '';
  const q = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(q);

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const weeks = useMemo(() => monthMatrix(date), [date]);
  const range = useMemo(() => {
    if (view === 'month') return { start: weeks[0][0], end: addDays(weeks[weeks.length - 1][6], 1) };
    if (view === 'week') return { start: startOfWeek(date), end: addDays(startOfWeek(date), 7) };
    return { start: date, end: addDays(date, 1) };
  }, [view, date, weeks]);
  const from = range.start.toISOString();
  const to = range.end.toISOString();

  const { calendars } = useContainers();
  const { isVisible } = useCalendarVisibility();
  const visible = calendars.filter(isVisible);

  const { byCalendar, isLoading } = useRangeOccurrences(visible, from, to, {
    query: q || undefined,
    tag: tag || undefined,
  });
  const proposed = useProposedByCalendar(visible);
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
    return [...accepted, ...ghosts];
  }, [byCalendar, proposed, range]);

  const navigate = (dir: -1 | 1) => {
    const next = view === 'month' ? addMonths(date, dir) : addDays(date, dir * (view === 'week' ? 7 : 1));
    setParam('d', ymd(next));
  };

  const openItem = (id: string) => setParam('item', id);
  const openDay = (d: Date) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', 'day');
      next.set('d', ymd(d));
      return next;
    });
  };

  const title =
    view === 'month'
      ? fmtMonthTitle(date)
      : view === 'week'
        ? `${fmtDate(startOfWeek(date))} – ${fmtDate(addDays(startOfWeek(date), 6))}`
        : fmtDayTitle(date);

  return (
    <div className="cal-screen">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="btn" onClick={() => navigate(-1)} aria-label="Previous">
            ‹
          </button>
          <button className="btn" onClick={() => setParam('d', null)}>
            Today
          </button>
          <button className="btn" onClick={() => navigate(1)} aria-label="Next">
            ›
          </button>
          <h2 className="cal-title">{title}</h2>
          {isLoading && <span className="meta">loading…</span>}
        </div>
        <div className="cal-filters">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setParam('q', search || null);
            }}
          >
            <input
              className="text-input"
              placeholder="Search title/description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <input
            className="text-input tag-input"
            placeholder="tag"
            defaultValue={tag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam('tag', (e.target as HTMLInputElement).value || null);
            }}
            onBlur={(e) => setParam('tag', e.target.value || null)}
          />
          <div className="seg">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button key={v} className={`seg-btn ${view === v ? 'active' : ''}`} onClick={() => setParam('view', v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === 'month' ? (
        <MonthGrid date={date} weeks={weeks} entries={entries} segments={segments} onOpenItem={openItem} onOpenDay={openDay} />
      ) : (
        <WeekGrid
          days={view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)) : [date]}
          entries={entries}
          segments={segments}
          onOpenItem={openItem}
        />
      )}
    </div>
  );
}
