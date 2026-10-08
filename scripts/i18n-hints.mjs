#!/usr/bin/env node
/* Writes src/i18n/param-hints.json from src/i18n/metadata.json: for each key, the params whose Korean value can be
   told from the code that fills them. The display runtime (src/i18n/runtime.ts) uses it to split stored Korean text
   back into its params: a particle the value ends with ("이/가"), or the only values a param can take (a choice
   between two literals, `x ? '퓨처스 경기에서 ' : ''`). Run after a new extraction; npm run i18n:check reports a
   stale file. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const I18N = join(fileURLToPath(import.meta.url), '../../src/i18n');
export function buildHints(metadata) {
  const hints = {};
  for (const [key, m] of Object.entries(metadata)) {
    for (const [name, p] of Object.entries(m.params ?? {})) {
      const h = {};
      if (p.particle) h.ends = p.particle.split('/');
      const e = (p.expression ?? '').trim();
      const choice = /\?\s*(['"])((?:(?!\1).)*)\1\s*:\s*(['"])((?:(?!\3).)*)\3\s*\)?$/.exec(e);
      if (choice && !/[`$]/.test(choice[2] + choice[4])) h.one = [choice[2], choice[4]];
      if (Object.keys(h).length) (hints[key] ??= {})[name] = h;
    }
  }
  return hints;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hints = buildHints(JSON.parse(readFileSync(join(I18N, 'metadata.json'), 'utf8')));
  writeFileSync(join(I18N, 'param-hints.json'), JSON.stringify(hints) + '\n');
  console.log(`param-hints.json: ${Object.keys(hints).length} keys`);
}
