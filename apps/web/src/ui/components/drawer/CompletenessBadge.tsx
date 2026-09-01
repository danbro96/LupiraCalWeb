import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import type { CompletenessScore } from '@lupira/cal-api/models';

/** Score ring + expandable gap list (field, weight, severity). Exempt items pass null and render nothing. */
export function CompletenessBadge({ score }: { score?: CompletenessScore | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!score) return null;
  const pct = Math.round(score.score * 100);
  const hue = Math.round(score.score * 120); // red → green

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor((a) => (a ? null : e.currentTarget))}
        title={`Completeness ${pct}% (rubric v${score.rubricVersion})`}
        sx={{
          flex: 'none',
          width: 40,
          height: 40,
          borderRadius: '999px',
          fontSize: 12,
          fontWeight: 700,
          color: 'text.primary',
        }}
        style={{ background: `conic-gradient(hsl(${hue} 70% 45%) ${pct}%, var(--mui-palette-divider) ${pct}%)` }}
      >
        {/* The inner disc is what turns the gradient into a ring. */}
        <Box
          component="span"
          sx={{
            bgcolor: 'background.default',
            width: 30,
            height: 30,
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pct}
        </Box>
      </ButtonBase>
      <Popover
        open={!!anchor && score.gaps.length > 0}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: '8px 12px', minWidth: 220, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 13 }}>
          {score.gaps.map((g) => (
            <Box component="li" key={g.field}>
              <Chip variant="outlined" label={g.severity} /> {g.field}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}> ·  weight {g.weight}</Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
