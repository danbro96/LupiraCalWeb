import * as AuthSession from 'expo-auth-session';
import { logDebug } from '../../debug/log';
import { REQUEST_TIMEOUT_MS } from '../../domain/apiError';
import { OIDC_CLIENT_ID, OIDC_ISSUER } from './oidcConfig';

/** Token-endpoint failure classified for the refresh state machine. Definitive (400/401 from the endpoint —
 *  invalid_grant, revoked session) means the session is dead: clear it and demand a fresh sign-in. Everything
 *  else (discovery failure, transport, 5xx/429) is transient: keep the session and retry on a later trigger. */
export class RefreshError extends Error {
  readonly definitive: boolean;

  constructor(message: string, definitive: boolean) {
    super(message);
    this.name = 'RefreshError';
    this.definitive = definitive;
  }
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
};

// Discovery is cached in a module promise, but a launch-time blip must not poison the cache — null it on failure.
let discovery: Promise<AuthSession.DiscoveryDocument> | null = null;

export function getDiscovery(): Promise<AuthSession.DiscoveryDocument> {
  discovery ??= AuthSession.fetchDiscoveryAsync(OIDC_ISSUER).catch((e) => {
    discovery = null;
    throw new RefreshError(`OIDC discovery failed: ${String(e)}`, false);
  });
  return discovery;
}

/** Hand-rolled code exchange (not AuthSession.exchangeCodeAsync): a broken token response then surfaces its
 *  raw status + body slice instead of an opaque "JSON Parse error". */
export async function exchangeAuthCode(code: string, redirectUri: string, codeVerifier: string): Promise<TokenResponse> {
  const d = await getDiscovery();
  return postForm(d.tokenEndpoint!, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: OIDC_CLIENT_ID,
    code_verifier: codeVerifier,
  });
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const d = await getDiscovery();
  return postForm(d.tokenEndpoint!, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: OIDC_CLIENT_ID,
  });
}

async function postForm(url: string, fields: Record<string, string>): Promise<TokenResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      signal: controller.signal,
    });
  } catch (e) {
    throw new RefreshError(`Token endpoint unreachable: ${String(e)}`, false);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = (await resp.text().catch(() => '')).slice(0, 200);
    logDebug('auth', `token endpoint ${resp.status}: ${body}`);
    // invalid_grant etc. — the session is unrecoverable; 5xx/429 are the server's problem, keep trying.
    throw new RefreshError(`Token endpoint ${resp.status}`, resp.status === 400 || resp.status === 401);
  }

  const json = (await resp.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_in?: number }
    | null;
  if (!json?.access_token) throw new RefreshError('Token endpoint returned no access token.', false);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
  };
}

/** Payload-only JWT decode (no signature check — the server verifies; this is for display identity only). */
export function decodeJwt(token: string): { email?: string; name?: string; sub?: string } {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atobUrlSafe(payload)) as Record<string, unknown>;
    return {
      email: asString(json.email) ?? asString(json.preferred_username),
      name: asString(json.name) ?? asString(json.given_name),
      sub: asString(json.sub),
    };
  } catch {
    return {};
  }
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function atobUrlSafe(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return globalThis.atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}
