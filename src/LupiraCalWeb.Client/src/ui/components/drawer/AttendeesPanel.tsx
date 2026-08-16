import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import {
  useConfirmAttendance,
  useGetParticipationSummary,
  useInviteParticipant,
  useLeaveItem,
  useRemoveParticipant,
  useRespondToInvitation,
} from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { useSearchContacts } from '../../../data/api-contact/lupiraContactApi';
import { rankByInteraction } from '@lupira/cal-domain/contactRank';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { errText } from '../errText';

const ROLE_OPTIONS = [
  { value: 'req-participant', label: 'Required' },
  { value: 'opt-participant', label: 'Optional' },
  { value: 'chair', label: 'Chair' },
  { value: 'non-participant', label: 'FYI' },
];

const ROLE_LABELS: Record<string, string> = {
  Chair: 'chair',
  RequiredParticipant: 'required',
  OptionalParticipant: 'optional',
  NonParticipant: 'fyi',
};

const STATUS_LABELS: Record<string, string> = {
  NeedsAction: 'invited',
  Accepted: 'accepted',
  Declined: 'declined',
  Tentative: 'tentative',
  Delegated: 'delegated',
};

/** Invitees + RSVP state, with invite/respond/attend/leave/remove riding the participation events. */
export function AttendeesPanel({ item }: { item: CalendarItemDto }) {
  const invalidate = useInvalidateItems();
  const { data: contacts } = useSearchContacts();
  const contactName = (id?: string) => contacts?.find((c) => c.id === id)?.displayName ?? (id ?? '?').slice(0, 8);

  const opts = { mutation: { onSuccess: invalidate } };
  const invite = useInviteParticipant(opts);
  const respond = useRespondToInvitation(opts);
  const attend = useConfirmAttendance(opts);
  const leave = useLeaveItem(opts);
  const remove = useRemoveParticipant(opts);

  const [contactId, setContactId] = useState('');
  const [role, setRole] = useState('req-participant');

  // Most-met contacts first; fail-open — while the summary loads (or errors) the list stays alphabetical.
  const { data: summary } = useGetParticipationSummary();
  const invitable = rankByInteraction(
    (contacts ?? []).filter((c) => !item.attendees.some((a) => a.contactId === c.id)),
    summary,
  );

  return (
    <section className="drawer-section">
      <h3>Attendees</h3>
      {item.attendees.length === 0 && <p className="meta">No attendees yet.</p>}
      {item.attendees.map((a) => {
        const pid = a.participationId ?? '';
        const status = a.status ?? 'NeedsAction';
        return (
          <div key={pid} className="attendee-row">
            <span className="avatar">{initials(contactName(a.contactId))}</span>
            <div className="attendee-info">
              <span>{contactName(a.contactId)}</span>
              <span className="meta">
                {ROLE_LABELS[a.role ?? ''] ?? a.role} · <b className={`rsvp-${status.toLowerCase()}`}>{STATUS_LABELS[status] ?? status}</b>
                {a.attendedAt ? ' · attended' : ''}
                {a.leftAt ? ' · left' : ''}
              </span>
            </div>
            <div className="attendee-actions">
              {status === 'NeedsAction' && (
                <>
                  <Tooltip title="Accept">
                    <Chip size="small" variant="outlined" label="✓" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'accepted' } })} />
                  </Tooltip>
                  <Tooltip title="Tentative">
                    <Chip size="small" variant="outlined" label="?" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'tentative' } })} />
                  </Tooltip>
                  <Tooltip title="Decline">
                    <Chip size="small" variant="outlined" label="✗" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'declined' } })} />
                  </Tooltip>
                </>
              )}
              {status === 'Accepted' && !a.attendedAt && (
                <Tooltip title="Confirm attendance">
                  <Chip size="small" variant="outlined" label="attended" onClick={() => attend.mutate({ id: item.id, participationId: pid })} />
                </Tooltip>
              )}
              {!a.leftAt && (
                <Tooltip title="Left">
                  <Chip size="small" variant="outlined" label="left" onClick={() => leave.mutate({ id: item.id, participationId: pid })} />
                </Tooltip>
              )}
              <Tooltip title="Remove">
                <IconButton size="small" onClick={() => remove.mutate({ id: item.id, participationId: pid })}>
                  ×
                </IconButton>
              </Tooltip>
            </div>
          </div>
        );
      })}
      <div className="form-row">
        <TextField select size="small" value={contactId} onChange={(e) => setContactId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Invite a contact…</MenuItem>
          {invitable.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.displayName}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="outlined"
          size="small"
          disabled={!contactId || invite.isPending}
          onClick={() => {
            invite.mutate({ id: item.id, params: { contactId, role } });
            setContactId('');
          }}
        >
          Invite
        </Button>
      </div>
      {errText(invite.error) && <p className="error-text">{errText(invite.error)}</p>}
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
