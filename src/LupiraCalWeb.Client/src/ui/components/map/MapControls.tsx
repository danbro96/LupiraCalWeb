import TextField from '@mui/material/TextField';
import { addDays, startOfDay, ymd } from '@lupira/cal-domain/time';
import { ACTIVITY_COLORS, type MapTheme } from './mapTokens';

export type LayerKey = 'events' | 'movement' | 'contacts' | 'saved';
export const DEFAULT_LAYERS: LayerKey[] = ['events', 'movement', 'contacts'];

const PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'yesterday', label: 'Yesterday', days: 1, offset: -1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
] as const;

export interface DateRange {
  /** Inclusive local date (YYYY-MM-DD). */
  fromYmd: string;
  toYmd: string;
}

export function defaultRange(): DateRange {
  const today = ymd(startOfDay(new Date()));
  return { fromYmd: today, toYmd: today };
}

export function presetRange(key: string): DateRange | null {
  const preset = PRESETS.find((p) => p.key === key);
  if (!preset) return null;
  const offset = 'offset' in preset ? preset.offset : 0;
  const end = addDays(startOfDay(new Date()), offset);
  return { fromYmd: ymd(addDays(end, -(preset.days - 1))), toYmd: ymd(end) };
}

/** Preset chips + custom from/to, URL-param-backed; shared by the events and movement layers. */
export function TimeRangeBar({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const activeKey = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r && r.fromYmd === range.fromYmd && r.toYmd === range.toYmd;
  })?.key;

  return (
    <div className="map-timebar">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          className={`chip${p.key === activeKey ? ' active' : ''}`}
          onClick={() => onChange(presetRange(p.key)!)}
        >
          {p.label}
        </button>
      ))}
      <TextField
        type="date" size="small" value={range.fromYmd} sx={{ width: '9.5em' }}
        slotProps={{ htmlInput: { max: range.toYmd, 'aria-label': 'From date' } }}
        onChange={(e) => e.target.value && onChange({ ...range, fromYmd: e.target.value })}
      />
      <span className="sep">–</span>
      <TextField
        type="date" size="small" value={range.toYmd} sx={{ width: '9.5em' }}
        slotProps={{ htmlInput: { min: range.fromYmd, 'aria-label': 'To date' } }}
        onChange={(e) => e.target.value && onChange({ ...range, toYmd: e.target.value })}
      />
    </div>
  );
}

/** Layer chips gate the queries (enabled:), not just visibility. */
export function LayerToggles({ active, onToggle, theme, unmappableCount, showHistory, onToggleHistory }: {
  active: LayerKey[];
  onToggle: (key: LayerKey) => void;
  theme: MapTheme;
  unmappableCount: number;
  showHistory: boolean;
  onToggleHistory: () => void;
}) {
  const toggles: { key: LayerKey; label: string }[] = [
    { key: 'events', label: 'Events' },
    { key: 'movement', label: 'Movement' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'saved', label: 'Saved' },
  ];
  const activities = ACTIVITY_COLORS[theme];

  return (
    <div className="map-toggles">
      {toggles.map((t) => (
        <button
          key={t.key}
          className={`chip${active.includes(t.key) ? ' active' : ''}`}
          onClick={() => onToggle(t.key)}
        >
          {t.label}
          {t.key === 'events' && unmappableCount > 0 && (
            <span className="meta" title={`${unmappableCount} occurrences have a free-text location only (no place)`}>
              {' '}·{unmappableCount}
            </span>
          )}
        </button>
      ))}
      {active.includes('contacts') && (
        <button
          className={`chip${showHistory ? ' active' : ''}`}
          title="Show former addresses (residency history)"
          onClick={onToggleHistory}
        >
          History
        </button>
      )}
      {active.includes('movement') && (
        <span className="map-legend">
          {(['Walk', 'Run', 'Cycle', 'Vehicle'] as const).map((a) => (
            <span key={a} className="map-legend-item">
              <span className="map-legend-swatch" style={{ background: activities[a] }} />
              {a}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
