import { useState } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
        <Button
          variant="text"
          endIcon={open ? <ExpandMoreIcon /> : <ChevronRightIcon />}
          onClick={() => setOpen((o) => !o)}
        >
          Metadata
        </Button>
      </h3>
      {open && (
        <>
          <pre className="json-view">{isEmpty ? '{}' : JSON.stringify(metadata, null, 2)}</pre>
          <TextField
            multiline
            minRows={3}
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
            placeholder='Merge JSON, e.g. {"source":"manual"}'
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
          />
          {jsonError && <p className="error-text">{jsonError}</p>}
          <Button
            variant="outlined"
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
          </Button>
        </>
      )}
    </section>
  );
}
