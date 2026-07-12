import { Link, useSearchParams } from 'react-router-dom';
import { useGetItem, useSearchItems } from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { fmtWhen } from '../../../domain/time';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';

/** Parent link + direct children (ParentItemId nesting — distinct from cross-API Relations). */
export function HierarchyPanel({ item }: { item: CalendarItemDto }) {
  const [params] = useSearchParams();
  const { data: parent } = useGetItem(item.parentItemId ?? '', { query: { enabled: !!item.parentItemId } });
  const { data: childOccs } = useSearchItems({ parentId: item.id, take: 100 });

  // Recurring children repeat per occurrence — keep the first per item.
  const children = [...new Map((childOccs ?? []).map((o) => [o.id, o])).values()];
  if (!item.parentItemId && children.length === 0) return null;

  const itemHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('item', id);
    return `?${next.toString()}`;
  };

  return (
    <section className="drawer-section">
      <h3>Hierarchy</h3>
      {parent && (
        <Link to={itemHref(parent.id)} className="location-row">
          <span className="meta">↳ part of</span>
          <span className="location-name">{parent.title || '(untitled)'}</span>
        </Link>
      )}
      {children.map((c) => (
        <Link key={c.id} to={itemHref(c.id)} className="location-row">
          <span className="kind-icon">{(c.category && ITEM_CATEGORY_ICONS[c.category]) || '📅'}</span>
          <span className="location-name">{c.title || '(untitled)'}</span>
          <span className="meta">{fmtWhen(c.start, c.isAllDay)}</span>
        </Link>
      ))}
      {children.length > 0 && (
        <Link className="linklike" to={`/items?parent=${item.id}`}>
          open in list
        </Link>
      )}
    </section>
  );
}
