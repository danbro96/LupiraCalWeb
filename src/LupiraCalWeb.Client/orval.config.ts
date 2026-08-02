import { defineConfig } from 'orval';

// Generates the typed API client + react-query hooks from LupiraCalApi's build-time OpenAPI doc
// (backend-openapi.json, refreshed by `npm run gen:api` from ../LupiraCalApi/openapi/).
// The `LupiraCalApi` tag holds the .well-known DAV redirects — not part of the REST surface.
export default defineConfig({
  lupiraCalApi: {
    input: {
      target: './backend-openapi.json',
      filters: { mode: 'exclude', tags: ['LupiraCalApi'] },
    },
    output: {
      target: './src/data/api/lupiraCalApi.ts',
      schemas: './src/data/api/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/data/fetcher.ts', name: 'customFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  // LupiraGeoApi (gazetteer/geocoding/saved places). Proxied same-origin by the BFF at /geo-api;
  // requests go through customFetchGeo (GEO_API_BASE_URL).
  lupiraGeoApi: {
    input: { target: './backend-geo-openapi.json' },
    output: {
      target: './src/data/api-geo/lupiraGeoApi.ts',
      schemas: './src/data/api-geo/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/data/fetcher.ts', name: 'customFetchGeo' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  // LupiraContactApi (contacts, address books, groups, relations). Proxied same-origin by the BFF at
  // /contact-api; requests go through customFetchContact (CONTACT_API_BASE_URL).
  lupiraContactApi: {
    input: { target: './backend-contact-openapi.json' },
    output: {
      target: './src/data/api-contact/lupiraContactApi.ts',
      schemas: './src/data/api-contact/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/data/fetcher.ts', name: 'customFetchContact' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  // LupiraTasksApi (task deadlines on the calendar). Proxied same-origin by the BFF at /tasks-api;
  // requests go through customFetchTasks (TASKS_API_BASE_URL).
  lupiraTasksApi: {
    input: { target: './backend-tasks-openapi.json' },
    output: {
      target: './src/data/api-tasks/lupiraTasksApi.ts',
      schemas: './src/data/api-tasks/models',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/data/fetcher.ts', name: 'customFetchTasks' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
