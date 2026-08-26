import { Link, useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useGetItem, useSearchItems } from '../../../data/api/lupiraCalApi';
import type { CalendarItemDto } from '../../../data/api/models';
import { fmtWhen } from '@lupira/cal-domain/time';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';
import { DrawerSection } from '../DrawerSection';
import { Row, RowName } from '../rows';

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
    <DrawerSection title="Hierarchy">
      {parent && (
        <Row component={Link} to={itemHref(parent.id)}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>↳ part of</Typography>
          <RowName>{parent.title || '(untitled)'}</RowName>
        </Row>
      )}
      {children.map((c) => (
        <Row component={Link} key={c.id} to={itemHref(c.id)}>
          <Box component="span" sx={{ fontSize: 22 }}>{(c.category && ITEM_CATEGORY_ICONS[c.category]) || '📅'}</Box>
          <RowName>{c.title || '(untitled)'}</RowName>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{fmtWhen(c.start, c.isAllDay)}</Typography>
        </Row>
      ))}
      {children.length > 0 && (
        <Button variant="text" component={Link} to={`/items?parent=${item.id}`}>
          open in list
        </Button>
      )}
    </DrawerSection>
  );
}
