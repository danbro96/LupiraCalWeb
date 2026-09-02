import type { LocationFix } from '../domain/locationFix';
import { toNdjsonLine } from '../domain/locationFix';

/** The ingest call, hand-written on purpose: it authenticates with
 *  `Authorization: DeviceKey {keyId}.{secret}`, and the OpenAPI document declares only a Bearer
 *  scheme, so the generated client cannot express it. It still goes through the BFF like everything
 *  else — the BFF has Anonymous ingest routes that check the header shape and forward it untouched,
 *  because only location-api holds the keys. */

/** The server stops reading after this many lines and rejects the remainder as `batch_too_large`. */
export const MAX_BATCH_LINES = 10_000;

export type IngestReject = { seq?: number | null; reason: string };

export type IngestReceipt = {
  submitted: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  highWaterSeq?: number | null;
  paused: boolean;
  rejects: IngestReject[];
};

export type IngestCursor = { deviceId: string; lastSeq?: number | null; lastTs?: string | null };

/** Raised on 401 — the device was retired or its key revoked server-side. The caller must stop
 *  tracking and re-register rather than retrying, which would loop forever. */
export class DeviceRevokedError extends Error {
  constructor() {
    super('This device is no longer registered with the location service.');
    this.name = 'DeviceRevokedError';
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `DeviceKey ${apiKey}` };
}

async function ingestFetch(baseUrl: string, path: string, apiKey: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { ...authHeaders(apiKey), ...(init?.headers ?? {}) },
  });
  if (response.status === 401) throw new DeviceRevokedError();
  return response;
}

/** Uploads a batch. The response is always 202 — even an all-rejected batch, and even while paused —
 *  so the receipt, not the status code, is what the caller reconciles against. */
export async function postFixes(baseUrl: string, apiKey: string, fixes: LocationFix[]): Promise<IngestReceipt> {
  const body = fixes.map(toNdjsonLine).join('\n');
  const response = await ingestFetch(baseUrl, '/ingest/location', apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body,
  });
  if (!response.ok) throw new Error(`ingest failed (${response.status})`);
  return (await response.json()) as IngestReceipt;
}

/** The highest seq the server has ever accepted for this device. Survives our local queue, so it is
 *  the repair path after a reinstall. */
export async function fetchCursor(baseUrl: string, apiKey: string): Promise<IngestCursor> {
  const response = await ingestFetch(baseUrl, '/ingest/location/cursor', apiKey);
  if (!response.ok) throw new Error(`cursor fetch failed (${response.status})`);
  return (await response.json()) as IngestCursor;
}

export async function fetchTrackingState(baseUrl: string, apiKey: string): Promise<{ paused: boolean }> {
  const response = await ingestFetch(baseUrl, '/ingest/location/state', apiKey);
  if (!response.ok) throw new Error(`state fetch failed (${response.status})`);
  return (await response.json()) as { paused: boolean };
}
