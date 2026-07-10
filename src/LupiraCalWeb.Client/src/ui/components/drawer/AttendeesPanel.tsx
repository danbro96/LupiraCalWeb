import { useState } from 'react';
import {
  useConfirmAttendance,
  useInviteParticipant,
  useLeaveItem,
  useRemoveParticipant,
  useRespondToInvitation,
} from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { useSearchContacts } from '../../../data/api-contact/lupiraContactApi';
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

  const invitable = (contacts ?? []).filter((c) => !item.attendees.some((a) => a.contactId === c.id));

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
                  <button className="chip" title="Accept" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'accepted' } })}>
                    ✓
                  </button>
                  <button className="chip" title="Tentative" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'tentative' } })}>
                    ?
                  </button>
                  <button className="chip" title="Decline" onClick={() => respond.mutate({ id: item.id, participationId: pid, params: { status: 'declined' } })}>
                    ✗
                  </button>
                </>
              )}
              {status === 'Accepted' && !a.attendedAt && (
                <button className="chip" title="Confirm attendance" onClick={() => attend.mutate({ id: item.id, participationId: pid })}>
                  attended
                </button>
              )}
              {!a.leftAt && (
                <button className="chip" title="Left" onClick={() => leave.mutate({ id: item.id, participationId: pid })}>
                  left
                </button>
              )}
              <button className="icon-btn" title="Remove" onClick={() => remove.mutate({ id: item.id, participationId: pid })}>
                ×
              </button>
            </div>
          </div>
        );
      })}
      <div className="form-row">
        <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">Invite a contact…</option>
          {invitable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!contactId || invite.isPending}
          onClick={() => {
            invite.mutate({ id: item.id, params: { contactId, role } });
            setContactId('');
          }}
        >
          Invite
        </button>
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
