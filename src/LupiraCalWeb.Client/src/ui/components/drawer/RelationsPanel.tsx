import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useCreateItemRelation, useListItemRelations } from '@lupira/cal-api/query/cal';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { WrapRow } from '../WrapRow';
import { DrawerSection } from '../DrawerSection';

/** Opaque cross-API edges (e.g. → a LupiraTasks item). Kind/ref/type are free-form by design. */
export function RelationsPanel({ itemId }: { itemId: string }) {
  const { data: relations } = useListItemRelations(itemId);
  const invalidate = useInvalidateItems();
  const create = useCreateItemRelation({ mutation: { onSuccess: invalidate } });
  const [form, setForm] = useState({ toKind: '', toRef: '', relationType: '' });

  return (
    <DrawerSection title="Relations">
      {(relations ?? []).map((r) => (
        <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: '6px', borderBottom: 1, borderColor: 'divider' }}>
          <Chip variant="outlined" label={r.relationType} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {r.toKind}: <code>{r.toRef}</code>
          </Typography>
        </Box>
      ))}
      <WrapRow
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ id: itemId, data: form });
          setForm({ toKind: '', toRef: '', relationType: '' });
        }}
      >
        <TextField placeholder="kind (task, url…)" value={form.toKind} onChange={(e) => setForm({ ...form, toKind: e.target.value })} required />
        <TextField placeholder="reference" value={form.toRef} onChange={(e) => setForm({ ...form, toRef: e.target.value })} required />
        <TextField placeholder="relation (blocks…)" value={form.relationType} onChange={(e) => setForm({ ...form, relationType: e.target.value })} required />
        <Button variant="outlined" type="submit" disabled={create.isPending}>
          Link
        </Button>
      </WrapRow>
    </DrawerSection>
  );
}
