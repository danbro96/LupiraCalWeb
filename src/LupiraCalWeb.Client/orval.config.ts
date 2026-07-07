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
});
