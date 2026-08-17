import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import {
  useAcceptItemIntoCalendar,
  useFileItemToCalendar,
  useRemoveItemFromCalendar,
} from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { calendarLabel, useContainers } from '../../../state/useContainers';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { calendarColor } from '../../theme/kinds';

/** The item's calendar memberships (Proposed/Accepted) + curation actions and file-to-calendar. */
export function CalendarsPanel({ item }: { item: CalendarItemDto }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const accept = useAcceptItemIntoCalendar({ mutation: { onSuccess: invalidate } });
  const remove = useRemoveItemFromCalendar({ mutation: { onSuccess: invalidate } });
  const file = useFileItemToCalendar({ mutation: { onSuccess: invalidate } });
  const [target, setTarget] = useState('');

  const memberships = item.calendars.filter((m) => m.status !== 'Removed');
  const memberIds = new Set(memberships.map((m) => m.calendarId));
  const fileable = calendars.filter((c) => !memberIds.has(c.id));

  return (
    <section className="drawer-section">
      <h3>Calendars</h3>
      {memberships.map((m) => {
        const cal = calendars.find((c) => c.id === m.calendarId);
        return (
          <div key={m.calendarId} className="membership-row">
            <span className="color-dot" style={{ background: cal ? calendarColor(cal) : 'var(--mui-palette-border)' }} />
            <span className="membership-name">{cal ? calendarLabel(cal) : m.calendarId.slice(0, 8)}</span>
            {m.status === 'Proposed' ? (
              <Chip size="small" variant="outlined" label="proposed" />
            ) : (
              <Chip size="small" variant="outlined" label="accepted" />
            )}
            {m.status === 'Proposed' && (
              <Chip size="small" variant="outlined" label="Accept" onClick={() => accept.mutate({ itemId: item.id, calendarId: m.calendarId })} />
            )}
            <Tooltip title="Remove from calendar">
              <IconButton size="small" onClick={() => remove.mutate({ itemId: item.id, calendarId: m.calendarId })}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        );
      })}
      <div className="form-row">
        <TextField select size="small" value={target} onChange={(e) => setTarget(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">File into calendar…</MenuItem>
          {fileable.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {calendarLabel(c)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          size="small"
          disabled={!target || file.isPending}
          onClick={() => {
            file.mutate({ itemId: item.id, calendarId: target, params: { status: 'accepted' } });
            setTarget('');
          }}
        >
          File
        </Button>
      </div>
    </section>
  );
}
