export const APP_VERSION = '0.1.0';

/// 'oidc' = sign in against Authentik and send a bearer; 'none' = send nothing — the Development BFF
/// auto-authenticates via its DevAuthHandler (the LAN dev loop).
export type AuthMode = 'oidc' | 'none';

export type ApiPreset = { key: string; label: string; url: string; authMode: AuthMode };

export const API_PRESETS: ApiPreset[] = [
  { key: 'prod', label: 'Production', url: 'https://cal.lupira.com', authMode: 'oidc' },
  { key: 'lan', label: 'LAN dev', url: 'http://192.168.14.108:5181', authMode: 'none' },
  { key: 'emulator', label: 'Emulator dev', url: 'http://10.0.2.2:5181', authMode: 'none' },
];

// Build-time default; the settings screen persists a runtime override on top.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? API_PRESETS[0].url;
export const DEFAULT_AUTH_MODE: AuthMode =
  (process.env.EXPO_PUBLIC_AUTH_MODE as AuthMode | undefined)
  ?? (process.env.EXPO_PUBLIC_API_URL ? 'none' : 'oidc');
