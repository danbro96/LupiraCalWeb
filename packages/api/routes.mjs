#!/usr/bin/env node
// Writes ReverseProxy.Routes in the BFF's appsettings.json from exposed.json.
//
// One route per exact path template, constrained to the verbs the allowlist names. A
// `{**catch-all}` per resource would forward anything the upstream later adds under that resource.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const settingsPath = join(here, '..', '..', 'src/LupiraCalBff/appsettings.json');

const PREFIX = {
  'cal-api': '/api',
  'contact-api': '/contact-api',
  'geo-api': '/geo-api',
  'tasks-api': '/tasks-api',
  'location-api': '/location-api',
  'photo-api': '/photo-api',
  'comms-api': '/comms-api',
};

const exposed = JSON.parse(readFileSync(join(here, 'exposed.json'), 'utf8'));
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));

const routes = {};
const seen = new Map();

for (const [cluster, ops] of Object.entries(exposed.operations)) {
  const prefix = PREFIX[cluster];
  if (!prefix) throw new Error(`No BFF prefix for cluster ${cluster}`);

  const byPath = new Map();
  for (const op of ops) {
    const [verb, path] = op.split(' ');
    if (!byPath.has(path)) byPath.set(path, new Set());
    byPath.get(path).add(verb);
  }

  for (const [path, verbs] of [...byPath].sort(([a], [b]) => a.localeCompare(b))) {
    const key = `${cluster}${path}`.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '');
    if (seen.has(key)) throw new Error(`Route key collision: ${key} (${seen.get(key)} vs ${cluster}${path})`);
    seen.set(key, `${cluster}${path}`);

    routes[key] = {
      ClusterId: cluster,
      AuthorizationPolicy: 'Default',
      Match: { Path: `${prefix}${path}`, Methods: [...verbs].sort() },
      Transforms: [{ PathRemovePrefix: prefix }],
    };
  }
}

// File subtrees the upstreams serve outside OpenAPI. These keep a catch-all because the paths
// (glyph ranges, sprites, tiles) cannot be enumerated — hence the verbs stay pinned to GET.
for (const [cluster, entries] of Object.entries(exposed.static ?? {})) {
  for (const entry of entries) {
    const [verb, path] = entry.split(' ');
    const key = `${cluster}${path.replace(/\{\*\*\w+\}/, '')}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '');
    routes[key] = {
      ClusterId: cluster,
      AuthorizationPolicy: 'Default',
      Match: { Path: `${PREFIX[cluster]}${path}`, Methods: [verb] },
      Transforms: [{ PathRemovePrefix: PREFIX[cluster] }],
    };
  }
}

// Device ingest. Mounted at the upstream's own path (no prefix, so no transform) and Anonymous,
// because the credential is a per-device key the BFF cannot validate — location-api holds the keys
// and does the authenticating. The BFF only rejects malformed headers, so this stays no weaker than
// the direct exposure it replaces, and the clients keep a single origin.
for (const [cluster, entries] of Object.entries(exposed.device ?? {})) {
  for (const entry of entries) {
    const [verb, path] = entry.split(' ');
    const key = `${cluster}${path}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '');
    routes[key] = {
      ClusterId: cluster,
      AuthorizationPolicy: 'Anonymous',
      Match: { Path: path, Methods: [verb] },
    };
  }
}

settings.ReverseProxy.Routes = routes;
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

const verbs = Object.values(routes).reduce((n, r) => n + r.Match.Methods.length, 0);
console.log(`routes: ${Object.keys(routes).length} path templates, ${verbs} verbs`);
