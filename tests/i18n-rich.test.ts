/* 2.0.9: a text-only translation (t) turns a component in its values into "[object Object]" (the scandal
   decision showed it in place of the player's name); a sentence with a button or a fragment in it needs rich(). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));

describe('translated sentences with components', () => {
  it('go through rich(), never t()', () => {
    const bad: string[] = [];
    for (const f of files(join(__dirname, '..', 'src'))) {
      const src = readFileSync(f, 'utf8');
      for (let i = src.indexOf('__i18n_t('); i >= 0; i = src.indexOf('__i18n_t(', i + 1)) {
        let depth = 0,
          j = i + 8;
        for (; j < src.length; j++) {
          if (src[j] === '(') depth++;
          else if (src[j] === ')' && --depth === 0) break;
        }
        if (/<[a-zA-Z]*[\s>]/.test(src.slice(i, j))) bad.push(`${f}:${src.slice(0, i).split('\n').length}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
