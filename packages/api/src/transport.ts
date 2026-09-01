/**
 * The seam between the generated clients and each app's own HTTP concerns.
 *
 * Both surfaces talk to the same BFF but authenticate differently — the SPA rides a first-party
 * cookie the BFF owns, the app carries a bearer it refreshes itself — and only the app needs
 * timeouts, a retry budget and re-auth. Rather than generate twice, the clients call through here
 * and each app installs its own transport at startup, the way `apps/mobile/src/data/api/authProvider`
 * already hands the mutator its backend and token at call time.
 */
export type ApiTransport = <T>(url: string, init?: RequestInit) => Promise<T>;

let transport: ApiTransport | null = null;

/** Install the app's transport. Call once, before anything issues a request. */
export function setApiTransport(next: ApiTransport): void {
  transport = next;
}

/** Orval mutator. Paths already carry their BFF route prefix, so this prepends nothing. */
export function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  if (!transport) {
    throw new Error('@lupira/cal-api: no transport installed — call setApiTransport() during startup.');
  }
  return transport<T>(url, init);
}
