// Sector layout for the relation ego-graph: depth-1 nodes grouped into angular sectors per
// category, crowded sectors wrapping onto concentric sub-rings; deeper BFS levels land on outer
// ring bands near their parent's angle. Pure and deterministic.
//
// Geometry: pills are wide (~190×40), so circular rings can't stay overlap-free at the east/west
// poles. The layout therefore works in a normalized space where pills are squares (x compressed by
// pillW/pillH) and keeps every pairwise distance ≥ √2·pillH — which guarantees |Δx| ≥ pillW or
// |Δy| ≥ pillH after stretching x back out. Rings are ringGap apart, same-ring neighbours one
// chord-step apart; the result is elliptical rings matching a wide viewport.
import type { RelationCategory } from './contactRelations';

export interface LayoutConfig {
  /** First-ring radius in normalized (pill-square) space. */
  baseRadius: number;
  /** Radial gap between rings in normalized space; must stay ≥ √2·pillH for the no-overlap guarantee. */
  ringGap: number;
  /** Node footprint incl. breathing room (pill max-width 170 / height ~28). */
  pillW: number;
  pillH: number;
  /** Angular gap between category sectors (radians). */
  sectorGap: number;
  /** A tiny category still gets a visible slice. */
  minSectorSpan: number;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  baseRadius: 100,
  ringGap: 60,
  pillW: 190,
  pillH: 40,
  sectorGap: 0.12,
  minSectorSpan: Math.PI / 7,
};

export const CATEGORY_ORDER: readonly RelationCategory[] = ['Family', 'Social', 'Professional', 'Other'];

/** Proportional spans with a minimum per sector; falls back to plain proportional if mins can't fit. */
function allocateSpans(weights: number[], available: number, minSpan: number): number[] {
  if (minSpan * weights.length > available) minSpan = 0;
  const spans = weights.map(() => 0);
  const isMin = weights.map(() => false);
  for (;;) {
    const free = available - minSpan * isMin.filter(Boolean).length;
    const wSum = weights.reduce((s, w, i) => s + (isMin[i] ? 0 : w), 0) || 1;
    let changed = false;
    for (let i = 0; i < weights.length; i++) {
      if (isMin[i]) {
        spans[i] = minSpan;
        continue;
      }
      spans[i] = (weights[i] / wSum) * free;
      if (spans[i] < minSpan) {
        isMin[i] = true;
        changed = true;
      }
    }
    if (!changed) return spans;
  }
}

export function sectorRadialLayout(
  centerId: string,
  children: ReadonlyMap<string, readonly string[]>,
  depth: ReadonlyMap<string, number>,
  category: ReadonlyMap<string, RelationCategory>,
  labels: ReadonlyMap<string, string>,
  cfg: Partial<LayoutConfig> = {},
): Map<string, { x: number; y: number }> {
  const c = { ...DEFAULT_LAYOUT, ...cfg };
  const sx = c.pillW / c.pillH;
  const chord = Math.SQRT2 * c.pillH;
  const stepAt = (rho: number) => 2 * Math.asin(Math.min(1, chord / (2 * rho)));
  const byName = (a: string, b: string) =>
    (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b) || a.localeCompare(b);

  const pos = new Map<string, { x: number; y: number }>([[centerId, { x: 0, y: 0 }]]);
  const angleOf = new Map<string, number>();
  const place = (id: string, angle: number, rho: number) => {
    pos.set(id, { x: Math.cos(angle) * rho * sx, y: Math.sin(angle) * rho });
    angleOf.set(id, angle);
  };

  // Subtree leaf counts drive sector spans, so an expanded neighbour claims room for its children.
  const leafCount = (id: string): number => {
    const kids = children.get(id) ?? [];
    return kids.length === 0 ? 1 : kids.reduce((s, k) => s + leafCount(k), 0);
  };

  const level1 = [...(children.get(centerId) ?? [])].sort(byName);
  if (level1.length === 0) return pos;

  const sectors = CATEGORY_ORDER.map((cat) => ({
    cat,
    members: level1.filter((id) => (category.get(id) ?? 'Other') === cat),
  })).filter((s) => s.members.length > 0);

  const available = Math.PI * 2 - sectors.length * c.sectorGap;
  const spans = allocateSpans(
    sectors.map((s) => s.members.reduce((sum, id) => sum + leafCount(id), 0)),
    available,
    c.minSectorSpan,
  );

  let sectorStart = -Math.PI / 2; // Family opens at the top
  let maxRho = c.baseRadius;
  sectors.forEach((s, i) => {
    const span = spans[i];
    let rho = c.baseRadius;
    let idx = 0;
    while (idx < s.members.length) {
      const step = stepAt(rho);
      const n = Math.min(Math.floor(span / step), s.members.length - idx);
      if (n > 0) {
        const start = sectorStart + (span - n * step) / 2 + step / 2; // centered within the sector
        for (let j = 0; j < n; j++) place(s.members[idx + j], start + j * step, rho);
        idx += n;
        maxRho = Math.max(maxRho, rho);
      }
      rho += c.ringGap; // sector arc full (or too narrow) — wrap to the next sub-ring
    }
    sectorStart += span + c.sectorGap;
  });

  // Deeper levels: each expanded parent's children form a contiguous run centered on the parent's
  // angle, swept in angle order so runs never collide; a full ring spills onto the next one.
  const maxDepth = Math.max(...depth.values());
  let bandRho = maxRho + 2 * c.ringGap;
  for (let d = 2; d <= maxDepth; d++) {
    const parents = [...depth.entries()]
      .filter(([id, dd]) => dd === d - 1 && (children.get(id) ?? []).length > 0)
      .map(([id]) => id)
      .sort((a, b) => angleOf.get(a)! - angleOf.get(b)! || byName(a, b));
    if (parents.length === 0) break;
    let rho = bandRho;
    let step = stepAt(rho);
    let cursor = Number.NEGATIVE_INFINITY;
    let ringStart = 0;
    let usedOnRing = 0;
    let ringMax = rho;
    for (const p of parents) {
      const kids = [...(children.get(p) ?? [])].sort(byName);
      let needed = kids.length * step;
      let start = Math.max(angleOf.get(p)! - needed / 2, cursor);
      if (usedOnRing > 0 && start + needed - ringStart > Math.PI * 2 - step) {
        rho += c.ringGap;
        step = stepAt(rho);
        needed = kids.length * step;
        start = angleOf.get(p)! - needed / 2;
        usedOnRing = 0;
      }
      if (usedOnRing === 0) ringStart = start;
      kids.forEach((k, j) => place(k, start + step / 2 + j * step, rho));
      cursor = start + needed + c.sectorGap;
      usedOnRing += kids.length;
      ringMax = Math.max(ringMax, rho);
    }
    bandRho = ringMax + 2 * c.ringGap;
  }

  return pos;
}
