import { describe, expect, it } from 'vitest';
import type { RelationCategory } from './contactRelations';
import { CATEGORY_ORDER, DEFAULT_LAYOUT, sectorRadialLayout } from './relationLayout';

const CENTER = 'center';
const sx = DEFAULT_LAYOUT.pillW / DEFAULT_LAYOUT.pillH;

interface Star {
  children: Map<string, string[]>;
  depth: Map<string, number>;
  category: Map<string, RelationCategory>;
  labels: Map<string, string>;
}

/** Star around CENTER with `counts` depth-1 nodes per category (ids like `Social-07`). */
function makeStar(counts: Partial<Record<RelationCategory, number>>): Star {
  const children = new Map<string, string[]>([[CENTER, []]]);
  const depth = new Map<string, number>([[CENTER, 0]]);
  const category = new Map<string, RelationCategory>();
  const labels = new Map<string, string>([[CENTER, 'Center']]);
  for (const cat of CATEGORY_ORDER) {
    for (let i = 0; i < (counts[cat] ?? 0); i++) {
      const id = `${cat}-${String(i).padStart(2, '0')}`;
      children.get(CENTER)!.push(id);
      depth.set(id, 1);
      category.set(id, cat);
      labels.set(id, id);
    }
  }
  return { children, depth, category, labels };
}

/** Attach depth-(d+1) children under an existing node. */
function addChildren(star: Star, parent: string, ids: string[], cat: RelationCategory) {
  star.children.set(parent, ids);
  const d = star.depth.get(parent)! + 1;
  for (const id of ids) {
    star.depth.set(id, d);
    star.category.set(id, cat);
    star.labels.set(id, id);
  }
}

function layout(star: Star) {
  return sectorRadialLayout(CENTER, star.children, star.depth, star.category, star.labels);
}

/** Angle normalized to [-π/2, 3π/2) so sectors starting at the top don't wrap mid-interval. */
function angle(p: { x: number; y: number }): number {
  const a = Math.atan2(p.y, p.x / sx);
  return a < -Math.PI / 2 ? a + Math.PI * 2 : a;
}

function normRadius(p: { x: number; y: number }): number {
  return Math.hypot(p.x / sx, p.y);
}

function expectNoOverlaps(pos: Map<string, { x: number; y: number }>) {
  const entries = [...pos.entries()];
  const bad: string[] = [];
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, a] = entries[i];
      const [idB, b] = entries[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx < DEFAULT_LAYOUT.pillW - 0.5 && dy < DEFAULT_LAYOUT.pillH - 0.5) bad.push(`${idA} ↔ ${idB}`);
    }
  expect(bad).toEqual([]);
}

describe('sectorRadialLayout', () => {
  it('is deterministic', () => {
    const star = makeStar({ Family: 15, Social: 30, Professional: 8, Other: 2 });
    expect([...layout(star).entries()]).toEqual([...layout(star).entries()]);
  });

  it('never overlaps pills at 55 depth-1 nodes (incl. the center)', () => {
    const pos = layout(makeStar({ Family: 15, Social: 30, Professional: 8, Other: 2 }));
    expect(pos.size).toBe(56);
    expectNoOverlaps(pos);
  });

  it('keeps each category in one contiguous angular sector, in CATEGORY_ORDER', () => {
    const star = makeStar({ Family: 12, Social: 20, Professional: 6, Other: 3 });
    const pos = layout(star);
    const ranges = CATEGORY_ORDER.map((cat) => {
      const angles = [...pos.keys()].filter((id) => id.startsWith(cat)).map((id) => angle(pos.get(id)!));
      return { cat, min: Math.min(...angles), max: Math.max(...angles) };
    });
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].min).toBeGreaterThan(ranges[i - 1].max);
  });

  it('gives a lone category a visible slice away from its big neighbour', () => {
    const pos = layout(makeStar({ Social: 49, Other: 1 }));
    const other = pos.get('Other-00')!;
    const circular = (a: number, b: number) => {
      const d = Math.abs(a - b) % (Math.PI * 2);
      return Math.min(d, Math.PI * 2 - d);
    };
    const nearestSocial = Math.min(
      ...[...pos.keys()].filter((id) => id.startsWith('Social')).map((id) => circular(angle(pos.get(id)!), angle(other))),
    );
    expect(nearestSocial).toBeGreaterThanOrEqual(DEFAULT_LAYOUT.sectorGap);
    expectNoOverlaps(pos);
  });

  it('wraps a crowded sector onto multiple sub-rings', () => {
    const pos = layout(makeStar({ Social: 30 }));
    const radii = new Set(
      [...pos.keys()].filter((id) => id !== CENTER).map((id) => Math.round(normRadius(pos.get(id)!))),
    );
    expect(radii.size).toBeGreaterThanOrEqual(2);
    expectNoOverlaps(pos);
  });

  it('places an expanded node’s children on an outer band near the parent, without overlaps', () => {
    const star = makeStar({ Family: 3, Social: 5 });
    addChildren(star, 'Family-01', ['kid-a', 'kid-b'], 'Family');
    const pos = layout(star);
    const parent = pos.get('Family-01')!;
    for (const kid of ['kid-a', 'kid-b']) {
      const p = pos.get(kid)!;
      expect(normRadius(p)).toBeGreaterThan(normRadius(parent));
      expect(Math.abs(angle(p) - angle(parent))).toBeLessThan(Math.PI / 2);
    }
    expectNoOverlaps(pos);
  });

  it('handles two expanded parents without collisions between their child runs', () => {
    const star = makeStar({ Family: 4, Social: 12 });
    addChildren(star, 'Family-00', ['fkid-0', 'fkid-1', 'fkid-2'], 'Family');
    addChildren(star, 'Social-05', ['skid-0', 'skid-1', 'skid-2', 'skid-3'], 'Social');
    expectNoOverlaps(layout(star));
  });

  it('returns only the center when there are no relations', () => {
    const pos = layout(makeStar({}));
    expect([...pos.entries()]).toEqual([[CENTER, { x: 0, y: 0 }]]);
  });
});
