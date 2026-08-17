import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
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
import { fuzzyToInput, parseFuzzyInput, residencyStatus } from '@lupira/cal-domain/fuzzyDate';
import { inputToPartialDate, partialDateKey, partialDateToInput } from '@lupira/cal-domain/partialDate';

// placeId stays null in drafts until a place is picked; save filters those rows out.
type AddressDraft = Omit<ContactPostalAddress, 'placeId'> & { placeId: string | null; movedInText: string; movedOutText: string };

type ContactFormValues = {
  givenName: string;
  middleName: string;
  familyName: string;
  nickname: string;
  displayNameFormat: DisplayNameFormat;
  birthdayYearKnown: boolean;
  birthday: string;
  birthdayMonth: string;
  birthdayDay: string;
  channels: ContactReachChannel[];
  tags: string[];
  addresses: AddressDraft[];
  profiles: ContactSocialProfile[];
  emergency: string[];
  deceased: boolean;
  deathDate: string;
};

/** Null-vs-undefined and key-order insensitive shape for the addresses change diff. */
function normAddr(a: Omit<ContactPostalAddress, 'placeId'> & { placeId?: string | null }) {
  return { placeId: a.placeId ?? null, type: a.type, movedIn: fuzzyToInput(a.movedIn), movedOut: fuzzyToInput(a.movedOut) };
}

function AddressStatusHint({ movedInText, movedOutText }: { movedInText: string; movedOutText: string }) {
  const status = residencyStatus(
    movedInText.trim() ? parseFuzzyInput(movedInText) : null,
    movedOutText.trim() ? parseFuzzyInput(movedOutText) : null,
  );
  return status === 'active' ? null : <span className="meta">{status === 'former' ? 'former' : 'upcoming'}</span>;
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

  const yearKnownInitial = contact.birthday == null || contact.birthday.year != null;
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<ContactFormValues>({
    defaultValues: {
      givenName: contact.givenName ?? '',
      middleName: contact.middleName ?? '',
      familyName: contact.familyName ?? '',
      nickname: contact.nickname ?? '',
      displayNameFormat: contact.displayNameFormat ?? DisplayNameFormat.Full,
      birthdayYearKnown: yearKnownInitial,
      birthday: yearKnownInitial ? partialDateToInput(contact.birthday) : '',
      birthdayMonth: !yearKnownInitial && contact.birthday ? String(Number(contact.birthday.month)) : '',
      birthdayDay: !yearKnownInitial && contact.birthday ? String(Number(contact.birthday.day)) : '',
      channels: contact.channels.map((c) => ({ ...c })),
      tags: (contact.tags ?? []).filter((t) => t !== PINNED_TAG),
      // Residency dates are edited as text ("2015", "2015-06", "2015-06-12" — precision = certainty) and
      // parsed at save; a filled moved-out marks the address as former.
      addresses: contact.addresses.map((a) => ({
        ...a,
        movedInText: fuzzyToInput(a.movedIn),
        movedOutText: fuzzyToInput(a.movedOut),
      })),
      profiles: contact.profiles.map((p) => ({ ...p })),
      emergency: [...contact.emergencyContactIds],
      deceased: !!contact.deceased,
      deathDate: contact.deathDate ?? '',
    },
  });
  const { fields: channelFields, append: appendChannel, remove: removeChannel } = useFieldArray({ control, name: 'channels' });
  const { fields: addressFields, append: appendAddress, remove: removeAddress } = useFieldArray({ control, name: 'addresses' });
  const { fields: profileFields, append: appendProfile, remove: removeProfile } = useFieldArray({ control, name: 'profiles' });
  const birthdayYearKnown = watch('birthdayYearKnown');
  const watchedChannels = watch('channels');
  const watchedAddresses = watch('addresses');
  const deceased = watch('deceased');

  const id = contact.id;
  const nameOf = (cid: string) => bookContacts?.find((c) => c.id === cid)?.displayName ?? cid.slice(0, 8);

  const save = handleSubmit(async (v) => {
    clearErrors('root');
    try {
      const rev: ReviseContactRequest = {};
      if (norm(v.givenName) !== norm(contact.givenName)) rev.givenName = v.givenName;
      if (norm(v.middleName) !== norm(contact.middleName)) rev.middleName = v.middleName;
      if (norm(v.familyName) !== norm(contact.familyName)) rev.familyName = v.familyName;
      if (norm(v.nickname) !== norm(contact.nickname)) rev.nickname = v.nickname;
      if (v.displayNameFormat !== (contact.displayNameFormat ?? DisplayNameFormat.Full)) rev.displayNameFormat = v.displayNameFormat;
      const nextBirthday = v.birthdayYearKnown
        ? inputToPartialDate(v.birthday, true)
        : (v.birthdayMonth && v.birthdayDay ? { year: null, month: Number(v.birthdayMonth), day: Number(v.birthdayDay) } : null);
      if (partialDateKey(nextBirthday) !== partialDateKey(contact.birthday)) rev.birthday = nextBirthday;
      if (Object.keys(rev).length > 0) await revise.mutateAsync({ id, data: rev });

      const cleanChannels = v.channels.filter((c) => c.value.trim()).map((c) => ({ ...c, value: c.value.trim() }));
      if (JSON.stringify(cleanChannels) !== JSON.stringify(contact.channels)) await setChannels.mutateAsync({ id, data: { channels: cleanChannels } });
      // The pin sentinel is hidden from the editor — preserve it across an edit.
      const nextTags = (contact.tags ?? []).includes(PINNED_TAG) ? [...v.tags, PINNED_TAG] : v.tags;
      if (!sameList(nextTags, contact.tags ?? [])) await setTags.mutateAsync({ id, data: { tags: nextTags } });

      const cleanAddresses: ContactPostalAddress[] = [];
      for (const a of v.addresses) {
        if (!a.placeId) continue;
        const movedIn = a.movedInText.trim() ? parseFuzzyInput(a.movedInText) : null;
        const movedOut = a.movedOutText.trim() ? parseFuzzyInput(a.movedOutText) : null;
        if ((a.movedInText.trim() && !movedIn) || (a.movedOutText.trim() && !movedOut)) {
          setError('root', { message: 'Residency dates must be YYYY, YYYY-MM, or YYYY-MM-DD.' });
          return;
        }
        cleanAddresses.push({ placeId: a.placeId, type: a.type, movedIn, movedOut });
      }
      if (JSON.stringify(cleanAddresses.map(normAddr)) !== JSON.stringify(contact.addresses.map(normAddr)))
        await setAddresses.mutateAsync({ id, data: { addresses: cleanAddresses } });

      const cleanProfiles = v.profiles.filter((p) => norm(p.service) && norm(p.handle));
      if (JSON.stringify(cleanProfiles) !== JSON.stringify(contact.profiles))
        await setProfiles.mutateAsync({ id, data: { profiles: cleanProfiles } });

      if (!sameList(v.emergency, contact.emergencyContactIds))
        await setEmergency.mutateAsync({ id, data: { contactIds: v.emergency } });

      if (v.deceased !== !!contact.deceased || (v.deceased && v.deathDate !== (contact.deathDate ?? ''))) {
        if (v.deceased) await markDeceased.mutateAsync({ id, data: { deathDate: v.deathDate || null } });
        else await clearDeceased.mutateAsync({ id });
      }

      invalidate();
      onDone();
    } catch (e) {
      showSnack(errText(e) ?? 'Save failed.');
    }
  });

  return (
    <form className="contact-edit" onSubmit={save}>
      <div className="edit-field">
        <Controller name="givenName" control={control} render={({ field }) => <TextField size="small" label="Given name" {...field} />} />
      </div>
      <div className="edit-field">
        <Controller name="middleName" control={control} render={({ field }) => <TextField size="small" label="Middle name" {...field} />} />
      </div>
      <div className="edit-field">
        <Controller name="familyName" control={control} render={({ field }) => <TextField size="small" label="Family name" {...field} />} />
      </div>
      <div className="edit-field">
        <Controller name="nickname" control={control} render={({ field }) => <TextField size="small" label="Nickname" {...field} />} />
      </div>
      <div className="edit-field">
        <Controller
          name="displayNameFormat"
          control={control}
          render={({ field }) => (
            <TextField select size="small" label="Display as" {...field}>
              {Object.values(DisplayNameFormat).map((f) => (
                <MenuItem key={f} value={f}>
                  {DISPLAY_NAME_FORMAT_LABELS[f]}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </div>
      <div className="edit-field">
        <label>Birthday</label>
        <Controller
          name="birthdayYearKnown"
          control={control}
          render={({ field }) => (
            <label className="meta">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => {
                  field.onChange(e.target.checked);
                  setValue('birthday', '');
                  setValue('birthdayMonth', '');
                  setValue('birthdayDay', '');
                }}
              />{' '}
              Enter year
            </label>
          )}
        />
        {birthdayYearKnown ? (
          <Controller name="birthday" control={control} render={({ field }) => <TextField size="small" type="date" {...field} />} />
        ) : (
          <div className="form-row">
            <Controller
              name="birthdayMonth"
              control={control}
              render={({ field }) => (
                <TextField size="small" type="number" slotProps={{ htmlInput: { min: 1, max: 12 } }} placeholder="Month" {...field} />
              )}
            />
            <Controller
              name="birthdayDay"
              control={control}
              render={({ field }) => (
                <TextField size="small" type="number" slotProps={{ htmlInput: { min: 1, max: 31 } }} placeholder="Day" {...field} />
              )}
            />
          </div>
        )}
      </div>

      <div className="edit-field">
        <label>Reach channels</label>
        {channelFields.map((f, i) => (
          <div key={f.id} className="form-row">
            <Controller
              name={`channels.${i}.medium`}
              control={control}
              render={({ field }) => (
                <TextField select size="small" {...field}>
                  {Object.values(ReachMedium).map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name={`channels.${i}.value`}
              control={control}
              render={({ field }) => (
                <TextField
                  size="small"
                  placeholder={watchedChannels[i]?.medium === ReachMedium.Phone ? '+46…' : 'name@example.com'}
                  {...field}
                />
              )}
            />
            <Controller
              name={`channels.${i}.type`}
              control={control}
              render={({ field }) => (
                <TextField
                  size="small"
                  placeholder="type (home/work…)"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              )}
            />
            <Controller
              name={`channels.${i}.preferred`}
              control={control}
              render={({ field }) => (
                <label className="meta">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      if (e.target.checked) {
                        const medium = getValues(`channels.${i}.medium`);
                        getValues('channels').forEach((x, j) => {
                          if (j !== i && x.medium === medium) setValue(`channels.${j}.preferred`, false); // ≤1 preferred per medium
                        });
                      }
                    }}
                  />{' '}
                  preferred
                </label>
              )}
            />
            <Tooltip title="Remove channel">
              <IconButton size="small" onClick={() => removeChannel(i)}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button
          variant="text"
          size="small"
          onClick={() => appendChannel({ medium: ReachMedium.Email, value: '', type: null, preferred: false })}
        >
          + Add channel
        </Button>
      </div>

      <Controller
        name="tags"
        control={control}
        render={({ field }) => <ChipList label="Tags" values={field.value} onChange={field.onChange} placeholder="work, family…" />}
      />

      <div className="edit-field">
        <label>Addresses</label>
        {addressFields.map((f, i) => (
          <div key={f.id} className="form-row">
            <Controller
              name={`addresses.${i}.type`}
              control={control}
              render={({ field }) => (
                <TextField select size="small" value={field.value ?? ContactAddressType.Home} onChange={field.onChange}>
                  {Object.values(ContactAddressType).map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name={`addresses.${i}.placeId`}
              control={control}
              render={({ field }) => <PlacePicker placeId={field.value ?? null} placeholder="Street, city…" onChange={field.onChange} />}
            />
            <Controller
              name={`addresses.${i}.movedInText`}
              control={control}
              render={({ field }) => (
                <Tooltip title="Moved in — YYYY, YYYY-MM, or YYYY-MM-DD; as precise as actually known">
                  <TextField size="small" placeholder="Moved in" {...field} />
                </Tooltip>
              )}
            />
            <Controller
              name={`addresses.${i}.movedOutText`}
              control={control}
              render={({ field }) => (
                <Tooltip title="Moved out — filling this marks the address as former">
                  <TextField size="small" placeholder="Moved out" {...field} />
                </Tooltip>
              )}
            />
            <AddressStatusHint
              movedInText={watchedAddresses[i]?.movedInText ?? ''}
              movedOutText={watchedAddresses[i]?.movedOutText ?? ''}
            />
            <Tooltip title="Remove address">
              <IconButton size="small" onClick={() => removeAddress(i)}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button
          variant="text"
          size="small"
          onClick={() => appendAddress({ type: ContactAddressType.Home, placeId: null, movedInText: '', movedOutText: '' })}
        >
          + Add address
        </Button>
      </div>

      <div className="edit-field">
        <label>Social profiles</label>
        {profileFields.map((f, i) => (
          <div key={f.id} className="form-row">
            <Controller
              name={`profiles.${i}.service`}
              control={control}
              render={({ field }) => (
                <TextField size="small" placeholder="service (telegram…)" value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
            <Controller
              name={`profiles.${i}.handle`}
              control={control}
              render={({ field }) => (
                <TextField size="small" placeholder="handle" value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
            <Controller
              name={`profiles.${i}.preferred`}
              control={control}
              render={({ field }) => (
                <label className="meta">
                  <input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} /> preferred
                </label>
              )}
            />
            <Tooltip title="Remove profile">
              <IconButton size="small" onClick={() => removeProfile(i)}>
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        <Button variant="text" size="small" onClick={() => appendProfile({ service: '', handle: '', preferred: false })}>
          + Add profile
        </Button>
      </div>

      <div className="edit-field">
        <label>Emergency contacts</label>
        <p className="meta">In priority order — who to call about this person.</p>
        <Controller
          name="emergency"
          control={control}
          render={({ field }) => {
            const emergencyPickable = (bookContacts ?? []).filter((c) => c.id !== id && !field.value.includes(c.id));
            return (
              <>
                {field.value.map((cid, i) => (
                  <div key={cid} className="membership-row">
                    <Chip size="small" variant="outlined" label={i + 1} />
                    <span className="membership-name">{nameOf(cid)}</span>
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={() => field.onChange(field.value.filter((x) => x !== cid))}>
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
                      if (e.target.value) field.onChange([...field.value, e.target.value]);
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
              </>
            );
          }}
        />
      </div>

      <div className="edit-field">
        <Controller
          name="deceased"
          control={control}
          render={({ field }) => (
            <label className="meta">
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} /> Deceased
            </label>
          )}
        />
        {deceased && (
          <Controller name="deathDate" control={control} render={({ field }) => <TextField size="small" type="date" {...field} />} />
        )}
      </div>

      {errors.root && <p className="error-text">{errors.root.message}</p>}
      <div className="edit-actions">
        <Button variant="contained" size="small" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outlined" size="small" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
