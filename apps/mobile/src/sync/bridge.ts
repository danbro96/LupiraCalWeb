import { v7 as uuidv7 } from 'uuid';
import type { BridgeInboxRow } from '../../modules/lupira-bridge/src';
import { LupiraBridge } from '../../modules/lupira-bridge/src';
import type { Db } from '../data/db/types';
import { deterministicIdFor } from '../data/ids';
import * as mirror from '../data/mirror';
import type { CalCapturePayload, ParsedCalRow } from '../domain/bridgeTranslate';
import { PENDING_PREFIX, sourceKeyOfPendingMarker, translateCalRow } from '../domain/bridgeTranslate';
import { currentHorizon } from '../domain/materialize';
import type { ClientOp } from '../domain/ops';
import { logDebug } from '../debug/log';
import { enqueue } from './outbox';

/// Impure half of the write-back: pull captured provider edits from the Kotlin inbox, resolve ids
/// (pending markers → deterministic aggregate ids), translate, enqueue through the normal outbox/LWW
/// path, re-point provider rows, ack. Idempotent across crashes: re-drained creates share the
/// deterministic sourceKey and revises converge via LWW.
export async function drainBridgeInbox(db: Db): Promise<number> {
  let rows: BridgeInboxRow[];
  try {
    rows = await LupiraBridge.drainInbox();
  } catch {
    return 0;   // module unavailable (e.g. account features not set up) — never fatal for a sync run
  }
  if (rows.length === 0) return 0;

  const ops: ClientOp[] = [];
  const assignments: { marker: string; syncId: string }[] = [];
  const ackIds: number[] = [];

  for (const row of rows) {
    if (row.domain !== 'cal') {
      ackIds.push(row.id);   // contacts arrive with S4
      continue;
    }
    const parsed = await parseRow(row);
    if (!parsed) {
      ackIds.push(row.id);
      continue;
    }
    const existing = await mirror.loadItem(db, parsed.itemId);
    const t = translateCalRow(parsed, existing?.doc ?? null);
    switch (t.kind) {
      case 'create':
        ops.push({ kind: 'item.create', itemId: t.itemId, sourceKey: t.sourceKey, calendarId: t.calendarId, core: t.core, commandId: uuidv7(), occurredAt: t.occurredAt });
        assignments.push({ marker: row.syncId!, syncId: t.itemId });
        break;
      case 'revise':
        ops.push({ kind: 'item.revise', itemId: t.itemId, core: t.core, commandId: uuidv7(), occurredAt: t.occurredAt });
        break;
      case 'delete':
        ops.push({ kind: 'item.delete', itemId: t.itemId, commandId: uuidv7(), occurredAt: t.occurredAt });
        break;
      case 'skip':
        logDebug('bridge', `inbox row ${row.id} skipped: ${t.reason}`);
        break;
    }
    ackIds.push(row.id);
  }

  if (ops.length > 0) await enqueue(db, ops, currentHorizon());
  for (const a of assignments) await LupiraBridge.assignEventSyncId(a.marker, a.syncId);
  await LupiraBridge.ackInbox(ackIds);
  logDebug('bridge', `drained ${rows.length} inbox rows → ${ops.length} ops`);
  return ops.length;
}

async function parseRow(row: BridgeInboxRow): Promise<ParsedCalRow | null> {
  let payload: CalCapturePayload;
  try {
    payload = JSON.parse(row.payload) as CalCapturePayload;
  } catch {
    logDebug('bridge', `inbox row ${row.id}: unparseable payload`);
    return null;
  }
  const occurredAt = new Date(row.capturedAt).toISOString();
  if (!row.syncId) return null;

  if (row.syncId.startsWith(PENDING_PREFIX)) {
    const sourceKey = sourceKeyOfPendingMarker(row.syncId);
    if (!sourceKey) return null;
    const itemId = await deterministicIdFor(sourceKey);
    // A pending row can also be a deletion (created in the stock app, drained, then deleted there).
    return { kind: row.kind === 'deleted' ? 'deleted' : 'created', itemId, sourceKey, payload, occurredAt };
  }
  if (!GUID_RE.test(row.syncId)) {
    logDebug('bridge', `inbox row ${row.id}: foreign sync id '${row.syncId}' dropped (pre-M7 spike row?)`);
    return null;
  }
  return { kind: row.kind === 'deleted' ? 'deleted' : 'revised', itemId: row.syncId, payload, occurredAt };
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
