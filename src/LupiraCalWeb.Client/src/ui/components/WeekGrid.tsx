import { useMemo, useState } from 'react';
import type { AvailabilitySegment } from '../../state/useAvailability';
import { clampToDay, layoutColumns } from '../../domain/occurrences';
import { type DayRail, familyKey, railsForDay } from '../../domain/family';
import { fmtDayShort, fmtTime, isToday, minutesOfDay, sameDay, ymd } from '../../domain/time';
import { AVAILABILITY_COLORS, familyAccent } from '../theme/kinds';
import type { GridEntry } from './entries';

const HOUR_PX = 48;
const RAIL_SLOT_PX = 5; // 3px rail + 2px gap
const MIN_BLOCK_PX = 18; // min block height; drives column packing so short neighbours don't overlap
const MIN_BLOCK_MINUTES = (MIN_BLOCK_PX / HOUR_PX) * 60;
const HEADER_PX = 18; // timed-parent header height; children starting under it drop below

interface Props {
  days: Date[];
  entries: GridEntry[];
  segments: AvailabilitySegment[];
  onOpenItem: (id: string) => void;
  selectedFamilyKey?: string;
}

type FamClass = (key: string | undefined) => string;

/** Timed week/day lanes: hour rows, an all-day strip, availability tint, and column-packed events. */
export function WeekGrid({ days, entries, segments, onOpenItem, selectedFamilyKey }: Props) {
  const allDay = useMemo(() => entries.filter((e) => e.isAllDay), [entries]);
  const timed = useMemo(() => entries.filter((e) => !e.isAllDay), [entries]);
  const nowMin = minutesOfDay(new Date());

  const [hoverFamily, setHoverFamily] = useState<string | null>(null);
  const activeFamily = hoverFamily ?? selectedFamilyKey ?? null;
  const famClass: FamClass = (key) =>
    activeFamily ? (key === activeFamily ? 'family-hi' : 'family-dim') : '';

  const railsByDay = useMemo(
    () => new Map(days.map((d) => [ymd(d), railsForDay(entries, d)])),
    [entries, days],
  );

  return (
    <div className="week-grid" style={{ ['--day-count' as string]: days.length }}>
      <div className="week-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`week-head-day ${isToday(d) ? 'today' : ''}`}>
            {fmtDayShort(d)}
          </div>
        ))}
      </div>
      <div className="week-allday">
        <div className="gutter meta">all-day</div>
        {days.map((d) => (
          <div key={d.toISOString()} className="allday-cell">
            {allDay
              .filter((e) => sameDay(e.start, d) || (e.end && e.start <= d && e.end >= d))
              .map((e) => {
                const fk = familyKey(e);
                return (
                  <button
                    key={e.key}
                    className={`allday-chip ${e.ghost ? 'ghost' : ''} ${e.childCount > 0 ? 'family-parent' : ''} ${e.parentItemId ? 'family-child' : ''} ${famClass(fk)}`}
                    style={{ background: e.color, ['--family-accent' as string]: fk ? familyAccent(fk) : undefined }}
                    onClick={() => onOpenItem(e.itemId)}
                    onMouseEnter={fk ? () => setHoverFamily(fk) : undefined}
                    onMouseLeave={fk ? () => setHoverFamily(null) : undefined}
                  >
                    {e.icon ? `${e.icon} ` : ''}
                    {e.title}
                    {e.childCount > 0 ? ` · ${e.childCount}` : ''}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <div className="week-body">
        <div className="gutter">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour-label" style={{ top: h * HOUR_PX }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            timed={timed}
            segments={segments}
            nowMin={nowMin}
            rails={railsByDay.get(ymd(day)) ?? []}
            famClass={famClass}
            onHoverFamily={setHoverFamily}
            onOpenItem={onOpenItem}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  timed,
  segments,
  nowMin,
  rails,
  famClass,
  onHoverFamily,
  onOpenItem,
}: {
  day: Date;
  timed: GridEntry[];
  segments: AvailabilitySegment[];
  nowMin: number;
  rails: DayRail[];
  famClass: FamClass;
  onHoverFamily: (key: string | null) => void;
  onOpenItem: (id: string) => void;
}) {
  const positioned = useMemo(() => {
    // Parents drawn as a rail are excluded from column packing so they bracket their children
    // instead of stealing a column.
    const railIds = new Set(rails.map((r) => r.itemId));
    const spans = timed
      .filter((e) => !railIds.has(e.itemId))
      .flatMap((e) => {
        const span = clampToDay(e.start, e.end ?? new Date(e.start.getTime() + 30 * 60000), day);
        return span ? [{ ...span, item: e }] : [];
      });
    return layoutColumns(spans, MIN_BLOCK_MINUTES);
  }, [timed, day, rails]);

  const daySegments = useMemo(
    () =>
      segments.flatMap((s) => {
        if (s.isAllDay) {
          const start = new Date(s.start);
          const end = s.end ? new Date(s.end) : start;
          return sameDay(start, day) || (start <= day && end >= day)
            ? [{ startMin: 0, endMin: 1440, status: s.status }]
            : [];
        }
        const span = clampToDay(new Date(s.start), s.end ? new Date(s.end) : new Date(s.start), day);
        return span ? [{ ...span, status: s.status }] : [];
      }),
    [segments, day],
  );

  // Earliest child top per timed parent — decides whether its header sits in the gap or above the start.
  const firstChildTopByRail = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positioned) {
      if (!p.item.parentItemId) continue;
      const top = (p.startMin / 60) * HOUR_PX;
      const cur = m.get(p.item.parentItemId);
      if (cur == null || top < cur) m.set(p.item.parentItemId, top);
    }
    return m;
  }, [positioned]);

  // A single rail tints its span (the whole column for an all-day parent, the parent's hours for a
  // timed one); two rails would blend into mud, so no tint then.
  const tintRail = rails.length === 1 ? rails[0] : null;

  return (
    <div className="day-col" style={{ height: 24 * HOUR_PX }}>
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="hour-line" style={{ top: h * HOUR_PX }} />
      ))}
      {daySegments.map((s, i) => (
        <div
          key={`seg-${i}`}
          className="avail-band"
          title={s.status}
          style={{
            top: (s.startMin / 60) * HOUR_PX,
            height: ((s.endMin - s.startMin) / 60) * HOUR_PX,
            background: AVAILABILITY_COLORS[s.status],
          }}
        >
          <span className="avail-label">{s.status}</span>
        </div>
      ))}
      {tintRail && (
        <div
          className="family-tint"
          style={{
            top: tintRail.startMin != null ? (tintRail.startMin / 60) * HOUR_PX : 0,
            height:
              tintRail.startMin != null && tintRail.endMin != null
                ? ((tintRail.endMin - tintRail.startMin) / 60) * HOUR_PX
                : 24 * HOUR_PX,
            background: `color-mix(in srgb, ${familyAccent(tintRail.itemId)} 6%, transparent)`,
          }}
        />
      )}
      {rails.map((r, i) => (
        <button
          key={`rail-${r.itemId}`}
          className={`family-rail ${famClass(r.itemId)}`}
          style={{
            left: i * RAIL_SLOT_PX,
            top: r.startMin != null ? (r.startMin / 60) * HOUR_PX : 0,
            height: r.startMin != null && r.endMin != null ? ((r.endMin - r.startMin) / 60) * HOUR_PX : undefined,
            bottom: r.startMin != null ? 'auto' : 0,
            ['--family-accent' as string]: familyAccent(r.itemId),
          }}
          title={r.title}
          aria-label={r.title}
          onClick={() => onOpenItem(r.itemId)}
          onMouseEnter={() => onHoverFamily(r.itemId)}
          onMouseLeave={() => onHoverFamily(null)}
        />
      ))}
      {/* Timed parents have no all-day chip, so label them with a header at the top of their span —
          in the gap before the first child when there's room, otherwise just above the start so it
          never hides a child that begins at the same time. */}
      {rails.map((r) => {
        if (r.startMin == null) return null;
        const railTopPx = (r.startMin / 60) * HOUR_PX;
        const firstChildTop = firstChildTopByRail.get(r.itemId);
        const atStart = firstChildTop == null || firstChildTop - railTopPx >= HEADER_PX;
        return (
          <button
            key={`rail-hd-${r.itemId}`}
            className={`family-rail-label ${famClass(r.itemId)}`}
            style={{
              top: atStart ? railTopPx : railTopPx - HEADER_PX,
              left: rails.length * RAIL_SLOT_PX,
              ['--family-accent' as string]: familyAccent(r.itemId),
            }}
            title={r.title}
            onClick={() => onOpenItem(r.itemId)}
            onMouseEnter={() => onHoverFamily(r.itemId)}
            onMouseLeave={() => onHoverFamily(null)}
          >
            {r.title}
            {r.childCount > 0 ? ` · ${r.childCount}` : ''}
          </button>
        );
      })}
      {positioned.map((p) => {
        const fk = familyKey(p.item);
        const railIdx = p.item.parentItemId ? rails.findIndex((r) => r.itemId === p.item.parentItemId) : -1;
        const inset = railIdx >= 0 && p.col === 0 ? rails.length * RAIL_SLOT_PX : 0;
        return (
          <button
            key={p.item.key}
            className={`timed-block ${p.item.ghost ? 'ghost' : ''} ${p.item.parentItemId ? 'family-child' : ''} ${famClass(fk)}`}
            style={{
              top: (p.startMin / 60) * HOUR_PX,
              height: Math.max(((p.endMin - p.startMin) / 60) * HOUR_PX - 2, MIN_BLOCK_PX),
              left: `calc(${(p.col / p.cols) * 100}% + ${2 + inset}px)`,
              width: `calc(${(1 / p.cols) * 100}% - ${4 + inset}px)`,
              background: p.item.color,
              ['--family-accent' as string]: fk ? familyAccent(fk) : undefined,
            }}
            onClick={() => onOpenItem(p.item.itemId)}
            onMouseEnter={fk ? () => onHoverFamily(fk) : undefined}
            onMouseLeave={fk ? () => onHoverFamily(null) : undefined}
            title={p.item.ghost ? `${p.item.title} (proposed)` : p.item.title}
          >
            <span className="timed-title">
              {p.item.icon ? `${p.item.icon} ` : ''}
              {p.item.title}
            </span>
            <span className="timed-time">
              {fmtTime(p.item.start)}
              {p.item.ghost ? ' · proposed' : ''}
            </span>
          </button>
        );
      })}
      {isToday(day) && <div className="now-line" style={{ top: (nowMin / 60) * HOUR_PX }} />}
    </div>
  );
}
