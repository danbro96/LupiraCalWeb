import { useState } from 'react';
import { useCreateItem } from '../../data/api/lupiraCalApi';
import { AvailabilityStatus, type CreateCalendarItemRequest } from '../../data/api/models';
import { ymd } from '@lupira/cal-domain/time';
import { useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { errText } from './errText';

/**
 * Availability quick-add: status + date range only. Entries are all-day items in the Availability-kind
 * calendar (title = status, presence status carried by `availability`), rendered as the background band
 * rather than chips — so the normal event form deliberately doesn't offer that calendar.
 */
export function AvailabilityModal({ onClose }: { onClose: () => void }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const create = useCreateItem({
    mutation: {
      onSuccess: () => {
        invalidate();
        onClose();
      },
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Set availability</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          {!availabilityCalendar && <p className="meta">No availability calendar — bootstrap the standard set first.</p>}
          <div className="form-row">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AvailabilityStatus)}>
              {Object.values(AvailabilityStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>From</label>
            <input type="date" className="text-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="form-row">
            <label>Until (exclusive)</label>
            <input type="date" className="text-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
          </div>
          {create.error ? <p className="error">{errText(create.error)}</p> : null}
          <div className="modal-actions">
            <button className="btn primary" type="submit" disabled={!availabilityCalendar || create.isPending}>
              Save
            </button>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
