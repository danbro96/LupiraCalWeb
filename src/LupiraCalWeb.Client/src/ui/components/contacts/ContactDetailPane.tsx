import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MuiLink from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import type { SxProps, Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
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
import { fmtResidencyPeriod, residencyStatus, type FuzzyDate } from '@lupira/cal-domain/fuzzyDate';

function residencySuffix(movedIn: FuzzyDate | null | undefined, movedOut: FuzzyDate | null | undefined): string {
  const status = residencyStatus(movedIn, movedOut);
  return status === 'former' ? ' (former)' : status === 'future' ? ' (upcoming)' : '';
}
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
import { WrapRow } from '../WrapRow';
import { DrawerSection } from '../DrawerSection';

const linkSx: SxProps<Theme> = { fontSize: 13, fontWeight: 600, p: '2px', whiteSpace: 'nowrap', '@media (pointer: coarse)': { p: '6px 2px' } };

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

  if (isLoading) return <div className="contacts-detail-pane"><Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading…</Typography></div>;
  if (!contact) return <div className="contacts-detail-pane"><Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Contact not found.</Typography></div>;

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
          {contact.nickname && contact.nickname !== contact.displayName && <Typography variant="caption" sx={{ color: 'text.secondary' }}> “{contact.nickname}”</Typography>}
          {contact.deceased && (
            <Tooltip title={contact.deathDate ? `died ${contact.deathDate}` : 'deceased'}>
              <Chip variant="outlined" label="†" />
            </Tooltip>
          )}
        </h2>
        <div className="head-actions">
          <CompletenessBadge score={contact.completeness} />
          {!editing && (
            <Button variant="outlined" onClick={() => setEditing(true)}>
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
                  <MuiLink underline="hover" sx={linkSx} href={`${c.medium === 'Phone' ? 'tel' : 'mailto'}:${c.value}`}>
                    {c.value}
                  </MuiLink>
                </dd>
              </div>
            ))}
            {contact.addresses.filter((a) => a.placeId).map((a, i) => (
              <div key={i}>
                <dt>{a.type} address</dt>
                <dd>
                  📍 <PlaceLabel placeId={a.placeId} link />
                  {(a.movedIn || a.movedOut) && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}> · {fmtResidencyPeriod(a.movedIn, a.movedOut)}{residencySuffix(a.movedIn, a.movedOut)}</Typography>
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
                    <MuiLink underline="hover" sx={linkSx} href={p.url} target="_blank" rel="noreferrer">
                      {p.handle} ↗
                    </MuiLink>
                  ) : (
                    p.handle
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {(contact.tags ?? []).filter((t) => t !== PINNED_TAG).length > 0 && (
            <WrapRow>
              {(contact.tags ?? []).filter((t) => t !== PINNED_TAG).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </WrapRow>
          )}

          {contact.emergencyContactIds.length > 0 && (
            <DrawerSection title="Emergency contacts">
              {contact.emergencyContactIds.map((cid, i) => (
                <div key={cid} className="membership-row">
                  <Chip variant="outlined" label={i + 1} />
                  <MuiLink component={Link} sx={{ flex: 1 }} to={link(cid)}>
                    {nameOf(cid)}
                  </MuiLink>
                </div>
              ))}
            </DrawerSection>
          )}
        </>
      )}

      <DrawerSection title="Groups">
        {memberOf.map((g) => (
          <div key={g.id} className="membership-row">
            <Chip variant="outlined" label={g.kind === 'Organization' ? '🏢' : '👥'} />
            <MuiLink component={Link} sx={{ flex: 1 }} to={{ pathname: `/contacts/groups/${g.id}`, search: groupSearch }}>
              {g.name}
            </MuiLink>
            <Tooltip title="Remove from group">
              <IconButton
                onClick={() => removeMember.mutate({ groupId: g.id, contactId: contact.id })}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <WrapRow>
          <TextField select value={groupId} onChange={(e) => setGroupId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Add to group…</MenuItem>
            {joinable.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={!groupId}
            onClick={() => {
              addMember.mutate({ groupId, params: { contactId: contact.id } });
              setGroupId('');
            }}
          >
            Add
          </Button>
        </WrapRow>
      </DrawerSection>

      <ContactEventsPanel contactId={contact.id} />

      <ContactRelationsPanel contact={contact} />

      <DrawerSection
        title="Social circles"
        action={
          <Button variant="text" onClick={() => setShowCircles((v) => !v)}>
            {showCircles ? 'Hide' : 'Show'}
          </Button>
        }
      >
        {showCircles && <ContactCircles focusId={contact.id} />}
      </DrawerSection>

      {contact.updatedAt && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">
          Updated {fmtDate(new Date(contact.updatedAt))}
          {contact.createdAt && ` · added ${fmtDate(new Date(contact.createdAt))}`}
        </Typography>
      )}
      <div className="detail-footer">
        <Button variant="text" disabled={setMe.isPending} onClick={() => setMe.mutate({ data: { contactId: contact.id } })}>
          This is me
        </Button>
        <Button variant="outlined" color="error" onClick={() => del.mutate({ id: contact.id })} disabled={del.isPending}>
          Delete contact
        </Button>
      </div>
    </div>
  );
}
