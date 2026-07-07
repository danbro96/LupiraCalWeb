import { useState } from 'react';
import {
  useCreateContactGroup,
  useDeleteContactGroup,
  useListContactGroups,
  useRenameContactGroup,
} from '../../data/api/lupiraCalApi';
import { useInvalidateContacts } from '../../state/useInvalidate';

/** Groups & organizations of one address book (an employer = Organization-kind group). */
export function GroupsPanel({ addressBookId }: { addressBookId?: string }) {
  const invalidate = useInvalidateContacts();
  const { data: groups } = useListContactGroups(addressBookId ?? '', { query: { enabled: !!addressBookId } });
  const create = useCreateContactGroup({ mutation: { onSuccess: invalidate } });
  const rename = useRenameContactGroup({ mutation: { onSuccess: invalidate } });
  const del = useDeleteContactGroup({ mutation: { onSuccess: invalidate } });
  const [name, setName] = useState('');
  const [kind, setKind] = useState('group');

  if (!addressBookId) return null;

  return (
    <section className="drawer-section">
      <h3>Groups & organizations</h3>
      {(groups ?? []).map((g) => (
        <div key={g.id} className="membership-row">
          <span className="badge">{g.kind === 'Organization' ? '🏢 org' : '👥 group'}</span>
          <input
            className="text-input inline-name"
            defaultValue={g.name}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== g.name)
                rename.mutate({ groupId: g.id, params: { name: e.target.value } });
            }}
          />
          <span className="meta">{g.members.length} members</span>
          <button className="icon-btn" title="Delete group" onClick={() => del.mutate({ groupId: g.id })}>
            ×
          </button>
        </div>
      ))}
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name) return;
          create.mutate({ addressBookId, params: { name, kind } });
          setName('');
        }}
      >
        <input className="text-input" placeholder="New group…" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="group">Group</option>
          <option value="organization">Organization</option>
        </select>
        <button className="btn" type="submit">
          Add
        </button>
      </form>
    </section>
  );
}
