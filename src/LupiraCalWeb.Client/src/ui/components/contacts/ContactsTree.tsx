import { useState } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCreateCalendar,
  useCreateContactGroup,
  useListContactGroups,
  useSearchContacts,
} from '../../../data/api/lupiraCalApi';
import type { ContainerDto } from '../../../data/api/models';
import { calendarLabel, useContainers } from '../../../state/useContainers';
import { useInvalidateContacts, useInvalidateContainers } from '../../../state/useInvalidate';

/** Left rail: address books → their groups/orgs, with contact and member counts.
 *  Book click filters the list (?book); group click opens the group pane + filters to members. */
export function ContactsTree() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeBookId = params.get('book') ?? '';
  const activeGroupId = useMatch('/contacts/groups/:groupId')?.params.groupId ?? '';
  const { addressBooks } = useContainers();
  const { data: allContacts } = useSearchContacts({});
  const [addingBook, setAddingBook] = useState(false);

  const countFor = (bookId: string) => (allContacts ?? []).filter((c) => c.addressBookId === bookId).length;

  return (
    <aside className="contacts-tree">
      <div className="section-label">Address books</div>
      <button
        className={`tree-node ${!activeBookId && !activeGroupId ? 'active' : ''}`}
        onClick={() => navigate('/contacts')}
      >
        <span className="tree-caret" />
        <span className="tree-label">All contacts</span>
        <span className="tree-count">{allContacts?.length ?? '·'}</span>
      </button>

      {addressBooks.map((book) => (
        <BookNode
          key={book.id}
          book={book}
          count={countFor(book.id)}
          activeBookId={activeBookId}
          activeGroupId={activeGroupId}
        />
      ))}

      {addingBook ? (
        <NewBookForm onDone={() => setAddingBook(false)} />
      ) : (
        <div className="tree-add">
          <button className="linklike" onClick={() => setAddingBook(true)}>
            + Address book
          </button>
        </div>
      )}
    </aside>
  );
}

function BookNode({
  book,
  count,
  activeBookId,
  activeGroupId,
}: {
  book: ContainerDto;
  count: number;
  activeBookId: string;
  activeGroupId: string;
}) {
  const navigate = useNavigate();
  const isActive = activeBookId === book.id;
  const [expanded, setExpanded] = useState(() => isActive);
  const [adding, setAdding] = useState(false);
  const { data: groups } = useListContactGroups(book.id, { query: { enabled: expanded } });

  return (
    <>
      <button
        className={`tree-node ${isActive ? 'active' : ''}`}
        onClick={() => navigate(`/contacts?book=${book.id}`)}
      >
        <span
          className="tree-caret"
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((x) => !x);
          }}
        >
          {expanded ? '▾' : '▸'}
        </span>
        <span className="tree-label">📇 {calendarLabel(book)}</span>
        <span className="tree-count">{count}</span>
      </button>

      {expanded && (
        <>
          {(groups ?? []).map((g) => (
            <button
              key={g.id}
              className={`tree-node tree-group ${activeGroupId === g.id ? 'active' : ''}`}
              onClick={() => navigate(`/contacts/groups/${g.id}?book=${book.id}`)}
            >
              <span className="tree-label">
                {g.kind === 'Organization' ? '🏢' : '👥'} {g.name}
              </span>
              <span className="tree-count">{g.members.length}</span>
            </button>
          ))}
          {adding ? (
            <NewGroupForm addressBookId={book.id} onDone={() => setAdding(false)} />
          ) : (
            <div className="tree-add">
              <button className="linklike" onClick={() => setAdding(true)}>
                + group
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function NewGroupForm({ addressBookId, onDone }: { addressBookId: string; onDone: () => void }) {
  const invalidate = useInvalidateContacts();
  const create = useCreateContactGroup({ mutation: { onSuccess: () => { invalidate(); onDone(); } } });
  const [name, setName] = useState('');
  const [kind, setKind] = useState('group');

  return (
    <form
      className="tree-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (name) create.mutate({ addressBookId, params: { name, kind } });
      }}
    >
      <input className="text-input" placeholder="Group name…" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="group">Group</option>
        <option value="organization">Organization</option>
      </select>
      <div className="form-row">
        <button className="btn" type="submit" disabled={!name || create.isPending}>
          Add
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function NewBookForm({ onDone }: { onDone: () => void }) {
  const invalidate = useInvalidateContainers();
  const create = useCreateCalendar({ mutation: { onSuccess: () => { invalidate(); onDone(); } } });
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');

  return (
    <form
      className="tree-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (slug)
          create.mutate({
            data: { type: 'addressbook', slug, displayName: displayName || null, color: null, defaultTimezone: null, class: null, kind: null },
          });
      }}
    >
      <input className="text-input" placeholder="slug" value={slug} autoFocus onChange={(e) => setSlug(e.target.value)} />
      <input className="text-input" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <div className="form-row">
        <button className="btn" type="submit" disabled={!slug || create.isPending}>
          Add
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
