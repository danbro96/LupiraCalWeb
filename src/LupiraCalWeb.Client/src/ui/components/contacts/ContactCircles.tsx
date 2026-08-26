import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import { Link, useLocation } from 'react-router-dom';
import { useGetContactCircles } from '../../../data/api-contact/lupiraContactApi';
import type { CircleKind } from '../../../data/api-contact/models';

const CIRCLE_LABEL: Record<CircleKind, string> = {
  CloseFamily: 'Close family',
  ExtendedFamily: 'Extended family',
  Friends: 'Friends',
  Colleagues: 'Colleagues',
  Household: 'Household',
};

/** Computed social circles around a contact (close family / extended / friends / colleagues / household). */
export function ContactCircles({ focusId }: { focusId: string }) {
  const location = useLocation();
  const { data, isLoading } = useGetContactCircles({ focusId });
  if (isLoading) return <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading circles…</Typography>;

  const circles = (data?.circles ?? []).filter((c) => c.members.length > 0);
  if (circles.length === 0) return <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>No circles yet — add relations to build them.</Typography>;

  return (
    <>
      {circles.map((c) => (
        <div key={c.kind}>
          <Typography variant="overline" component="p" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2, pb: 1, color: 'text.subtle' }}>{CIRCLE_LABEL[c.kind]}</Typography>
          {c.members.map((m) => (
            <div key={m.contactId} className="membership-row">
              {m.kind && <Chip variant="outlined" label={m.kind} />}
              <MuiLink component={Link} sx={{ flex: 1 }} to={{ pathname: `/contacts/${m.contactId}`, search: location.search }}>
                {m.displayName}
              </MuiLink>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
