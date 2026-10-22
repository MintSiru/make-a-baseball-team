/* The released versions whose saves keep working (V1.0, docs/PLAN-1.0.md §4 G) and the two checks on each: it loads,
   and it plays on. 2.0.30 (the user's question: can the tests run faster?): the playing — some six seconds a save,
   forty-odd saves — is spread over four files (compat-play-1…4) so the test workers and CI shards run them side by
   side; this file stays the one list to add a version to. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect } from 'vitest';
import { SIM_VERSION } from '../../src/core/version';
import { apply, regularOver } from '../../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../../src/league/expansion';
import type { LeagueState } from '../../src/league/state';
import { parseSave } from '../../src/save/format';

export const VERSIONS = ['0.11.0', '0.12.0', '0.16.0', '1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.6.0', '1.7.0', '1.7.1', '1.8.0', '1.8.1', '1.8.2', '1.8.4', '1.9.0', '1.9.3', '1.9.5', '1.9.8', '1.9.9', '2.0.0', '2.0.1', '2.0.2', '2.0.3', '2.0.4', '2.0.5', '2.0.6', '2.0.7', '2.0.8', '2.0.11', '2.0.12', '2.0.15', '2.0.16', '2.0.17', '2.0.18', '2.0.21', '2.0.22', '2.0.24', '2.0.25', '2.0.26', '2.0.27', '2.0.28', '2.0.29', '2.0.30', '2.0.34', '2.0.36', '2.0.37', '2.0.38'];

export const load = (version: string) => parseSave(gunzipSync(readFileSync(new URL(`../fixtures/save-${version}.json.gz`, import.meta.url))).toString('utf8'));

/** The versions one of the four playing files takes (1–4). */
export const part = (n: number) => VERSIONS.filter((_, i) => i % 4 === n - 1);

export function loads(version: string) {
  const save = load(version);
  if (version === SIM_VERSION) expect(save.migratedFrom).toBeUndefined();
  else expect(save.migratedFrom).toBe(version);
  const s = save.snapshot!.state as LeagueState;
  expect(s.user?.teamId).toBe(EXPANSION_ID);
  expect(s.year).toBe(2027);
}

export function playsOn(version: string) {
  const s = load(version).snapshot!.state as LeagueState;
  let decisions = 0;
  for (let guard = 0; guard < 5000 && !(s.year === 2028 && s.phase === 'regular'); guard++) {
    if (s.pending) {
      apply(s, { kind: 'decide', input: autoDecision(s)! });
      decisions++;
      continue;
    }
    if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else apply(s, { kind: 'nextSeason' });
  }
  expect(s.year).toBe(2028);
  expect(s.phase).toBe('regular');
  expect(decisions).toBeGreaterThan(5);
  // The 2027 season was recorded with our club in it; the rival is still due in the winter of 2028.
  const h = s.history.find((x) => x.year === 2027)!;
  expect(h.table.some((r) => r.teamId === EXPANSION_ID)).toBe(true);
  expect(s.teams.length).toBe(11);
  expect(s.user!.settings.twelve).toEqual({ mode: 'year', year: 2028 });
  // A week of 2028 goes too.
  apply(s, { kind: 'days', days: 6 });
}
