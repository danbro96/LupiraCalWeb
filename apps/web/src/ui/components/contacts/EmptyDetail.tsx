import Typography from '@mui/material/Typography';
import { DetailPane } from './panes';
/** Placeholder shown in the detail pane when no contact or group is selected. */
export function EmptyDetail() {
  return (
    <DetailPane>
      <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Select a contact or group.</Typography>
    </DetailPane>
  );
}
