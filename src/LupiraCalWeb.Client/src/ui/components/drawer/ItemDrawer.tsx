import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useDeleteItem, useGetItem, useUpdateItem } from '../../../data/api/lupiraCalApi';
import {
  AvailabilityStatus,
  ItemStatus,
  type CalendarItemDto,
  type UpdateCalendarItemRequest,
} from '../../../data/api/models';
import { describeRrule, RRULE_PRESETS } from '@lupira/cal-domain/rrule';
import { fmtDate, parseYmd } from '@lupira/cal-domain/time';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';
import { AttendeesPanel } from './AttendeesPanel';
import { CalendarsPanel } from './CalendarsPanel';
import { CompletenessBadge } from './CompletenessBadge';
import { HierarchyPanel } from './HierarchyPanel';
import { isoToLocalInput, localInputToIso } from './inputs';
import { KindDetailsCard } from './KindDetailsCard';
import { MetadataPanel } from './MetadataPanel';
import { PayloadPanel } from './PayloadPanel';
import { RelationsPanel } from './RelationsPanel';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';

/** The item detail drawer (?item=<id>): every field the REST read model exposes, editable where the API allows. */
export function ItemDrawer({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { data: item, isLoading } = useGetItem(itemId);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconButton size="small" onClick={onClose} aria-label="Close">
            ✕
          </IconButton>
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
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const update = useUpdateItem({ mutation: { onSuccess: invalidate, onError } });
  const del = useDeleteItem({
    mutation: {
      onSuccess: () => {
        invalidate();
        onClose();
      },
      onError,
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
        <TextField
          variant="standard"
          fullWidth
          slotProps={{ input: { sx: { fontSize: '1.35rem', fontWeight: 600 } } }}
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
        <TextField select size="small" value={item.status ?? ''} onChange={(e) => patch({ status: e.target.value || null })} slotProps={{ select: { displayEmpty: true } }}>
          <MenuItem value="">(none)</MenuItem>
          {Object.values(ItemStatus).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        {item.details?.presence && (
          <>
            <label>Availability</label>
            <TextField
              select
              size="small"
              value={item.details.presence.status ?? ''}
              onChange={(e) => e.target.value && patch({ availability: e.target.value as AvailabilityStatus })}
              slotProps={{ select: { displayEmpty: true } }}
            >
              <MenuItem value="">(set…)</MenuItem>
              {Object.values(AvailabilityStatus).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
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
            <TextField
              type="datetime-local"
              size="small"
              defaultValue={isoToLocalInput(item.startsAt)}
              onBlur={(e) => {
                const iso = localInputToIso(e.target.value);
                if (iso && iso !== item.startsAt) patch({ startsAt: iso });
              }}
            />
            <span className="meta">→</span>
            <TextField
              type="datetime-local"
              size="small"
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
          <TextField
            select
            size="small"
            value={RRULE_PRESETS.some((p) => p.rrule === rrule) ? rrule : rrule ? 'custom' : ''}
            onChange={(e) => {
              if (e.target.value && e.target.value !== 'custom') {
                setRrule(e.target.value);
                patch({ recurrenceRule: e.target.value });
              }
            }}
            slotProps={{ select: { displayEmpty: true } }}
          >
            <MenuItem value="">never</MenuItem>
            {RRULE_PRESETS.map((p) => (
              <MenuItem key={p.rrule} value={p.rrule}>
                {p.label}
              </MenuItem>
            ))}
            {rrule && !RRULE_PRESETS.some((p) => p.rrule === rrule) && <MenuItem value="custom">custom</MenuItem>}
          </TextField>
          <TextField
            size="small"
            slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
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
        <TextField
          size="small"
          placeholder={item.locationLabel ? 'Change location…' : 'Add location…'}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => location && patch({ location })}
        />
      </section>

      <section className="drawer-section">
        <h3>Description</h3>
        <TextField
          size="small"
          multiline
          minRows={3}
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
            <Chip key={t} size="small" label={t} onDelete={() => patch({ tags: (item.tags ?? []).filter((x) => x !== t) })} />
          ))}
          <TextField
            size="small"
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
      <HierarchyPanel item={item} />
      <RelationsPanel itemId={item.id} />
      <MetadataPanel itemId={item.id} metadata={item.metadata} />

      <div className="drawer-footer">
        <span className="meta" title={`iCal UID ${item.externalId} · etag ${item.etag}`}>
          {item.category ?? 'General'} item
        </span>
        <Button variant="outlined" color="error" size="small" onClick={() => del.mutate({ id: item.id })} disabled={del.isPending}>
          Delete item
        </Button>
      </div>
    </div>
  );
}
