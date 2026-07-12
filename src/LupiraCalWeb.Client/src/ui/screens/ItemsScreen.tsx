import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ItemCategory, ItemStatus, type CalendarItemOccurrenceDto, type ContainerDto } from '../../data/api/models';
import { fmtDate, fmtDateTime, parseYmd } from '../../domain/time';
import { RANGE_PRESETS } from '../../domain/searchRange';
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

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const byId = new Map(calendars.map((c) => [c.id, c]));
  const secondaryCount = [filters.tag, filters.cal, filters.category, filters.status].filter(Boolean).length;

  const itemHref = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('item', id);
    return `?${next.toString()}`;
  };

  const filterControls = (
    <>
      <input
        className="text-input tag-input"
        placeholder="tag"
        defaultValue={filters.tag}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setParam('tag', (e.target as HTMLInputElement).value || null);
        }}
        onBlur={(e) => setParam('tag', e.target.value || null)}
      />
      <select value={filters.cal} onChange={(e) => setParam('cal', e.target.value || null)} aria-label="Calendar">
        <option value="">All calendars</option>
        {calendars.map((c) => (
          <option key={c.id} value={c.id}>
            {calendarLabel(c)}
          </option>
        ))}
      </select>
      <select
        value={filters.category}
        onChange={(e) => setParam('category', e.target.value || null)}
        aria-label="Category"
      >
        <option value="">Any category</option>
        {Object.values(ItemCategory).map((c) => (
          <option key={c} value={c}>
            {ITEM_CATEGORY_ICONS[c]} {c}
          </option>
        ))}
      </select>
      <select value={filters.status} onChange={(e) => setParam('status', e.target.value || null)} aria-label="Status">
        <option value="">Any status</option>
        {Object.values(ItemStatus).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </>
  );

  const rangeControls = (
    <>
      <div className="seg">
        {RANGE_PRESETS.map((r) => (
          <button
            key={r}
            className={`seg-btn ${filters.range === r ? 'active' : ''}`}
            onClick={() => setParam('range', r === 'upcoming' ? null : r)}
          >
            {r}
          </button>
        ))}
      </div>
      {filters.range === 'custom' && (
        <>
          <input
            className="text-input"
            type="date"
            value={filters.from}
            onChange={(e) => setParam('from', e.target.value || null)}
            aria-label="From"
          />
          <input
            className="text-input"
            type="date"
            value={filters.to}
            onChange={(e) => setParam('to', e.target.value || null)}
            aria-label="To"
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
          <input
            className="text-input"
            placeholder="Search title/description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        {rangeControls}
        {isPhone ? (
          <button className="btn" onClick={() => setSheetOpen(true)}>
            ☰ Filters{secondaryCount > 0 ? ` (${secondaryCount})` : ''}
          </button>
        ) : (
          filterControls
        )}
      </div>

      <div className="location-list items-list">
        {occurrences.map((o, i) => (
          <ItemRow key={`${o.id}-${o.start}-${i}`} occurrence={o} byId={byId} href={itemHref(o.id)} />
        ))}
        {!isLoading && occurrences.length === 0 && !error && <p className="empty">No items match.</p>}
        {error && <p className="empty">{errText(error) ?? 'Search failed.'}</p>}
      </div>
      {hasNextPage && (
        <button className="btn items-more" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading…' : `Load ${SEARCH_PAGE_SIZE} more`}
        </button>
      )}

      {sheetOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="sheet items-sheet">{filterControls}</div>
        </>
      )}
    </div>
  );
}

function ItemRow({
  occurrence: o,
  byId,
  href,
}: {
  occurrence: CalendarItemOccurrenceDto;
  byId: Map<string, ContainerDto>;
  href: string;
}) {
  const containers = o.calendarIds.map((id) => byId.get(id)).filter((c): c is ContainerDto => !!c);
  const first = containers[0];
  return (
    <Link to={href} className="location-row">
      <span className="kind-icon">{(o.category && ITEM_CATEGORY_ICONS[o.category]) || '📅'}</span>
      <span className="location-name">{o.title || '(untitled)'}</span>
      {o.tags?.map((t) => (
        <span key={t} className="tag-chip">
          {t}
        </span>
      ))}
      {o.status && o.status !== ItemStatus.Confirmed && <span className="badge">{o.status.toLowerCase()}</span>}
      {first && (
        <span className="meta items-cal">
          <span className="color-dot" style={{ background: calendarColor(first) }} />
          {calendarLabel(first)}
          {containers.length > 1 ? ` +${containers.length - 1}` : ''}
        </span>
      )}
      <span className="meta items-when">{whenOf(o)}</span>
    </Link>
  );
}

/** All-day starts are midnight UTC — render the UTC date part; local conversion can shift the day. */
function whenOf(o: CalendarItemOccurrenceDto): string {
  if (o.isAllDay) return fmtDate(parseYmd(o.start.slice(0, 10)));
  return fmtDateTime(new Date(o.start));
}
