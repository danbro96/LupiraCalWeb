import { useState } from 'react';
import { NavLink, useLocation, useMatch, useSearchParams } from 'react-router-dom';
import { useCreateContact, useSearchContacts } from '../../../data/api-contact/lupiraContactApi';
import type { ContactReachChannel } from '../../../data/api-contact/models';
import { ReachMedium } from '../../../data/api-contact/models';
import { addressBookLabel, useAddressBooks } from '../../../state/useAddressBooks';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { errText } from '../errText';
import { useGroup } from './useGroup';

/** Split a comma-separated input into reach channels of one medium (create-form convenience). */
function toChannels(raw: string, medium: ReachMedium): ContactReachChannel[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => ({ medium, value, type: null, preferred: false }));
}

/** Middle pane: search + the contact rows, filtered by the selected book (?book) and, when a
 *  group is open, narrowed to that group's members (client-side — the API has no group filter). */
export function ContactList() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const bookId = params.get('book') ?? '';
  const query = params.get('q') ?? '';
  const groupId = useMatch('/contacts/groups/:groupId')?.params.groupId;
  const group = useGroup(bookId || undefined, groupId);

  const { addressBooks } = useAddressBooks();
  const { data: contacts } = useSearchContacts({
    query: query || undefined,
    addressBookId: bookId || undefined,
  });
  const [creating, setCreating] = useState(false);

  const rows = groupId ? (contacts ?? []).filter((c) => group?.members.includes(c.id)) : contacts ?? [];

  const setQuery = (q: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (q) next.set('q', q);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );

  return (
    <div className="contacts-list-pane">
      <div className="list-pane-head">
        <input className="text-input" placeholder="Search names…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn primary" onClick={() => setCreating((c) => !c)}>
          + New
        </button>
      </div>
      {creating && <NewContactForm defaultBookId={bookId || addressBooks[0]?.id} onDone={() => setCreating(false)} />}
      <div className="contact-list">
        {rows.map((c) => (
          <NavLink key={c.id} to={{ pathname: `/contacts/${c.id}`, search: location.search }} className="contact-row">
            <span className="avatar">{(c.displayName[0] ?? '?').toUpperCase()}</span>
            <span className="contact-name">
              {c.displayName}
              {c.nickname ? <span className="meta"> “{c.nickname}”</span> : null}
            </span>
            {c.birthday && <span className="badge">🎂 {c.birthday.slice(5)}</span>}
            {c.completeness && (
              <span className="completeness-bar" title={`Completeness ${Math.round(Number(c.completeness.score) * 100)}%`}>
                <span style={{ width: `${Math.round(Number(c.completeness.score) * 100)}%` }} />
              </span>
            )}
          </NavLink>
        ))}
        {rows.length === 0 && <p className="empty">No contacts.</p>}
      </div>
    </div>
  );
}

function NewContactForm({ defaultBookId, onDone }: { defaultBookId?: string; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
  const create = useCreateContact({ mutation: { onSuccess: () => { invalidate(); onDone(); } } });
  const { addressBooks } = useAddressBooks();
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
        const channels = [...toChannels(form.emails, ReachMedium.Email), ...toChannels(form.phones, ReachMedium.Phone)];
        create.mutate({
          data: {
            addressBookId: form.addressBookId,
            givenName: form.givenName || null,
            familyName: form.familyName || null,
            nickname: form.nickname || null,
            channels: channels.length ? channels : null,
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
              {addressBookLabel(b)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
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
