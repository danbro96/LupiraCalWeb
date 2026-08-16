import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
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
import { PINNED_TAG } from '@lupira/cal-domain/contactTiers';
import { fmtResidencyPeriod } from '@lupira/cal-domain/fuzzyDate';
import { fmtDate } from '@lupira/cal-domain/time';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { CompletenessBadge } from '../drawer/CompletenessBadge';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';
import { PlaceLabel } from '../places/PlaceLabel';
import { ContactCircles } from './ContactCircles';
import { ContactEditForm } from './ContactEditForm';
import { ContactEventsPanel } from './ContactEventsPanel';
import { ContactRelationsPanel } from './ContactRelationsPanel';
import { fmtPartialDate } from '@lupira/cal-domain/partialDate';

/** Right pane for a contact: reach fields, postal addresses, profiles, emergency designation, group membership,
 *  completeness, and relations. Fields edit inline via ContactEditForm; all writes go over REST. */
export function ContactDetailPane() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useGetContact(contactId ?? '', { query: { enabled: !!contactId } });
  const { data: groups } = useListContactGroups(contact?.addressBookId ?? '', { query: { enabled: !!contact } });
  const { data: bookContacts } = useSearchContacts({ addressBookId: contact?.addressBookId ?? '' }, { query: { enabled: !!contact } });
  const invalidate = useInvalidateContacts();
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const addMember = useAddContactGroupMember({ mutation: { onSuccess: invalidate, onError } });
  const removeMember = useRemoveContactGroupMember({ mutation: { onSuccess: invalidate, onError } });
  const del = useDeleteContact({ mutation: { onSuccess: () => { invalidate(); navigate('/contacts'); }, onError } });
  const setMe = useSetMyContact({ mutation: { onSuccess: invalidate, onError } });
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
          {contact.deceased && (
            <Tooltip title={contact.deathDate ? `died ${contact.deathDate}` : 'deceased'}>
              <Chip size="small" variant="outlined" label="†" />
            </Tooltip>
          )}
        </h2>
        <div className="head-actions">
          <CompletenessBadge score={contact.completeness} />
          {!editing && (
            <Button variant="outlined" size="small" onClick={() => setEditing(true)}>
              Edit
            </Button>
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
                <dd>
                  📍 <PlaceLabel placeId={a.placeId} link />
                  {(a.movedIn || a.movedOut) && (
                    <span className="meta"> · {fmtResidencyPeriod(a.movedIn, a.movedOut)}{a.movedOut ? ' (former)' : ''}</span>
                  )}
                </dd>
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

          {(contact.tags ?? []).filter((t) => t !== PINNED_TAG).length > 0 && (
            <div className="chip-row">
              {(contact.tags ?? []).filter((t) => t !== PINNED_TAG).map((t) => (
                <Chip key={t} size="small" label={t} />
              ))}
            </div>
          )}

          {contact.emergencyContactIds.length > 0 && (
            <section className="drawer-section">
              <h3>Emergency contacts</h3>
              {contact.emergencyContactIds.map((cid, i) => (
                <div key={cid} className="membership-row">
                  <Chip size="small" variant="outlined" label={i + 1} />
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
            <Chip size="small" variant="outlined" label={g.kind === 'Organization' ? '🏢' : '👥'} />
            <Link className="membership-name" to={{ pathname: `/contacts/groups/${g.id}`, search: groupSearch }}>
              {g.name}
            </Link>
            <Tooltip title="Remove from group">
              <IconButton
                size="small"
                onClick={() => removeMember.mutate({ groupId: g.id, contactId: contact.id })}
              >
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <div className="form-row">
          <TextField select size="small" value={groupId} onChange={(e) => setGroupId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Add to group…</MenuItem>
            {joinable.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            disabled={!groupId}
            onClick={() => {
              addMember.mutate({ groupId, params: { contactId: contact.id } });
              setGroupId('');
            }}
          >
            Add
          </Button>
        </div>
      </section>

      <ContactEventsPanel contactId={contact.id} />

      <ContactRelationsPanel contact={contact} />

      <section className="drawer-section">
        <div className="page-head">
          <h3>Social circles</h3>
          <Button variant="text" size="small" onClick={() => setShowCircles((v) => !v)}>
            {showCircles ? 'Hide' : 'Show'}
          </Button>
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
        <Button variant="text" size="small" disabled={setMe.isPending} onClick={() => setMe.mutate({ data: { contactId: contact.id } })}>
          This is me
        </Button>
        <Button variant="outlined" color="error" size="small" onClick={() => del.mutate({ id: contact.id })} disabled={del.isPending}>
          Delete contact
        </Button>
      </div>
    </div>
  );
}
