import { useState } from 'react';
import Chip from '@mui/material/Chip';
import type { CompletenessScore } from '../../../data/api/models';

/** Score ring + expandable gap list (field, weight, severity). Exempt items pass null and render nothing. */
export function CompletenessBadge({ score }: { score?: CompletenessScore | null }) {
  const [open, setOpen] = useState(false);
  if (!score) return null;
  const value = score.score;
  const pct = Math.round(value * 100);
  const hue = Math.round(value * 120); // red → green

  return (
    <div className="completeness">
      <button className="completeness-ring" onClick={() => setOpen((o) => !o)} title={`Completeness ${pct}% (rubric v${score.rubricVersion})`}
        style={{
          background: `conic-gradient(hsl(${hue} 70% 45%) ${pct}%, var(--mui-palette-divider) ${pct}%)`,
        }}
      >
        <span>{pct}</span>
      </button>
      {open && score.gaps.length > 0 && (
        <ul className="gap-list">
          {score.gaps.map((g) => (
            <li key={g.field}>
              <Chip size="small" variant="outlined" label={g.severity} /> {g.field}
              <span className="meta"> ·  weight {g.weight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
