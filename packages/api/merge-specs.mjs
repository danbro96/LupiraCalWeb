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

// `VERB /path` per cluster. routes.mjs generates the YARP routes from the same file.
const EXPOSED = JSON.parse(readFileSync(join(here, 'exposed.json'), 'utf8')).operations;

/** Reads the BFF's route table for the prefix each cluster is mounted under. */
function prefixesFromBff() {
  const cfg = JSON.parse(readFileSync(join(repo, 'src/LupiraCalBff/appsettings.json'), 'utf8'));
  const out = {};
  for (const route of Object.values(cfg.ReverseProxy.Routes)) {
    const prefix = (route.Transforms ?? []).map((t) => t.PathRemovePrefix).find(Boolean);
    if (prefix) out[route.ClusterId] = prefix;
  }
  return out;
}

const stable = (v) => JSON.stringify(v);
const pascal = (s) => s.replace(/-api$/, '').replace(/^./, (c) => c.toUpperCase());

/** Keeps only the allowlisted operations, and reports upstream ones nobody has reviewed. */
function prunePaths(doc, cluster, tag) {
  const allowed = new Set(EXPOSED[cluster] ?? []);
  const kept = {};
  const unlisted = [];
  let dropped = 0;
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const keptOps = {};
    for (const [verb, op] of Object.entries(item)) {
      if (!op || typeof op !== 'object' || !('responses' in op)) {
        keptOps[verb] = op; // path-level `parameters` and friends
        continue;
      }
      const key = `${verb.toUpperCase()} ${path}`;
      if (!allowed.has(key)) {
        dropped++;
        if (op.operationId) unlisted.push(key);
        continue;
      }
      allowed.delete(key);
      // One tag per operation so orval's tags-split lands each upstream in its own folder.
      op.tags = [tag];
      keptOps[verb] = op;
    }
    if (Object.values(keptOps).some((v) => v && typeof v === 'object' && 'responses' in v)) {
      kept[path] = keptOps;
    }
  }
  return { kept, dropped, unlisted, stale: [...allowed] };
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

/** Every upstream must agree on the OpenAPI version — a mixed merge would need down-levelling. */
function versionOfSources() {
  const seen = new Set(
    Object.values(SPEC_BY_CLUSTER).map((f) => JSON.parse(readFileSync(join(specsDir, f), 'utf8')).openapi),
  );
  if (seen.size !== 1) throw new Error(`Upstream specs disagree on OpenAPI version: ${[...seen].join(', ')}`);
  return [...seen][0];
}

function main() {
  const prefixes = prefixesFromBff();
  // Version comes from the sources, not a literal: they are 3.1.x, and declaring 3.0 makes every
  // nullable `type: [x, 'null']` fail validation.
  const version = versionOfSources();
  const merged = { openapi: version, info: { title: 'LupiraCalWeb BFF', version: 'v1' }, paths: {}, components: { schemas: {} } };
  const claimed = new Map();   // final schema name -> { sig, cluster }
  const claimedOps = new Map(); // operationId -> cluster
  const report = [];
  const conflicts = [];
  const skipped = [];
  const missing = [];

  for (const [cluster, file] of Object.entries(SPEC_BY_CLUSTER)) {
    const prefix = prefixes[cluster];
    if (!prefix) throw new Error(`No BFF route prefix for cluster ${cluster}`);
    const doc = JSON.parse(readFileSync(join(specsDir, file), 'utf8'));
    const tag = cluster.replace(/-api$/, '');

    const { kept, dropped, unlisted, stale } = prunePaths(doc, cluster, tag);
    if (unlisted.length) skipped.push(...unlisted.map((k) => `  ${cluster}  ${k}`));
    if (stale.length) missing.push(...stale.map((k) => `  ${cluster}  ${k}`));
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

    // Operation ids name the generated functions and their inline param types, and they collide too
    // — cal and tasks both declare GetItem/UpdateItem for genuinely different operations. Same rule as
    // schemas: first claimant keeps the bare name, later ones get their cluster prefix.
    for (const item of Object.values(local.paths)) {
      for (const op of Object.values(item)) {
        if (!op || typeof op !== 'object' || !op.operationId) continue;
        const prior = claimedOps.get(op.operationId);
        if (prior === undefined) { claimedOps.set(op.operationId, cluster); continue; }
        const alias = `${pascal(cluster)}${op.operationId}`;
        conflicts.push(`  ${op.operationId}() (${prior} vs ${cluster}) -> ${alias}()`);
        claimedOps.set(alias, cluster);
        op.operationId = alias;
      }
    }

    for (const [path, item] of Object.entries(local.paths)) merged.paths[`${prefix}${path}`] = item;
    for (const [name, schema] of Object.entries(local.schemas)) {
      merged.components.schemas[rename[name] ?? name] = schema;
    }
    report.push(`${cluster.padEnd(14)} ${Object.keys(local.paths).length} paths (+${prefix}), ${dropped} dropped, ${live.size} schemas`);
  }

  writeFileSync(join(here, 'bff-openapi.json'), `${JSON.stringify(merged, null, 2)}\n`);
  console.log(report.join('\n'));
  if (conflicts.length) console.log(`\nnamespaced ${conflicts.length} conflict(s):\n${conflicts.join('\n')}`);
  if (skipped.length) console.log(`\nnot exposed — add to exposed.json to publish (${skipped.length}):\n${skipped.join('\n')}`);
  // An allowlisted operation the upstream no longer has: the spec moved and exposed.json did not.
  if (missing.length) throw new Error(`exposed.json lists operations no upstream declares:\n${missing.join('\n')}`);
  console.log(`\nmerged: ${Object.keys(merged.paths).length} paths, ${Object.keys(merged.components.schemas).length} schemas`);
}

main();
