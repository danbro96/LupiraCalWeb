import { useState } from 'react';
import { useCreateCalendar, useGrantCalendarOwner, useRevokeCalendarOwner } from '../../data/api/lupiraCalApi';
import { CalendarClass, CalendarKind, type ContainerDto } from '../../data/api/models';
import { useCreateAddressBook, useGrantAddressBookOwner, useRevokeAddressBookOwner } from '../../data/api-contact/lupiraContactApi';
import type { AddressBookDto } from '../../data/api-contact/models';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { addressBookLabel, useAddressBooks } from '../../state/useAddressBooks';
import { useInvalidateAddressBooks, useInvalidateContainers } from '../../state/useInvalidate';
import { CALENDAR_KIND_ICONS, calendarColor } from '../theme/kinds';
import { errText } from '../components/errText';

/** Container management: calendars (class/kind/color/tz, from cal-api) and address books (from
 *  contact-api), with creation and per-owner sharing. */
export function CalendarsScreen() {
  const { calendars } = useContainers();
  const { addressBooks } = useAddressBooks();
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
          {calendars.map((c) => (
            <CalendarRow key={c.id} c={c} />
          ))}
          {addressBooks.map((b) => (
            <BookRow key={b.id} b={b} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarRow({ c }: { c: ContainerDto }) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <tr>
        <td>
          <span className="color-dot" style={{ background: calendarColor(c) }} />
        </td>
        <td>
          {c.kind ? `${CALENDAR_KIND_ICONS[c.kind]} ` : ''}
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
            <SharePanel kind="calendar" id={c.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function BookRow({ b }: { b: AddressBookDto }) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <tr>
        <td>
          <span className="color-dot" style={{ background: 'var(--border)' }} />
        </td>
        <td>📇 {addressBookLabel(b)}</td>
        <td>
          <code>{b.slug}</code>
        </td>
        <td className="meta">—</td>
        <td className="meta">—</td>
        <td className="meta">—</td>
        <td className="meta">{b.access}</td>
        <td>
          {b.access === 'Owner' && (
            <button className="linklike" onClick={() => setSharing((s) => !s)}>
              {sharing ? 'close' : 'share…'}
            </button>
          )}
        </td>
      </tr>
      {sharing && (
        <tr>
          <td colSpan={8}>
            <SharePanel kind="book" id={b.id} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Grant/revoke by email. The API has no owner-list endpoint, so this is action-only. Calendars
 *  share via cal-api owners, address books via contact-api owners. */
function SharePanel({ kind, id }: { kind: 'calendar' | 'book'; id: string }) {
  const invalidateContainers = useInvalidateContainers();
  const invalidateBooks = useInvalidateAddressBooks();
  const calOpts = { mutation: { onSuccess: invalidateContainers } };
  const bookOpts = { mutation: { onSuccess: invalidateBooks } };
  const grantCal = useGrantCalendarOwner(calOpts);
  const revokeCal = useRevokeCalendarOwner(calOpts);
  const grantBook = useGrantAddressBookOwner(bookOpts);
  const revokeBook = useRevokeAddressBookOwner(bookOpts);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('read-write');

  const isCalendar = kind === 'calendar';
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
            ? grantCal.mutate({ calendarId: id, data: { email, access } })
            : grantBook.mutate({ addressBookId: id, data: { email, access } })
        }
      >
        Grant
      </button>
      <button
        className="btn destructive"
        disabled={!email}
        onClick={() =>
          isCalendar
            ? revokeCal.mutate({ calendarId: id, params: { email } })
            : revokeBook.mutate({ addressBookId: id, params: { email } })
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
  const invalidateContainers = useInvalidateContainers();
  const invalidateBooks = useInvalidateAddressBooks();
  const createCal = useCreateCalendar({ mutation: { onSuccess: () => { invalidateContainers(); onDone(); } } });
  const createBook = useCreateAddressBook({ mutation: { onSuccess: () => { invalidateBooks(); onDone(); } } });
  const [form, setForm] = useState({
    type: 'calendar',
    slug: '',
    displayName: '',
    color: '#1d6feb',
    defaultTimezone: 'Europe/Stockholm',
    class: 'Agenda' as CalendarClass,
    kind: 'Generic' as CalendarKind,
  });

  const isBook = form.type === 'addressbook';
  const error = errText(createCal.error) || errText(createBook.error);
  const pending = createCal.isPending || createBook.isPending;

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        if (isBook) {
          createBook.mutate({ data: { slug: form.slug, displayName: form.displayName || null } });
        } else {
          createCal.mutate({
            data: {
              type: 'calendar',
              slug: form.slug,
              displayName: form.displayName || null,
              color: form.color,
              defaultTimezone: form.defaultTimezone || null,
              class: form.class,
              kind: form.kind,
            },
          });
        }
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
      {!isBook && (
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
      {error && <p className="error-text">{error}</p>}
      <div className="chip-row">
        <button className="btn primary" type="submit" disabled={pending}>
          Create
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
