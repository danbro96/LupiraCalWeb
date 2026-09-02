import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(new URL('.', import.meta.url).pathname, 'src/generated');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const queryFiles = walk(join(root, 'query'));
const keys = queryFiles.flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/^\s+`(\/[^`]*)`/gm)].map((m) => m[1]),
);

describe('generated client', () => {
  // The reason the merge exists. Before it, orval derived keys from the path alone, so /pingz was
  // one key across four clients and /items across two — managed by prose in CLAUDE.md and
  // hand-prefixed keys at the call sites. Prefixed paths make them distinct by construction.
  it('has no duplicate react-query keys', () => {
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('keeps the formerly-colliding routes apart', () => {
    const endingIn = (tail: string) => keys.filter((k) => k.endsWith(tail)).sort();
    expect(endingIn('/pingz')).toEqual([]); // stripped outright, not disambiguated
    expect(endingIn('/sync/changes')).toEqual(['/api/sync/changes', '/contact-api/sync/changes']);
    expect(endingIn('/me')).toEqual(['/contact-api/me']);
  });

  it('routes every key through a BFF prefix', () => {
    const prefixes = ['/api/', '/contact-api/', '/geo-api/', '/tasks-api/', '/location-api/', '/photo-api/', '/comms-api/'];
    expect(keys.filter((k) => !prefixes.some((p) => k.startsWith(p)))).toEqual([]);
  });

  it('generates both flavours over one set of models', () => {
    const tags = ['cal', 'comms', 'contact', 'geo', 'location', 'photo', 'tasks'];
    for (const dir of ['query', 'fetch']) {
      expect(readdirSync(join(root, dir)).sort()).toEqual(tags);
    }
    // Both import types from the shared models dir rather than carrying their own copy.
    for (const f of [...queryFiles, ...walk(join(root, 'fetch'))]) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/from '\.\.\/\.\.\/\.\.\/models/);
    }
  });
});
