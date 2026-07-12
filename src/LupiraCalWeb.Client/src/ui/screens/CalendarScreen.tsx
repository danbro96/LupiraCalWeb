import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContainers } from '../../state/useContainers';
import { useRangeOccurrences } from '../../state/useRangeOccurrences';
import { useProposedByCalendar } from '../../state/useProposed';
import { useAvailabilitySegments } from '../../state/useAvailability';
import { useCalendarVisibility } from '../components/CalendarVisibility';
import { fromOccurrence, fromProposed, type GridEntry } from '../components/entries';
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

  const openItem = (id: string) => setParam('item', id);

  return (
    <div className="cal-screen">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="btn" onClick={() => navigate(-1)} aria-label="Previous">
            ‹
          </button>
          <button className="btn" onClick={() => setDate(null)}>
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
              <button key={v} className={`seg-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn phone-only" onClick={() => setSheetOpen(true)}>
            🗂 Calendars
          </button>
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
        />
      ) : (
        <WeekGrid days={days} entries={entries} segments={segments} onOpenItem={openItem} />
      )}
      {sheetOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="sheet">
            <Sidebar />
          </div>
        </>
      )}
    </div>
  );
}
