/// The one error the data layer throws. Status 0 = transport failure/timeout (no HTTP response at all).
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 0;
}

export const REQUEST_TIMEOUT_MS = 10_000;
