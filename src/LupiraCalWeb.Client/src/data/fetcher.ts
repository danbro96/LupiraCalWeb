import { API_BASE_URL, GEO_API_BASE_URL } from '../config';

/**
 * Mutator for every orval-generated request. Auth rides the BFF's HttpOnly cookie session
 * (same-origin), so we send credentials and never a bearer. A 401 means the session expired →
 * bounce to the BFF sign-in, returning here afterwards. `customFetch` targets LupiraCalApi (`/api`),
 * `customFetchGeo` targets LupiraGeoApi (`/geo-api`) — both proxied same-origin by the BFF.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(base: string, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${url}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }
  if (res.status === 401) {
    const returnUrl = window.location.pathname + window.location.search;
    window.location.assign(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    throw new ApiError(401, 'Not authenticated');
  }
  if (!res.ok) {
    // 400/403/409 arrive as application/problem+json — surface the human-readable detail.
    const text = await res.text().catch(() => res.statusText);
    let message = text || res.statusText;
    try {
      const problem = JSON.parse(text) as { detail?: string; title?: string };
      message = problem.detail || problem.title || message;
    } catch {
      // not a problem document — keep the raw text
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function customFetch<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(API_BASE_URL, url, init);
}

export function customFetchGeo<T>(url: string, init?: RequestInit): Promise<T> {
  return request<T>(GEO_API_BASE_URL, url, init);
}

export default customFetch;
