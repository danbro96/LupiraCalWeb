// Contact↔contact relation taxonomy + ego-graph builder. Pure: the UI maps generated DTOs onto
// the structural RelationEntry shape and feeds one entry list per fetched contact.
import { CATEGORY_ORDER, sectorRadialLayout } from './relationLayout';

// All kinds are storable (== generated ContactRelationKind). The extended-family kinds are also produced by the
// API's read-time inference over the parent/child graph — explicit vs inferred is carried by RelationProvenance,
// not by the kind.
export type RelationKind =
  | 'Parent'
  | 'Child'
  | 'Sibling'
  | 'Spouse'
  | 'Partner'
  | 'Friend'
  | 'Colleague'
  | 'Neighbor'
  | 'Other'
  | 'Grandparent'
  | 'Grandchild'
  | 'AuntUncle'
  | 'NieceNephew'
  | 'Cousin';

export type RelationDirection = 'Outgoing' | 'Incoming';

/** Alias kept for the resolved-entry shape; identical to RelationKind now that extended kin are storable. */
export type KinKind = RelationKind;

export type RelationProvenance = 'Explicit' | 'Inferred';

export type RelationCategory = 'Family' | 'Social' | 'Professional' | 'Other';

/** The kinds a user can store/edit (the add-form select), immediate/social first, extended kin last. */
export const RELATION_KINDS: RelationKind[] = [
  'Parent',
  'Child',
  'Sibling',
  'Spouse',
  'Partner',
  'Friend',
  'Colleague',
  'Neighbor',
  'Other',
  'Grandparent',
  'Grandchild',
  'AuntUncle',
  'NieceNephew',
  'Cousin',
];

const CATEGORY: Record<KinKind, RelationCategory> = {
  Parent: 'Family',
  Child: 'Family',
  Sibling: 'Family',
  Spouse: 'Family',
  Partner: 'Family',
  Grandparent: 'Family',
  Grandchild: 'Family',
  AuntUncle: 'Family',
  NieceNephew: 'Family',
  Cousin: 'Family',
  Friend: 'Social',
  Neighbor: 'Social',
  Colleague: 'Professional',
  Other: 'Other',
};

// Mirrors the API's ContactRelationKinds.Inverse: Parent↔Child, Grandparent↔Grandchild,
// AuntUncle↔NieceNephew; the rest (incl. Sibling, Cousin) are symmetric.
const INVERSE: Record<RelationKind, RelationKind> = {
  Parent: 'Child',
  Child: 'Parent',
  Grandparent: 'Grandchild',
  Grandchild: 'Grandparent',
  AuntUncle: 'NieceNephew',
  NieceNephew: 'AuntUncle',
  Sibling: 'Sibling',
  Spouse: 'Spouse',
  Partner: 'Partner',
  Friend: 'Friend',
  Colleague: 'Colleague',
  Neighbor: 'Neighbor',
  Cousin: 'Cousin',
  Other: 'Other',
};

export function kindCategory(kind: KinKind): RelationCategory {
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
  kind: KinKind;
  label?: string | null;
  direction: RelationDirection;
  provenance?: RelationProvenance;
  /** Ended relationships (ex-spouse, falling-out) no longer assert current kinship — excluded from the graph. */
  ended?: boolean;
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
  /** Stored owner ("target is owner's kind"); for inferred edges, the center contact. */
  source: string;
  target: string;
  kind: KinKind;
  label?: string | null;
  category: RelationCategory;
  /** Asymmetric kinds (Parent/Child) get an arrowhead. */
  directed: boolean;
  /** Derived from the kinship graph rather than a stored edge (rendered dashed, read-only). */
  inferred?: boolean;
}

export interface RelationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RelationGraphOptions {
  /** Keep only these categories' edges (empty/undefined = all); nodes left unreachable drop out. */
  categories?: ReadonlySet<RelationCategory>;
}

// Directed kinship pairs collapse to one elder-rooted edge (arrow elder→younger) so a stored edge and its
// derived inverse dedupe: the "younger" kind maps to its "elder" partner. Symmetric kinds fall through.
const ELDER_KIND: Partial<Record<RelationKind, RelationKind>> = { Parent: 'Parent', Grandparent: 'Grandparent', AuntUncle: 'AuntUncle' };
const YOUNGER_TO_ELDER: Partial<Record<RelationKind, RelationKind>> = { Child: 'Parent', Grandchild: 'Grandparent', NieceNephew: 'AuntUncle' };

/**
 * Normalize a stored edge to a single display orientation so identical relationships read the same
 * regardless of which contact stored them (and so mirror/redundant facts dedupe to one edge):
 * directed kinships → arrow elder → younger; symmetric kinds → endpoints sorted.
 */
function orient(owner: string, target: string, storedKind: RelationKind): { source: string; target: string; kind: RelationKind } {
  const elder = ELDER_KIND[storedKind];
  if (elder) return { source: target, target: owner, kind: elder }; // target is owner's elder (parent/grandparent/aunt-uncle)
  const asElder = YOUNGER_TO_ELDER[storedKind];
  if (asElder) return { source: owner, target, kind: asElder }; // owner is the elder
  if (isSymmetric(storedKind)) {
    return owner < target
      ? { source: owner, target, kind: storedKind }
      : { source: target, target: owner, kind: storedKind };
  }
  return { source: owner, target, kind: storedKind };
}

/**
 * Merge per-contact relation lists into one deduped directed ego-graph, radially laid out around
 * `center`. Each entry is canonicalized to its stored edge (owner → target, storedKind) so a
 * stored edge and its derived inverse collapse to a single edge — and an unexpanded neighbor still
 * contributes its edge via the center's own list.
 */
export function buildRelationGraph(
  center: { id: string; label: string },
  entriesByContact: ReadonlyMap<string, readonly RelationEntry[]>,
  opts?: RelationGraphOptions,
): RelationGraph {
  const names = new Map<string, string>([[center.id, center.label]]);
  const edges = new Map<string, GraphEdge>();

  for (const [viewer, entries] of entriesByContact) {
    for (const e of entries) {
      names.set(e.contactId, e.displayName);

      // Inferred kin (only ever supplied for the center): a dashed spoke, not a stored edge.
      if (e.provenance === 'Inferred') {
        const key = `kin|${viewer}|${e.contactId}|${e.kind}`;
        if (!edges.has(key))
          edges.set(key, {
            id: key,
            source: viewer,
            target: e.contactId,
            kind: e.kind,
            label: null,
            category: kindCategory(e.kind),
            directed: false,
            inferred: true,
          });
        continue;
      }

      if (e.ended) continue; // ended relationships stay listed on the card but leave the graph

      const stored = e.kind as RelationKind; // explicit entries only ever carry storable kinds
      const outgoing = e.direction === 'Outgoing';
      const owner = outgoing ? viewer : e.contactId;
      const target = outgoing ? e.contactId : viewer;
      const storedKind = outgoing ? stored : inverseKind(stored);
      const o = orient(owner, target, storedKind);
      const key = `${o.source}|${o.target}|${o.kind}`;
      const existing = edges.get(key);
      if (!existing) {
        edges.set(key, {
          id: key,
          source: o.source,
          target: o.target,
          kind: o.kind,
          label: outgoing ? e.label ?? null : null,
          category: kindCategory(o.kind),
          directed: !isSymmetric(o.kind),
        });
      } else if (outgoing && e.label && !existing.label) {
        existing.label = e.label; // the label lives on the owner's outgoing entry
      }
    }
  }

  const active = opts?.categories;
  const allEdges = [...edges.values()].filter((e) => !active?.size || active.has(e.category));
  const { depth, category, children } = walkFromCenter(center.id, allEdges);
  const pos = sectorRadialLayout(center.id, children, depth, category, names);

  // Only what's reachable from the center is drawn (matters once category filtering cuts edges).
  const edgeList = allEdges.filter((e) => depth.has(e.source) && depth.has(e.target));
  const nodes: GraphNode[] = [...depth.keys()].map((id) => {
    const p = pos.get(id)!;
    return {
      id,
      label: names.get(id) ?? id.slice(0, 8),
      category: id === center.id ? 'self' : category.get(id) ?? 'Other',
      depth: depth.get(id)!,
      isCenter: id === center.id,
      x: p.x,
      y: p.y,
    };
  });

  return { nodes, edges: edgeList };
}

export interface RelationEntryGroup<T> {
  category: RelationCategory;
  total: number;
  outgoing: T[];
  incoming: T[];
  inferred: T[];
}

/** Bucket relation entries per category (in CATEGORY_ORDER, empty ones omitted) and per
 *  direction/provenance within it, alphabetically — the shape the grouped list renders. */
export function groupRelationEntries<
  T extends Pick<RelationEntry, 'kind' | 'direction' | 'provenance' | 'displayName'>,
>(entries: readonly T[]): RelationEntryGroup<T>[] {
  const byName = (a: T, b: T) => a.displayName.localeCompare(b.displayName);
  const groups = new Map<RelationCategory, RelationEntryGroup<T>>();
  for (const e of entries) {
    const cat = kindCategory(e.kind);
    let g = groups.get(cat);
    if (!g) groups.set(cat, (g = { category: cat, total: 0, outgoing: [], incoming: [], inferred: [] }));
    const bucket = e.provenance === 'Inferred' ? g.inferred : e.direction === 'Outgoing' ? g.outgoing : g.incoming;
    bucket.push(e);
    g.total++;
  }
  for (const g of groups.values()) {
    g.outgoing.sort(byName);
    g.incoming.sort(byName);
    g.inferred.sort(byName);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => groups.get(c)!);
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

