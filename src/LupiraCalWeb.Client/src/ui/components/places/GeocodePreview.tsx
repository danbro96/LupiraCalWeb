import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { hitContext, type PickerHit } from './placePickerMachine';

/** "Did you mean…?" over forward-geocode hits. Cancel/close never creates anything. */
export function GeocodePreview({ query, hits, busy, error, onPick, onPin, onCancel }: {
  query: string;
  hits: PickerHit[];
  busy: boolean;
  error: string | null;
  onPick: (index: number) => void;
  onPin: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{hits.length > 0 ? 'Did you mean…?' : 'No matches'}</DialogTitle>
      <DialogContent>
        {hits.length === 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Nothing found for “{query}”.</Typography>}
        {hits.length > 0 && (
          <List dense disablePadding>
            {hits.map((hit, i) => (
              <ListItemButton key={i} disabled={busy} onClick={() => onPick(i)}>
                <ListItemText
                  primary={hit.displayName}
                  secondary={[hitContext(hit), hit.category !== 'Unknown' ? hit.category : null]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </ListItemButton>
            ))}
          </List>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {busy && <LinearProgress />}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onPin}>
          None of these — drop a pin on the map
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
