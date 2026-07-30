import { Link } from 'react-router-dom';
import { useGetContact } from '../../../data/api-contact/lupiraContactApi';
import type { ContactDto } from '../../../data/api-contact/models';
import { nextBirthday, turningAge } from '@lupira/cal-domain/birthday';
import { fmtDate } from '@lupira/cal-domain/time';
import { fmtPartialDate } from '@lupira/cal-domain/partialDate';

/** Read-only view for a birthday occurrence (a contact projection, not a stored item): the birthday date,
 *  the age the contact is turning when known, and a link to the contact. `year` is the clicked occurrence's year. */
export function BirthdayCard({ contactId, year, onClose }: { contactId: string; year: string | null; onClose: () => void }) {
  const { data: contact, isLoading } = useGetContact(contactId);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {isLoading && <p className="meta drawer-pad">Loading…</p>}
        {!isLoading && !contact && <p className="meta drawer-pad">Contact not found (or no access).</p>}
        {contact && <BirthdayBody contact={contact} year={year} />}
      </aside>
    </div>
  );
}

function BirthdayBody({ contact, year }: { contact: ContactDto; year: string | null }) {
  const b = contact.birthday ?? null;
  const { year: birthYear, month, day } = b ?? { year: null, month: 0, day: 0 };
  // Reconstruct the occurrence from the contact's authoritative month/day; a deep link without a year
  // falls back to the next upcoming birthday.
  const clickedYear = year ? Number(year) : null;
  const onDate = b
    ? clickedYear != null
      ? new Date(clickedYear, month - 1, day)
      : nextBirthday(month, day, new Date())
    : null;
  const age = onDate ? turningAge(birthYear, onDate) : null;
  const verb = contact.deceased ? 'Would have turned' : 'Turning';

  return (
    <div className="drawer-pad">
      <div className="drawer-title-row">
        <span className="kind-icon" title="Birthday">
          🎂
        </span>
        <h2 className="field-value">{contact.displayName}</h2>
      </div>

      <section className="drawer-section">
        <h3>Birthday</h3>
        {b ? <p className="field-value">{fmtPartialDate(b)}</p> : <p className="meta">Unknown.</p>}
        {age != null && onDate && (
          <p className="field-value">
            {verb} {age} on {fmtDate(onDate)}
          </p>
        )}
      </section>

      <Link className="linklike" to={`/contacts/${contact.id}`}>
        View contact →
      </Link>
    </div>
  );
}
