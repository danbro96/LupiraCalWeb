import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCreateContact, useSearchContacts } from '../../data/api/lupiraCalApi';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { useInvalidateContacts } from '../../state/useInvalidate';
import { GroupsPanel } from '../components/GroupsPanel';
import { errText } from '../components/errText';

export function ContactsScreen() {
  const [query, setQuery] = useState('');
  const [bookId, setBookId] = useState('');
  const { addressBooks } = useContainers();
  const { data: contacts } = useSearchContacts({ query: query || undefined, addressBookId: bookId || undefined });
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Contacts</h2>
        <button className="btn primary" onClick={() => setCreating((c) => !c)}>
          + New contact
        </button>
      </div>
      <div className="form-row">
        <input className="text-input" placeholder="Search names…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
          <option value="">All address books</option>
          {addressBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {calendarLabel(b)}
            </option>
          ))}
        </select>
      </div>
      {creating && <NewContactForm defaultBookId={bookId || addressBooks[0]?.id} onDone={() => setCreating(false)} />}
      <div className="contact-list">
        {(contacts ?? []).map((c) => (
          <Link key={c.id} to={`/contacts/${c.id}`} className="contact-row">
            <span className="avatar">{(c.displayName[0] ?? '?').toUpperCase()}</span>
            <span className="contact-name">
              {c.displayName}
              {c.nickname ? <span className="meta"> “{c.nickname}”</span> : null}
            </span>
            {c.birthday && <span className="badge">🎂 {c.birthday.slice(5)}</span>}
            {(c.tags ?? []).map((t) => (
              <span key={t} className="tag-chip">
                {t}
              </span>
            ))}
            {c.completeness && (
              <span className="completeness-bar" title={`Completeness ${Math.round(Number(c.completeness.score) * 100)}%`}>
                <span style={{ width: `${Math.round(Number(c.completeness.score) * 100)}%` }} />
              </span>
            )}
          </Link>
        ))}
        {contacts?.length === 0 && <p className="empty">No contacts.</p>}
      </div>
      <GroupsPanel addressBookId={bookId || addressBooks[0]?.id} />
    </div>
  );
}

function NewContactForm({ defaultBookId, onDone }: { defaultBookId?: string; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
  const create = useCreateContact({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
    },
  });
  const { addressBooks } = useContainers();
  const [form, setForm] = useState({
    addressBookId: defaultBookId ?? '',
    givenName: '',
    familyName: '',
    nickname: '',
    emails: '',
    phones: '',
    birthday: '',
  });

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          data: {
            addressBookId: form.addressBookId,
            givenName: form.givenName || null,
            familyName: form.familyName || null,
            nickname: form.nickname || null,
            emails: form.emails ? form.emails.split(',').map((s) => s.trim()) : null,
            phones: form.phones ? form.phones.split(',').map((s) => s.trim()) : null,
            birthday: form.birthday || null,
          },
        });
      }}
    >
      <div className="form-row">
        <select value={form.addressBookId} onChange={(e) => setForm({ ...form, addressBookId: e.target.value })} required>
          <option value="">Address book…</option>
          {addressBooks.map((b) => (
            <option key={b.id} value={b.id}>
              {calendarLabel(b)}
            </option>
          ))}
        </select>
        <input className="text-input" placeholder="Given name" value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} />
        <input className="text-input" placeholder="Family name" value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} />
      </div>
      <div className="form-row">
        <input className="text-input" placeholder="Nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        <input type="date" className="text-input" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} title="Birthday" />
      </div>
      <div className="form-row">
        <input className="text-input" placeholder="Emails (comma-separated)" value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} />
        <input className="text-input" placeholder="Phones (comma-separated)" value={form.phones} onChange={(e) => setForm({ ...form, phones: e.target.value })} />
      </div>
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
