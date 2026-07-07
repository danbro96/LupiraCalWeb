import { useState } from 'react';
import { useCreateItemRelation, useListItemRelations } from '../../../data/api/lupiraCalApi';
import { useInvalidateItems } from '../../../state/useInvalidate';

/** Opaque cross-API edges (e.g. → a LupiraTasks item). Kind/ref/type are free-form by design. */
export function RelationsPanel({ itemId }: { itemId: string }) {
  const { data: relations } = useListItemRelations(itemId);
  const invalidate = useInvalidateItems();
  const create = useCreateItemRelation({ mutation: { onSuccess: invalidate } });
  const [form, setForm] = useState({ toKind: '', toRef: '', relationType: '' });

  return (
    <section className="drawer-section">
      <h3>Relations</h3>
      {(relations ?? []).map((r) => (
        <div key={r.id} className="relation-row">
          <span className="badge">{r.relationType}</span>
          <span className="meta">
            {r.toKind}: <code>{r.toRef}</code>
          </span>
        </div>
      ))}
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ id: itemId, data: form });
          setForm({ toKind: '', toRef: '', relationType: '' });
        }}
      >
        <input className="text-input" placeholder="kind (task, url…)" value={form.toKind} onChange={(e) => setForm({ ...form, toKind: e.target.value })} required />
        <input className="text-input" placeholder="reference" value={form.toRef} onChange={(e) => setForm({ ...form, toRef: e.target.value })} required />
        <input className="text-input" placeholder="relation (blocks…)" value={form.relationType} onChange={(e) => setForm({ ...form, relationType: e.target.value })} required />
        <button className="btn" type="submit" disabled={create.isPending}>
          Link
        </button>
      </form>
    </section>
  );
}
