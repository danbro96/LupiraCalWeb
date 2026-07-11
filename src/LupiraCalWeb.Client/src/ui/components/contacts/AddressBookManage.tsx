import { useState } from 'react';
import {
  useDeleteAddressBook,
  useGrantAddressBookOwner,
  useListAddressBookOwners,
  useRevokeAddressBookOwner,
  useUpdateAddressBook,
} from '../../../data/api-contact/lupiraContactApi';
import type { AddressBookDto } from '../../../data/api-contact/models';
import { useInvalidateAddressBooks } from '../../../state/useInvalidate';
import { errText } from '../errText';

const ACCESS_OPTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'read-write', label: 'Read-write' },
  { value: 'owner', label: 'Owner' },
];

/** Owner-only management for one address book: rename, share (grant/revoke co-owners), delete.
 *  Delete is refused server-side for the personal book or a non-empty book — the 409 surfaces inline. */
export function AddressBookManage({ book, onDeleted }: { book: AddressBookDto; onDeleted: () => void }) {
  const invalidate = useInvalidateAddressBooks();
  const update = useUpdateAddressBook({ mutation: { onSuccess: invalidate } });
  const del = useDeleteAddressBook({ mutation: { onSuccess: () => { invalidate(); onDeleted(); } } });
  const grant = useGrantAddressBookOwner({ mutation: { onSuccess: invalidate } });
  const revoke = useRevokeAddressBookOwner({ mutation: { onSuccess: invalidate } });
  const { data: owners } = useListAddressBookOwners(book.id);

  const [displayName, setDisplayName] = useState(book.displayName ?? '');
  const [slug, setSlug] = useState(book.slug);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState('read');

  const errors = [update, del, grant, revoke].map((m) => errText(m.error)).filter(Boolean);

  return (
    <div className="book-manage">
      <form
        className="tree-add"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ addressBookId: book.id, data: { slug: slug.trim() || null, displayName: displayName.trim() || null } });
        }}
      >
        <input className="text-input" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <input className="text-input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <button className="btn" type="submit" disabled={update.isPending}>
          Rename
        </button>
      </form>

      <div className="section-label">Shared with</div>
      {(owners ?? []).map((o) => (
        <div key={o.principalId} className="membership-row">
          <span className="badge">{o.access}</span>
          <span className="membership-name">{o.email}</span>
          <button
            className="icon-btn"
            title="Revoke access"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ addressBookId: book.id, params: { email: o.email } })}
          >
            ×
          </button>
        </div>
      ))}
      <form
        className="tree-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          grant.mutate({ addressBookId: book.id, data: { email: email.trim(), access } });
          setEmail('');
        }}
      >
        <input className="text-input" type="email" placeholder="email to share with" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={access} onChange={(e) => setAccess(e.target.value)}>
          {ACCESS_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={!email.trim() || grant.isPending}>
          Share
        </button>
      </form>

      <button className="btn destructive" disabled={del.isPending} onClick={() => del.mutate({ addressBookId: book.id })}>
        Delete address book
      </button>
      {errors.map((msg, i) => (
        <p key={i} className="error-text">
          {msg}
        </p>
      ))}
    </div>
  );
}
