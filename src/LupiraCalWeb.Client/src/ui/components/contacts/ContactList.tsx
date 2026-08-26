import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { NavLink, useLocation, useMatch, useSearchParams } from 'react-router-dom';
import { useCreateContact, useSetContactTags } from '../../../data/api-contact/lupiraContactApi';
import type { ContactDto, ContactReachChannel } from '../../../data/api-contact/models';
import { ReachMedium } from '../../../data/api-contact/models';
import { PINNED_TAG, isPinned } from '@lupira/cal-domain/contactTiers';
import { addressBookLabel, useAddressBooks } from '../../../state/useAddressBooks';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { useTieredContacts } from '../../../state/useTieredContacts';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';
import { inputToPartialDate, partialDateBadge } from '@lupira/cal-domain/partialDate';
import { useGroup } from './useGroup';
import { FormRow } from '../FormRow';

/** Split a comma-separated input into reach channels of one medium (create-form convenience). */
function toChannels(raw: string, medium: ReachMedium): ContactReachChannel[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => ({ medium, value, type: null, preferred: false }));
}

/** Middle pane: search + the contact rows, filtered by the selected book (?book) and, when a
 *  group is open, narrowed to that group's members (client-side — the API has no group filter). */
export function ContactList() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const bookId = params.get('book') ?? '';
  const query = params.get('q') ?? '';
  const groupId = useMatch('/contacts/groups/:groupId')?.params.groupId;
  const group = useGroup(bookId || undefined, groupId);

  const { addressBooks } = useAddressBooks();
  const { active, dormant, contacts, isLoading } = useTieredContacts({
    query: query || undefined,
    addressBookId: bookId || undefined,
  });
  const [creating, setCreating] = useState(false);
  const [showDormant, setShowDormant] = useState(false);

  // A text query or an open group already narrows the set — show one flat, untiered list then.
  const bypassTiers = !!query || !!groupId;
  const flatRows = groupId ? contacts.filter((c) => group?.members.some((m) => m.contactId === c.id)) : contacts;

  const setQuery = (q: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (q) next.set('q', q);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );

  return (
    <div className="contacts-list-pane">
      <div className="list-pane-head">
        <TextField placeholder="Search names…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="contained" onClick={() => setCreating((c) => !c)}>
          + New
        </Button>
      </div>
      {creating && <NewContactForm defaultBookId={bookId || addressBooks[0]?.id} onDone={() => setCreating(false)} />}
      <div className="contact-list">
        {bypassTiers ? (
          <>
            {flatRows.map((c) => (
              <ContactRow key={c.id} contact={c} search={location.search} />
            ))}
            {flatRows.length === 0 && <p className="empty">No contacts.</p>}
          </>
        ) : (
          <>
            {active.map((c) => (
              <ContactRow key={c.id} contact={c} search={location.search} />
            ))}
            {active.length === 0 && dormant.length === 0 && !isLoading && <p className="empty">No contacts.</p>}
            {dormant.length > 0 && (
              <div className="contact-section">
                <button className="contact-section-head" onClick={() => setShowDormant((s) => !s)}>
                  {showDormant ? '▾' : '▸'} Dormant ({dormant.length})
                </button>
                {showDormant && dormant.map((c) => <ContactRow key={c.id} contact={c} search={location.search} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** One contact row + a pin toggle (⭐ = a reserved tag that keeps the contact in the Active tier). */
function ContactRow({ contact: c, search }: { contact: ContactDto; search: string }) {
  const invalidate = useInvalidateContacts();
  const showSnack = useSnackbar();
  const setTags = useSetContactTags({
    mutation: { onSuccess: invalidate, onError: (e) => showSnack(errText(e) ?? 'Request failed.') },
  });
  const pinned = isPinned(c);

  const togglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tags = pinned ? (c.tags ?? []).filter((t) => t !== PINNED_TAG) : [...(c.tags ?? []), PINNED_TAG];
    setTags.mutate({ id: c.id, data: { tags } });
  };

  return (
    <NavLink to={{ pathname: `/contacts/${c.id}`, search }} className="contact-row">
      <button
        className={`pin-btn${pinned ? ' pinned' : ''}`}
        onClick={togglePin}
        title={pinned ? 'Unpin' : 'Pin to keep in Active'}
        aria-label={pinned ? 'Unpin contact' : 'Pin contact'}
      >
        ★
      </button>
      <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        {(c.displayName[0] ?? '?').toUpperCase()}
      </Avatar>
      <span className="contact-name">
        {c.displayName}
        {c.nickname && c.nickname !== c.displayName ? <Typography variant="caption" sx={{ color: 'text.secondary' }}> “{c.nickname}”</Typography> : null}
      </span>
      {c.birthday && <Chip variant="outlined" label={`🎂 ${partialDateBadge(c.birthday)}`} />}
      {c.completeness && (
        <span className="completeness-bar" title={`Completeness ${Math.round(c.completeness.score * 100)}%`}>
          <span style={{ width: `${Math.round(c.completeness.score * 100)}%` }} />
        </span>
      )}
    </NavLink>
  );
}

function NewContactForm({ defaultBookId, onDone }: { defaultBookId?: string; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
  const showSnack = useSnackbar();
  const create = useCreateContact({
    mutation: { onSuccess: () => { invalidate(); onDone(); }, onError: (e) => showSnack(errText(e) ?? 'Request failed.') },
  });
  const { addressBooks } = useAddressBooks();
  const [form, setForm] = useState({
    addressBookId: defaultBookId ?? '',
    givenName: '',
    familyName: '',
    nickname: '',
    emails: '',
    phones: '',
    birthday: '',
    birthdayYearKnown: true,
    birthdayMonth: '',
    birthdayDay: '',
  });

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        const channels = [...toChannels(form.emails, ReachMedium.Email), ...toChannels(form.phones, ReachMedium.Phone)];
        create.mutate({
          data: {
            addressBookId: form.addressBookId,
            givenName: form.givenName || null,
            familyName: form.familyName || null,
            nickname: form.nickname || null,
            channels: channels.length ? channels : null,
            birthday: form.birthdayYearKnown
              ? inputToPartialDate(form.birthday, true)
              : (form.birthdayMonth && form.birthdayDay
                ? { year: null, month: Number(form.birthdayMonth), day: Number(form.birthdayDay) }
                : null),
          },
        });
      }}
    >
      <FormRow>
        <TextField select value={form.addressBookId} onChange={(e) => setForm({ ...form, addressBookId: e.target.value })} required slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Address book…</MenuItem>
          {addressBooks.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {addressBookLabel(b)}
            </MenuItem>
          ))}
        </TextField>
      </FormRow>
      <FormRow>
        <TextField placeholder="Given name" value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} />
        <TextField placeholder="Family name" value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} />
      </FormRow>
      <FormRow>
        <TextField placeholder="Nickname" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }} component="label">
          <input
            type="checkbox"
            checked={form.birthdayYearKnown}
            onChange={(e) => setForm({ ...form, birthdayYearKnown: e.target.checked, birthday: '', birthdayMonth: '', birthdayDay: '' })}
          />{' '}
          Enter year
        </Typography>
        {form.birthdayYearKnown ? (
          <Tooltip title="Birthday">
            <TextField type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          </Tooltip>
        ) : (
          <>
            <TextField type="number" slotProps={{ htmlInput: { min: 1, max: 12 } }} placeholder="Birth month" value={form.birthdayMonth} onChange={(e) => setForm({ ...form, birthdayMonth: e.target.value })} />
            <TextField type="number" slotProps={{ htmlInput: { min: 1, max: 31 } }} placeholder="Birth day" value={form.birthdayDay} onChange={(e) => setForm({ ...form, birthdayDay: e.target.value })} />
          </>
        )}
      </FormRow>
      <FormRow>
        <TextField placeholder="Emails (comma-separated)" value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} />
        <TextField placeholder="Phones (comma-separated)" value={form.phones} onChange={(e) => setForm({ ...form, phones: e.target.value })} />
      </FormRow>
      <div className="chip-row">
        <Button variant="contained" type="submit" disabled={create.isPending}>
          Create
        </Button>
        <Button variant="outlined" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
