import { Controller, useForm } from 'react-hook-form';
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

type FormValues = {
  status: AvailabilityStatus;
  startDate: string;
  endDate: string;
};

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
  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { status: AvailabilityStatus.Office, startDate: ymd(new Date()), endDate: '' },
  });
  const startDate = watch('startDate');

  const submit = handleSubmit((values) => {
    if (!availabilityCalendar) return;
    const body: CreateCalendarItemRequest = {
      calendarId: availabilityCalendar.id,
      title: values.status,
      isAllDay: true,
      startDate: values.startDate,
      endDate: values.endDate || null,
      availability: values.status,
    };
    create.mutate({ data: body });
  });

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
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField select size="small" {...field}>
                {Object.values(AvailabilityStatus).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </div>
        <div className="form-row">
          <label>From</label>
          <Controller
            name="startDate"
            control={control}
            rules={{ required: true }}
            render={({ field }) => <TextField type="date" size="small" {...field} required />}
          />
        </div>
        <div className="form-row">
          <label>Until (exclusive)</label>
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <TextField type="date" size="small" {...field} slotProps={{ htmlInput: { min: startDate } }} />
            )}
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
