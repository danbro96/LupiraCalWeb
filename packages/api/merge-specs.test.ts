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

describe('merged BFF spec', () => {
  it('mounts every path under a BFF route prefix', () => {
    const prefixes = ['/api/', '/contact-api/', '/geo-api/', '/tasks-api/', '/location-api/', '/photo-api/', '/comms-api/'];
    expect(paths.filter((p) => !prefixes.some((x) => p.startsWith(x)))).toEqual([]);
  });

  // The whole point: /pingz existed in 4 specs and /items in 2, all generating the same query key.
  // Prefixing makes them distinct, which is what removes the collision class.
  it('gives every previously-colliding route a distinct path', () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const tail of ['/pingz', '/items', '/sync/changes', '/sync/containers']) {
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

  it('leaves no schema unreachable from a path', () => {
    const refs = new Set<string>();
    JSON.stringify(merged).replace(/"#\/components\/schemas\/([^"]+)"/g, (_m, n: string) => (refs.add(n), _m));
    expect(Object.keys(schemas).filter((n) => !refs.has(n))).toEqual([]);
  });
});
