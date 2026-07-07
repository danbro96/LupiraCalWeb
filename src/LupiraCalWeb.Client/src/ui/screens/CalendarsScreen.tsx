import { useState } from 'react';
import {
  useCreateCalendar,
  useGrantAddressBookOwner,
  useGrantCalendarOwner,
  useRevokeAddressBookOwner,
  useRevokeCalendarOwner,
} from '../../data/api/lupiraCalApi';
import { CalendarClass, CalendarKind, type ContainerDto } from '../../data/api/models';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateContainers } from '../../state/useInvalidate';
import { CALENDAR_KIND_ICONS, calendarColor } from '../theme/kinds';
import { errText } from '../components/errText';

/** Container management: the full classified set (class/kind/color/tz/access), creation, and sharing. */
export function CalendarsScreen() {
  const { calendars, addressBooks } = useContainers();
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Calendars & address books</h2>
        <button className="btn primary" onClick={() => setCreating((c) => !c)}>
          + New
        </button>
      </div>
      {creating && <NewContainerForm onDone={() => setCreating(false)} />}
      <table className="containers-table">
        <thead>
          <tr>
            <th />
            <th>Name</th>
            <th>Slug</th>
            <th>Class</th>
            <th>Kind</th>
            <th>Timezone</th>
            <th>Access</th>
            <th>Sharing</th>
          </tr>
        </thead>
        <tbody>
          {[...calendars, ...addressBooks].map((c) => (
            <ContainerRow key={c.id} container={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContainerRow({ container: c }: { container: ContainerDto }) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <tr>
        <td>
          <span className="color-dot" style={{ background: c.type === 'calendar' ? calendarColor(c) : 'var(--border)' }} />
        </td>
        <td>
          {c.kind ? `${CALENDAR_KIND_ICONS[c.kind]} ` : '📇 '}
          {calendarLabel(c)}
        </td>
        <td>
          <code>{c.slug}</code>
        </td>
        <td>{c.class && <span className={`badge ${c.class === 'System' ? 'severity-weak' : ''}`}>{c.class}</span>}</td>
        <td className="meta">{c.kind ?? '—'}</td>
        <td className="meta">{c.defaultTimezone ?? '—'}</td>
        <td className="meta">{c.access}</td>
        <td>
          {c.access === 'Owner' && (
            <button className="linklike" onClick={() => setSharing((s) => !s)}>
              {sharing ? 'close' : 'share…'}
            </button>
          )}
        </td>
      </tr>
      {sharing && (
        <tr>
          <td colSpan={8}>
            <SharePanel container={c} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Grant/revoke by email. The API has no owner-list endpoint, so this is action-only. */
function SharePanel({ container }: { container: ContainerDto }) {
  const invalidate = useInvalidateContainers();
  const opts = { mutation: { onSuccess: invalidate } };
  const grantCal = useGrantCalendarOwner(opts);
  const grantBook = useGrantAddressBookOwner(opts);
  const revokeCal = useRevokeCalendarOwner(opts);
  const revokeBook = useRevokeAddressBookOwner(opts);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('read-write');

  const isCalendar = container.type === 'calendar';
  const grant = isCalendar ? grantCal : grantBook;
  const revoke = isCalendar ? revokeCal : revokeBook;
  const error = [grantCal, grantBook, revokeCal, revokeBook].map((m) => errText(m.error)).find(Boolean);

  return (
    <div className="share-panel">
      <input className="text-input" type="email" placeholder="member@email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select value={access} onChange={(e) => setAccess(e.target.value)}>
        <option value="owner">Owner</option>
        <option value="read-write">Read-write</option>
        <option value="read">Read</option>
      </select>
      <button
        className="btn"
        disabled={!email}
        onClick={() =>
          isCalendar
            ? grantCal.mutate({ calendarId: container.id, data: { email, access } })
            : grantBook.mutate({ addressBookId: container.id, data: { email, access } })
        }
      >
        Grant
      </button>
      <button
        className="btn destructive"
        disabled={!email}
        onClick={() =>
          isCalendar
            ? revokeCal.mutate({ calendarId: container.id, params: { email } })
            : revokeBook.mutate({ addressBookId: container.id, params: { email } })
        }
      >
        Revoke
      </button>
      {(grant.isPending || revoke.isPending) && <span className="meta">…</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

function NewContainerForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidateContainers();
  const create = useCreateCalendar({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
    },
  });
  const [form, setForm] = useState({
    type: 'calendar',
    slug: '',
    displayName: '',
    color: '#1d6feb',
    defaultTimezone: 'Europe/Stockholm',
    class: 'Agenda' as CalendarClass,
    kind: 'Generic' as CalendarKind,
  });

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          data: {
            type: form.type,
            slug: form.slug,
            displayName: form.displayName || null,
            color: form.type === 'calendar' ? form.color : null,
            defaultTimezone: form.type === 'calendar' ? form.defaultTimezone || null : null,
            class: form.type === 'calendar' ? form.class : null,
            kind: form.type === 'calendar' ? form.kind : null,
          },
        });
      }}
    >
      <div className="form-row">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="calendar">Calendar</option>
          <option value="addressbook">Address book</option>
        </select>
        <input className="text-input" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <input className="text-input" placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      </div>
      {form.type === 'calendar' && (
        <div className="form-row">
          <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} title="Color" />
          <input className="text-input" placeholder="IANA timezone" value={form.defaultTimezone} onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })} />
          <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value as CalendarClass })}>
            {Object.values(CalendarClass).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CalendarKind })}>
            {Object.values(CalendarKind).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
      )}
      {errText(create.error) && <p className="error-text">{errText(create.error)}</p>}
      <div className="chip-row">
        <button className="btn primary" type="submit" disabled={create.isPending}>
          Create
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
