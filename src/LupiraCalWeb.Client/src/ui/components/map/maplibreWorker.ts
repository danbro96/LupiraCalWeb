// MapLibre v6 resolves its worker as a sibling file of the entry module (import.meta.url), which no
// bundler preserves — dev and prod alike 404 and the map silently never loads a style. This entry
// exists so Vite bundles the worker (and its maplibre-gl-shared.mjs import) into one servable file;
// MapCanvas hands its URL to setWorkerUrl().
import 'maplibre-gl/dist/maplibre-gl-worker.mjs';
