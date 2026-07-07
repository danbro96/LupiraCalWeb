// Placement math for the timed lanes of the week/day grids.

export interface DaySpan {
  /** Minutes from local midnight, clamped to [0, 1440]. */
  startMin: number;
  endMin: number;
}

/** Clamp a timed span to one day; null when it doesn't overlap the day. */
export function clampToDay(start: Date, end: Date, day: Date): DaySpan | null {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  if (start >= dayEnd || end <= dayStart) return null;
  const s = start < dayStart ? 0 : start.getHours() * 60 + start.getMinutes();
  const e = end > dayEnd ? 1440 : end.getHours() * 60 + end.getMinutes();
  return { startMin: s, endMin: Math.max(e, s + 15) }; // floor at 15 min so zero-length events stay clickable
}

export interface Positioned<T> extends DaySpan {
  item: T;
  /** Column index within the overlap cluster, and the cluster's column count. */
  col: number;
  cols: number;
}

/**
 * Assign side-by-side columns to overlapping spans (greedy first-free-column, then each overlap
 * cluster shares its max column count so widths line up).
 */
export function layoutColumns<T>(spans: Array<DaySpan & { item: T }>): Positioned<T>[] {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Positioned<T>[] = [];
  const colEnds: number[] = []; // per column: the end of its last span
  let cluster: Positioned<T>[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    const cols = Math.max(...cluster.map((p) => p.col), 0) + 1;
    for (const p of cluster) p.cols = cols;
    cluster = [];
    colEnds.length = 0;
  };

  for (const span of sorted) {
    if (cluster.length > 0 && span.startMin >= clusterEnd) closeCluster();
    let col = colEnds.findIndex((end) => end <= span.startMin);
    if (col === -1) col = colEnds.length;
    colEnds[col] = span.endMin;
    const positioned: Positioned<T> = { ...span, col, cols: 1 };
    cluster.push(positioned);
    placed.push(positioned);
    clusterEnd = Math.max(clusterEnd, span.endMin);
  }
  if (cluster.length > 0) closeCluster();
  return placed;
}
