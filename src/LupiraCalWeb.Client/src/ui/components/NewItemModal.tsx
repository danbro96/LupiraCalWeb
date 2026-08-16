import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useCreateItem } from '../../data/api/lupiraCalApi';
import { AvailabilityStatus, type CreateCalendarItemRequest } from '../../data/api/models';
import { RRULE_PRESETS } from '@lupira/cal-domain/rrule';
import { ymd } from '@lupira/cal-domain/time';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { localInputToIso } from './drawer/inputs';
import { errText } from './errText';
import { useSnackbar } from './SnackbarHost';

/** Quick-create: title, calendar, when (timed or all-day), location, recurrence, kind/availability, tags. */
export function NewItemModal({ onClose }: { onClose: () => void }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const [, setSearchParams] = useSearchParams();
  const showSnack = useSnackbar();
  const create = useCreateItem({
    mutation: {
      onSuccess: (created) => {
        invalidate();
        onClose();
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('item', created.id);
          return next;
        });
      },
      onError: (e) => showSnack(errText(e) ?? 'Request failed.'),
    },
  });

  const defaultCalendar = calendars.find((c) => c.kind === 'Personal') ?? calendars[0];
  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState(defaultCalendar?.id ?? '');
  const [isAllDay, setIsAllDay] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [startDate, setStartDate] = useState(ymd(new Date()));
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [rrule, setRrule] = useState('');
  const [availability, setAvailability] = useState<'' | AvailabilityStatus>('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const isAvailabilityCalendar = selectedCalendar?.kind === 'Availability';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: CreateCalendarItemRequest = {
      calendarId: calendarId || null,
      title: title || null,
      description: description || null,
      location: location || null,
      isAllDay,
      startsAt: isAllDay ? null : localInputToIso(start),
      endsAt: isAllDay ? null : localInputToIso(end),
      startDate: isAllDay ? startDate || null : null,
      endDate: isAllDay ? endDate || null : null,
      recurrenceRule: rrule || null,
      availability: availability || null,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : null,
    };
    create.mutate({ data: body });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <IconButton size="small" onClick={onClose} aria-label="Close">
            ✕
          </IconButton>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <TextField
            variant="standard"
            fullWidth
            slotProps={{ input: { sx: { fontSize: '1.35rem', fontWeight: 600 } } }}
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="form-row">
            <label>Calendar</label>
            <TextField select size="small" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
              {calendars.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {calendarLabel(c)}
                  {c.class === 'System' ? ' (system)' : ''}
                </MenuItem>
              ))}
              <MenuItem value="">(unfiled → curation)</MenuItem>
            </TextField>
            <FormControlLabel
              control={<Checkbox size="small" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />}
              label="All day"
            />
          </div>
          {isAllDay ? (
            <div className="form-row">
              <TextField type="date" size="small" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <span className="meta">→</span>
              <TextField type="date" size="small" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          ) : (
            <div className="form-row">
              <TextField type="datetime-local" size="small" value={start} onChange={(e) => setStart(e.target.value)} required />
              <span className="meta">→</span>
              <TextField type="datetime-local" size="small" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
          <div className="form-row">
            <label>Repeats</label>
            <TextField select size="small" value={rrule} onChange={(e) => setRrule(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
              <MenuItem value="">never</MenuItem>
              {RRULE_PRESETS.map((p) => (
                <MenuItem key={p.rrule} value={p.rrule}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            {(isAvailabilityCalendar || availability) && (
              <>
                <label>Availability</label>
                <TextField
                  select
                  size="small"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as AvailabilityStatus | '')}
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  <MenuItem value="">(status…)</MenuItem>
                  {Object.values(AvailabilityStatus).map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </div>
          <TextField size="small" placeholder="Location (free text — becomes a Place)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <TextField size="small" placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <TextField size="small" multiline minRows={3} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="chip-row">
            <Button variant="contained" size="small" type="submit" disabled={create.isPending}>
              Create
            </Button>
            <Button variant="outlined" size="small" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
