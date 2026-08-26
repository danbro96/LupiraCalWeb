import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { addMonths, fmtMonthTitle, isToday, monthMatrix, sameDay, startOfMonth } from '@lupira/cal-domain/time';

interface Props {
  /** The date to highlight as current. */
  selected: Date;
  anchorEl: HTMLElement | null;
  onPick: (d: Date) => void;
  onClose: () => void;
}

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Small month calendar for jumping the day/week view to any date (keeps the current view). */
export function MiniMonthPicker({ selected, anchorEl, onPick, onClose }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(selected));
  const weeks = monthMatrix(cursor);

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{ paper: { className: 'date-picker', 'aria-label': 'Pick a date' } }}
    >
        <div className="dp-head">
          <IconButton onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <span className="dp-title">{fmtMonthTitle(cursor)}</span>
          <IconButton onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
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
    </Popover>
  );
}
