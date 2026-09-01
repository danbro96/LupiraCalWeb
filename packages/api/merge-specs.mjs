#!/usr/bin/env node
// Merges the upstream OpenAPI docs into one document describing the BFF's own surface, so the
// clients generate against the thing they actually talk to. The BFF is a YARP proxy and publishes
// no spec of its own; this reconstructs it.
//
// Path prefixes come from the BFF's route table — each route's PathRemovePrefix transform is exactly
// the inverse of what we do here — so there is no second copy of the mapping to drift.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const specsDir = join(here, 'specs');

/** Which upstream spec backs which YARP cluster. Order fixes who keeps an unprefixed schema name. */
const SPEC_BY_CLUSTER = {
  'cal-api': 'LupiraCalApi.json',
  'contact-api': 'LupiraContactApi.json',
  'geo-api': 'LupiraGeoApi.json',
  'tasks-api': 'LupiraTasksApi.json',
  'location-api': 'LupiraLocationApi.json',
  'photo-api': 'LupiraPhotoApi.json',
  'comms-api': 'LupiraCommsApi.json',
};

/**
 * Paths dropped from the merged surface, per cluster.
 *
 * `/me` is an identity echo the BFF already owns at /auth/user, and cal/geo/location/photo's copies
 * have zero call sites in either client. contact's is KEPT: it uniquely carries `contactId` (which
 * contact record is me), which ContactsTree uses. Dropping the other four also removes four of the
 * five MeDto schemas — each is referenced only by its own /me response — so the worst schema
 * conflict resolves itself rather than needing a namespace.
 */
const DROP_PATHS = {
  'cal-api': ['/me'],
  'geo-api': ['/me'],
  'location-api': ['/me'],
  'photo-api': ['/me'],
  'tasks-api': ['/me'],
};

/** Operations under these tags never reach the SPA. `LupiraCalApi` holds the .well-known DAV redirects. */
const DROP_TAGS = { 'cal-api': ['LupiraCalApi'] };

/** Reads the BFF's route table for the prefix each cluster is mounted under. */
function prefixesFromBff() {
  const cfg = JSON.parse(readFileSync(join(repo, 'src/LupiraCalWeb/appsettings.json'), 'utf8'));
  const out = {};
  for (const route of Object.values(cfg.ReverseProxy.Routes)) {
    const prefix = (route.Transforms ?? []).map((t) => t.PathRemovePrefix).find(Boolean);
    if (prefix) out[route.ClusterId] = prefix;
  }
  return out;
}

const stable = (v) => JSON.stringify(v);
const pascal = (s) => s.replace(/-api$/, '').replace(/^./, (c) => c.toUpperCase());

/** Strips the paths this cluster does not expose through the BFF, and tags the rest with its name. */
function prunePaths(doc, cluster, tag) {
  const drop = new Set(DROP_PATHS[cluster] ?? []);
  const dropTags = new Set(DROP_TAGS[cluster] ?? []);
  const kept = {};
  let dropped = 0;
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (drop.has(path)) { dropped++; continue; }
    const ops = Object.entries(item).filter(([, op]) => op && typeof op === 'object' && 'responses' in op);
    if (ops.length && ops.every(([, op]) => (op.tags ?? []).some((t) => dropTags.has(t)))) { dropped++; continue; }
    // One tag per operation so orval's tags-split lands each upstream in its own folder.
    for (const [, op] of ops) op.tags = [tag];
    kept[path] = item;
  }
  return { kept, dropped };
}

/** Schemas a pruned document still reaches, so dropping /me also drops its now-orphaned MeDto. */
function reachableSchemas(paths, schemas) {
  const seen = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        const name = v.replace('#/components/schemas/', '');
        if (!seen.has(name)) { seen.add(name); visit(schemas[name]); }
      } else visit(v);
    }
  };
  visit(paths);
  return seen;
}

function main() {
  const prefixes = prefixesFromBff();
  const merged = { openapi: '3.0.4', info: { title: 'LupiraCalWeb BFF', version: 'v1' }, paths: {}, components: { schemas: {} } };
  const claimed = new Map();   // final name -> { sig, cluster }
  const report = [];
  const conflicts = [];

  for (const [cluster, file] of Object.entries(SPEC_BY_CLUSTER)) {
    const prefix = prefixes[cluster];
    if (!prefix) throw new Error(`No BFF route prefix for cluster ${cluster}`);
    const doc = JSON.parse(readFileSync(join(specsDir, file), 'utf8'));
    const tag = cluster.replace(/-api$/, '');

    const { kept, dropped } = prunePaths(doc, cluster, tag);
    const schemas = doc.components?.schemas ?? {};
    const live = reachableSchemas(kept, schemas);

    // Decide this document's renames: a name already claimed with a DIFFERENT shape gets namespaced.
    const rename = {};
    for (const name of live) {
      const sig = stable(schemas[name]);
      const prior = claimed.get(name);
      if (!prior) { claimed.set(name, { sig, cluster }); continue; }
      if (prior.sig === sig) continue;
      const alias = `${pascal(cluster)}${name}`;
      rename[name] = alias;
      claimed.set(alias, { sig, cluster });
      conflicts.push(`  ${name} (${prior.cluster} vs ${cluster}) -> ${alias}`);
    }

    // Apply this document's renames to ITS OWN json only — a global rewrite would repoint the other
    // clusters' refs at this alias too, which is the classic bad merge.
    let scoped = JSON.stringify({ paths: kept, schemas: Object.fromEntries([...live].map((n) => [n, schemas[n]])) });
    for (const [name, alias] of Object.entries(rename)) {
      scoped = scoped.replaceAll(`"#/components/schemas/${name}"`, `"#/components/schemas/${alias}"`);
    }
    const local = JSON.parse(scoped);

    for (const [path, item] of Object.entries(local.paths)) merged.paths[`${prefix}${path}`] = item;
    for (const [name, schema] of Object.entries(local.schemas)) {
      merged.components.schemas[rename[name] ?? name] = schema;
    }
    report.push(`${cluster.padEnd(14)} ${Object.keys(local.paths).length} paths (+${prefix}), ${dropped} dropped, ${live.size} schemas`);
  }

  writeFileSync(join(here, 'bff-openapi.json'), `${JSON.stringify(merged, null, 2)}\n`);
  console.log(report.join('\n'));
  if (conflicts.length) console.log(`\nnamespaced ${conflicts.length} conflicting schema(s):\n${conflicts.join('\n')}`);
  console.log(`\nmerged: ${Object.keys(merged.paths).length} paths, ${Object.keys(merged.components.schemas).length} schemas`);
}

main();
