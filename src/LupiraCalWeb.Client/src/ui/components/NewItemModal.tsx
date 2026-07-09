import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCreateItem } from '../../data/api/lupiraCalApi';
import { AvailabilityStatus, type CreateCalendarItemRequest } from '../../data/api/models';
import { RRULE_PRESETS } from '../../domain/rrule';
import { ymd } from '../../domain/time';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateItems } from '../../state/useInvalidate';
import { localInputToIso } from './drawer/inputs';
import { errText } from './errText';

/** Quick-create: title, calendar, when (timed or all-day), location, recurrence, kind/availability, tags. */
export function NewItemModal({ onClose }: { onClose: () => void }) {
  const { calendars } = useContainers();
  const invalidate = useInvalidateItems();
  const [, setSearchParams] = useSearchParams();
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
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <input className="title-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="form-row">
            <label>Calendar</label>
            <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {calendarLabel(c)}
                  {c.class === 'System' ? ' (system)' : ''}
                </option>
              ))}
              <option value="">(unfiled → curation)</option>
            </select>
            <label className="check-row">
              <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
              All day
            </label>
          </div>
          {isAllDay ? (
            <div className="form-row">
              <input type="date" className="text-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <span className="meta">→</span>
              <input type="date" className="text-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          ) : (
            <div className="form-row">
              <input type="datetime-local" className="text-input" value={start} onChange={(e) => setStart(e.target.value)} required />
              <span className="meta">→</span>
              <input type="datetime-local" className="text-input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
          <div className="form-row">
            <label>Repeats</label>
            <select value={rrule} onChange={(e) => setRrule(e.target.value)}>
              <option value="">never</option>
              {RRULE_PRESETS.map((p) => (
                <option key={p.rrule} value={p.rrule}>
                  {p.label}
                </option>
              ))}
            </select>
            {(isAvailabilityCalendar || availability) && (
              <>
                <label>Availability</label>
                <select value={availability} onChange={(e) => setAvailability(e.target.value as AvailabilityStatus | '')}>
                  <option value="">(status…)</option>
                  {Object.values(AvailabilityStatus).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <input className="text-input" placeholder="Location (free text — becomes a Place)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <input className="text-input" placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <textarea className="text-input notes-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {errText(create.error) && <p className="error-text">{errText(create.error)}</p>}
          <div className="chip-row">
            <button className="btn primary" type="submit" disabled={create.isPending}>
              Create
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
