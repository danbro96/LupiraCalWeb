import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = new URL('.', import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));

const merged = read('bff-openapi.json');
const cal = read('specs/LupiraCalApi.json');
const tasks = read('specs/LupiraTasksApi.json');
const contact = read('specs/LupiraContactApi.json');

const schemas = merged.components.schemas as Record<string, unknown>;
const paths = Object.keys(merged.paths) as string[];
const exposed = read('exposed.json').operations as Record<string, string[]>;
const routes = read('../../src/LupiraCalBff/appsettings.json').ReverseProxy.Routes as Record<
  string,
  { ClusterId: string; AuthorizationPolicy: string; Match: { Path: string; Methods: string[] } }
>;

describe('the exposed allowlist', () => {
  it('is the whole of the merged surface — nothing rides along', () => {
    const allowed = new Set(
      Object.entries(exposed).flatMap(([cluster, ops]) =>
        ops.map((op) => {
          const [verb, path] = op.split(' ');
          const prefix = cluster === 'cal-api' ? '/api' : `/${cluster}`;
          return `${verb} ${prefix}${path}`;
        }),
      ),
    );
    const actual = Object.entries(merged.paths).flatMap(([path, item]) =>
      Object.keys(item as object)
        .filter((verb) => verb !== 'parameters')
        .map((verb) => `${verb.toUpperCase()} ${path}`),
    );
    expect(actual.filter((op) => !allowed.has(op))).toEqual([]);
    expect(actual).toHaveLength(allowed.size);
  });

  // These reach a different credential than the family session the BFF holds, or aren't a browser
  // surface at all. An allowlist should already exclude them; this fails loudly if one is re-added.
  it('never exposes ingest, share-links, the user directory or liveness probes', () => {
    // Anchored to the resource root: a list owner's own /lists/{id}/shares is session-auth'd and fine.
    const forbidden = /^\/[a-z-]+\/(pingz|ingest|shared|shares|users)(\/|$)/;
    expect(paths.filter((p) => forbidden.test(p))).toEqual([]);
    expect(Object.values(routes).filter((r) => forbidden.test(r.Match.Path))).toEqual([]);
  });
});

describe('the BFF route table', () => {
  const isStatic = (path: string) => path.includes('**');
  // The static subtrees and device ingest are routed but deliberately absent from the spec.
  const offSpec = new Set(
    Object.values({ ...read('exposed.json').static, ...read('exposed.json').device })
      .flat()
      .map((entry) => (entry as string).split(' ')[1]),
  );

  // routes.mjs generates these from exposed.json, so a mismatch means someone hand-edited one side.
  it('routes exactly the operations the spec declares', () => {
    const routed = new Set(
      Object.values(routes)
        .filter((r) => !isStatic(r.Match.Path) && !offSpec.has(r.Match.Path))
        .flatMap((r) => r.Match.Methods.map((m) => `${m} ${r.Match.Path}`)),
    );
    const declared = Object.entries(merged.paths).flatMap(([path, item]) =>
      Object.keys(item as object)
        .filter((verb) => verb !== 'parameters')
        .map((verb) => `${verb.toUpperCase()} ${path}`),
    );
    expect(declared.filter((op) => !routed.has(op))).toEqual([]);
    expect(routed.size).toBe(declared.length);
  });

  // Device ingest carries a per-device key, not the family session, so it is Anonymous at the BFF and
  // authenticated by location-api. It must stay out of the merged spec: the generated client can only
  // express Bearer, and the uploader is hand-written for exactly that reason.
  it('routes device ingest anonymously and keeps it out of the client', () => {
    const ingest = Object.entries(routes).filter(([, r]) => r.Match.Path.startsWith('/ingest'));
    expect(ingest.map(([, r]) => r.Match.Path).sort()).toEqual([
      '/ingest/location',
      '/ingest/location/cursor',
      '/ingest/location/state',
    ]);
    for (const [name, route] of ingest) {
      expect(route.AuthorizationPolicy, name).toBe('Anonymous');
      expect(route.ClusterId, name).toBe('location-api');
      // No transform: the BFF path is the upstream path, and rewriting would break the device call.
      expect((route as { Transforms?: unknown }).Transforms, name).toBeUndefined();
    }
    expect(paths.filter((p) => p.includes('/ingest'))).toEqual([]);
  });

  // A catch-all forwards whatever the upstream adds under that resource, unreviewed. The static
  // file subtrees in exposed.json are the deliberate exception, and stay read-only.
  it('keeps catch-alls to the declared static subtrees, and every route verb-constrained', () => {
    const wildcards = Object.values(routes).filter((r) => isStatic(r.Match.Path));
    expect(wildcards.map((r) => r.Match.Path)).toEqual(['/geo-api/basemap/{**path}']);
    expect(wildcards.every((r) => r.Match.Methods.every((m) => m === 'GET'))).toBe(true);
    for (const [name, route] of Object.entries(routes)) {
      expect(route.Match.Methods?.length, name).toBeGreaterThan(0);
    }
  });
});

describe('merged BFF spec', () => {
  it('mounts every path under a BFF route prefix', () => {
    const prefixes = ['/api/', '/contact-api/', '/geo-api/', '/tasks-api/', '/location-api/', '/photo-api/', '/comms-api/'];
    expect(paths.filter((p) => !prefixes.some((x) => p.startsWith(x)))).toEqual([]);
  });

  // /items and /sync/* existed in 2 specs each and generated the same query key; prefixing makes
  // them distinct, which is what removes the collision class.
  it('gives every previously-colliding route a distinct path', () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const tail of ['/items', '/sync/changes', '/sync/containers']) {
      expect(paths.filter((p) => p.endsWith(tail)).length).toBeGreaterThan(1);
    }
  });

  // Same name, different enum values — a merge that picked one would still typecheck.
  it('keeps cal and tasks ItemStatus apart, each matching its source', () => {
    expect(schemas.ItemStatus).toEqual(cal.components.schemas.ItemStatus);
    expect(schemas.TasksItemStatus).toEqual(tasks.components.schemas.ItemStatus);
    expect(cal.components.schemas.ItemStatus).not.toEqual(tasks.components.schemas.ItemStatus);
  });

  it('namespaces the cal/contact conflicts against their source', () => {
    const RENAMED = ['OwnerGrantDto', 'SyncChangeDto', 'SyncChangesResponse', 'SectionGuardsDto'];
    // A renamed schema's siblings must point at the new name, so compare the source with the same
    // rewrite applied — otherwise this asserts the refs were left dangling.
    const rewrite = (v: unknown) =>
      JSON.parse(RENAMED.reduce(
        (s, n) => s.replaceAll(`"#/components/schemas/${n}"`, `"#/components/schemas/Contact${n}"`),
        JSON.stringify(v),
      ));
    for (const name of RENAMED) {
      expect(schemas[name]).toEqual(cal.components.schemas[name]);
      expect(schemas[`Contact${name}`]).toEqual(rewrite(contact.components.schemas[name]));
    }
  });

  it('drops every /me but contact’s, which alone carries contactId', () => {
    expect(paths.filter((p) => p.endsWith('/me'))).toEqual(['/contact-api/me']);
    expect(Object.keys(schemas).filter((n) => n.includes('MeDto'))).toEqual(['MeDto']);
    expect(schemas.MeDto).toEqual(contact.components.schemas.MeDto);
  });

  // Operation ids name the generated functions and their inline param types. cal and tasks both
  // declared GetItem/UpdateItem for different operations, which produced a duplicate TS identifier.
  it('has no duplicate operationIds', () => {
    const ids = Object.values(merged.paths as Record<string, Record<string, { operationId?: string }>>)
      .flatMap((item) => Object.values(item).map((op) => op?.operationId).filter(Boolean));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('leaves no schema unreachable from a path', () => {
    const refs = new Set<string>();
    JSON.stringify(merged).replace(/"#\/components\/schemas\/([^"]+)"/g, (_m, n: string) => (refs.add(n), _m));
    expect(Object.keys(schemas).filter((n) => !refs.has(n))).toEqual([]);
  });
});
