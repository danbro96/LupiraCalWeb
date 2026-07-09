import { useState } from 'react';
import { useDeleteItem, useGetItem, useUpdateItem } from '../../../data/api/lupiraCalApi';
import {
  AvailabilityStatus,
  ItemStatus,
  type CalendarItemDto,
  type UpdateCalendarItemRequest,
} from '../../../data/api/models';
import { describeRrule, RRULE_PRESETS } from '../../../domain/rrule';
import { fmtDate, parseYmd } from '../../../domain/time';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';
import { AttendeesPanel } from './AttendeesPanel';
import { CalendarsPanel } from './CalendarsPanel';
import { CompletenessBadge } from './CompletenessBadge';
import { isoToLocalInput, localInputToIso } from './inputs';
import { KindDetailsCard } from './KindDetailsCard';
import { MetadataPanel } from './MetadataPanel';
import { PayloadPanel } from './PayloadPanel';
import { RelationsPanel } from './RelationsPanel';
import { errText } from '../errText';

/** The item detail drawer (?item=<id>): every field the REST read model exposes, editable where the API allows. */
export function ItemDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { data: item, isLoading } = useGetItem(itemId);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {isLoading && <p className="meta drawer-pad">Loading…</p>}
        {!isLoading && !item && <p className="meta drawer-pad">Item not found (or no access).</p>}
        {item && <DrawerBody key={item.etag} item={item} onClose={onClose} />}
      </aside>
    </div>
  );
}

function DrawerBody({ item, onClose }: { item: CalendarItemDto; onClose: () => void }) {
  const invalidate = useInvalidateItems();
  const update = useUpdateItem({ mutation: { onSuccess: invalidate } });
  const del = useDeleteItem({
    mutation: {
      onSuccess: () => {
        invalidate();
        onClose();
      },
    },
  });
  const patch = (data: UpdateCalendarItemRequest) => update.mutate({ id: item.id, data });

  const [title, setTitle] = useState(item.title ?? '');
  const [description, setDescription] = useState(item.description ?? '');
  const [location, setLocation] = useState('');
  const [rrule, setRrule] = useState(item.recurrenceRule ?? '');
  const [newTag, setNewTag] = useState('');

  return (
    <div className="drawer-pad">
      <div className="drawer-title-row">
        {item.category && item.category !== 'General' && (
          <span className="kind-icon" title={item.category}>
            {ITEM_CATEGORY_ICONS[item.category] ?? ''}
          </span>
        )}
        <input
          className="title-input"
          value={title}
          placeholder="(untitled)"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== (item.title ?? '') && patch({ title })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <CompletenessBadge score={item.completeness} />
      </div>

      <div className="form-row">
        <label>Status</label>
        <select value={item.status ?? ''} onChange={(e) => patch({ status: e.target.value || null })}>
          <option value="">(none)</option>
          {Object.values(ItemStatus).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {item.details?.presence && (
          <>
            <label>Availability</label>
            <select
              value={item.details.presence.status ?? ''}
              onChange={(e) => e.target.value && patch({ availability: e.target.value as AvailabilityStatus })}
            >
              <option value="">(set…)</option>
              {Object.values(AvailabilityStatus).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <section className="drawer-section">
        <h3>When</h3>
        {item.isAllDay ? (
          <p className="field-value">
            All day · {item.startDate ? fmtDate(parseYmd(item.startDate)) : '?'}
            {item.endDate && item.endDate !== item.startDate ? ` – ${fmtDate(parseYmd(item.endDate))}` : ''}
          </p>
        ) : (
          <div className="form-row">
            <input
              type="datetime-local"
              className="text-input"
              defaultValue={isoToLocalInput(item.startsAt)}
              onBlur={(e) => {
                const iso = localInputToIso(e.target.value);
                if (iso && iso !== item.startsAt) patch({ startsAt: iso });
              }}
            />
            <span className="meta">→</span>
            <input
              type="datetime-local"
              className="text-input"
              defaultValue={isoToLocalInput(item.endsAt)}
              onBlur={(e) => {
                const iso = localInputToIso(e.target.value);
                if (iso && iso !== item.endsAt) patch({ endsAt: iso });
              }}
            />
          </div>
        )}
        <div className="form-row">
          <label>Repeats</label>
          <select
            value={RRULE_PRESETS.some((p) => p.rrule === rrule) ? rrule : rrule ? 'custom' : ''}
            onChange={(e) => {
              if (e.target.value && e.target.value !== 'custom') {
                setRrule(e.target.value);
                patch({ recurrenceRule: e.target.value });
              }
            }}
          >
            <option value="">never</option>
            {RRULE_PRESETS.map((p) => (
              <option key={p.rrule} value={p.rrule}>
                {p.label}
              </option>
            ))}
            {rrule && !RRULE_PRESETS.some((p) => p.rrule === rrule) && <option value="custom">custom</option>}
          </select>
          <input
            className="text-input mono"
            placeholder="RRULE…"
            value={rrule}
            onChange={(e) => setRrule(e.target.value)}
            onBlur={() => rrule && rrule !== (item.recurrenceRule ?? '') && patch({ recurrenceRule: rrule })}
          />
        </div>
        {item.recurrenceRule && <p className="meta">{describeRrule(item.recurrenceRule)}</p>}
      </section>

      <section className="drawer-section">
        <h3>Where</h3>
        {item.locationLabel && <p className="field-value">📍 {item.locationLabel}</p>}
        <input
          className="text-input"
          placeholder={item.locationLabel ? 'Change location…' : 'Add location…'}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => location && patch({ location })}
        />
      </section>

      <section className="drawer-section">
        <h3>Description</h3>
        <textarea
          className="text-input notes-input"
          value={description}
          placeholder="Notes…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (item.description ?? '') && patch({ description })}
        />
      </section>

      <section className="drawer-section">
        <h3>Tags</h3>
        <div className="chip-row">
          {(item.tags ?? []).map((t) => (
            <span key={t} className="tag-chip">
              {t}{' '}
              <button className="tag-x" onClick={() => patch({ tags: (item.tags ?? []).filter((x) => x !== t) })}>
                ×
              </button>
            </span>
          ))}
          <input
            className="text-input tag-input"
            placeholder="+ tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTag.trim()) {
                patch({ tags: [...(item.tags ?? []), newTag.trim()] });
                setNewTag('');
              }
            }}
          />
        </div>
      </section>

      <KindDetailsCard details={item.details} />
      <PayloadPanel item={item} />
      <AttendeesPanel item={item} />
      <CalendarsPanel item={item} />
      <RelationsPanel itemId={item.id} />
      <MetadataPanel itemId={item.id} metadata={item.metadata} />

      {errText(update.error) && <p className="error-text">{errText(update.error)}</p>}
      <div className="drawer-footer">
        <span className="meta" title={`iCal UID ${item.externalId} · etag ${item.etag}`}>
          {item.category ?? 'General'} item
        </span>
        <button className="btn destructive" onClick={() => del.mutate({ id: item.id })} disabled={del.isPending}>
          Delete item
        </button>
      </div>
    </div>
  );
}
