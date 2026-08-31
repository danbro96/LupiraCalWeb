import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import CloseIcon from '@mui/icons-material/Close';
import { Row, RowName } from '../Rows';
export interface IndexRow {
  key: string;
  primary: string;
  secondary?: string;
  onClick: () => void;
}

export interface IndexGroup {
  title: string;
  rows: IndexRow[];
}

/** Flat navigation over everything on the map, grouped by kind — click a row to fly there. */
export function MapIndexPanel({ groups, onClose }: { groups: IndexGroup[]; onClose: () => void }) {
  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  return (
    <Paper
      component="aside"
      elevation={4}
      sx={{
        position: 'absolute',
        zIndex: 6,
        top: 96,
        left: 1.5,
        bottom: 1.5,
        width: 'min(280px, calc(100vw - 24px))',
        overflowY: 'auto',
        borderRadius: '12px',
        p: '8px 12px 12px',
        // The index wants its rows full-width with the caption on its own line.
        '& .MuiListItemButton-root': { width: '100%', flexWrap: 'wrap' },
        '& .MuiListItemButton-root .MuiTypography-caption': { flexBasis: '100%', textAlign: 'left' },
      }}
    >
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', top: 4, right: 4 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      {nonEmpty.length === 0 && <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Nothing on the map yet.</Typography>}
      {nonEmpty.map((group) => (
        <section key={group.title}>
          <Typography
            variant="overline"
            component="h4"
            sx={{ display: 'block', mt: 1.5, mb: 0.5, color: 'text.secondary' }}
          >
            {group.title}
          </Typography>
          {group.rows.map((row) => (
            <Row key={row.key} onClick={row.onClick}>
              <RowName>{row.primary}</RowName>
              {row.secondary && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.secondary}</Typography>}
            </Row>
          ))}
        </section>
      ))}
    </Paper>
  );
}
