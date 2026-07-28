import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../domain/apiError';
import { setAuthPort, type AuthPort } from './authProvider';
import { apiFetch, type ApiEnvelope } from './mutator';

type FetchCall = { url: string; headers: Headers };
let calls: FetchCall[];
let responses: Array<() => Response>;

function stubPort(overrides: Partial<AuthPort> = {}): AuthPort {
  const port: AuthPort = {
    getApiUrl: () => 'https://bff.test',
    getToken: () => 'tok-1',
    refresh: vi.fn(async () => 'tok-1'),
    onSignIn: () => () => {},
    ...overrides,
  };
  setAuthPort(port);
  return port;
}

beforeEach(() => {
  calls = [];
  responses = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers) });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    return next();
  }));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (status: number, body: unknown = {}, headers?: Record<string, string>) => () =>
  new Response(JSON.stringify(body), { status, headers });

/// Runs apiFetch while draining the retry-delay timers fake time creates. The synchronous no-op catch marks
/// a rejection as handled before the timer drain, so expect(...).rejects doesn't race an unhandled-rejection.
async function run<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

describe('apiFetch', () => {
  it('prefixes the backend origin and injects the bearer', async () => {
    stubPort();
    responses.push(json(200, { ok: true }));
    const r = await run(apiFetch<ApiEnvelope<{ ok: boolean }>>('/api/me'));

    expect(calls[0].url).toBe('https://bff.test/api/me');
    expect(calls[0].headers.get('Authorization')).toBe('Bearer tok-1');
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it('sends no Authorization header in dev auto-auth mode', async () => {
    stubPort({ getToken: () => null });
    responses.push(json(200));
    await run(apiFetch('/api/me'));
    expect(calls[0].headers.has('Authorization')).toBe(false);
  });

  it('retries a transient 503 on reads and then succeeds', async () => {
    stubPort();
    responses.push(json(503), json(200, { ok: true }));
    const r = await run(apiFetch<ApiEnvelope<{ ok: boolean }>>('/api/me'));
    expect(calls).toHaveLength(2);
    expect(r.status).toBe(200);
  });

  it('does not retry an unkeyed write', async () => {
    stubPort();
    responses.push(json(503));
    await expect(run(apiFetch('/api/items/x', { method: 'PUT', body: '{}' }))).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(1);
  });

  it('retries a keyed write', async () => {
    stubPort();
    responses.push(json(503), json(200));
    const r = await run(apiFetch<ApiEnvelope<unknown>>('/api/items/x', {
      method: 'PUT',
      body: '{}',
      headers: { 'Idempotency-Key': '0198c0de-0000-7000-8000-000000000000' },
    }));
    expect(calls).toHaveLength(2);
    expect(r.status).toBe(200);
  });

  it('forces one refresh on 401 and replays with the rotated token', async () => {
    const refresh = vi.fn(async () => 'tok-2');
    stubPort({ refresh });
    responses.push(json(401), json(200));

    const r = await run(apiFetch<ApiEnvelope<unknown>>('/api/me'));
    expect(refresh).toHaveBeenCalledWith(true, 'tok-1');
    expect(calls[1].headers.get('Authorization')).toBe('Bearer tok-2');
    expect(r.status).toBe(200);
  });

  it('gives up when the forced refresh returns the same token', async () => {
    const refresh = vi.fn(async () => 'tok-1');   // transient failure upstream — nothing rotated
    stubPort({ refresh });
    responses.push(json(401));

    await expect(run(apiFetch('/api/me'))).rejects.toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('maps transport failure to ApiError(0) after the retry budget', async () => {
    stubPort();
    const failing = vi.fn(async () => {
      calls.push({ url: 'x', headers: new Headers() });
      throw new TypeError('network down');
    });
    vi.stubGlobal('fetch', failing);

    const attempt = apiFetch('/api/me');
    const guarded = attempt.catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const err = await guarded;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
    expect(failing.mock.calls.length).toBe(3);   // initial + MAX_RETRIES
  });

  it('returns undefined data for 204', async () => {
    stubPort();
    responses.push(() => new Response(null, { status: 204 }));
    const r = await run(apiFetch<ApiEnvelope<undefined>>('/api/items/x'));
    expect(r.status).toBe(204);
    expect(r.data).toBeUndefined();
  });
});
