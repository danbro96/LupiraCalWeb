import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useCreateItem } from '../../data/api/lupiraCalApi';
import { AvailabilityStatus, type CreateCalendarItemRequest } from '../../data/api/models';
import { ymd } from '@lupira/cal-domain/time';
import { useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { errText } from './errText';
import { useSnackbar } from './SnackbarHost';

/**
 * Availability quick-add: status + date range only. Entries are all-day items in the Availability-kind
 * calendar (title = status, presence status carried by `availability`), rendered as the background band
 * rather than chips — so the normal event form deliberately doesn't offer that calendar.
 */
export function AvailabilityModal({ onClose }: { onClose: () => void }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const showSnack = useSnackbar();
  const create = useCreateItem({
    mutation: {
      onSuccess: () => {
        invalidate();
        onClose();
      },
      onError: (e) => showSnack(errText(e) ?? 'Request failed.'),
    },
  });

  const availabilityCalendar = calendars.find((c) => c.kind === 'Availability');
  const [status, setStatus] = useState<AvailabilityStatus>(AvailabilityStatus.Office);
  const [startDate, setStartDate] = useState(ymd(new Date()));
  const [endDate, setEndDate] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!availabilityCalendar) return;
    const body: CreateCalendarItemRequest = {
      calendarId: availabilityCalendar.id,
      title: status,
      isAllDay: true,
      startDate,
      endDate: endDate || null,
      availability: status,
    };
    create.mutate({ data: body });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <div className="modal-head">
        <strong>Set availability</strong>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          ✕
        </IconButton>
      </div>
      <form className="modal-body" onSubmit={submit}>
          {!availabilityCalendar && <p className="meta">No availability calendar — bootstrap the standard set first.</p>}
          <div className="form-row">
            <label>Status</label>
            <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}>
              {Object.values(AvailabilityStatus).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <div className="form-row">
            <label>From</label>
            <TextField type="date" size="small" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Until (exclusive)</label>
            <TextField
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ htmlInput: { min: startDate } }}
            />
          </div>
          <div className="modal-actions">
            <Button variant="contained" size="small" type="submit" disabled={!availabilityCalendar || create.isPending}>
              Save
            </Button>
            <Button variant="outlined" size="small" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
