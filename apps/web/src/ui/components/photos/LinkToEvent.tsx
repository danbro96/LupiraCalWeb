import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';
import { useCreateItemRelation, useSearchItems } from '@lupira/cal-api/query/cal';
import { usePhotoEventLinks } from '../../../state/usePhotoLibrary';
import { DrawerSection } from '../DrawerSection';
import { useSnackbar } from '../SnackbarHost';

/** Events this photo belongs to, plus a picker to add one.
 *
 *  Candidates are events overlapping the capture time, but nothing is linked automatically — a photo
 *  taken during a 9-to-5 "work" block is not of it. */
export function LinkToEvent({ photoId, takenAt }: { photoId: string; takenAt: string }) {
  const links = usePhotoEventLinks();
  const linkedIds = useMemo(() => links.get(photoId) ?? [], [links, photoId]);
  const showSnack = useSnackbar();
  const queryClient = useQueryClient();
  const createRelation = useCreateItemRelation();
  const [picking, setPicking] = useState(false);

  const window = useMemo(() => {
    const t = new Date(takenAt).getTime();
    return { from: new Date(t - 3600_000).toISOString(), to: new Date(t + 3600_000).toISOString() };
  }, [takenAt]);

  const { data: candidates } = useSearchItems(
    { from: window.from, to: window.to, take: 25 },
    { query: { enabled: picking } },
  );

  const linked = useMemo(
    () => (candidates ?? []).filter((i) => linkedIds.includes(i.id)),
    [candidates, linkedIds],
  );

  const onLink = (itemId: string) => {
    createRelation.mutate(
      { id: itemId, data: { toKind: 'photo', toRef: photoId, relationType: 'depicts' } },
      {
        onSuccess: () => {
          showSnack('Linked to the event', 'success');
          setPicking(false);
          void queryClient.invalidateQueries({ queryKey: ['/relations/edges', 'photo'] });
        },
        onError: (e) => showSnack(e instanceof Error ? e.message : 'Could not link the photo'),
      },
    );
  };

  return (
    <DrawerSection title="Events">
      {linkedIds.length === 0 && !picking && (
        <Typography variant="body2" sx={{ color: 'text.subtle' }}>Not linked to an event.</Typography>
      )}
      {linked.map((item) => (
        <Box key={item.id}>
          <Button size="small" component={Link} to={`/items?item=${item.id}`}>{item.title ?? 'Untitled event'}</Button>
        </Box>
      ))}
      {linkedIds.length > 0 && linked.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.subtle' }}>
          Linked to {linkedIds.length} event{linkedIds.length === 1 ? '' : 's'}.
        </Typography>
      )}

      {picking ? (
        <TextField
          select size="small" fullWidth label="Around this time" defaultValue=""
          onChange={(e) => e.target.value && onLink(e.target.value)}
          sx={{ mt: 1 }}
        >
          {(candidates ?? []).length === 0 && <MenuItem value="" disabled>No events near this time</MenuItem>}
          {(candidates ?? []).map((item) => (
            <MenuItem key={item.id} value={item.id}>{item.title ?? 'Untitled event'}</MenuItem>
          ))}
        </TextField>
      ) : (
        <Button size="small" onClick={() => setPicking(true)}>Link to event…</Button>
      )}
    </DrawerSection>
  );
}
