// One-level nesting of occurrence rows by parentItemId. The API treats parenting as an
// advisory hint (no cycle/depth enforcement), so grouping must terminate on any input.

export interface OccurrenceLike {
  id: string;
  parentItemId?: string | null;
}

export interface ItemGroup<T extends OccurrenceLike> {
  occ: T;
  children: T[];
}

/**
 * Groups a loaded page of occurrences: each top-level occurrence becomes a group, in encounter
 * order; child occurrences attach to their parent's FIRST occurrence (recurring parents repeat
 * rows — later ones host nothing). Top-level means: no parent, parent not in the page, or the
 * parent is itself nested (one visual level — grandchildren surface as their own top rows).
 * Cycles and self-parenting resolve deterministically: the first-encountered node wins top.
 */
export function groupOccurrences<T extends OccurrenceLike>(occs: T[]): ItemGroup<T>[] {
  const firstIdx = new Map<string, number>();
  occs.forEach((o, i) => {
    if (!firstIdx.has(o.id)) firstIdx.set(o.id, i);
  });

  const topById = new Map<string, boolean>();
  const isTop = (id: string, trail: Set<string>): boolean => {
    const known = topById.get(id);
    if (known !== undefined) return known;
    const pid = occs[firstIdx.get(id)!].parentItemId;
    let top: boolean;
    if (!pid || pid === id || !firstIdx.has(pid) || trail.has(id)) {
      top = true;
    } else {
      trail.add(id);
      top = !isTop(pid, trail);
      trail.delete(id);
    }
    topById.set(id, top);
    return top;
  };

  const groups: ItemGroup<T>[] = [];
  const hostByItem = new Map<string, ItemGroup<T>>();
  for (const o of occs) {
    if (!isTop(o.id, new Set())) continue;
    const g: ItemGroup<T> = { occ: o, children: [] };
    groups.push(g);
    if (!hostByItem.has(o.id)) hostByItem.set(o.id, g);
  }
  for (const o of occs) {
    if (isTop(o.id, new Set())) continue;
    hostByItem.get(o.parentItemId!)?.children.push(o);
  }
  return groups;
}
