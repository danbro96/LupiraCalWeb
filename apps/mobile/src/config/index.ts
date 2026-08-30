export const APP_VERSION = '1.0.0';   // keep in lockstep with app.json expo.version

/** 'dev' = this backend's bypass; here that means sending nothing (the BFF's DevAuthHandler). */
export type AuthMode = 'oidc' | 'dev';

/** `urls.api` is the primary origin; multi-backend apps add keys. */
export type ApiPreset = {
  key: string;
  label: string;
  urls: { api: string } & Record<string, string>;
  authMode: AuthMode;
};

export const API_PRESETS: ApiPreset[] = [
  { key: 'prod', label: 'Production', urls: { api: 'https://cal.lupira.com' }, authMode: 'oidc' },
  { key: 'lan', label: 'LAN dev', urls: { api: 'http://192.168.14.108:5181' }, authMode: 'dev' },
  { key: 'emulator', label: 'Emulator dev', urls: { api: 'http://10.0.2.2:5181' }, authMode: 'dev' },
];

/** GPS ingest is the one call that does NOT go through the BFF: it authenticates with a per-device
 *  key, which the BFF's OIDC-only policy rejects. location-api is tunneled in its own right, so the
 *  uploader posts straight to this origin. Everything else still speaks to one origin with a prefix. */
export const LOCATION_INGEST_URL =
  process.env.EXPO_PUBLIC_LOCATION_INGEST_URL ?? 'https://location-api.lupira.com';

// Build-time default; the settings screen persists a runtime override on top.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? API_PRESETS[0].urls.api;
export const DEFAULT_AUTH_MODE: AuthMode =
  (process.env.EXPO_PUBLIC_AUTH_MODE as AuthMode | undefined)
  ?? (process.env.EXPO_PUBLIC_API_URL ? 'dev' : 'oidc');

/** Extra screens the Developer screen links to. */
export const DIAGNOSTIC_ROUTES: { route: string; label: string }[] = [
  { route: 'DebugLog', label: 'Debug log' },
  { route: 'BridgeDiagnostics', label: 'Bridge diagnostics' },
];
