import { describe, expect, it } from 'vitest';
import { buildRelationGraph, inverseKind, isSymmetric, kindCategory } from './contactRelations';
import type { RelationEntry } from './contactRelations';

describe('kind taxonomy', () => {
  it('maps kinds to categories', () => {
    expect(kindCategory('Parent')).toBe('Family');
    expect(kindCategory('Friend')).toBe('Social');
    expect(kindCategory('Neighbor')).toBe('Social');
    expect(kindCategory('Colleague')).toBe('Professional');
    expect(kindCategory('Other')).toBe('Other');
  });

  it('categorizes extended-family kinds as Family', () => {
    for (const k of ['Grandparent', 'Grandchild', 'AuntUncle', 'NieceNephew', 'Cousin'] as const)
      expect(kindCategory(k)).toBe('Family');
  });

  it('inverts the directed kinship pairs, else self', () => {
    expect(inverseKind('Parent')).toBe('Child');
    expect(inverseKind('Child')).toBe('Parent');
    expect(inverseKind('Grandparent')).toBe('Grandchild');
    expect(inverseKind('Grandchild')).toBe('Grandparent');
    expect(inverseKind('AuntUncle')).toBe('NieceNephew');
    expect(inverseKind('NieceNephew')).toBe('AuntUncle');
    expect(inverseKind('Sibling')).toBe('Sibling');
    expect(inverseKind('Cousin')).toBe('Cousin');
    expect(inverseKind('Friend')).toBe('Friend');
  });

  it('flags symmetric kinds', () => {
    expect(isSymmetric('Sibling')).toBe(true);
    expect(isSymmetric('Spouse')).toBe(true);
    expect(isSymmetric('Cousin')).toBe(true);
    expect(isSymmetric('Parent')).toBe(false);
    expect(isSymmetric('Grandparent')).toBe(false);
    expect(isSymmetric('AuntUncle')).toBe(false);
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

  it('collapses a stored Grandparent edge and its derived Grandchild inverse into one elder→younger edge', () => {
    // Stored on Y: "X is Y's Grandparent". Y sees it Outgoing; X sees Y as an Incoming Grandchild.
    const entries = new Map<string, RelationEntry[]>([
      ['Y', [{ contactId: 'X', displayName: 'Xavier', kind: 'Grandparent', direction: 'Outgoing' }]],
      ['X', [{ contactId: 'Y', displayName: 'Yara', kind: 'Grandchild', direction: 'Incoming' }]],
    ]);
    const g = buildRelationGraph(center, entries);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]).toMatchObject({ source: 'X', target: 'Y', kind: 'Grandparent', directed: true });
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

  it('renders inferred kin as dashed, undirected spokes from the center', () => {
    const entries = new Map<string, RelationEntry[]>([
      [
        'Y',
        [
          { contactId: 'P', displayName: 'Pat', kind: 'Parent', direction: 'Outgoing' },
          { contactId: 'G', displayName: 'Gramps', kind: 'Grandparent', direction: 'Incoming', provenance: 'Inferred' },
        ],
      ],
    ]);
    const g = buildRelationGraph(center, entries);
    const kin = g.edges.find((e) => e.target === 'G')!;
    expect(kin).toMatchObject({ source: 'Y', kind: 'Grandparent', inferred: true, directed: false, category: 'Family' });
    expect(g.edges.find((e) => e.kind === 'Parent')?.inferred).toBeUndefined(); // stored edge unaffected
    expect(g.nodes.find((n) => n.id === 'G')?.label).toBe('Gramps');
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

  it('excludes ended relationships from the graph', () => {
    const entries = new Map<string, RelationEntry[]>([
      [
        'Y',
        [
          { contactId: 'E', displayName: 'Ex', kind: 'Spouse', direction: 'Outgoing', ended: true },
          { contactId: 'F', displayName: 'Fern', kind: 'Friend', direction: 'Outgoing' },
        ],
      ],
    ]);
    const g = buildRelationGraph(center, entries);
    expect(g.edges).toHaveLength(1);
    expect([g.edges[0].source, g.edges[0].target]).toContain('F'); // the surviving edge is the (non-ended) Friend to F
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['F', 'Y']);
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
