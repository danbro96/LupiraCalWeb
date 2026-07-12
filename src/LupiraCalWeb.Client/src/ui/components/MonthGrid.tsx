import type { AvailabilitySegment } from '../../state/useAvailability';
import { fmtTime, isToday, sameDay } from '../../domain/time';
import { AVAILABILITY_COLORS } from '../theme/kinds';
import type { GridEntry } from './entries';

const MAX_PER_CELL = 4;

interface Props {
  date: Date;
  weeks: Date[][];
  entries: GridEntry[];
  segments: AvailabilitySegment[];
  /** Phone treatment: each cell is one tap-to-day button showing event dots instead of chips. */
  compact?: boolean;
  onOpenItem: (id: string) => void;
  onOpenDay: (d: Date) => void;
}

export function MonthGrid({ date, weeks, entries, segments, compact, onOpenItem, onOpenDay }: Props) {
  return (
    <div className={`month-grid ${compact ? 'compact' : ''}`}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <div key={d} className="month-head">
          {d}
        </div>
      ))}
      {weeks.flat().map((day) => {
        const dayEntries = entries
          .filter((e) => spansDay(e, day))
          .sort((a, b) => Number(b.isAllDay) - Number(a.isAllDay) || a.start.getTime() - b.start.getTime());
        const shown = dayEntries.slice(0, MAX_PER_CELL);
        const daySegments = segments.filter((s) => spansDay({ start: new Date(s.start), end: s.end ? new Date(s.end) : null, isAllDay: s.isAllDay }, day));
        const otherMonth = day.getMonth() !== date.getMonth() ? 'other-month' : '';
        if (compact)
          return (
            <button key={day.toISOString()} className={`month-cell compact-cell ${otherMonth}`} onClick={() => onOpenDay(day)}>
              <span className={`day-number ${isToday(day) ? 'today' : ''}`}>{day.getDate()}</span>
              <span className="dot-row">
                {shown.map((e) => (
                  <span key={e.key} className={`chip-dot ${e.ghost ? 'ghost' : ''}`} style={{ background: e.color }} />
                ))}
                {dayEntries.length > shown.length && <span className="dot-more">+{dayEntries.length - shown.length}</span>}
              </span>
              {daySegments.length > 0 && (
                <span className="avail-dots">
                  {daySegments.map((s, i) => (
                    <span key={i} className="avail-dot" style={{ background: AVAILABILITY_COLORS[s.status] }} />
                  ))}
                </span>
              )}
            </button>
          );
        return (
          <div key={day.toISOString()} className={`month-cell ${otherMonth}`}>
            <div className="month-cell-head">
              <button className={`day-number ${isToday(day) ? 'today' : ''}`} onClick={() => onOpenDay(day)}>
                {day.getDate()}
              </button>
              <span className="avail-dots">
                {daySegments.map((s, i) => (
                  <span key={i} className="avail-dot" title={s.status} style={{ background: AVAILABILITY_COLORS[s.status] }} />
                ))}
              </span>
            </div>
            {shown.map((e) => (
              <button
                key={e.key}
                className={`month-chip ${e.ghost ? 'ghost' : ''}`}
                style={{ borderColor: e.color }}
                onClick={() => onOpenItem(e.itemId)}
                title={e.ghost ? `${e.title} (proposed)` : e.title}
              >
                <span className="chip-dot" style={{ background: e.color }} />
                {!e.isAllDay && <span className="chip-time">{fmtTime(e.start)}</span>}
                <span className="chip-title">
                  {e.icon ? `${e.icon} ` : ''}
                  {e.title}
                  {e.ghost ? ' (proposed)' : ''}
                </span>
              </button>
            ))}
            {dayEntries.length > shown.length && (
              <button className="linklike more-link" onClick={() => onOpenDay(day)}>
                +{dayEntries.length - shown.length} more
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function spansDay(e: { start: Date; end: Date | null; isAllDay: boolean }, day: Date): boolean {
  if (e.end && e.end > e.start) {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return e.start < dayEnd && e.end > dayStart;
  }
  return sameDay(e.start, day);
}
