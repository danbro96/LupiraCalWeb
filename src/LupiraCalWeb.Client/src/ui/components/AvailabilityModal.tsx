import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 1 }}>
        Set availability
        <IconButton size="small" onClick={onClose} aria-label="Close">
          ✕
        </IconButton>
      </DialogTitle>
      <form onSubmit={submit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0 }}>
          {!availabilityCalendar && <p className="meta">No availability calendar — bootstrap the standard set first.</p>}
        <div className="form-row">
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField select size="small" label="Status" {...field}>
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
          <Controller
            name="startDate"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField type="date" size="small" label="From" slotProps={{ inputLabel: { shrink: true } }} {...field} required />
            )}
          />
        </div>
        <div className="form-row">
          <Controller
            name="endDate"
            control={control}
            render={({ field }) => (
              <TextField
                type="date"
                size="small"
                label="Until (exclusive)"
                {...field}
                slotProps={{ htmlInput: { min: startDate }, inputLabel: { shrink: true } }}
              />
            )}
          />
        </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" size="small" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" size="small" type="submit" disabled={!availabilityCalendar || create.isPending}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
