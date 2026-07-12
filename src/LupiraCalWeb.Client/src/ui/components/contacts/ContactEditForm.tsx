import { useState } from 'react';
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
import { ContactAddressType, ReachMedium } from '../../../data/api-contact/models';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { errText } from '../errText';
import { inputToPartialDate, partialDateKey, partialDateToInput } from './partialDate';

const norm = (s?: string | null) => (s ?? '').trim();
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

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
            <span key={`${v}-${i}`} className="tag-chip">
              {v}
              <button type="button" className="chip-x" title="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="form-row">
        <input
          className="text-input"
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
        <button type="button" className="btn" onClick={commit} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

/** Inline editor for a contact's fields. Scalars go through the merge update; the multi-valued fields use the
 *  wholesale-replace endpoints so entries can be removed. A single Save fans out only to the sections that changed. */
export function ContactEditForm({ contact, onDone }: { contact: ContactDto; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
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
  const [birthday, setBirthday] = useState(partialDateToInput(contact.birthday));
  const [birthdayYearKnown, setBirthdayYearKnown] = useState(contact.birthday?.year != null);
  const [channels, setChannelsState] = useState<ContactReachChannel[]>(contact.channels.map((c) => ({ ...c })));
  const [tags, setTagsState] = useState<string[]>(contact.tags ?? []);
  const [addresses, setAddressesState] = useState<ContactPostalAddress[]>(contact.addresses.map((a) => ({ ...a })));
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
      const nextBirthday = inputToPartialDate(birthday, birthdayYearKnown);
      if (partialDateKey(nextBirthday) !== partialDateKey(contact.birthday)) rev.birthday = nextBirthday;
      if (Object.keys(rev).length > 0) await revise.mutateAsync({ id, data: rev });

      const cleanChannels = channels.filter((c) => c.value.trim()).map((c) => ({ ...c, value: c.value.trim() }));
      if (JSON.stringify(cleanChannels) !== JSON.stringify(contact.channels)) await setChannels.mutateAsync({ id, data: { channels: cleanChannels } });
      if (!sameList(tags, contact.tags ?? [])) await setTags.mutateAsync({ id, data: { tags } });

      const cleanAddresses = addresses.filter((a) => a.placeId || norm(a.formattedAddress));
      if (JSON.stringify(cleanAddresses) !== JSON.stringify(contact.addresses))
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
      setError(errText(e) ?? 'Save failed.');
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
        <input className="text-input" value={givenName} onChange={(e) => setGivenName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Middle name</label>
        <input className="text-input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Family name</label>
        <input className="text-input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Nickname</label>
        <input className="text-input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <div className="edit-field">
        <label>Birthday</label>
        <input className="text-input" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <label className="meta">
          <input type="checkbox" checked={!birthdayYearKnown} onChange={(e) => setBirthdayYearKnown(!e.target.checked)} disabled={!birthday} /> Year unknown
        </label>
      </div>

      <div className="edit-field">
        <label>Reach channels</label>
        {channels.map((c, i) => (
          <div key={i} className="form-row">
            <select
              value={c.medium}
              onChange={(e) => setChannelsState(channels.map((x, j) => (j === i ? { ...x, medium: e.target.value as ReachMedium } : x)))}
            >
              {Object.values(ReachMedium).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              className="text-input"
              placeholder={c.medium === ReachMedium.Phone ? '+46…' : 'name@example.com'}
              value={c.value}
              onChange={(e) => setChannelsState(channels.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
            <input
              className="text-input"
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
            <button type="button" className="icon-btn" title="Remove channel" onClick={() => setChannelsState(channels.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="linklike"
          onClick={() => setChannelsState([...channels, { medium: ReachMedium.Email, value: '', type: null, preferred: false }])}
        >
          + Add channel
        </button>
      </div>

      <ChipList label="Tags" values={tags} onChange={setTagsState} placeholder="work, family…" />

      <div className="edit-field">
        <label>Addresses</label>
        {addresses.map((a, i) => (
          <div key={i} className="form-row">
            <select
              value={a.type ?? ContactAddressType.Home}
              onChange={(e) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, type: e.target.value as ContactAddressType } : x)))}
            >
              {Object.values(ContactAddressType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="text-input"
              placeholder="Street, city…"
              value={a.formattedAddress ?? ''}
              onChange={(e) => setAddressesState(addresses.map((x, j) => (j === i ? { ...x, formattedAddress: e.target.value } : x)))}
            />
            <button type="button" className="icon-btn" title="Remove address" onClick={() => setAddressesState(addresses.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="linklike" onClick={() => setAddressesState([...addresses, { type: ContactAddressType.Home, formattedAddress: '' }])}>
          + Add address
        </button>
      </div>

      <div className="edit-field">
        <label>Social profiles</label>
        {profiles.map((p, i) => (
          <div key={i} className="form-row">
            <input
              className="text-input"
              placeholder="service (telegram…)"
              value={p.service ?? ''}
              onChange={(e) => setProfilesState(profiles.map((x, j) => (j === i ? { ...x, service: e.target.value } : x)))}
            />
            <input
              className="text-input"
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
            <button type="button" className="icon-btn" title="Remove profile" onClick={() => setProfilesState(profiles.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="linklike" onClick={() => setProfilesState([...profiles, { service: '', handle: '', preferred: false }])}>
          + Add profile
        </button>
      </div>

      <div className="edit-field">
        <label>Emergency contacts</label>
        <p className="meta">In priority order — who to call about this person.</p>
        {emergency.map((cid, i) => (
          <div key={cid} className="membership-row">
            <span className="badge">{i + 1}</span>
            <span className="membership-name">{nameOf(cid)}</span>
            <button type="button" className="icon-btn" title="Remove" onClick={() => setEmergencyState(emergency.filter((x) => x !== cid))}>
              ×
            </button>
          </div>
        ))}
        {emergencyPickable.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) setEmergencyState([...emergency, e.target.value]);
            }}
          >
            <option value="">Add emergency contact…</option>
            {emergencyPickable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="edit-field">
        <label className="meta">
          <input type="checkbox" checked={deceased} onChange={(e) => setDeceased(e.target.checked)} /> Deceased
        </label>
        {deceased && (
          <input className="text-input" type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      <div className="edit-actions">
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn" type="button" onClick={onDone} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
