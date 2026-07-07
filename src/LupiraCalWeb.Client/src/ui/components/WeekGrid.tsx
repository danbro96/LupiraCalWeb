import { useMemo } from 'react';
import type { AvailabilitySegment } from '../../state/useAvailability';
import { clampToDay, layoutColumns } from '../../domain/occurrences';
import { fmtDayShort, fmtTime, isToday, minutesOfDay, sameDay } from '../../domain/time';
import { AVAILABILITY_COLORS } from '../theme/kinds';
import type { GridEntry } from './entries';

const HOUR_PX = 48;

interface Props {
  days: Date[];
  entries: GridEntry[];
  segments: AvailabilitySegment[];
  onOpenItem: (id: string) => void;
}

/** Timed week/day lanes: hour rows, an all-day strip, availability tint, and column-packed events. */
export function WeekGrid({ days, entries, segments, onOpenItem }: Props) {
  const allDay = entries.filter((e) => e.isAllDay);
  const timed = entries.filter((e) => !e.isAllDay);
  const nowMin = minutesOfDay(new Date());

  return (
    <div className="week-grid" style={{ ['--day-count' as string]: days.length }}>
      <div className="week-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`week-head-day ${isToday(d) ? 'today' : ''}`}>
            {fmtDayShort(d)}
          </div>
        ))}
      </div>
      <div className="week-allday">
        <div className="gutter meta">all-day</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="allday-cell">
            {allDay
              .filter((e) => sameDay(e.start, d) || (e.end && e.start <= d && e.end >= d))
              .map((e) => (
                <button
                  key={e.key}
                  className={`allday-chip ${e.ghost ? 'ghost' : ''}`}
                  style={{ background: e.color }}
                  onClick={() => onOpenItem(e.itemId)}
                >
                  {e.icon ? `${e.icon} ` : ''}
                  {e.title}
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="week-body">
        <div className="gutter">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour-label" style={{ top: h * HOUR_PX }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => (
          <DayColumn key={day.toISOString()} day={day} timed={timed} segments={segments} nowMin={nowMin} onOpenItem={onOpenItem} />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  timed,
  segments,
  nowMin,
  onOpenItem,
}: {
  day: Date;
  timed: GridEntry[];
  segments: AvailabilitySegment[];
  nowMin: number;
  onOpenItem: (id: string) => void;
}) {
  const positioned = useMemo(() => {
    const spans = timed.flatMap((e) => {
      const span = clampToDay(e.start, e.end ?? new Date(e.start.getTime() + 30 * 60000), day);
      return span ? [{ ...span, item: e }] : [];
    });
    return layoutColumns(spans);
  }, [timed, day]);

  const daySegments = useMemo(
    () =>
      segments.flatMap((s) => {
        if (s.isAllDay) {
          const start = new Date(s.start);
          const end = s.end ? new Date(s.end) : start;
          return sameDay(start, day) || (start <= day && end >= day)
            ? [{ startMin: 0, endMin: 1440, status: s.status }]
            : [];
        }
        const span = clampToDay(new Date(s.start), s.end ? new Date(s.end) : new Date(s.start), day);
        return span ? [{ ...span, status: s.status }] : [];
      }),
    [segments, day],
  );

  return (
    <div className="day-col" style={{ height: 24 * HOUR_PX }}>
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="hour-line" style={{ top: h * HOUR_PX }} />
      ))}
      {daySegments.map((s, i) => (
        <div
          key={`seg-${i}`}
          className="avail-band"
          title={s.status}
          style={{
            top: (s.startMin / 60) * HOUR_PX,
            height: ((s.endMin - s.startMin) / 60) * HOUR_PX,
            background: AVAILABILITY_COLORS[s.status],
          }}
        >
          <span className="avail-label">{s.status}</span>
        </div>
      ))}
      {positioned.map((p) => (
        <button
          key={p.item.key}
          className={`timed-block ${p.item.ghost ? 'ghost' : ''}`}
          style={{
            top: (p.startMin / 60) * HOUR_PX,
            height: Math.max(((p.endMin - p.startMin) / 60) * HOUR_PX - 2, 18),
            left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
            width: `calc(${(1 / p.cols) * 100}% - 4px)`,
            background: p.item.color,
          }}
          onClick={() => onOpenItem(p.item.itemId)}
          title={p.item.ghost ? `${p.item.title} (proposed)` : p.item.title}
        >
          <span className="timed-title">
            {p.item.icon ? `${p.item.icon} ` : ''}
            {p.item.title}
          </span>
          <span className="timed-time">{fmtTime(p.item.start)}</span>
        </button>
      ))}
      {isToday(day) && <div className="now-line" style={{ top: (nowMin / 60) * HOUR_PX }} />}
    </div>
  );
}
