import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import {
  useClearContactDeceased,
  useMarkContactDeceased,
  useReviseContact,
  useSearchContacts,
  useSetContactAddresses,
  useSetContactChannels,
  useSetContactProfiles,
  useSetContactTags,
  useSetEmergencyContacts,
} from '../../../data/api-contact/lupiraContactApi';
import type {
  ContactDto,
  ContactPostalAddress,
  ContactReachChannel,
  ContactSocialProfile,
  ReviseContactRequest,
} from '../../../data/api-contact/models';
import { ContactAddressType, DisplayNameFormat, ReachMedium } from '../../../data/api-contact/models';
import { PINNED_TAG } from '@lupira/cal-domain/contactTiers';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { PlacePicker } from '../places/PlacePicker';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';
import { fuzzyToInput, parseFuzzyInput } from '@lupira/cal-domain/fuzzyDate';
import { inputToPartialDate, partialDateKey, partialDateToInput } from '@lupira/cal-domain/partialDate';

// placeId stays null in drafts until a place is picked; save filters those rows out.
type AddressDraft = Omit<ContactPostalAddress, 'placeId'> & { placeId: string | null; movedInText: string; movedOutText: string };

/** Null-vs-undefined and key-order insensitive shape for the addresses change diff. */
function normAddr(a: Omit<ContactPostalAddress, 'placeId'> & { placeId?: string | null }) {
  return { placeId: a.placeId ?? null, type: a.type, movedIn: fuzzyToInput(a.movedIn), movedOut: fuzzyToInput(a.movedOut) };
}

const norm = (s?: string | null) => (s ?? '').trim();
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

const DISPLAY_NAME_FORMAT_LABELS: Record<DisplayNameFormat, string> = {
  [DisplayNameFormat.Full]: 'Full name',
  [DisplayNameFormat.FirstLast]: 'First & last',
  [DisplayNameFormat.NickName]: 'Nickname',
};

/** Add/remove editor for a simple string list (tags). */
function ChipList({ label, values, onChange, placeholder, inputType = 'text' }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  inputType?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="edit-field">
      <label>{label}</label>
      {values.length > 0 && (
        <div className="chip-row">
          {values.map((v, i) => (
            <Chip key={`${v}-${i}`} size="small" label={v} onDelete={() => onChange(values.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div className="form-row">
        <TextField
          size="small"
          type={inputType}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Button variant="outlined" size="small" onClick={commit} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

/** Inline editor for a contact's fields. Scalars go through the merge update; the multi-valued fields use the
 *  wholesale-replace endpoints so entries can be removed. A single Save fans out only to the sections that changed. */
export function ContactEditForm({ contact, onDone }: { contact: ContactDto; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
  const showSnack = useSnackbar();
  const revise = useReviseContact();
  const setChannels = useSetContactChannels();
  const setTags = useSetContactTags();
  const setAddresses = useSetContactAddresses();
  const setProfiles = useSetContactProfiles();
  const setEmergency = useSetEmergencyContacts();
  const markDeceased = useMarkContactDeceased();
  const clearDeceased = useClearContactDeceased();
  const { data: bookContacts } = useSearchContacts({ addressBookId: contact.addressBookId });

  const [givenName, setGivenName] = useState(contact.givenName ?? '');
  const [middleName, setMiddleName] = useState(contact.middleName ?? '');
  const [familyName, setFamilyName] = useState(contact.familyName ?? '');
  const [nickname, setNickname] = useState(contact.nickname ?? '');
  const [displayNameFormat, setDisplayNameFormat] = useState(contact.displayNameFormat ?? DisplayNameFormat.Full);
  const yearKnownInitial = contact.birthday == null || contact.birthday.year != null;
  const [birthday, setBirthday] = useState(yearKnownInitial ? partialDateToInput(contact.birthday) : '');
  const [birthdayYearKnown, setBirthdayYearKnown] = useState(yearKnownInitial);
  const [birthdayMonth, setBirthdayMonth] = useState(!yearKnownInitial && contact.birthday ? String(Number(contact.birthday.month)) : '');
  const [birthdayDay, setBirthdayDay] = useState(!yearKnownInitial && contact.birthday ? String(Number(contact.birthday.day)) : '');
  const [channels, setChannelsState] = useState<ContactReachChannel[]>(contact.channels.map((c) => ({ ...c })));
  const [tags, setTagsState] = useState<string[]>((contact.tags ?? []).filter((t) => t !== PINNED_TAG));
  // Residency dates are edited as text ("2015", "2015-06", "2015-06-12" — precision = certainty) and
  // parsed at save; a filled moved-out marks the address as former.
  const [addresses, setAddressesState] = useState<AddressDraft[]>(contact.addresses.map((a) => ({
    ...a,
    movedInText: fuzzyToInput(a.movedIn),
    movedOutText: fuzzyToInput(a.movedOut),
  })));
  const [profiles, setProfilesState] = useState<ContactSocialProfile[]>(contact.profiles.map((p) => ({ ...p })));
  const [emergency, setEmergencyState] = useState<string[]>([...contact.emergencyContactIds]);
  const [deceased, setDeceased] = useState(!!contact.deceased);
  const [deathDate, setDeathDate] = useState(contact.deathDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = contact.id;
  const nameOf = (cid: string) => bookContacts?.find((c) => c.id === cid)?.displayName ?? cid.slice(0, 8);
  const emergencyPickable = (bookContacts ?? []).filter((c) => c.id !== id && !emergency.includes(c.id));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const rev: ReviseContactRequest = {};
      if (norm(givenName) !== norm(contact.givenName)) rev.givenName = givenName;
      if (norm(middleName) !== norm(contact.middleName)) rev.middleName = middleName;
      if (norm(familyName) !== norm(contact.familyName)) rev.familyName = familyName;
      if (norm(nickname) !== norm(contact.nickname)) rev.nickname = nickname;
      if (displayNameFormat !== (contact.displayNameFormat ?? DisplayNameFormat.Full)) rev.displayNameFormat = displayNameFormat;
      const nextBirthday = birthdayYearKnown
        ? inputToPartialDate(birthday, true)
        : (birthdayMonth && birthdayDay ? { year: null, month: Number(birthdayMonth), day: Number(birthdayDay) } : null);
      if (partialDateKey(nextBirthday) !== partialDateKey(contact.birthday)) rev.birthday = nextBirthday;
      if (Object.keys(rev).length > 0) await revise.mutateAsync({ id, data: rev });

      const cleanChannels = channels.filter((c) => c.value.trim()).map((c) => ({ ...c, value: c.value.trim() }));
      if (JSON.stringify(cleanChannels) !== JSON.stringify(contact.channels)) await setChannels.mutateAsync({ id, data: { channels: cleanChannels } });
      // The pin sentinel is hidden from the editor — preserve it across an edit.
      const nextTags = (contact.tags ?? []).includes(PINNED_TAG) ? [...tags, PINNED_TAG] : tags;
      if (!sameList(nextTags, contact.tags ?? [])) await setTags.mutateAsync({ id, data: { tags: nextTags } });

      const cleanAddresses: ContactPostalAddress[] = [];
      for (const a of addresses) {
        if (!a.placeId) continue;
        const movedIn = a.movedInText.trim() ? parseFuzzyInput(a.movedInText) : null;
        const movedOut = a.movedOutText.trim() ? parseFuzzyInput(a.movedOutText) : null;
        if ((a.movedInText.trim() && !movedIn) || (a.movedOutText.trim() && !movedOut)) {
          setError('Residency dates must be YYYY, YYYY-MM, or YYYY-MM-DD.');
          setSaving(false);
          return;
        }
        cleanAddresses.push({ placeId: a.placeId, type: a.type, movedIn, movedOut });
      }
      if (JSON.stringify(cleanAddresses.map(normAddr)) !== JSON.stringify(contact.addresses.map(normAddr)))
        await setAddresses.mutateAsync({ id, data: { addresses: cleanAddresses } });

      const cleanProfiles = profiles.filter((p) => norm(p.service) && norm(p.handle));
      if (JSON.stringify(cleanProfiles) !== JSON.stringify(contact.profiles))
        await setProfiles.mutateAsync({ id, data: { profiles: cleanProfiles } });

      if (!sameList(emergency, contact.emergencyContactIds))
        await setEmergency.mutateAsync({ id, data: { contactIds: emergency } });

      if (deceased !== !!contact.deceased || (deceased && deathDate !== (contact.deathDate ?? ''))) {
        if (deceased) await markDeceased.mutateAsync({ id, data: { deathDate: deathDate || null } });
        else await clearDeceased.mutateAsync({ id });
      }

      invalidate();
      onDone();
    } catch (e) {
      showSnack(errText(e) ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="contact-edit"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="edit-field">
        <label>Given name</label>
        <TextField size="small" value={givenName} onChange={(e) => setGivenName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Middle name</label>
        <TextField size="small" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Family name</label>
        <TextField size="small" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Nickname</label>
        <TextField size="small" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Display as</label>
        <TextField select size="small" value={displayNameFormat} onChange={(e) => setDisplayNameFormat(e.target.value as DisplayNameFormat)}>
          {Object.values(DisplayNameFormat).map((f) => (
            <MenuItem key={f} value={f}>
              {DISPLAY_NAME_FORMAT_LABELS[f]}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <div className="edit-field">
        <label>Birthday</label>
        <label className="meta">
          <input
            type="checkbox"
            checked={birthdayYearKnown}
            onChange={(e) => {
              setBirthdayYearKnown(e.target.checked);
              setBirthday('');
              setBirthdayMonth('');
              setBirthdayDay('');
            }}
          />{' '}
          Enter year
        </label>
        {birthdayYearKnown ? (
          <TextField size="small" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        ) : (
          <div className="form-row">
            <TextField size="small" type="number" slotProps={{ htmlInput: { min: 1, max: 12 } }} placeholder="Month" value={birthdayMonth} onChange={(e) => setBirthdayMonth(e.target.value)} />
            <TextField size="small" type="number" slotProps={{ htmlInput: { min: 1, max: 31 } }} placeholder="Day" value={birthdayDay} onChange={(e) => setBirthdayDay(e.target.value)} />
          </div>
        )}
      </div>

      <div className="edit-field">
        <label>Reach channels</label>
        {channels.map((c, i) => (
          <div key={i} className="form-row">
            <TextField
              select
              size="small"
              value={c.medium}
              onChange={(e) => setChannelsState(channels.map((x, j) => (j === i ? { ...x, medium: e.target.value as ReachMedium } : x)))}
            >
              {Object.values(ReachMedium).map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              placeholder={c.medium === ReachMedium.Phone ? '+46…' : 'name@example.com'}
              value={c.value}
              onChange={(e) => setChannelsState(channels.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <TextField
              size="small"
              placeholder="type (home/work…)"
              value={c.type ?? ''}
              onChange={(e) => setChannelsState(channels.map((x, j) => (j === i ? { ...x, type: e.target.value || null } : x)))}
            />
            <label className="meta">
              <input
                type="checkbox"
                checked={c.preferred}
                onChange={(e) =>
                  setChannelsState(
                    channels.map((x, j) =>
                      j === i
                        ? { ...x, preferred: e.target.checked }
                        : e.target.checked && x.medium === c.medium
                          ? { ...x, preferred: false } // ≤1 preferred per medium
                          : x,
                    ),
                  )
                }
              />{' '}
              preferred
            </label>
            <Tooltip title="Remove channel">
              <IconButton size="small" onClick={() => setChannelsState(channels.filter((_, j) => j !== i))}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button
          variant="text"
          size="small"
          onClick={() => setChannelsState([...channels, { medium: ReachMedium.Email, value: '', type: null, preferred: false }])}
        >
          + Add channel
        </Button>
      </div>

      <ChipList label="Tags" values={tags} onChange={setTagsState} placeholder="work, family…" />

      <div className="edit-field">
        <label>Addresses</label>
        {addresses.map((a, i) => (
          <div key={i} className="form-row">
            <TextField
              select
              size="small"
              value={a.type ?? ContactAddressType.Home}
              onChange={(e) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, type: e.target.value as ContactAddressType } : x)))}
            >
              {Object.values(ContactAddressType).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <PlacePicker
              placeId={a.placeId ?? null}
              placeholder="Street, city…"
              onChange={(placeId) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, placeId } : x)))}
            />
            <Tooltip title="Moved in — YYYY, YYYY-MM, or YYYY-MM-DD; as precise as actually known">
              <TextField
                size="small"
                placeholder="Moved in"
                value={a.movedInText}
                onChange={(e) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, movedInText: e.target.value } : x)))}
              />
            </Tooltip>
            <Tooltip title="Moved out — filling this marks the address as former">
              <TextField
                size="small"
                placeholder="Moved out"
                value={a.movedOutText}
                onChange={(e) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, movedOutText: e.target.value } : x)))}
              />
            </Tooltip>
            {a.movedOutText.trim() !== '' && <span className="meta">former</span>}
            <Tooltip title="Remove address">
              <IconButton size="small" onClick={() => setAddressesState(addresses.filter((_, j) => j !== i))}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button
          variant="text"
          size="small"
          onClick={() => setAddressesState([...addresses, { type: ContactAddressType.Home, placeId: null, movedInText: '', movedOutText: '' }])}
        >
          + Add address
        </Button>
      </div>

      <div className="edit-field">
        <label>Social profiles</label>
        {profiles.map((p, i) => (
          <div key={i} className="form-row">
            <TextField
              size="small"
              placeholder="service (telegram…)"
              value={p.service ?? ''}
              onChange={(e) => setProfilesState(profiles.map((x, j) => (j === i ? { ...x, service: e.target.value } : x)))}
            />
            <TextField
              size="small"
              placeholder="handle"
              value={p.handle ?? ''}
              onChange={(e) => setProfilesState(profiles.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
            />
            <label className="meta">
              <input
                type="checkbox"
                checked={!!p.preferred}
                onChange={(e) => setProfilesState(profiles.map((x, j) => (j === i ? { ...x, preferred: e.target.checked } : x)))}
              />{' '}
              preferred
            </label>
            <Tooltip title="Remove profile">
              <IconButton size="small" onClick={() => setProfilesState(profiles.filter((_, j) => j !== i))}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button variant="text" size="small" onClick={() => setProfilesState([...profiles, { service: '', handle: '', preferred: false }])}>
          + Add profile
        </Button>
      </div>

      <div className="edit-field">
        <label>Emergency contacts</label>
        <p className="meta">In priority order — who to call about this person.</p>
        {emergency.map((cid, i) => (
          <div key={cid} className="membership-row">
            <Chip size="small" variant="outlined" label={i + 1} />
            <span className="membership-name">{nameOf(cid)}</span>
            <Tooltip title="Remove">
              <IconButton size="small" onClick={() => setEmergencyState(emergency.filter((x) => x !== cid))}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        {emergencyPickable.length > 0 && (
          <TextField
            select
            size="small"
            value=""
            onChange={(e) => {
              if (e.target.value) setEmergencyState([...emergency, e.target.value]);
            }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">Add emergency contact…</MenuItem>
            {emergencyPickable.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.displayName}
              </MenuItem>
            ))}
          </TextField>
        )}
      </div>

      <div className="edit-field">
        <label className="meta">
          <input type="checkbox" checked={deceased} onChange={(e) => setDeceased(e.target.checked)} /> Deceased
        </label>
        {deceased && (
          <TextField size="small" type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="edit-actions">
        <Button variant="contained" size="small" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outlined" size="small" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
