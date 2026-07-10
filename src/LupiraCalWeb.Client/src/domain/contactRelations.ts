// Contact↔contact relation taxonomy + ego-graph builder. Pure: the UI maps generated DTOs onto
// the structural RelationEntry shape and feeds one entry list per fetched contact.

export type RelationKind =
  | 'Parent'
  | 'Child'
  | 'Sibling'
  | 'Spouse'
  | 'Partner'
  | 'Friend'
  | 'Colleague'
  | 'Neighbor'
  | 'Emergency'
  | 'Other';

export type RelationDirection = 'Outgoing' | 'Incoming';

export type RelationCategory = 'Family' | 'Social' | 'Professional' | 'Emergency' | 'Other';

export const RELATION_KINDS: RelationKind[] = [
  'Parent',
  'Child',
  'Sibling',
  'Spouse',
  'Partner',
  'Friend',
  'Colleague',
  'Neighbor',
  'Emergency',
  'Other',
];

const CATEGORY: Record<RelationKind, RelationCategory> = {
  Parent: 'Family',
  Child: 'Family',
  Sibling: 'Family',
  Spouse: 'Family',
  Partner: 'Family',
  Friend: 'Social',
  Neighbor: 'Social',
  Colleague: 'Professional',
  Emergency: 'Emergency',
  Other: 'Other',
};

// Mirrors CalApi's ContactRelationKinds.Inverse: Parent↔Child, Emergency→Other, else symmetric.
const INVERSE: Record<RelationKind, RelationKind> = {
  Parent: 'Child',
  Child: 'Parent',
  Emergency: 'Other',
  Sibling: 'Sibling',
  Spouse: 'Spouse',
  Partner: 'Partner',
  Friend: 'Friend',
  Colleague: 'Colleague',
  Neighbor: 'Neighbor',
  Other: 'Other',
};

export function kindCategory(kind: RelationKind): RelationCategory {
  return CATEGORY[kind];
}

export function inverseKind(kind: RelationKind): RelationKind {
  return INVERSE[kind];
}

export function isSymmetric(kind: RelationKind): boolean {
  return INVERSE[kind] === kind;
}

/** One resolved relation as seen from a viewing contact (structurally == ContactRelationEntryDto). */
export interface RelationEntry {
  contactId: string;
  displayName: string;
  kind: RelationKind;
  label?: string | null;
  direction: RelationDirection;
}

export interface GraphNode {
  id: string;
  label: string;
  /** How this node relates into the tree ('self' = the centered contact). */
  category: RelationCategory | 'self';
  depth: number;
  isCenter: boolean;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  /** Stored owner ("target is owner's kind"). */
  source: string;
  target: string;
  kind: RelationKind;
  label?: string | null;
  category: RelationCategory;
  /** Asymmetric kinds (Parent/Child, Emergency) get an arrowhead. */
  directed: boolean;
}

export interface RelationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const RING = 220;

/**
 * Merge per-contact relation lists into one deduped directed ego-graph, radially laid out around
 * `center`. Each entry is canonicalized to its stored edge (owner → target, storedKind) so a
 * stored edge and its derived inverse collapse to a single edge — and an unexpanded neighbor still
 * contributes its edge via the center's own list.
 */
export function buildRelationGraph(
  center: { id: string; label: string },
  entriesByContact: ReadonlyMap<string, readonly RelationEntry[]>,
): RelationGraph {
  const names = new Map<string, string>([[center.id, center.label]]);
  const edges = new Map<string, GraphEdge>();

  for (const [viewer, entries] of entriesByContact) {
    for (const e of entries) {
      names.set(e.contactId, e.displayName);
      const outgoing = e.direction === 'Outgoing';
      const owner = outgoing ? viewer : e.contactId;
      const target = outgoing ? e.contactId : viewer;
      const storedKind = outgoing ? e.kind : inverseKind(e.kind);
      const key = `${owner}|${target}|${storedKind}`;
      const existing = edges.get(key);
      if (!existing) {
        edges.set(key, {
          id: key,
          source: owner,
          target,
          kind: storedKind,
          label: outgoing ? e.label ?? null : null,
          category: kindCategory(storedKind),
          directed: !isSymmetric(storedKind),
        });
      } else if (outgoing && e.label && !existing.label) {
        existing.label = e.label; // the label lives on the owner's outgoing entry
      }
    }
  }

  const edgeList = [...edges.values()];
  const { depth, category, children } = walkFromCenter(center.id, edgeList);
  const pos = radialLayout(center.id, children, depth);

  const nodeIds = new Set<string>([center.id]);
  for (const e of edgeList) {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  }

  let fallback = 0;
  const nodes: GraphNode[] = [...nodeIds].map((id) => {
    const p = pos.get(id) ?? outerFallback(fallback++);
    return {
      id,
      label: names.get(id) ?? id.slice(0, 8),
      category: id === center.id ? 'self' : category.get(id) ?? 'Other',
      depth: depth.get(id) ?? 99,
      isCenter: id === center.id,
      x: p.x,
      y: p.y,
    };
  });

  return { nodes, edges: edgeList };
}

interface Walk {
  depth: Map<string, number>;
  category: Map<string, RelationCategory>;
  children: Map<string, string[]>;
}

/** BFS the undirected edge graph from the center; record depth, the BFS child tree, and the
 *  category of the edge each node was first reached through (used for node color). */
function walkFromCenter(centerId: string, edges: GraphEdge[]): Walk {
  const adj = new Map<string, { to: string; category: RelationCategory }[]>();
  const link = (a: string, b: string, cat: RelationCategory) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, category: cat });
  };
  for (const e of edges) {
    link(e.source, e.target, e.category);
    link(e.target, e.source, e.category);
  }

  const depth = new Map<string, number>([[centerId, 0]]);
  const category = new Map<string, RelationCategory>();
  const children = new Map<string, string[]>();
  const queue = [centerId];
  while (queue.length) {
    const cur = queue.shift()!;
    const neighbors = (adj.get(cur) ?? []).slice().sort((a, b) => a.to.localeCompare(b.to));
    for (const n of neighbors) {
      if (depth.has(n.to)) continue;
      depth.set(n.to, depth.get(cur)! + 1);
      category.set(n.to, n.category);
      if (!children.has(cur)) children.set(cur, []);
      children.get(cur)!.push(n.to);
      queue.push(n.to);
    }
  }
  return { depth, category, children };
}

/** Leaf-weighted radial tree layout: each subtree gets an angular slice ∝ its leaf count; a node
 *  sits at the middle of its slice, radius = depth × RING. Deterministic given sorted children. */
function radialLayout(
  centerId: string,
  children: Map<string, string[]>,
  depth: Map<string, number>,
): Map<string, { x: number; y: number }> {
  const leaves = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) return 1;
    const n = kids.reduce((sum, k) => sum + countLeaves(k), 0);
    leaves.set(id, n);
    return n;
  };
  countLeaves(centerId);

  const pos = new Map<string, { x: number; y: number }>([[centerId, { x: 0, y: 0 }]]);
  const place = (id: string, a0: number, a1: number) => {
    const kids = children.get(id) ?? [];
    const total = kids.reduce((s, k) => s + (leaves.get(k) ?? 1), 0) || 1;
    let a = a0;
    for (const k of kids) {
      const span = ((leaves.get(k) ?? 1) / total) * (a1 - a0);
      const mid = a + span / 2;
      const r = (depth.get(k) ?? 1) * RING;
      pos.set(k, { x: Math.cos(mid) * r, y: Math.sin(mid) * r });
      place(k, a, a + span);
      a += span;
    }
  };
  place(centerId, 0, Math.PI * 2);
  return pos;
}

function outerFallback(i: number): { x: number; y: number } {
  const a = i * 1.1;
  const r = 3 * RING;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
