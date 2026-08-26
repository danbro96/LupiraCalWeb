import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import CloseIcon from '@mui/icons-material/Close';
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
import { WrapRow } from '../WrapRow';
import { DrawerSection } from '../DrawerSection';
import { PageHead } from '../Page';
import { DetailPane } from './panes';

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
      <DetailPane>
        <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>
          {bookId ? 'Group not found.' : 'Open this group from its address book.'}
        </Typography>
      </DetailPane>
    );
  }

  const members = (bookContacts ?? []).filter((c) => group.members.some((m) => m.contactId === c.id));
  const nonMembers = (bookContacts ?? []).filter((c) => !group.members.some((m) => m.contactId === c.id));
  const backSearch = `?book=${bookId}`;

  return (
    <DetailPane>
      <PageHead>
        <h2>
          <Chip variant="outlined" label={group.kind === 'Organization' ? '🏢 org' : '👥 group'} />{' '}
          <TextField
            variant="standard"
            defaultValue={group.name}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== group.name)
                rename.mutate({ groupId: group.id, params: { name: e.target.value } });
            }}
          />
        </h2>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{group.members.length} members</Typography>
      </PageHead>

      <DrawerSection title="Members">
        {members.map((c) => (
          <div key={c.id} className="membership-row">
            <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              {(c.displayName[0] ?? '?').toUpperCase()}
            </Avatar>
            <MuiLink component={Link} sx={{ flex: 1 }} to={{ pathname: `/contacts/${c.id}`, search: backSearch }}>
              {c.displayName}
            </MuiLink>
            <Tooltip title="Remove from group">
              <IconButton
                onClick={() => removeMember.mutate({ groupId: group.id, contactId: c.id })}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        {members.length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">No members yet.</Typography>}
        <WrapRow>
          <TextField select value={addId} onChange={(e) => setAddId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Add member…</MenuItem>
            {nonMembers.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.displayName}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={!addId}
            onClick={() => {
              addMember.mutate({ groupId: group.id, params: { contactId: addId } });
              setAddId('');
            }}
          >
            Add
          </Button>
        </WrapRow>
      </DrawerSection>

      <div className="drawer-footer">
        <Button variant="outlined" color="error" onClick={() => del.mutate({ groupId: group.id })} disabled={del.isPending}>
          Delete {group.kind === 'Organization' ? 'organization' : 'group'}
        </Button>
      </div>
    </DetailPane>
  );
}
