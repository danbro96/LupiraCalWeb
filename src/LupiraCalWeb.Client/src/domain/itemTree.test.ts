import { describe, expect, it } from 'vitest';
import { groupOccurrences } from './itemTree';

const occ = (id: string, parentItemId?: string | null, key?: string) => ({ id, parentItemId, key: key ?? id });
const shape = (groups: ReturnType<typeof groupOccurrences<ReturnType<typeof occ>>>) =>
  groups.map((g) => [g.occ.key, g.children.map((c) => c.key)]);

describe('groupOccurrences', () => {
  it('nests children under their parent, preserving encounter order', () => {
    const rows = [occ('p'), occ('c1', 'p'), occ('x'), occ('c2', 'p')];
    expect(shape(groupOccurrences(rows))).toEqual([
      ['p', ['c1', 'c2']],
      ['x', []],
    ]);
  });

  it('attaches a child that appears before its parent', () => {
    expect(shape(groupOccurrences([occ('c', 'p'), occ('p')]))).toEqual([['p', ['c']]]);
  });

  it('keeps an orphan (parent not in page) top-level', () => {
    expect(shape(groupOccurrences([occ('c', 'missing')]))).toEqual([['c', []]]);
  });

  it('hosts children only on the first occurrence of a recurring parent', () => {
    const rows = [occ('p', null, 'p@1'), occ('c', 'p'), occ('p', null, 'p@2')];
    expect(shape(groupOccurrences(rows))).toEqual([
      ['p@1', ['c']],
      ['p@2', []],
    ]);
  });

  it('attaches every occurrence of a recurring child', () => {
    const rows = [occ('p'), occ('c', 'p', 'c@1'), occ('c', 'p', 'c@2')];
    expect(shape(groupOccurrences(rows))).toEqual([['p', ['c@1', 'c@2']]]);
  });

  it('surfaces a grandchild of a nested parent as its own top row', () => {
    const rows = [occ('a'), occ('b', 'a'), occ('c', 'b')];
    expect(shape(groupOccurrences(rows))).toEqual([
      ['a', ['b']],
      ['c', []],
    ]);
  });

  it('treats a self-parenting item as top-level', () => {
    expect(shape(groupOccurrences([occ('s', 's')]))).toEqual([['s', []]]);
  });

  it('breaks a two-node cycle deterministically (first encountered wins top)', () => {
    expect(shape(groupOccurrences([occ('a', 'b'), occ('b', 'a')]))).toEqual([['a', ['b']]]);
  });
});
