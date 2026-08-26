import Typography from '@mui/material/Typography';
/** Placeholder shown in the detail pane when no contact or group is selected. */
export function EmptyDetail() {
  return (
    <div className="contacts-detail-pane">
      <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Select a contact or group.</Typography>
    </div>
  );
}
