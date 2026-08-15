export interface IndexRow {
  key: string;
  primary: string;
  secondary?: string;
  onClick: () => void;
}

export interface IndexGroup {
  title: string;
  rows: IndexRow[];
}

/** Flat navigation over everything on the map, grouped by kind — click a row to fly there. */
export function MapIndexPanel({ groups, onClose }: { groups: IndexGroup[]; onClose: () => void }) {
  const nonEmpty = groups.filter((g) => g.rows.length > 0);
  return (
    <aside className="map-index">
      <button className="map-popover-close" onClick={onClose} aria-label="Close">×</button>
      {nonEmpty.length === 0 && <p className="empty">Nothing on the map yet.</p>}
      {nonEmpty.map((group) => (
        <section key={group.title}>
          <h4>{group.title}</h4>
          {group.rows.map((row) => (
            <button key={row.key} className="location-row" onClick={row.onClick}>
              <span className="location-name">{row.primary}</span>
              {row.secondary && <span className="meta">{row.secondary}</span>}
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}
