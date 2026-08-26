import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
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
import { FormRow } from '../FormRow';

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
            <Chip variant="outlined" label="LLM prompt" />
            <Chip variant="outlined" label={item.prompt.intent} />
            <Chip variant="outlined" label={`→ ${item.prompt.output}`} />
            {!item.prompt.enabled && <Chip variant="outlined" label="disabled" />}
          </div>
          <p className="payload-instruction">{item.prompt.instruction}</p>
          <Typography variant="caption" color="text.secondary" component="p">
            Fires {describeFire(item.prompt.fire.kind, item.prompt.fire.offsetMinutes, item.prompt.fire.allDayAt)}
            {item.prompt.tier ? ` · ${item.prompt.tier} model` : ''} · on miss: {item.prompt.onMiss}
            {item.prompt.tools?.length ? ` · tools: ${item.prompt.tools.join(', ')}` : ''}
          </Typography>
          <div className="chip-row">
            <Chip variant="outlined" label="Edit" onClick={() => setEditing('prompt')} />
            <Chip variant="outlined" color="error" label="Remove" onClick={() => clearPrompt.mutate({ id: item.id })} />
          </div>
        </div>
      )}
      {item.action && editing !== 'action' && (
        <div className="payload-card">
          <div className="payload-head">
            <Chip variant="outlined" label="Action" />
            <Chip variant="outlined" label={item.action.kind} />
            {!item.action.enabled && <Chip variant="outlined" label="disabled" />}
          </div>
          <pre className="json-view">{prettyJson(item.action.paramsJson)}</pre>
          <Typography variant="caption" color="text.secondary" component="p">
            Fires {describeFire(item.action.fire.kind, item.action.fire.offsetMinutes, item.action.fire.allDayAt)}
          </Typography>
          <div className="chip-row">
            <Chip variant="outlined" label="Edit" onClick={() => setEditing('action')} />
            <Chip variant="outlined" color="error" label="Remove" onClick={() => clearAction.mutate({ id: item.id })} />
          </div>
        </div>
      )}
      {!item.prompt && !item.action && editing === null && (
        <div className="chip-row">
          <Chip variant="outlined" label="+ LLM prompt" onClick={() => setEditing('prompt')} />
          <Chip variant="outlined" label="+ Action" onClick={() => setEditing('action')} />
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
    <FormRow>
      <TextField
        select
        label="Fires"
        value={fire.kind}
        onChange={(e) => onChange({ ...fire, kind: e.target.value as PromptFire['kind'] })}
      >
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
            value={fire.offsetMinutes ?? -30}
            onChange={(e) => onChange({ ...fire, offsetMinutes: Number(e.target.value) })}
          />
        </Tooltip>
      )}
      {fire.kind === 'AllDayAt' && (
        <TextField
          type="time"
          value={(fire.allDayAt ?? '09:00:00').slice(0, 5)}
          onChange={(e) => onChange({ ...fire, allDayAt: `${e.target.value}:00` })}
        />
      )}
    </FormRow>
  );
}

type PromptFormValues = {
  intent: PromptIntent;
  instruction: string;
  output: OutputKind;
  tools: string;
  tier: '' | ModelTier;
  onMiss: FallbackMode;
  fire: PromptFire;
  enabled: boolean;
};

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
  const { control, handleSubmit } = useForm<PromptFormValues>({
    defaultValues: {
      intent: item.prompt?.intent ?? 'EnrichRecord',
      instruction: item.prompt?.instruction ?? '',
      output: item.prompt?.output ?? 'RecordEdit',
      tools: item.prompt?.tools?.join(', ') ?? '',
      tier: item.prompt?.tier ?? '',
      onMiss: item.prompt?.onMiss ?? 'Retry',
      fire: item.prompt?.fire ?? { kind: 'OnStart', offsetMinutes: null, allDayAt: null },
      enabled: item.prompt?.enabled ?? true,
    },
  });

  const submit = handleSubmit((v) => {
    const body: SetItemPromptRequest = {
      intent: v.intent,
      instruction: v.instruction,
      output: v.output,
      tools: v.tools ? v.tools.split(',').map((t) => t.trim()).filter(Boolean) : null,
      tier: v.tier || null,
      onMiss: v.onMiss,
      fire: v.fire,
      enabled: v.enabled,
    };
    set.mutate({ id: item.id, data: body });
  });

  return (
    <form className="payload-form" onSubmit={submit}>
      <FormRow>
        <Controller
          name="intent"
          control={control}
          render={({ field }) => (
            <TextField select label="Intent" {...field}>
              {Object.values(PromptIntent).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="output"
          control={control}
          render={({ field }) => (
            <TextField select label="Output" {...field}>
              {Object.values(OutputKind).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </FormRow>
      <Controller
        name="instruction"
        control={control}
        render={({ field }) => (
          <TextField multiline minRows={3} placeholder="Instruction for the agent…" {...field} required />
        )}
      />
      <FormRow>
        <Controller
          name="tier"
          control={control}
          render={({ field }) => (
            <TextField
              select
              label="Tier"
              {...field}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">(default)</MenuItem>
              {Object.values(ModelTier).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name="onMiss"
          control={control}
          render={({ field }) => (
            <TextField select label="On miss" {...field}>
              {Object.values(FallbackMode).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </FormRow>
      <Controller
        name="tools"
        control={control}
        render={({ field }) => <TextField placeholder="Tools (comma-separated, optional)" {...field} />}
      />
      <Controller
        name="fire"
        control={control}
        render={({ field }) => <FireEditor fire={field.value} onChange={field.onChange} />}
      />
      <Controller
        name="enabled"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            label="Enabled"
          />
        )}
      />
      <div className="chip-row">
        <Button variant="contained" type="submit" disabled={set.isPending}>
          Save prompt
        </Button>
        <Button variant="outlined" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type ActionFormValues = {
  kind: ActionKind;
  paramsJson: string;
  fire: PromptFire;
  enabled: boolean;
};

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
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ActionFormValues>({
    defaultValues: {
      kind: item.action?.kind ?? 'Notify',
      paramsJson: item.action ? prettyJson(item.action.paramsJson) : '{}',
      fire: item.action?.fire ?? { kind: 'OnStart', offsetMinutes: null, allDayAt: null },
      enabled: item.action?.enabled ?? true,
    },
  });

  const submit = handleSubmit((v) => {
    const body: SetItemActionRequest = {
      kind: v.kind,
      paramsJson: v.paramsJson,
      fire: v.fire,
      enabled: v.enabled,
    };
    set.mutate({ id: item.id, data: body });
  });

  return (
    <form className="payload-form" onSubmit={submit}>
      <FormRow>
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <TextField select label="Kind" {...field}>
              {Object.values(ActionKind).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </FormRow>
      <Controller
        name="paramsJson"
        control={control}
        rules={{
          validate: (v) => {
            try {
              JSON.parse(v);
              return true;
            } catch {
              return 'Params must be valid JSON.';
            }
          },
        }}
        render={({ field }) => (
          <Tooltip title="Frozen params JSON (e.g. a SendCheckIn message)">
            <TextField multiline minRows={3} slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} {...field} />
          </Tooltip>
        )}
      />
      <Controller
        name="fire"
        control={control}
        render={({ field }) => <FireEditor fire={field.value} onChange={field.onChange} />}
      />
      <Controller
        name="enabled"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            label="Enabled"
          />
        )}
      />
      {errors.paramsJson && <p className="error-text">{errors.paramsJson.message}</p>}
      <div className="chip-row">
        <Button variant="contained" type="submit" disabled={set.isPending}>
          Save action
        </Button>
        <Button variant="outlined" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
