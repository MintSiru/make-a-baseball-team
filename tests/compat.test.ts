/* Saves made by released versions keep working (V1.0, docs/PLAN-1.0.md §4 G). The fixtures are real autosaves
   written by the 0.11.0, 0.12.0, 0.16.0, 1.0.0, 1.1.0 and 1.2.0 code (a naming-rights club on hard, three weeks into its first first-team
   season, a rival club due in the winter of 2028), gzip-packed. Each is loaded the way the game loads a file and played
   through the rest of the season, the winter and into the next opening day. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/core/version';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import type { LeagueState } from '../src/league/state';
import { parseSave } from '../src/save/format';

const load = (version: string) => parseSave(gunzipSync(readFileSync(new URL(`./fixtures/save-${version}.json.gz`, import.meta.url))).toString('utf8'));

describe.each(['0.11.0', '0.12.0', '0.16.0', '1.0.0', '1.1.0', '1.2.0'])('a %s save', (version) => {
  it('loads, carried forward to the current rules when they changed', () => {
    const save = load(version);
    if (version === SIM_VERSION) expect(save.migratedFrom).toBeUndefined();
    else expect(save.migratedFrom).toBe(version);
    const s = save.snapshot!.state as LeagueState;
    expect(s.user?.teamId).toBe(EXPANSION_ID);
    expect(s.year).toBe(2027);
  });

  it('plays on through the season, the winter and the next opening day', () => {
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
  }, 600_000);
});
