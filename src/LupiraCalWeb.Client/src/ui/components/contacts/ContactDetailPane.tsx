import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddContactGroupMember,
  useDeleteContact,
  useGetContact,
  useListContactGroups,
  useRemoveContactGroupMember,
} from '../../../data/api-contact/lupiraContactApi';
import { fmtDate, parseYmd } from '../../../domain/time';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { CompletenessBadge } from '../drawer/CompletenessBadge';
import { ContactRelationsPanel } from './ContactRelationsPanel';

/** Right pane for a contact: reach fields, postal addresses, profiles, group membership,
 *  completeness, delete. Fields are read-only over REST — edits sync via CardDAV. */
export function ContactDetailPane() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useGetContact(contactId ?? '', { query: { enabled: !!contactId } });
  const { data: groups } = useListContactGroups(contact?.addressBookId ?? '', { query: { enabled: !!contact } });
  const invalidate = useInvalidateContacts();
  const addMember = useAddContactGroupMember({ mutation: { onSuccess: invalidate } });
  const removeMember = useRemoveContactGroupMember({ mutation: { onSuccess: invalidate } });
  const del = useDeleteContact({ mutation: { onSuccess: () => { invalidate(); navigate('/contacts'); } } });
  const [groupId, setGroupId] = useState('');

  if (isLoading) return <div className="contacts-detail-pane"><p className="meta">Loading…</p></div>;
  if (!contact) return <div className="contacts-detail-pane"><p className="empty">Contact not found.</p></div>;

  const memberOf = (groups ?? []).filter((g) => g.members.includes(contact.id));
  const joinable = (groups ?? []).filter((g) => !g.members.includes(contact.id));
  const groupSearch = `?book=${contact.addressBookId}`;

  return (
    <div className="contacts-detail-pane">
      <div className="page-head">
        <h2>
          {contact.displayName}
          {contact.nickname && <span className="meta"> “{contact.nickname}”</span>}
        </h2>
        <CompletenessBadge score={contact.completeness} />
      </div>

      <dl className="detail-grid">
        {contact.birthday && (
          <div>
            <dt>Birthday</dt>
            <dd>🎂 {fmtDate(parseYmd(contact.birthday))}</dd>
          </div>
        )}
        {(contact.emails ?? []).map((e) => (
          <div key={e}>
            <dt>Email</dt>
            <dd>
              <a className="linklike" href={`mailto:${e}`}>
                {e}
              </a>
            </dd>
          </div>
        ))}
        {(contact.phones ?? []).map((p) => (
          <div key={p}>
            <dt>Phone</dt>
            <dd>
              <a className="linklike" href={`tel:${p}`}>
                {p}
              </a>
            </dd>
          </div>
        ))}
        {contact.addresses.map((a, i) => (
          <div key={i}>
            <dt>{a.type} address</dt>
            <dd>📍 {a.formattedAddress || '…'}</dd>
          </div>
        ))}
        {contact.profiles.map((p, i) => (
          <div key={i}>
            <dt>{p.service}</dt>
            <dd>
              {p.url ? (
                <a className="linklike" href={p.url} target="_blank" rel="noreferrer">
                  {p.handle} ↗
                </a>
              ) : (
                p.handle
              )}
            </dd>
          </div>
        ))}
      </dl>

      {(contact.tags ?? []).length > 0 && (
        <div className="chip-row">
          {(contact.tags ?? []).map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <section className="drawer-section">
        <h3>Groups</h3>
        {memberOf.map((g) => (
          <div key={g.id} className="membership-row">
            <span className="badge">{g.kind === 'Organization' ? '🏢' : '👥'}</span>
            <Link className="membership-name" to={{ pathname: `/contacts/groups/${g.id}`, search: groupSearch }}>
              {g.name}
            </Link>
            <button
              className="icon-btn"
              title="Remove from group"
              onClick={() => removeMember.mutate({ groupId: g.id, contactId: contact.id })}
            >
              ×
            </button>
          </div>
        ))}
        <div className="form-row">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Add to group…</option>
            {joinable.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!groupId}
            onClick={() => {
              addMember.mutate({ groupId, params: { contactId: contact.id } });
              setGroupId('');
            }}
          >
            Add
          </button>
        </div>
      </section>

      <ContactRelationsPanel contact={contact} />

      <p className="meta">vCard UID {contact.externalId} · edits sync via CardDAV</p>
      <button className="btn destructive" onClick={() => del.mutate({ id: contact.id })} disabled={del.isPending}>
        Delete contact
      </button>
    </div>
  );
}
