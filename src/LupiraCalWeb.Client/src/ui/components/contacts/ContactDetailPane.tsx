import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAddContactGroupMember,
  useDeleteContact,
  useGetContact,
  useListContactGroups,
  useRemoveContactGroupMember,
  useSearchContacts,
  useSetMyContact,
} from '../../../data/api-contact/lupiraContactApi';
import { fmtDate } from '../../../domain/time';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { CompletenessBadge } from '../drawer/CompletenessBadge';
import { errText } from '../errText';
import { PlaceLabel } from '../places/PlaceLabel';
import { ContactCircles } from './ContactCircles';
import { ContactEditForm } from './ContactEditForm';
import { ContactRelationsPanel } from './ContactRelationsPanel';
import { fmtPartialDate } from './partialDate';

/** Right pane for a contact: reach fields, postal addresses, profiles, emergency designation, group membership,
 *  completeness, and relations. Fields edit inline via ContactEditForm; all writes go over REST. */
export function ContactDetailPane() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useGetContact(contactId ?? '', { query: { enabled: !!contactId } });
  const { data: groups } = useListContactGroups(contact?.addressBookId ?? '', { query: { enabled: !!contact } });
  const { data: bookContacts } = useSearchContacts({ addressBookId: contact?.addressBookId ?? '' }, { query: { enabled: !!contact } });
  const invalidate = useInvalidateContacts();
  const addMember = useAddContactGroupMember({ mutation: { onSuccess: invalidate } });
  const removeMember = useRemoveContactGroupMember({ mutation: { onSuccess: invalidate } });
  const del = useDeleteContact({ mutation: { onSuccess: () => { invalidate(); navigate('/contacts'); } } });
  const setMe = useSetMyContact({ mutation: { onSuccess: invalidate } });
  const [groupId, setGroupId] = useState('');
  const [editing, setEditing] = useState(false);
  const [showCircles, setShowCircles] = useState(false);

  if (isLoading) return <div className="contacts-detail-pane"><p className="meta">Loading…</p></div>;
  if (!contact) return <div className="contacts-detail-pane"><p className="empty">Contact not found.</p></div>;

  const memberOf = (groups ?? []).filter((g) => g.members.some((m) => m.contactId === contact.id));
  const joinable = (groups ?? []).filter((g) => !g.members.some((m) => m.contactId === contact.id));
  const groupSearch = `?book=${contact.addressBookId}`;
  const link = (id: string) => ({ pathname: `/contacts/${id}`, search: groupSearch });
  const nameOf = (cid: string) => bookContacts?.find((c) => c.id === cid)?.displayName ?? cid.slice(0, 8);

  return (
    <div className="contacts-detail-pane">
      <div className="page-head">
        <h2>
          {contact.displayName}
          {contact.nickname && contact.nickname !== contact.displayName && <span className="meta"> “{contact.nickname}”</span>}
          {contact.deceased && <span className="badge" title={contact.deathDate ? `died ${contact.deathDate}` : 'deceased'}>†</span>}
        </h2>
        <div className="head-actions">
          <CompletenessBadge score={contact.completeness} />
          {!editing && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <ContactEditForm contact={contact} onDone={() => setEditing(false)} />
      ) : (
        <>
          <dl className="detail-grid">
            {contact.birthday && (
              <div>
                <dt>Birthday</dt>
                <dd>🎂 {fmtPartialDate(contact.birthday)}</dd>
              </div>
            )}
            {contact.channels.map((c, i) => (
              <div key={i}>
                <dt>
                  {c.type || c.medium}
                  {c.preferred && ' ★'}
                </dt>
                <dd>
                  <a className="linklike" href={`${c.medium === 'Phone' ? 'tel' : 'mailto'}:${c.value}`}>
                    {c.value}
                  </a>
                </dd>
              </div>
            ))}
            {contact.addresses.filter((a) => a.placeId).map((a, i) => (
              <div key={i}>
                <dt>{a.type} address</dt>
                <dd>📍 <PlaceLabel placeId={a.placeId} link /></dd>
              </div>
            ))}
            {contact.profiles.map((p, i) => (
              <div key={i}>
                <dt>
                  {p.service}
                  {p.preferred && ' ★'}
                </dt>
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

          {contact.emergencyContactIds.length > 0 && (
            <section className="drawer-section">
              <h3>Emergency contacts</h3>
              {contact.emergencyContactIds.map((cid, i) => (
                <div key={cid} className="membership-row">
                  <span className="badge">{i + 1}</span>
                  <Link className="membership-name" to={link(cid)}>
                    {nameOf(cid)}
                  </Link>
                </div>
              ))}
            </section>
          )}
        </>
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

      <section className="drawer-section">
        <div className="page-head">
          <h3>Social circles</h3>
          <button className="linklike" onClick={() => setShowCircles((v) => !v)}>
            {showCircles ? 'Hide' : 'Show'}
          </button>
        </div>
        {showCircles && <ContactCircles focusId={contact.id} />}
      </section>

      {contact.updatedAt && (
        <p className="meta">
          Updated {fmtDate(new Date(contact.updatedAt))}
          {contact.createdAt && ` · added ${fmtDate(new Date(contact.createdAt))}`}
        </p>
      )}
      <div className="detail-footer">
        <button className="linklike" disabled={setMe.isPending} onClick={() => setMe.mutate({ data: { contactId: contact.id } })}>
          This is me
        </button>
        <button className="btn destructive" onClick={() => del.mutate({ id: contact.id })} disabled={del.isPending}>
          Delete contact
        </button>
      </div>
      {errText(setMe.error) && <p className="error-text">{errText(setMe.error)}</p>}
    </div>
  );
}
