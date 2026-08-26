import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { logout } from '../../data/session';
import { useSession } from '../../state/useSession';
import { useCreateCalendar, useGrantCalendarOwner, useRevokeCalendarOwner } from '../../data/api/lupiraCalApi';
import { CalendarClass, CalendarKind, type ContainerDto } from '../../data/api/models';
import { useCreateAddressBook, useGrantAddressBookOwner, useRevokeAddressBookOwner } from '../../data/api-contact/lupiraContactApi';
import type { AddressBookDto } from '../../data/api-contact/models';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { addressBookLabel, useAddressBooks } from '../../state/useAddressBooks';
import { useInvalidateAddressBooks, useInvalidateContainers } from '../../state/useInvalidate';
import { CALENDAR_KIND_ICONS, calendarColor } from '../theme/kinds';
import { errText } from '../components/errText';
import { useSnackbar } from '../components/SnackbarHost';

/** Container management: calendars (class/kind/color/tz, from cal-api) and address books (from
 *  contact-api), with creation and per-owner sharing. */
export function CalendarsScreen() {
  const { calendars } = useContainers();
  const { addressBooks } = useAddressBooks();
  const { data: user } = useSession();
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <div className="account-card">
        <div className="account-who">
          <span className="account-name">{user?.name ?? user?.email}</span>
          {user?.name && user?.email && user.name !== user.email && (
            <span className="account-sub">{user.email}</span>
          )}
        </div>
        <Button variant="outlined" onClick={logout}>
          Sign out
        </Button>
      </div>
      <div className="page-head">
        <h2>Calendars & address books</h2>
        <Button variant="contained" onClick={() => setCreating((c) => !c)}>
          + New
        </Button>
        <Button component={NavLink} to="/places">
          Places…
        </Button>
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
        <td>{c.class && <Chip variant="outlined" label={c.class} />}</td>
        <td className="meta">{c.kind ?? '—'}</td>
        <td className="meta">{c.defaultTimezone ?? '—'}</td>
        <td className="meta">{c.access}</td>
        <td>
          {c.access === 'Owner' && (
            <Button variant="text" onClick={() => setSharing((s) => !s)}>
              {sharing ? 'close' : 'share…'}
            </Button>
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
          <span className="color-dot" style={{ background: 'var(--mui-palette-border)' }} />
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
            <Button variant="text" onClick={() => setSharing((s) => !s)}>
              {sharing ? 'close' : 'share…'}
            </Button>
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
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const calOpts = { mutation: { onSuccess: invalidateContainers, onError } };
  const bookOpts = { mutation: { onSuccess: invalidateBooks, onError } };
  const grantCal = useGrantCalendarOwner(calOpts);
  const revokeCal = useRevokeCalendarOwner(calOpts);
  const grantBook = useGrantAddressBookOwner(bookOpts);
  const revokeBook = useRevokeAddressBookOwner(bookOpts);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('read-write');

  const isCalendar = kind === 'calendar';
  const grant = isCalendar ? grantCal : grantBook;
  const revoke = isCalendar ? revokeCal : revokeBook;

  return (
    <div className="share-panel">
      <TextField type="email" placeholder="member@email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField select value={access} onChange={(e) => setAccess(e.target.value)}>
        <MenuItem value="owner">Owner</MenuItem>
        <MenuItem value="read-write">Read-write</MenuItem>
        <MenuItem value="read">Read</MenuItem>
      </TextField>
      <Button
        variant="outlined"
        disabled={!email}
        onClick={() =>
          isCalendar
            ? grantCal.mutate({ calendarId: id, data: { email, access } })
            : grantBook.mutate({ addressBookId: id, data: { email, access } })
        }
      >
        Grant
      </Button>
      <Button
        variant="outlined"
        color="error"
        disabled={!email}
        onClick={() =>
          isCalendar
            ? revokeCal.mutate({ calendarId: id, params: { email } })
            : revokeBook.mutate({ addressBookId: id, params: { email } })
        }
      >
        Revoke
      </Button>
      {(grant.isPending || revoke.isPending) && <Typography variant="caption" color="text.secondary">…</Typography>}
    </div>
  );
}

function NewContainerForm({ onDone }: { onDone: () => void }) {
  const invalidateContainers = useInvalidateContainers();
  const invalidateBooks = useInvalidateAddressBooks();
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const createCal = useCreateCalendar({ mutation: { onSuccess: () => { invalidateContainers(); onDone(); }, onError } });
  const createBook = useCreateAddressBook({ mutation: { onSuccess: () => { invalidateBooks(); onDone(); }, onError } });
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
        <TextField select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <MenuItem value="calendar">Calendar</MenuItem>
          <MenuItem value="addressbook">Address book</MenuItem>
        </TextField>
        <TextField placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <TextField placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      </div>
      {!isBook && (
        <div className="form-row">
          <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} title="Color" />
          <TextField placeholder="IANA timezone" value={form.defaultTimezone} onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })} />
          <TextField select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value as CalendarClass })}>
            {Object.values(CalendarClass).map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
          <TextField select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CalendarKind })}>
            {Object.values(CalendarKind).map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </TextField>
        </div>
      )}
      <div className="chip-row">
        <Button variant="contained" type="submit" disabled={pending}>
          Create
        </Button>
        <Button variant="outlined" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
