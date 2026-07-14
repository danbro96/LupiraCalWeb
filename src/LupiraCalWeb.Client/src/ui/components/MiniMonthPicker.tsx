import { useState } from 'react';
import { addMonths, fmtMonthTitle, isToday, monthMatrix, sameDay, startOfMonth } from '../../domain/time';

interface Props {
  /** The date to highlight as current. */
  selected: Date;
  onPick: (d: Date) => void;
  onClose: () => void;
}

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Small month calendar for jumping the day/week view to any date (keeps the current view). */
export function MiniMonthPicker({ selected, onPick, onClose }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(selected));
  const weeks = monthMatrix(cursor);

  return (
    <>
      <div className="picker-backdrop" onClick={onClose} />
      <div className="date-picker" role="dialog" aria-label="Pick a date">
        <div className="dp-head">
          <button className="icon-btn" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
            ‹
          </button>
          <span className="dp-title">{fmtMonthTitle(cursor)}</span>
          <button className="icon-btn" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="dp-grid">
          {DOW.map((d) => (
            <span key={d} className="dp-dow">
              {d}
            </span>
          ))}
          {weeks.flat().map((day) => (
            <button
              key={day.toISOString()}
              className={`dp-day ${day.getMonth() !== cursor.getMonth() ? 'other' : ''} ${sameDay(day, selected) ? 'sel' : ''} ${isToday(day) ? 'today' : ''}`}
              onClick={() => onPick(day)}
            >
              {day.getDate()}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
