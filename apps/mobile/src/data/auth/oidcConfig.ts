/// The Authentik public client for this app (PKCE, no secret). The token's audience fans out to
/// lupira-cal + lupira-contact + lupira-geo via the -aud scope mappings, so one bearer satisfies the BFF
/// and every upstream it proxies.
export const OIDC_ISSUER = 'https://auth.lupira.com/application/o/lupira-cal-mobile/';
export const OIDC_CLIENT_ID = 'lupira-cal-mobile';
export const OIDC_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'lupira-cal-aud',
  'lupira-contact-aud',
  'lupira-geo-aud',
];
export const OIDC_SCHEME = 'lupiracalendar';
/// A non-empty path is load-bearing: a bare `lupiracalendar://` normalizes to `lupiracalendar:` and the
/// auth-session callback matcher never fires (learned the hard way in LupiraTasksMobile).
export const OIDC_REDIRECT_PATH = 'oauthredirect';
