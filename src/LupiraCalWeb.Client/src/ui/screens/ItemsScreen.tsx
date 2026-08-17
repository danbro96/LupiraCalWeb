import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useGetItem } from '../../data/api/lupiraCalApi';
import { useGetContact } from '../../data/api-contact/lupiraContactApi';
import { ItemCategory, ItemStatus, OriginKind, type CalendarItemOccurrenceDto, type ContainerDto } from '../../data/api/models';
import { groupOccurrences } from '@lupira/cal-domain/itemTree';
import { fmtWhen } from '@lupira/cal-domain/time';
import { RANGE_PRESETS } from '@lupira/cal-domain/searchRange';
import { calendarLabel, useContainers } from '../../state/useContainers';
import { SEARCH_PAGE_SIZE, useItemSearch } from '../../state/useItemSearch';
import { errText } from '../components/errText';
import { calendarColor, ITEM_CATEGORY_ICONS } from '../theme/kinds';
import { useIsPhone } from '../useIsPhone';

/** Global list/search over every readable calendar; rows deep-link into the ?item= drawer. */
export function ItemsScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
  const { calendars } = useContainers();
  const { filters, occurrences, isLoading, isFetching, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useItemSearch();
  const [search, setSearch] = useState(filters.q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { data: drillParent } = useGetItem(filters.parent, { query: { enabled: !!filters.parent } });
  const { data: drillContact } = useGetContact(filters.contact, { query: { enabled: !!filters.contact } });

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  // Drill-down is a fresh scoped view: all children of one item, other filters reset.
  const drill = (id: string) => {
    setSearch('');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const k of ['item', 'q', 'tag', 'cal', 'category', 'status', 'range', 'from', 'to', 'contact']) next.delete(k);
      next.set('parent', id);
      return next;
    });
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byId = new Map(calendars.map((c) => [c.id, c]));
  const groups = groupOccurrences(occurrences);
  const secondaryCount = [filters.tag, filters.cal, filters.category, filters.status].filter(Boolean).length;

  // Birthdays are read-time contact projections, not stored items — link to the read-only card
  // (their synthetic id 404s the ?item= drawer); everything else opens the shared item drawer.
  const occHref = (o: CalendarItemOccurrenceDto) => {
    const next = new URLSearchParams(searchParams);
    next.delete('item');
    next.delete('birthday');
    next.delete('year');
    if (o.origin?.kind === OriginKind.Birthday) {
      next.set('birthday', o.origin.sourceId);
      next.set('year', o.start.slice(0, 4));
    } else {
      next.set('item', o.id);
    }
    return `?${next.toString()}`;
  };

  const filterControls = (
    <>
      <TextField
        size="small"
        placeholder="tag"
        defaultValue={filters.tag}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setParam('tag', (e.target as HTMLInputElement).value || null);
        }}
        onBlur={(e) => setParam('tag', e.target.value || null)}
      />
      <TextField
        select
        size="small"
        value={filters.cal}
        onChange={(e) => setParam('cal', e.target.value || null)}
        slotProps={{ htmlInput: { 'aria-label': 'Calendar' }, select: { displayEmpty: true } }}
      >
        <MenuItem value="">All calendars</MenuItem>
        {calendars.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {calendarLabel(c)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        value={filters.category}
        onChange={(e) => setParam('category', e.target.value || null)}
        slotProps={{ htmlInput: { 'aria-label': 'Category' }, select: { displayEmpty: true } }}
      >
        <MenuItem value="">Any category</MenuItem>
        {Object.values(ItemCategory).map((c) => (
          <MenuItem key={c} value={c}>
            {ITEM_CATEGORY_ICONS[c]} {c}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        value={filters.status}
        onChange={(e) => setParam('status', e.target.value || null)}
        slotProps={{ htmlInput: { 'aria-label': 'Status' }, select: { displayEmpty: true } }}
      >
        <MenuItem value="">Any status</MenuItem>
        {Object.values(ItemStatus).map((s) => (
          <MenuItem key={s} value={s}>
            {s}
          </MenuItem>
        ))}
      </TextField>
    </>
  );

  const rangeControls = (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filters.range}
        onChange={(_, nv) => nv != null && setParam('range', nv === 'upcoming' ? null : nv)}
      >
        {RANGE_PRESETS.map((r) => (
          <ToggleButton key={r} value={r}>
            {r}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {filters.range === 'custom' && (
        <>
          <TextField
            size="small"
            type="date"
            value={filters.from}
            onChange={(e) => setParam('from', e.target.value || null)}
            slotProps={{ htmlInput: { 'aria-label': 'From' } }}
          />
          <TextField
            size="small"
            type="date"
            value={filters.to}
            onChange={(e) => setParam('to', e.target.value || null)}
            slotProps={{ htmlInput: { 'aria-label': 'To' } }}
          />
        </>
      )}
    </>
  );

  return (
    <div className="page items-page">
      <div className="page-head">
        <h2>Items</h2>
        {isFetching && !isFetchingNextPage && <span className="meta">loading…</span>}
      </div>
      <div className="cal-filters items-filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', search || null);
          }}
        >
          <TextField
            size="small"
            placeholder="Search title/description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        {filters.parent || filters.contact ? (
          <>
            {filters.parent && (
              <span className="items-drill-chip">
                ↳ sub-items of {drillParent?.title ?? '…'}
                <button aria-label="Clear parent filter" onClick={() => setParam('parent', null)}>
                  ×
                </button>
              </span>
            )}
            {filters.contact && (
              <span className="items-drill-chip">
                👤 with {drillContact?.displayName ?? '…'}
                <button aria-label="Clear contact filter" onClick={() => setParam('contact', null)}>
                  ×
                </button>
              </span>
            )}
          </>
        ) : (
          rangeControls
        )}
        {isPhone ? (
          <Button variant="outlined" size="small" startIcon={<FilterListIcon />} onClick={() => setSheetOpen(true)}>
            Filters{secondaryCount > 0 ? ` (${secondaryCount})` : ''}
          </Button>
        ) : (
          filterControls
        )}
      </div>

      <div className="location-list items-list">
        {groups.map((g, gi) => {
          const hasNested = g.children.length > 0;
          const open = !collapsed.has(g.occ.id);
          return (
            <Fragment key={`${g.occ.id}-${g.occ.start}-${gi}`}>
              <ItemRow
                occurrence={g.occ}
                byId={byId}
                href={occHref(g.occ)}
                open={hasNested ? open : undefined}
                onToggle={hasNested ? () => toggle(g.occ.id) : undefined}
                onDrill={drill}
                drilled={!!filters.parent}
              />
              {open &&
                g.children.map((c, ci) => (
                  <ItemRow key={`${c.id}-${c.start}-${ci}`} occurrence={c} byId={byId} href={occHref(c)} indent onDrill={drill} />
                ))}
            </Fragment>
          );
        })}
        {!isLoading && occurrences.length === 0 && !error && <p className="empty">No items match.</p>}
        {error && <p className="empty">{errText(error) ?? 'Search failed.'}</p>}
      </div>
      {hasNextPage && (
        <Button variant="outlined" size="small" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : `Load ${SEARCH_PAGE_SIZE} more`}
        </Button>
      )}

      <SwipeableDrawer
        anchor="bottom"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onOpen={() => setSheetOpen(true)}
        disableSwipeToOpen
        slotProps={{ paper: { sx: { maxHeight: '85dvh', p: 2 } } }}
      >
        {filterControls}
      </SwipeableDrawer>
    </div>
  );
}

function ItemRow({
  occurrence: o,
  byId,
  href,
  indent,
  open,
  onToggle,
  onDrill,
  drilled,
}: {
  occurrence: CalendarItemOccurrenceDto;
  byId: Map<string, ContainerDto>;
  href: string;
  indent?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onDrill?: (id: string) => void;
  drilled?: boolean;
}) {
  const containers = o.calendarIds.map((id) => byId.get(id)).filter((c): c is ContainerDto => !!c);
  const first = containers[0];
  const childCount = o.childCount;
  // The row itself is a Link — embedded buttons must not trigger the navigation.
  const stop = (e: React.MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  return (
    <Link to={href} className={`location-row${indent ? ' item-child' : ''}`}>
      {onToggle && (
        <button className="items-caret" aria-label={open ? 'Collapse sub-items' : 'Expand sub-items'} onClick={(e) => stop(e, onToggle)}>
          {open ? '▾' : '▸'}
        </button>
      )}
      <span className="kind-icon">{(o.category && ITEM_CATEGORY_ICONS[o.category]) || '📅'}</span>
      <span className="location-name">{o.title || '(untitled)'}</span>
      {!indent && o.parentItemId && !drilled && (
        <button className="items-parent-chip" onClick={(e) => stop(e, () => onDrill?.(o.parentItemId!))}>
          ↳ {o.parentTitle ?? 'parent'}
        </button>
      )}
      {o.tags?.map((t) => (
        <Chip key={t} size="small" label={t} />
      ))}
      {o.status && o.status !== ItemStatus.Confirmed && <Chip size="small" variant="outlined" label={o.status.toLowerCase()} />}
      {childCount > 0 && (
        <button className="items-subcount" onClick={(e) => stop(e, () => onDrill?.(o.id))}>
          {childCount} sub-item{childCount === 1 ? '' : 's'}
        </button>
      )}
      {first && (
        <span className="meta items-cal">
          <span className="color-dot" style={{ background: calendarColor(first) }} />
          {calendarLabel(first)}
          {containers.length > 1 ? ` +${containers.length - 1}` : ''}
        </span>
      )}
      <span className="meta items-when">{fmtWhen(o.start, o.isAllDay)}</span>
    </Link>
  );
}
