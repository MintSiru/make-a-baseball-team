/* Save fixtures for tests/compat.test.ts (V1.0). Run from a checkout of the version to capture, e.g.
     git worktree add /tmp/old <commit> && ln -s $PWD/node_modules /tmp/old/ && cp scripts/make-save-fixture.ts /tmp/old/scripts/
     (cd /tmp/old && npx tsx scripts/make-save-fixture.ts <this repo>/tests/fixtures/save-<sim>.json.gz)
   It builds a game the way a player of that version would have it and writes the autosave gzip-packed. */
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { SIM_VERSION } from '../src/core/version';
import { makeSave, serializeSave } from '../src/save/format';
const out = process.argv[2]!;
const s = createLeague('fixture-' + SIM_VERSION);
apply(s, { kind: 'toFounding' });
apply(s, { kind: 'found', settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'namingRights', parentName: '고래증권', stadium: 'existing', promotion: 'immediate', difficulty: 'hard', scenario: null, twelve: { mode: 'year', year: 2028 } } as never });
// To the first first-team season (2027) and three weeks into it, answering everything the scouts' way.
for (let g = 0; g < 2000; g++) {
  if (s.pending) { apply(s, { kind: 'decide', input: autoDecision(s)! }); continue; }
  if (s.year === 2027 && s.phase === 'regular') break;
  if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
  else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
  else apply(s, { kind: 'nextSeason' });
}
for (let i = 0; i < 3; i++) { apply(s, { kind: 'days', days: 6 }); while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! }); }
const text = serializeSave(makeSave(s.seed, [], { at: { year: s.year, phase: 'regularSeason' }, state: s }, new Date('2026-10-01T00:00:00Z')));
writeFileSync(out, gzipSync(text, { level: 9 }));
console.log(SIM_VERSION, s.year, s.phase, (text.length / 1e6).toFixed(1) + 'MB');
