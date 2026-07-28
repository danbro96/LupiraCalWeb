import { describe, expect, it } from 'vitest';
import { isRetriableRequest, isTransientStatus, retryDelayMs } from './retryPolicy';

describe('isTransientStatus', () => {
  it('treats transport failure, throttling, and server errors as transient', () => {
    expect(isTransientStatus(0)).toBe(true);
    expect(isTransientStatus(429)).toBe(true);
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
  });

  it('treats client errors as terminal', () => {
    for (const s of [400, 401, 403, 404, 409]) expect(isTransientStatus(s)).toBe(false);
  });
});

describe('isRetriableRequest', () => {
  it('always replays reads', () => {
    expect(isRetriableRequest('GET', false)).toBe(true);
    expect(isRetriableRequest('head', false)).toBe(true);
  });

  it('replays writes only under an Idempotency-Key', () => {
    expect(isRetriableRequest('PUT', false)).toBe(false);
    expect(isRetriableRequest('POST', true)).toBe(true);
    expect(isRetriableRequest('DELETE', true)).toBe(true);
  });
});

describe('retryDelayMs', () => {
  it('honors a numeric Retry-After in seconds, capped', () => {
    expect(retryDelayMs(0, '2', () => 0)).toBe(2000);
    expect(retryDelayMs(0, '9999', () => 0)).toBe(10_000);
  });

  it('ignores a malformed Retry-After and backs off exponentially with jitter', () => {
    expect(retryDelayMs(0, 'soon', () => 0)).toBe(300);
    expect(retryDelayMs(1, null, () => 0)).toBe(600);
    expect(retryDelayMs(2, null, () => 1)).toBe(1500);
  });

  it('caps the backoff', () => {
    expect(retryDelayMs(10, null, () => 0)).toBe(10_000);
  });
});
