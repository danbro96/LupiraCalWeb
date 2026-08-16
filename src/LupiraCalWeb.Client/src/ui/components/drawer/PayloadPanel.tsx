import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import {
  useClearItemAction,
  useClearItemPrompt,
  useSetItemAction,
  useSetItemPrompt,
} from '../../../data/api/lupiraCalApi';
import {
  ActionKind,
  FallbackMode,
  ModelTier,
  OutputKind,
  PromptFireKind,
  PromptIntent,
  type CalendarItemDto,
  type PromptFire,
  type SetItemActionRequest,
  type SetItemPromptRequest,
} from '../../../data/api/models';
import { describeFire } from '@lupira/cal-domain/fire';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { errText } from '../errText';
import { useSnackbar } from '../SnackbarHost';

/**
 * The event-bound payload (⚡): at most one of prompt/action per item (server-enforced XOR — a 409
 * from the API surfaces here). Server-side only, never projected to ICS.
 */
export function PayloadPanel({ item }: { item: CalendarItemDto }) {
  const [editing, setEditing] = useState<'prompt' | 'action' | null>(null);
  const invalidate = useInvalidateItems();
  const showSnack = useSnackbar();
  const onError = (e: unknown) => showSnack(errText(e) ?? 'Request failed.');
  const clearPrompt = useClearItemPrompt({ mutation: { onSuccess: invalidate, onError } });
  const clearAction = useClearItemAction({ mutation: { onSuccess: invalidate, onError } });

  return (
    <section className="drawer-section">
      <h3>⚡ Payload</h3>
      {item.prompt && editing !== 'prompt' && (
        <div className="payload-card">
          <div className="payload-head">
            <Chip size="small" variant="outlined" label="LLM prompt" />
            <Chip size="small" variant="outlined" label={item.prompt.intent} />
            <Chip size="small" variant="outlined" label={`→ ${item.prompt.output}`} />
            {!item.prompt.enabled && <Chip size="small" variant="outlined" label="disabled" />}
          </div>
          <p className="payload-instruction">{item.prompt.instruction}</p>
          <p className="meta">
            Fires {describeFire(item.prompt.fire.kind, item.prompt.fire.offsetMinutes, item.prompt.fire.allDayAt)}
            {item.prompt.tier ? ` · ${item.prompt.tier} model` : ''} · on miss: {item.prompt.onMiss}
            {item.prompt.tools?.length ? ` · tools: ${item.prompt.tools.join(', ')}` : ''}
          </p>
          <div className="chip-row">
            <Chip size="small" variant="outlined" label="Edit" onClick={() => setEditing('prompt')} />
            <Chip size="small" variant="outlined" color="error" label="Remove" onClick={() => clearPrompt.mutate({ id: item.id })} />
          </div>
        </div>
      )}
      {item.action && editing !== 'action' && (
        <div className="payload-card">
          <div className="payload-head">
            <Chip size="small" variant="outlined" label="Action" />
            <Chip size="small" variant="outlined" label={item.action.kind} />
            {!item.action.enabled && <Chip size="small" variant="outlined" label="disabled" />}
          </div>
          <pre className="json-view">{prettyJson(item.action.paramsJson)}</pre>
          <p className="meta">
            Fires {describeFire(item.action.fire.kind, item.action.fire.offsetMinutes, item.action.fire.allDayAt)}
          </p>
          <div className="chip-row">
            <Chip size="small" variant="outlined" label="Edit" onClick={() => setEditing('action')} />
            <Chip size="small" variant="outlined" color="error" label="Remove" onClick={() => clearAction.mutate({ id: item.id })} />
          </div>
        </div>
      )}
      {!item.prompt && !item.action && editing === null && (
        <div className="chip-row">
          <Chip size="small" variant="outlined" label="+ LLM prompt" onClick={() => setEditing('prompt')} />
          <Chip size="small" variant="outlined" label="+ Action" onClick={() => setEditing('action')} />
        </div>
      )}
      {editing === 'prompt' && <PromptForm item={item} onDone={() => setEditing(null)} />}
      {editing === 'action' && <ActionForm item={item} onDone={() => setEditing(null)} />}
    </section>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function FireEditor({ fire, onChange }: { fire: PromptFire; onChange: (f: PromptFire) => void }) {
  return (
    <div className="form-row">
      <label>Fires</label>
      <TextField select size="small" value={fire.kind} onChange={(e) => onChange({ ...fire, kind: e.target.value as PromptFire['kind'] })}>
        {Object.values(PromptFireKind).map((k) => (
          <MenuItem key={k} value={k}>
            {k}
          </MenuItem>
        ))}
      </TextField>
      {fire.kind === 'Offset' && (
        <Tooltip title="Minutes relative to start (negative = before)">
          <TextField
            type="number"
            size="small"
            value={fire.offsetMinutes ?? -30}
            onChange={(e) => onChange({ ...fire, offsetMinutes: Number(e.target.value) })}
          />
        </Tooltip>
      )}
      {fire.kind === 'AllDayAt' && (
        <TextField
          type="time"
          size="small"
          value={(fire.allDayAt ?? '09:00:00').slice(0, 5)}
          onChange={(e) => onChange({ ...fire, allDayAt: `${e.target.value}:00` })}
        />
      )}
    </div>
  );
}

function PromptForm({ item, onDone }: { item: CalendarItemDto; onDone: () => void }) {
  const invalidate = useInvalidateItems();
  const showSnack = useSnackbar();
  const set = useSetItemPrompt({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
      onError: (e) => showSnack(errText(e) ?? 'Request failed.'),
    },
  });
  const [form, setForm] = useState<SetItemPromptRequest>(() => ({
    intent: item.prompt?.intent ?? 'EnrichRecord',
    instruction: item.prompt?.instruction ?? '',
    output: item.prompt?.output ?? 'RecordEdit',
    tools: item.prompt?.tools ?? null,
    tier: item.prompt?.tier ?? null,
    onMiss: item.prompt?.onMiss ?? 'Retry',
    fire: item.prompt?.fire ?? { kind: 'OnStart', offsetMinutes: null, allDayAt: null },
    enabled: item.prompt?.enabled ?? true,
  }));

  return (
    <form
      className="payload-form"
      onSubmit={(e) => {
        e.preventDefault();
        set.mutate({ id: item.id, data: form });
      }}
    >
      <div className="form-row">
        <label>Intent</label>
        <TextField select size="small" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value as SetItemPromptRequest['intent'] })}>
          {Object.values(PromptIntent).map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <label>Output</label>
        <TextField select size="small" value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value as SetItemPromptRequest['output'] })}>
          {Object.values(OutputKind).map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <TextField
        size="small"
        multiline
        minRows={3}
        placeholder="Instruction for the agent…"
        value={form.instruction}
        onChange={(e) => setForm({ ...form, instruction: e.target.value })}
        required
      />
      <div className="form-row">
        <label>Tier</label>
        <TextField
          select
          size="small"
          value={form.tier ?? ''}
          onChange={(e) => setForm({ ...form, tier: (e.target.value || null) as SetItemPromptRequest['tier'] })}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="">(default)</MenuItem>
          {Object.values(ModelTier).map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <label>On miss</label>
        <TextField select size="small" value={form.onMiss ?? 'Retry'} onChange={(e) => setForm({ ...form, onMiss: e.target.value as SetItemPromptRequest['onMiss'] })}>
          {Object.values(FallbackMode).map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <TextField
        size="small"
        placeholder="Tools (comma-separated, optional)"
        value={form.tools?.join(', ') ?? ''}
        onChange={(e) =>
          setForm({ ...form, tools: e.target.value ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean) : null })
        }
      />
      <FireEditor fire={form.fire} onChange={(fire) => setForm({ ...form, fire })} />
      <FormControlLabel
        control={<Checkbox size="small" checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />}
        label="Enabled"
      />
      <div className="chip-row">
        <Button variant="contained" size="small" type="submit" disabled={set.isPending}>
          Save prompt
        </Button>
        <Button variant="outlined" size="small" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ActionForm({ item, onDone }: { item: CalendarItemDto; onDone: () => void }) {
  const invalidate = useInvalidateItems();
  const showSnack = useSnackbar();
  const set = useSetItemAction({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
      onError: (e) => showSnack(errText(e) ?? 'Request failed.'),
    },
  });
  const [form, setForm] = useState<SetItemActionRequest>(() => ({
    kind: item.action?.kind ?? 'Notify',
    paramsJson: item.action ? prettyJson(item.action.paramsJson) : '{}',
    fire: item.action?.fire ?? { kind: 'OnStart', offsetMinutes: null, allDayAt: null },
    enabled: item.action?.enabled ?? true,
  }));
  const [jsonError, setJsonError] = useState<string | null>(null);

  return (
    <form
      className="payload-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          JSON.parse(form.paramsJson);
        } catch {
          setJsonError('Params must be valid JSON.');
          return;
        }
        setJsonError(null);
        set.mutate({ id: item.id, data: form });
      }}
    >
      <div className="form-row">
        <label>Kind</label>
        <TextField select size="small" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SetItemActionRequest['kind'] })}>
          {Object.values(ActionKind).map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <Tooltip title="Frozen params JSON (e.g. a SendCheckIn message)">
        <TextField
          size="small"
          multiline
          minRows={3}
          slotProps={{ input: { sx: { fontFamily: 'monospace' } } }}
          value={form.paramsJson}
          onChange={(e) => setForm({ ...form, paramsJson: e.target.value })}
        />
      </Tooltip>
      <FireEditor fire={form.fire} onChange={(fire) => setForm({ ...form, fire })} />
      <FormControlLabel
        control={<Checkbox size="small" checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />}
        label="Enabled"
      />
      {jsonError && <p className="error-text">{jsonError}</p>}
      <div className="chip-row">
        <Button variant="contained" size="small" type="submit" disabled={set.isPending}>
          Save action
        </Button>
        <Button variant="outlined" size="small" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
