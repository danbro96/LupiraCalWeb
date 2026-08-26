import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useGetContact } from '../../../data/api-contact/lupiraContactApi';
import type { ContactDto } from '../../../data/api-contact/models';
import { nextBirthday, turningAge } from '@lupira/cal-domain/birthday';
import { fmtDate } from '@lupira/cal-domain/time';
import { fmtPartialDate } from '@lupira/cal-domain/partialDate';
import { DetailDrawer } from './DetailDrawer';
import { DrawerSection } from '../DrawerSection';

/** Read-only view for a birthday occurrence (a contact projection, not a stored item): the birthday date,
 *  the age the contact is turning when known, and a link to the contact. `year` is the clicked occurrence's year. */
export function BirthdayCard({ contactId, year, onClose }: { contactId: string; year: string | null; onClose: () => void }) {
  const { data: contact, isLoading } = useGetContact(contactId);

  return (
    <DetailDrawer onClose={onClose}>
      {isLoading && <p className="meta drawer-pad">Loading…</p>}
      {!isLoading && !contact && <p className="meta drawer-pad">Contact not found (or no access).</p>}
      {contact && <BirthdayBody contact={contact} year={year} />}
    </DetailDrawer>
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
        <Typography component="h2" sx={{ mb: 1, color: 'text.secondary' }}>{contact.displayName}</Typography>
      </div>

      <DrawerSection title="Birthday">
        {b ? <Typography component="p" sx={{ mb: 1, color: 'text.secondary' }}>{fmtPartialDate(b)}</Typography> : <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Unknown.</Typography>}
        {age != null && onDate && (
          <Typography component="p" sx={{ mb: 1, color: 'text.secondary' }}>
            {verb} {age} on {fmtDate(onDate)}
          </Typography>
        )}
      </DrawerSection>

      <Button variant="text" component={Link} to={`/contacts/${contact.id}`}>
        View contact →
      </Button>
    </div>
  );
}
