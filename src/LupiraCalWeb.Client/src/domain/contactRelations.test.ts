import { describe, expect, it } from 'vitest';
import { buildRelationGraph, inverseKind, isSymmetric, kindCategory } from './contactRelations';
import type { RelationEntry } from './contactRelations';

describe('kind taxonomy', () => {
  it('maps kinds to categories', () => {
    expect(kindCategory('Parent')).toBe('Family');
    expect(kindCategory('Friend')).toBe('Social');
    expect(kindCategory('Neighbor')).toBe('Social');
    expect(kindCategory('Colleague')).toBe('Professional');
    expect(kindCategory('Emergency')).toBe('Emergency');
    expect(kindCategory('Other')).toBe('Other');
  });

  it('inverts Parent↔Child, Emergency→Other, else self', () => {
    expect(inverseKind('Parent')).toBe('Child');
    expect(inverseKind('Child')).toBe('Parent');
    expect(inverseKind('Emergency')).toBe('Other');
    expect(inverseKind('Sibling')).toBe('Sibling');
    expect(inverseKind('Friend')).toBe('Friend');
  });

  it('flags symmetric kinds', () => {
    expect(isSymmetric('Sibling')).toBe(true);
    expect(isSymmetric('Spouse')).toBe(true);
    expect(isSymmetric('Parent')).toBe(false);
    expect(isSymmetric('Child')).toBe(false);
    expect(isSymmetric('Emergency')).toBe(false);
  });
});

const center = { id: 'Y', label: 'Yara' };

describe('buildRelationGraph', () => {
  it('collapses a stored edge and its derived inverse into one parent→child edge', () => {
    // Stored on Y: "X is Y's Parent (dad)". Y sees it Outgoing; X sees Y as an Incoming Child.
    const entries = new Map<string, RelationEntry[]>([
      ['Y', [{ contactId: 'X', displayName: 'Xavier', kind: 'Parent', label: 'dad', direction: 'Outgoing' }]],
      ['X', [{ contactId: 'Y', displayName: 'Yara', kind: 'Child', direction: 'Incoming' }]],
    ]);
    const g = buildRelationGraph(center, entries);
    expect(g.edges).toHaveLength(1);
    // Normalized parent → child: X (parent) → Y (child).
    expect(g.edges[0]).toMatchObject({ source: 'X', target: 'Y', kind: 'Parent', label: 'dad', directed: true });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['X', 'Y']);
  });

  it('derives the edge for an unexpanded neighbor from the center list alone', () => {
    // Only Y fetched: an incoming Parent (Z is Y's parent, stored on Z) still yields Z's node + edge.
    const entries = new Map<string, RelationEntry[]>([
      ['Y', [{ contactId: 'Z', displayName: 'Zoe', kind: 'Parent', direction: 'Incoming' }]],
    ]);
    const g = buildRelationGraph(center, entries);
    expect(g.edges).toHaveLength(1);
    // Z is Y's parent → arrow Z (parent) → Y (child).
    expect(g.edges[0]).toMatchObject({ source: 'Z', target: 'Y', kind: 'Parent' });
    expect(g.nodes.find((n) => n.id === 'Z')?.label).toBe('Zoe');
  });

  it('orients both children of a parent identically regardless of which side stored the fact', () => {
    // Centered on parent P: A stored as P's child (outgoing); B stored P as its parent (→ incoming).
    const p = { id: 'P', label: 'Parent' };
    const entries = new Map<string, RelationEntry[]>([
      [
        'P',
        [
          { contactId: 'A', displayName: 'A', kind: 'Child', direction: 'Outgoing' },
          { contactId: 'B', displayName: 'B', kind: 'Child', direction: 'Incoming' },
        ],
      ],
    ]);
    const g = buildRelationGraph(p, entries);
    expect(g.edges).toHaveLength(2);
    for (const e of g.edges) {
      expect(e.source).toBe('P');
      expect(e.kind).toBe('Parent');
      expect(e.directed).toBe(true);
    }
    expect(g.edges.map((e) => e.target).sort()).toEqual(['A', 'B']);
  });

  it('marks symmetric relations undirected and categorizes nodes by the reaching edge', () => {
    const entries = new Map<string, RelationEntry[]>([
      [
        'Y',
        [
          { contactId: 'S', displayName: 'Sam', kind: 'Sibling', direction: 'Outgoing' },
          { contactId: 'C', displayName: 'Cleo', kind: 'Colleague', direction: 'Outgoing' },
        ],
      ],
    ]);
    const g = buildRelationGraph(center, entries);
    expect(g.edges.find((e) => e.source === 'S' || e.target === 'S')?.directed).toBe(false);
    expect(g.nodes.find((n) => n.id === 'S')?.category).toBe('Family');
    expect(g.nodes.find((n) => n.id === 'C')?.category).toBe('Professional');
    expect(g.nodes.find((n) => n.isCenter)?.category).toBe('self');
  });

  it('places the center at the origin and neighbors on the first ring, deterministically', () => {
    const entries = new Map<string, RelationEntry[]>([
      [
        'Y',
        [
          { contactId: 'A', displayName: 'A', kind: 'Friend', direction: 'Outgoing' },
          { contactId: 'B', displayName: 'B', kind: 'Friend', direction: 'Outgoing' },
        ],
      ],
    ]);
    const g1 = buildRelationGraph(center, entries);
    const g2 = buildRelationGraph(center, entries);
    const c = g1.nodes.find((n) => n.isCenter)!;
    expect([c.x, c.y]).toEqual([0, 0]);
    const radius = (n: { x: number; y: number }) => Math.hypot(n.x, n.y);
    for (const n of g1.nodes.filter((n) => n.depth === 1)) expect(radius(n)).toBeCloseTo(220);
    expect(g1.nodes.map((n) => [n.id, n.x, n.y])).toEqual(g2.nodes.map((n) => [n.id, n.x, n.y]));
  });
});
