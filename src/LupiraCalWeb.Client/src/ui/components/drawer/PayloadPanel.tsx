import { useState } from 'react';
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
import { describeFire } from '../../../domain/fire';
import { useInvalidateItems } from '../../../state/useInvalidate';
import { errText } from '../errText';

/**
 * The event-bound payload (⚡): at most one of prompt/action per item (server-enforced XOR — a 409
 * from the API surfaces here). Server-side only, never projected to ICS.
 */
export function PayloadPanel({ item }: { item: CalendarItemDto }) {
  const [editing, setEditing] = useState<'prompt' | 'action' | null>(null);
  const invalidate = useInvalidateItems();
  const clearPrompt = useClearItemPrompt({ mutation: { onSuccess: invalidate } });
  const clearAction = useClearItemAction({ mutation: { onSuccess: invalidate } });

  return (
    <section className="drawer-section">
      <h3>⚡ Payload</h3>
      {item.prompt && editing !== 'prompt' && (
        <div className="payload-card">
          <div className="payload-head">
            <span className="badge">LLM prompt</span>
            <span className="badge">{item.prompt.intent}</span>
            <span className="badge">→ {item.prompt.output}</span>
            {!item.prompt.enabled && <span className="badge severity-absent">disabled</span>}
          </div>
          <p className="payload-instruction">{item.prompt.instruction}</p>
          <p className="meta">
            Fires {describeFire(item.prompt.fire.kind, item.prompt.fire.offsetMinutes, item.prompt.fire.allDayAt)}
            {item.prompt.tier ? ` · ${item.prompt.tier} model` : ''} · on miss: {item.prompt.onMiss}
            {item.prompt.tools?.length ? ` · tools: ${item.prompt.tools.join(', ')}` : ''}
          </p>
          <div className="chip-row">
            <button className="chip" onClick={() => setEditing('prompt')}>
              Edit
            </button>
            <button className="chip danger" onClick={() => clearPrompt.mutate({ id: item.id })}>
              Remove
            </button>
          </div>
        </div>
      )}
      {item.action && editing !== 'action' && (
        <div className="payload-card">
          <div className="payload-head">
            <span className="badge">Action</span>
            <span className="badge">{item.action.kind}</span>
            {!item.action.enabled && <span className="badge severity-absent">disabled</span>}
          </div>
          <pre className="json-view">{prettyJson(item.action.paramsJson)}</pre>
          <p className="meta">
            Fires {describeFire(item.action.fire.kind, item.action.fire.offsetMinutes, item.action.fire.allDayAt)}
          </p>
          <div className="chip-row">
            <button className="chip" onClick={() => setEditing('action')}>
              Edit
            </button>
            <button className="chip danger" onClick={() => clearAction.mutate({ id: item.id })}>
              Remove
            </button>
          </div>
        </div>
      )}
      {!item.prompt && !item.action && editing === null && (
        <div className="chip-row">
          <button className="chip" onClick={() => setEditing('prompt')}>
            + LLM prompt
          </button>
          <button className="chip" onClick={() => setEditing('action')}>
            + Action
          </button>
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
      <select value={fire.kind} onChange={(e) => onChange({ ...fire, kind: e.target.value as PromptFire['kind'] })}>
        {Object.values(PromptFireKind).map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      {fire.kind === 'Offset' && (
        <input
          type="number"
          className="text-input"
          value={fire.offsetMinutes ?? -30}
          onChange={(e) => onChange({ ...fire, offsetMinutes: Number(e.target.value) })}
          title="Minutes relative to start (negative = before)"
        />
      )}
      {fire.kind === 'AllDayAt' && (
        <input
          type="time"
          className="text-input"
          value={(fire.allDayAt ?? '09:00:00').slice(0, 5)}
          onChange={(e) => onChange({ ...fire, allDayAt: `${e.target.value}:00` })}
        />
      )}
    </div>
  );
}

function PromptForm({ item, onDone }: { item: CalendarItemDto; onDone: () => void }) {
  const invalidate = useInvalidateItems();
  const set = useSetItemPrompt({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
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
        <select value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value as SetItemPromptRequest['intent'] })}>
          {Object.values(PromptIntent).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label>Output</label>
        <select value={form.output} onChange={(e) => setForm({ ...form, output: e.target.value as SetItemPromptRequest['output'] })}>
          {Object.values(OutputKind).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <textarea
        className="text-input notes-input"
        placeholder="Instruction for the agent…"
        value={form.instruction}
        onChange={(e) => setForm({ ...form, instruction: e.target.value })}
        required
      />
      <div className="form-row">
        <label>Tier</label>
        <select
          value={form.tier ?? ''}
          onChange={(e) => setForm({ ...form, tier: (e.target.value || null) as SetItemPromptRequest['tier'] })}
        >
          <option value="">(default)</option>
          {Object.values(ModelTier).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label>On miss</label>
        <select value={form.onMiss ?? 'Retry'} onChange={(e) => setForm({ ...form, onMiss: e.target.value as SetItemPromptRequest['onMiss'] })}>
          {Object.values(FallbackMode).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <input
        className="text-input"
        placeholder="Tools (comma-separated, optional)"
        value={form.tools?.join(', ') ?? ''}
        onChange={(e) =>
          setForm({ ...form, tools: e.target.value ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean) : null })
        }
      />
      <FireEditor fire={form.fire} onChange={(fire) => setForm({ ...form, fire })} />
      <label className="check-row">
        <input type="checkbox" checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        Enabled
      </label>
      {errText(set.error) && <p className="error-text">{errText(set.error)}</p>}
      <div className="chip-row">
        <button className="btn primary" type="submit" disabled={set.isPending}>
          Save prompt
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ActionForm({ item, onDone }: { item: CalendarItemDto; onDone: () => void }) {
  const invalidate = useInvalidateItems();
  const set = useSetItemAction({
    mutation: {
      onSuccess: () => {
        invalidate();
        onDone();
      },
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
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SetItemActionRequest['kind'] })}>
          {Object.values(ActionKind).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <textarea
        className="text-input notes-input mono"
        value={form.paramsJson}
        onChange={(e) => setForm({ ...form, paramsJson: e.target.value })}
        title="Frozen params JSON (e.g. a SendCheckIn message)"
      />
      <FireEditor fire={form.fire} onChange={(fire) => setForm({ ...form, fire })} />
      <label className="check-row">
        <input type="checkbox" checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        Enabled
      </label>
      {(jsonError ?? errText(set.error)) && <p className="error-text">{jsonError ?? errText(set.error)}</p>}
      <div className="chip-row">
        <button className="btn primary" type="submit" disabled={set.isPending}>
          Save action
        </button>
        <button className="btn" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
