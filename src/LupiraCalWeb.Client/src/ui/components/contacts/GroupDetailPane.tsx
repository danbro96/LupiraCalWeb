import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAddContactGroupMember,
  useDeleteContactGroup,
  useRemoveContactGroupMember,
  useRenameContactGroup,
  useSearchContacts,
} from '../../../data/api-contact/lupiraContactApi';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { useGroup } from './useGroup';

/** Right pane for a group/org: members with add/remove, inline rename, delete. */
export function GroupDetailPane() {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const bookId = params.get('book') ?? '';
  const navigate = useNavigate();
  const invalidate = useInvalidateContacts();
  const group = useGroup(bookId || undefined, groupId);
  const { data: bookContacts } = useSearchContacts({ addressBookId: bookId || undefined }, { query: { enabled: !!bookId } });

  const rename = useRenameContactGroup({ mutation: { onSuccess: invalidate } });
  const del = useDeleteContactGroup({ mutation: { onSuccess: () => { invalidate(); navigate('/contacts'); } } });
  const addMember = useAddContactGroupMember({ mutation: { onSuccess: invalidate } });
  const removeMember = useRemoveContactGroupMember({ mutation: { onSuccess: invalidate } });
  const [addId, setAddId] = useState('');

  if (!group) {
    return (
      <div className="contacts-detail-pane">
        <p className="empty">
          {bookId ? 'Group not found.' : 'Open this group from its address book.'}
        </p>
      </div>
    );
  }

  const members = (bookContacts ?? []).filter((c) => group.members.some((m) => m.contactId === c.id));
  const nonMembers = (bookContacts ?? []).filter((c) => !group.members.some((m) => m.contactId === c.id));
  const backSearch = `?book=${bookId}`;

  return (
    <div className="contacts-detail-pane">
      <div className="page-head">
        <h2>
          <Chip size="small" variant="outlined" label={group.kind === 'Organization' ? '🏢 org' : '👥 group'} />{' '}
          <TextField
            size="small"
            variant="standard"
            defaultValue={group.name}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== group.name)
                rename.mutate({ groupId: group.id, params: { name: e.target.value } });
            }}
          />
        </h2>
        <span className="meta">{group.members.length} members</span>
      </div>

      <section className="drawer-section">
        <h3>Members</h3>
        {members.map((c) => (
          <div key={c.id} className="membership-row">
            <span className="avatar">{(c.displayName[0] ?? '?').toUpperCase()}</span>
            <Link className="membership-name" to={{ pathname: `/contacts/${c.id}`, search: backSearch }}>
              {c.displayName}
            </Link>
            <Tooltip title="Remove from group">
              <IconButton
                size="small"
                onClick={() => removeMember.mutate({ groupId: group.id, contactId: c.id })}
              >
                ×
              </IconButton>
            </Tooltip>
          </div>
        ))}
        {members.length === 0 && <p className="meta">No members yet.</p>}
        <div className="form-row">
          <TextField select size="small" value={addId} onChange={(e) => setAddId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Add member…</MenuItem>
            {nonMembers.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.displayName}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            disabled={!addId}
            onClick={() => {
              addMember.mutate({ groupId: group.id, params: { contactId: addId } });
              setAddId('');
            }}
          >
            Add
          </Button>
        </div>
      </section>

      <div className="drawer-footer">
        <Button variant="outlined" color="error" size="small" onClick={() => del.mutate({ groupId: group.id })} disabled={del.isPending}>
          Delete {group.kind === 'Organization' ? 'organization' : 'group'}
        </Button>
      </div>
    </div>
  );
}
