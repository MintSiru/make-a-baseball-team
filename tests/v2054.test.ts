/* 2.0.54 (the user's reports): a legacy league's new club takes its special-draft pick and its allocation from our
   club only after we name our protected list; the allocations end with 2000 (NC and KT built with the special draft). */
import { afterAll, describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { ALLOCATION, LEGACY_ERA, legacyAllocations } from '../src/league/legacy1982';
import { keepValue } from '../src/league/players';
import { withScenario } from '../src/league/scenarios';
import type { LeagueState } from '../src/league/state';

afterAll(() => setEra(0));

describe('a legacy league’s new club and our protected list (2.0.54)', () => {
  it('asks for the list, and takes only from outside it', { timeout: 600_000 }, () => {
    const s: LeagueState = createLeague('v2054', undefined, LEGACY_ERA);
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null }, 'legacy') });
    const me = s.user!.teamId;
    let asked = null as Extract<NonNullable<LeagueState['pending']>, { kind: 'rivalProtect' }> | null;
    for (let g = 0; g < 20000 && !asked && s.year < 1990; g++) {
      if (s.pending?.kind === 'rivalProtect') asked = s.pending;
      else if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(asked).toBeTruthy();
    expect(asked!.club).toContain('빙그레');
    expect(asked!.allocation).toBe(ALLOCATION.perClub);
    // We protect the least valuable twenty: the new club must take from our best now.
    const next = s.offseason!.year + 1;
    const byValue = [...asked!.candidates].sort((a, b) => keepValue(s.players[a]!, next) - keepValue(s.players[b]!, next));
    const kept = byValue.slice(0, asked!.protect);
    apply(s, { kind: 'decide', input: { kind: 'rivalProtect', ids: kept } });
    for (let g = 0; g < 200 && s.offseason && !s.legacy!.clubs.find((c) => c.firstTeam === next)?.picks; g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else apply(s, { kind: 'nextSeason' });
    }
    const club = s.legacy!.clubs.find((c) => c.firstTeam === next)!;
    const lost = Object.values(s.players).filter((p) => p.teamId === club.teamId && p.moves?.some((m) => m.from === me));
    expect(lost.length).toBe(1 + ALLOCATION.perClub);
    for (const p of lost) expect(kept).not.toContain(p.id);
  });

  it('no allocation after 2000', () => {
    const s: LeagueState = createLeague('v2054-late', undefined, LEGACY_ERA);
    const before = JSON.stringify(Object.values(s.players).map((p) => p.teamId));
    s.legacy = { clubs: [{ teamId: 'nc', founded: 2011, firstTeam: 2013, gm: 'balanced' } as never] };
    legacyAllocations(s, 2013);
    expect(JSON.stringify(Object.values(s.players).map((p) => p.teamId))).toBe(before);
  });
});
