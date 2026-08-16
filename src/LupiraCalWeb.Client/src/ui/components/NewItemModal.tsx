import { useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
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
import { useIsPhone } from '../useIsPhone';

type FormValues = {
  title: string;
  calendarId: string;
  isAllDay: boolean;
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  location: string;
  rrule: string;
  availability: '' | AvailabilityStatus;
  tags: string;
  description: string;
};

/** Quick-create: title, calendar, when (timed or all-day), location, recurrence, kind/availability, tags. */
export function NewItemModal({ onClose }: { onClose: () => void }) {
  const isPhone = useIsPhone();
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
  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      title: '',
      calendarId: defaultCalendar?.id ?? '',
      isAllDay: false,
      start: '',
      end: '',
      startDate: ymd(new Date()),
      endDate: '',
      location: '',
      rrule: '',
      availability: '',
      tags: '',
      description: '',
    },
  });
  const isAllDay = watch('isAllDay');
  const calendarId = watch('calendarId');
  const availability = watch('availability');

  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const isAvailabilityCalendar = selectedCalendar?.kind === 'Availability';

  const submit = handleSubmit((v) => {
    const body: CreateCalendarItemRequest = {
      calendarId: v.calendarId || null,
      title: v.title || null,
      description: v.description || null,
      location: v.location || null,
      isAllDay: v.isAllDay,
      startsAt: v.isAllDay ? null : localInputToIso(v.start),
      endsAt: v.isAllDay ? null : localInputToIso(v.end),
      startDate: v.isAllDay ? v.startDate || null : null,
      endDate: v.isAllDay ? v.endDate || null : null,
      recurrenceRule: v.rrule || null,
      availability: v.availability || null,
      tags: v.tags
        ? v.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : null,
    };
    create.mutate({ data: body });
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isPhone}>
      <div className="modal-head">
        <IconButton size="small" onClick={onClose} aria-label="Close">
          ✕
        </IconButton>
      </div>
      <form className="modal-body" onSubmit={submit}>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <TextField
              variant="standard"
              fullWidth
              slotProps={{ input: { sx: { fontSize: '1.35rem', fontWeight: 600 } } }}
              placeholder="Title"
              autoFocus
              {...field}
            />
          )}
        />
        <div className="form-row">
          <label>Calendar</label>
          <Controller
            name="calendarId"
            control={control}
            render={({ field }) => (
              <TextField select size="small" {...field} slotProps={{ select: { displayEmpty: true } }}>
                {calendars.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {calendarLabel(c)}
                    {c.class === 'System' ? ' (system)' : ''}
                  </MenuItem>
                ))}
                <MenuItem value="">(unfiled → curation)</MenuItem>
              </TextField>
            )}
          />
          <Controller
            name="isAllDay"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="All day"
              />
            )}
          />
        </div>
        {isAllDay ? (
          <div className="form-row">
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => <TextField type="date" size="small" {...field} required />}
            />
            <span className="meta">→</span>
            <Controller name="endDate" control={control} render={({ field }) => <TextField type="date" size="small" {...field} />} />
          </div>
        ) : (
          <div className="form-row">
            <Controller
              name="start"
              control={control}
              render={({ field }) => <TextField type="datetime-local" size="small" {...field} required />}
            />
            <span className="meta">→</span>
            <Controller name="end" control={control} render={({ field }) => <TextField type="datetime-local" size="small" {...field} />} />
          </div>
        )}
        <div className="form-row">
          <label>Repeats</label>
          <Controller
            name="rrule"
            control={control}
            render={({ field }) => (
              <TextField select size="small" {...field} slotProps={{ select: { displayEmpty: true } }}>
                <MenuItem value="">never</MenuItem>
                {RRULE_PRESETS.map((p) => (
                  <MenuItem key={p.rrule} value={p.rrule}>
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {(isAvailabilityCalendar || availability) && (
            <>
              <label>Availability</label>
              <Controller
                name="availability"
                control={control}
                render={({ field }) => (
                  <TextField select size="small" {...field} slotProps={{ select: { displayEmpty: true } }}>
                    <MenuItem value="">(status…)</MenuItem>
                    {Object.values(AvailabilityStatus).map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </>
          )}
        </div>
        <Controller
          name="location"
          control={control}
          render={({ field }) => <TextField size="small" placeholder="Location (free text — becomes a Place)" {...field} />}
        />
        <Controller
          name="tags"
          control={control}
          render={({ field }) => <TextField size="small" placeholder="Tags (comma-separated)" {...field} />}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => <TextField size="small" multiline minRows={3} placeholder="Description" {...field} />}
        />
        <div className="chip-row">
          <Button variant="contained" size="small" type="submit" disabled={create.isPending}>
            Create
          </Button>
          <Button variant="outlined" size="small" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
