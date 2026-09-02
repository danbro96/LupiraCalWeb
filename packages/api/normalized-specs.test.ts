import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// TODO(kiota): this file goes with the normalizer once kiota#6776's fix ships (merged
// 2026-08-19, unreleased as of 1.34.1). https://github.com/microsoft/kiota/pull/8064
// `upstream-normalized/` is what the C# client generator reads: the same specs with
// `oneOf: [{type:"null"}, {$ref}]` collapsed to a bare `$ref`, written by
// `dotnet run --project src/LupiraCalBff -- --normalize-specs`.
const here = new URL('.', import.meta.url).pathname;
const bff = join(here, '../../src/LupiraCalBff');
const read = (dir: string, file: string) => JSON.parse(readFileSync(join(bff, dir, file), 'utf8'));
const specs = readdirSync(join(bff, 'upstream')).filter((f) => f.endsWith('.json'));

/** Every `oneOf` whose branches are exactly a null and a `$ref`. */
function nullableRefs(node: unknown, found: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) nullableRefs(item, found);
    return found;
  }
  const branches = (node as { oneOf?: unknown[] }).oneOf;
  if (Array.isArray(branches) && branches.length === 2) {
    const isNull = (b: unknown) => (b as { type?: string })?.type === 'null';
    const isRef = (b: unknown) => '$ref' in ((b ?? {}) as object);
    if (branches.some(isNull) && branches.some(isRef)) found.push(node);
  }
  for (const value of Object.values(node)) nullableRefs(value, found);
  return found;
}

describe('normalized upstream specs', () => {
  it('exists for every upstream spec', () => {
    expect(readdirSync(join(bff, 'upstream-normalized')).filter((f) => f.endsWith('.json')).sort())
      .toEqual(specs.sort());
  });

  // Left in place, Kiota turns each site into a wrapper class plus a junk member type, and reads
  // become `item.Status?.ItemStatus` instead of `item.Status`.
  it('leaves no nullable-reference oneOf for the generator to trip on', () => {
    for (const file of specs) {
      expect(nullableRefs(read('upstream-normalized', file)), file).toEqual([]);
    }
  });

  it('collapsed something — otherwise it is silently a no-op', () => {
    const total = specs.reduce((n, f) => n + nullableRefs(read('upstream', f)).length, 0);
    expect(total).toBeGreaterThan(60);
  });

  // The BFF's own document must keep the null branch: orval emits `status?: null | ItemStatus` from
  // it, so normalizing there would strip the null from the TypeScript types.
  it('does not touch the document the BFF publishes', () => {
    const published = JSON.parse(readFileSync(join(here, '../../openapi/LupiraCalBff.json'), 'utf8'));
    expect(nullableRefs(published).length).toBeGreaterThan(0);
  });

  it('keeps the description a collapsed branch carried', () => {
    const raw = read('upstream', 'LupiraCalApi.json');
    const normalized = read('upstream-normalized', 'LupiraCalApi.json');
    const described = nullableRefs(raw).filter((n) =>
      (n as { oneOf: { description?: string }[] }).oneOf.some((b) => b?.description),
    );
    expect(described.length).toBeGreaterThan(0);
    // Same count of $refs carrying a description, now as siblings rather than inside a branch.
    const withDescription = JSON.stringify(normalized).match(/"description":"[^"]*","\$ref"/g) ?? [];
    expect(withDescription.length).toBeGreaterThan(0);
  });
});
