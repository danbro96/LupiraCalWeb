import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { Link, useLocation } from 'react-router-dom';
import {
  useAddContactRelation,
  useEndContactRelation,
  useListContactRelations,
  useRemoveContactRelation,
  useSearchContacts,
} from '../../../data/api-contact/lupiraContactApi';
import type { ContactDto, ContactRelationEntryDto, ContactRelationKind } from '../../../data/api-contact/models';
import { groupRelationEntries, RELATION_KINDS } from '@lupira/cal-domain/contactRelations';
import type { RelationCategory, RelationKind } from '@lupira/cal-domain/contactRelations';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';
import { ContactRelationGraph } from './ContactRelationGraph';

/** Sections with more rows than this start collapsed. */
const OPEN_THRESHOLD = 8;

/** Relations network for a contact: interactive graph + an editable list, sharing category-chip and
 *  search filters plus a selection. Only OUTGOING (stored) edges are editable here; incoming edges
 *  are derived and managed on the other contact's card. A toggle reveals kin CalApi infers from the
 *  parent/child graph (grandparents, cousins, …), read-only. */
export function ContactRelationsPanel({ contact }: { contact: ContactDto }) {
  const location = useLocation();
  const invalidate = useInvalidateContacts();
  const [showExtended, setShowExtended] = useState(false);
  const { data: relations } = useListContactRelations(contact.id, { includeInferred: showExtended });
  const { data: candidates } = useSearchContacts({ addressBookId: contact.addressBookId });
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const add = useAddContactRelation({ mutation: { onSuccess: invalidate, onError } });
  const end = useEndContactRelation({ mutation: { onSuccess: invalidate, onError } });
  const remove = useRemoveContactRelation({ mutation: { onSuccess: invalidate, onError } });

  const [activeCats, setActiveCats] = useState<ReadonlySet<RelationCategory>>(new Set());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Partial<Record<RelationCategory, boolean>>>({});

  const [toContactId, setToContactId] = useState('');
  const [kind, setKind] = useState<RelationKind>('Friend');
  const [label, setLabel] = useState('');

  const groups = useMemo(() => groupRelationEntries(relations ?? []), [relations]);
  const outgoingIds = new Set((relations ?? []).filter((r) => r.direction === 'Outgoing' && r.provenance !== 'Inferred').map((r) => r.contactId));
  const pickable = (candidates ?? []).filter((c) => c.id !== contact.id && !outgoingIds.has(c.id));

  const q = query.trim().toLowerCase();
  const matches = (r: ContactRelationEntryDto) =>
    !q ||
    r.displayName.toLowerCase().includes(q) ||
    (r.label ?? '').toLowerCase().includes(q) ||
    r.kind.toLowerCase().includes(q);

  const toggleCat = (c: RelationCategory) =>
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const link = (id: string) => ({ pathname: `/contacts/${id}`, search: location.search });
  const rowSelect = (id: string) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return; // links/actions keep their meaning
    setSelectedId((cur) => (cur === id ? null : id));
  };
  const rowClass = (r: ContactRelationEntryDto, extra = '') =>
    `relation-row${extra}${r.contactId === selectedId ? ' selected' : ''}`;

  return (
    <section className="drawer-section">
      <div className="page-head">
        <h3>Relations</h3>
        <Button variant="text" size="small" onClick={() => setShowExtended((v) => !v)}>
          {showExtended ? 'Hide extended family' : 'Show extended family'}
        </Button>
      </div>

      <div className="relation-toolbar">
        <TextField
          size="small"
          placeholder="Search relations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {groups.map((g) => (
          <Chip
            key={g.category}
            size="small"
            variant={activeCats.has(g.category) ? 'filled' : 'outlined'}
            label={
              <>
                <span className={`legend-dot cat-${g.category}`} /> {g.category} · {g.total}
              </>
            }
            aria-pressed={activeCats.has(g.category)}
            onClick={() => toggleCat(g.category)}
            sx={{ color: `var(--cat-${g.category.toLowerCase()})`, borderColor: `var(--cat-${g.category.toLowerCase()})` }}
          />
        ))}
      </div>

      <ContactRelationGraph
        centerId={contact.id}
        centerLabel={contact.displayName}
        includeInferred={showExtended}
        categories={activeCats}
        query={query}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {groups
        .filter((g) => activeCats.size === 0 || activeCats.has(g.category))
        .map((g) => {
          const outgoing = g.outgoing.filter(matches);
          const incoming = g.incoming.filter(matches);
          const inferred = g.inferred.filter(matches);
          const shown = outgoing.length + incoming.length + inferred.length;
          if (q && shown === 0) return null;
          const open = q ? true : (openCats[g.category] ?? g.total <= OPEN_THRESHOLD);
          return (
            <div key={g.category}>
              <button
                className="relation-section-head"
                onClick={() => setOpenCats((prev) => ({ ...prev, [g.category]: !open }))}
              >
                <span className={`legend-dot cat-${g.category}`} />
                {g.category} <span className="count">· {q ? `${shown}/${g.total}` : g.total}</span>
                <span className="caret">{open ? '▾' : '▸'}</span>
              </button>
              {open && outgoing.map((r) => (
                <div key={`out-${r.contactId}-${r.kind}`} className={rowClass(r, r.ended ? ' ended' : '')} onClick={rowSelect(r.contactId)}>
                  <Chip size="small" variant="outlined" label={r.kind} sx={{ color: `var(--cat-${g.category.toLowerCase()})`, borderColor: `var(--cat-${g.category.toLowerCase()})` }} />
                  <Link className="membership-name" to={link(r.contactId)}>
                    {r.displayName}
                  </Link>
                  {r.label && <span className="meta">“{r.label}”</span>}
                  {r.ended && <span className="meta">· ended{r.until ? ` ${r.until}` : ''}</span>}
                  {r.ended ? (
                    <Tooltip title="Revive relationship">
                      <IconButton
                        size="small"
                        disabled={add.isPending}
                        onClick={() => add.mutate({ id: contact.id, data: { toContactId: r.contactId, kind: r.kind as ContactRelationKind, label: r.label ?? null } })}
                      >
                        ↺
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="End relationship (ran its course)">
                      <IconButton
                        size="small"
                        disabled={end.isPending}
                        onClick={() => end.mutate({ id: contact.id, toContactId: r.contactId, data: { kind: r.kind as ContactRelationKind } })}
                      >
                        ⏻
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Remove relation (entered by mistake)">
                    <IconButton
                      size="small"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: contact.id, toContactId: r.contactId, params: { kind: r.kind as ContactRelationKind } })}
                    >
                      ×
                    </IconButton>
                  </Tooltip>
                </div>
              ))}
              {open && incoming.map((r) => (
                <div key={`in-${r.contactId}-${r.kind}`} className={rowClass(r, ' incoming')} onClick={rowSelect(r.contactId)}>
                  <Chip size="small" variant="outlined" label={r.kind} sx={{ color: `var(--cat-${g.category.toLowerCase()})`, borderColor: `var(--cat-${g.category.toLowerCase()})` }} />
                  <Link className="membership-name" to={link(r.contactId)}>
                    {r.displayName}
                  </Link>
                  <span className="meta">· managed on their card</span>
                </div>
              ))}
              {open && inferred.map((r) => (
                <div key={`kin-${r.contactId}-${r.kind}`} className={rowClass(r, ' inferred')} onClick={rowSelect(r.contactId)}>
                  <Chip size="small" variant="outlined" label={r.kind} sx={{ color: `var(--cat-${g.category.toLowerCase()})`, borderColor: `var(--cat-${g.category.toLowerCase()})` }} />
                  <Link className="membership-name" to={link(r.contactId)}>
                    {r.displayName}
                  </Link>
                  <span className="meta">· derived</span>
                </div>
              ))}
            </div>
          );
        })}

      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!toContactId) return;
          add.mutate({ id: contact.id, data: { toContactId, kind, label: label.trim() || null } });
          setToContactId('');
          setLabel('');
        }}
      >
        <TextField select size="small" value={toContactId} onChange={(e) => setToContactId(e.target.value)} slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">Relate a contact…</MenuItem>
          {pickable.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.displayName}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" value={kind} onChange={(e) => setKind(e.target.value as RelationKind)}>
          {RELATION_KINDS.map((k) => (
            <MenuItem key={k} value={k}>
              {k}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="label (dad, boss…)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button variant="outlined" size="small" type="submit" disabled={!toContactId || add.isPending}>
          Add
        </Button>
      </form>
    </section>
  );
}
