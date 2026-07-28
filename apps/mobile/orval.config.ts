import { defineConfig } from 'orval';

// Generates raw fetchers (no react-query — the sync engine calls these; the UI reads the SQLite mirror).
// Inputs are the specs the web client's `gen:api` copies into the repo — refresh there first, then run this.
// baseUrl carries the BFF route prefix: the app talks to one origin (the BFF) and the prefix picks the upstream.
export default defineConfig({
  lupiraCalApi: {
    input: { target: '../../src/LupiraCalWeb.Client/backend-openapi.json', filters: { mode: 'exclude', tags: ['LupiraCalApi'] } },
    output: {
      target: './src/data/api/generated/cal/lupiraCalApi.ts',
      schemas: './src/data/api/generated/cal/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
  lupiraContactApi: {
    input: { target: '../../src/LupiraCalWeb.Client/backend-contact-openapi.json' },
    output: {
      target: './src/data/api/generated/contact/lupiraContactApi.ts',
      schemas: './src/data/api/generated/contact/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/contact-api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
  lupiraGeoApi: {
    input: { target: '../../src/LupiraCalWeb.Client/backend-geo-openapi.json' },
    output: {
      target: './src/data/api/generated/geo/lupiraGeoApi.ts',
      schemas: './src/data/api/generated/geo/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/geo-api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
});
