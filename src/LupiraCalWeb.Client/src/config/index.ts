/**
 * The member API and auth are served same-origin by the BFF, which proxies `/api/*` to LupiraCalApi
 * and owns the `/auth/*` routes. The SPA only ever talks to its own origin, so there is no CORS and the
 * session cookie stays first-party. Override the prefix only if the BFF mounts the proxy elsewhere.
 */
const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = (raw ?? '/api').replace(/\/$/, '');

/** LupiraGeoApi (gazetteer/geocoding/saved places), proxied same-origin by the BFF at `/geo-api/*`. */
const rawGeo = import.meta.env.VITE_GEO_API_BASE_URL as string | undefined;
export const GEO_API_BASE_URL = (rawGeo ?? '/geo-api').replace(/\/$/, '');

/** LupiraContactApi (contacts, address books, groups, relations), proxied same-origin at `/contact-api/*`. */
const rawContact = import.meta.env.VITE_CONTACT_API_BASE_URL as string | undefined;
export const CONTACT_API_BASE_URL = (rawContact ?? '/contact-api').replace(/\/$/, '');

/** LupiraTasksApi (task deadlines on the calendar), proxied same-origin at `/tasks-api/*`. */
const rawTasks = import.meta.env.VITE_TASKS_API_BASE_URL as string | undefined;
export const TASKS_API_BASE_URL = (rawTasks ?? '/tasks-api').replace(/\/$/, '');

/** LupiraLocationApi (GPS visits/trips/tracks on the map), proxied same-origin at `/location-api/*`. */
const rawLocation = import.meta.env.VITE_LOCATION_API_BASE_URL as string | undefined;
export const LOCATION_API_BASE_URL = (rawLocation ?? '/location-api').replace(/\/$/, '');
