import { useState } from 'react';
import { useMergeItemMetadata } from '../../../data/api/lupiraCalApi';
import { useInvalidateItems } from '../../../state/useInvalidate';

/** The item's free-form JSON metadata, with a merge editor (POST /items/{id}/metadata merges keys). */
export function MetadataPanel({ itemId, metadata }: { itemId: string; metadata: unknown }) {
  const [open, setOpen] = useState(false);
  const [patch, setPatch] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const invalidate = useInvalidateItems();
  const merge = useMergeItemMetadata({
    mutation: {
      onSuccess: () => {
        invalidate();
        setPatch('');
      },
    },
  });

  const isEmpty = !metadata || (typeof metadata === 'object' && Object.keys(metadata as object).length === 0);

  return (
    <section className="drawer-section">
      <h3>
        <button className="linklike" onClick={() => setOpen((o) => !o)}>
          Metadata {open ? '▾' : '▸'}
        </button>
      </h3>
      {open && (
        <>
          <pre className="json-view">{isEmpty ? '{}' : JSON.stringify(metadata, null, 2)}</pre>
          <textarea
            className="text-input notes-input mono"
            placeholder='Merge JSON, e.g. {"source":"manual"}'
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
          />
          {jsonError && <p className="error-text">{jsonError}</p>}
          <button
            className="btn"
            disabled={!patch || merge.isPending}
            onClick={() => {
              try {
                const data = JSON.parse(patch);
                setJsonError(null);
                merge.mutate({ id: itemId, data });
              } catch {
                setJsonError('Patch must be valid JSON.');
              }
            }}
          >
            Merge
          </button>
        </>
      )}
    </section>
  );
}
