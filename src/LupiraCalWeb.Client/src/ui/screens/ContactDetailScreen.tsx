import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAddContactGroupMember,
  useDeleteContact,
  useGetContact,
  useListContactGroups,
  useRemoveContactGroupMember,
} from '../../data/api/lupiraCalApi';
import { fmtDate, parseYmd } from '../../domain/time';
import { useInvalidateContacts } from '../../state/useInvalidate';
import { usePlaces } from '../../state/usePlaces';
import { CompletenessBadge } from '../components/drawer/CompletenessBadge';

/** Full contact card: reach fields, addresses (place-resolved), profiles, groups, completeness. */
export function ContactDetailScreen() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useGetContact(contactId ?? '', { query: { enabled: !!contactId } });
  const { data: groups } = useListContactGroups(contact?.addressBookId ?? '', { query: { enabled: !!contact } });
  const invalidate = useInvalidateContacts();
  const addMember = useAddContactGroupMember({ mutation: { onSuccess: invalidate } });
  const removeMember = useRemoveContactGroupMember({ mutation: { onSuccess: invalidate } });
  const del = useDeleteContact({ mutation: { onSuccess: () => { invalidate(); navigate('/contacts'); } } });
  const places = usePlaces((contact?.addresses ?? []).map((a) => a.placeId ?? null));
  const [groupId, setGroupId] = useState('');

  if (isLoading) return <p className="meta page">Loading…</p>;
  if (!contact) return <p className="meta page">Contact not found.</p>;

  const memberOf = (groups ?? []).filter((g) => g.members.includes(contact.id));
  const joinable = (groups ?? []).filter((g) => !g.members.includes(contact.id));

  return (
    <div className="page">
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
            <dd>📍 {(a.placeId && places.get(a.placeId)?.name) || '…'}</dd>
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
            <span className="membership-name">{g.name}</span>
            <button className="icon-btn" title="Remove from group" onClick={() => removeMember.mutate({ groupId: g.id, contactId: contact.id })}>
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

      <p className="meta">vCard UID {contact.vcardUid} · edits sync via CardDAV</p>
      <button className="btn destructive" onClick={() => del.mutate({ id: contact.id })} disabled={del.isPending}>
        Delete contact
      </button>
    </div>
  );
}
