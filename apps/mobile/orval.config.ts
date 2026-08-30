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
  // Photo/video assets: declare + complete drive the backup queue; list/map feed the Map tab.
  // Object bytes never cross this client — responses carry presigned URLs to the object store.
  lupiraPhotoApi: {
    input: { target: '../../src/LupiraCalWeb.Client/backend-photo-openapi.json' },
    output: {
      target: './src/data/api/generated/photo/lupiraPhotoApi.ts',
      schemas: './src/data/api/generated/photo/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/photo-api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
  // GPS history for the map, plus device registration for this phone's own uploader.
  // `Me` is excluded so location's `/me` can never shadow cal's (the estate's one query-key collision);
  // `Ingest` is excluded because it authenticates with `Authorization: DeviceKey …`, which the generated
  // mutator can't send and the spec doesn't even declare — see sync/locationUploader.ts for the real call.
  lupiraLocationApi: {
    input: {
      target: '../../src/LupiraCalWeb.Client/backend-location-openapi.json',
      filters: { mode: 'exclude', tags: ['Me', 'Ingest'] },
    },
    output: {
      target: './src/data/api/generated/location/lupiraLocationApi.ts',
      schemas: './src/data/api/generated/location/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/location-api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
  // Task deadlines (read-only, online-only): only the Items surface is consumed.
  lupiraTasksApi: {
    input: { target: '../../src/LupiraCalWeb.Client/backend-tasks-openapi.json', filters: { mode: 'include', tags: ['Items'] } },
    output: {
      target: './src/data/api/generated/tasks/lupiraTasksApi.ts',
      schemas: './src/data/api/generated/tasks/models',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      baseUrl: '/tasks-api',
      override: { mutator: { path: './src/data/api/mutator.ts', name: 'apiFetch' } },
    },
  },
});
