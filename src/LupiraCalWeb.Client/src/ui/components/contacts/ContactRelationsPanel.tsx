import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  useAddContactRelation,
  useEndContactRelation,
  useListContactRelations,
  useRemoveContactRelation,
  useSearchContacts,
} from '../../../data/api-contact/lupiraContactApi';
import type { ContactDto, ContactRelationKind } from '../../../data/api-contact/models';
import { kindCategory, RELATION_KINDS } from '../../../domain/contactRelations';
import type { RelationKind } from '../../../domain/contactRelations';
import { useInvalidateContacts } from '../../../state/useInvalidate';
import { errText } from '../errText';
import { ContactRelationGraph } from './ContactRelationGraph';

/** Relations network for a contact: interactive graph + an editable list. Only OUTGOING (stored)
 *  edges are editable here; incoming edges are derived and managed on the other contact's card.
 *  A toggle reveals kin CalApi infers from the parent/child graph (grandparents, cousins, …), read-only. */
export function ContactRelationsPanel({ contact }: { contact: ContactDto }) {
  const location = useLocation();
  const invalidate = useInvalidateContacts();
  const [showExtended, setShowExtended] = useState(false);
  const { data: relations } = useListContactRelations(contact.id, { includeInferred: showExtended });
  const { data: candidates } = useSearchContacts({ addressBookId: contact.addressBookId });
  const add = useAddContactRelation({ mutation: { onSuccess: invalidate } });
  const end = useEndContactRelation({ mutation: { onSuccess: invalidate } });
  const remove = useRemoveContactRelation({ mutation: { onSuccess: invalidate } });

  const [toContactId, setToContactId] = useState('');
  const [kind, setKind] = useState<RelationKind>('Friend');
  const [label, setLabel] = useState('');

  const outgoing = (relations ?? []).filter((r) => r.direction === 'Outgoing' && r.provenance !== 'Inferred');
  const incoming = (relations ?? []).filter((r) => r.direction === 'Incoming' && r.provenance !== 'Inferred');
  const inferred = (relations ?? []).filter((r) => r.provenance === 'Inferred');
  const relatedIds = new Set(outgoing.map((r) => r.contactId));
  const pickable = (candidates ?? []).filter((c) => c.id !== contact.id && !relatedIds.has(c.id));
  const categories = [...new Set((relations ?? []).map((r) => kindCategory(r.kind)))];

  const link = (id: string) => ({ pathname: `/contacts/${id}`, search: location.search });

  return (
    <section className="drawer-section">
      <div className="page-head">
        <h3>Relations</h3>
        <button className="linklike" onClick={() => setShowExtended((v) => !v)}>
          {showExtended ? 'Hide extended family' : 'Show extended family'}
        </button>
      </div>

      <ContactRelationGraph centerId={contact.id} centerLabel={contact.displayName} includeInferred={showExtended} />

      {categories.length > 0 && (
        <div className="relation-legend">
          {categories.map((c) => (
            <span key={c} className="legend-item">
              <span className={`legend-dot cat-${c}`} />
              {c}
            </span>
          ))}
        </div>
      )}

      {outgoing.map((r) => (
        <div key={`out-${r.contactId}-${r.kind}`} className={`relation-row${r.ended ? ' ended' : ''}`}>
          <span className={`badge cat-${kindCategory(r.kind)}`}>{r.kind}</span>
          <Link className="membership-name" to={link(r.contactId)}>
            {r.displayName}
          </Link>
          {r.label && <span className="meta">“{r.label}”</span>}
          {r.ended && <span className="meta">· ended{r.until ? ` ${r.until}` : ''}</span>}
          {r.ended ? (
            <button
              className="icon-btn"
              title="Revive relationship"
              disabled={add.isPending}
              onClick={() => add.mutate({ id: contact.id, data: { toContactId: r.contactId, kind: r.kind as ContactRelationKind, label: r.label ?? null } })}
            >
              ↺
            </button>
          ) : (
            <button
              className="icon-btn"
              title="End relationship (ran its course)"
              disabled={end.isPending}
              onClick={() => end.mutate({ id: contact.id, toContactId: r.contactId, data: { kind: r.kind as ContactRelationKind } })}
            >
              ⏻
            </button>
          )}
          <button
            className="icon-btn"
            title="Remove relation (entered by mistake)"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ id: contact.id, toContactId: r.contactId, params: { kind: r.kind as ContactRelationKind } })}
          >
            ×
          </button>
        </div>
      ))}

      {incoming.map((r) => (
        <div key={`in-${r.contactId}-${r.kind}`} className="relation-row incoming">
          <span className={`badge cat-${kindCategory(r.kind)}`}>{r.kind}</span>
          <Link className="membership-name" to={link(r.contactId)}>
            {r.displayName}
          </Link>
          <span className="meta">· managed on their card</span>
        </div>
      ))}

      {inferred.length > 0 && (
        <>
          <p className="section-label">Extended family (inferred)</p>
          {inferred.map((r) => (
            <div key={`kin-${r.contactId}-${r.kind}`} className="relation-row inferred">
              <span className={`badge cat-${kindCategory(r.kind)}`}>{r.kind}</span>
              <Link className="membership-name" to={link(r.contactId)}>
                {r.displayName}
              </Link>
              <span className="meta">· derived</span>
            </div>
          ))}
        </>
      )}

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
        <select value={toContactId} onChange={(e) => setToContactId(e.target.value)}>
          <option value="">Relate a contact…</option>
          {pickable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as RelationKind)}>
          {RELATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          className="text-input"
          placeholder="label (dad, boss…)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!toContactId || add.isPending}>
          Add
        </button>
      </form>
      {errText(add.error) && <p className="error-text">{errText(add.error)}</p>}
      {errText(end.error) && <p className="error-text">{errText(end.error)}</p>}
      {errText(remove.error) && <p className="error-text">{errText(remove.error)}</p>}
    </section>
  );
}
