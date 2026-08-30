import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { IconName } from '@lupira/cal-tokens/icons';
import type { CalendarKind, ItemCategory } from '../../data/api/models';
import { CALENDAR_KIND_ICONS, ICON_BY_NAME, ITEM_CATEGORY_ICONS } from '../theme/kinds';

/** For an already-resolved concept name — grid entries carry one rather than a category. */
export function NamedIcon({ name, ...props }: { name: IconName } & SvgIconProps) {
  const Icon = ICON_BY_NAME[name];
  return <Icon fontSize="inherit" {...props} />;
}

export function CategoryIcon({ category, ...props }: { category?: ItemCategory | null } & SvgIconProps) {
  const Icon = ICON_BY_NAME[category ? ITEM_CATEGORY_ICONS[category] : 'event'];
  return <Icon fontSize="small" {...props} />;
}

export function KindIcon({ kind, ...props }: { kind?: CalendarKind | null } & SvgIconProps) {
  const Icon = ICON_BY_NAME[kind ? CALENDAR_KIND_ICONS[kind] : 'calendar'];
  return <Icon fontSize="small" {...props} />;
}
