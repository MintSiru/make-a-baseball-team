/* 1.9.2: 통일 한국 — six clubs from the north at once, sixteen clubs in two leagues of eight, the north's amateurs in
   the draft and northern names. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { draftClass, NORTH_CLASS } from '../src/league/players';
import { NORTH_CITIES, NORTH_REGIONS, northName } from '../src/league/north';
import { makeNorthern } from '../src/league/northevents';
import { scenarioDef, withScenario } from '../src/league/scenarios';
import { firstTeamIds, registeredIds, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { cityById } from '../src/club/cities';
import { NORTH_AI_CLUBS, NORTH_TRYOUT } from '../src/league/unified';
import { rng } from '../src/draftroom';

const settings = (scenario: 'unified' | 'unifiedFree'): ExpansionSettings =>
  withScenario({ name: '평양 범', short: '평양', color: '#1f6fb2', cityId: 'pyongyang', parentType: 'conglomerate', parentName: '대동그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null, twelve: { mode: 'year', year: 2030 } }, scenario);

const isNorth = (region: string) => (NORTH_REGIONS as readonly string[]).includes(region);

let league: LeagueState | null = null;
/** One unified league, founded and played to its first sixteen-club season (shared by the tests below). */
function unified(): LeagueState {
  if (league) return league;
  const s = createLeague('v192');
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: settings('unified') });
  for (let g = 0; g < 3000 && !(s.year === 2028 && s.phase === 'regular'); g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else apply(s, { kind: 'nextSeason' });
  }
  return (league = s);
}

describe('the north: cities, names, schools', () => {
  it('cities: no political names (김책 goes by 성진), all found by id', () => {
    expect(NORTH_CITIES.map((c) => c.id)).toContain('songjin');
    for (const c of NORTH_CITIES) {
      expect(cityById(c.id)).toBe(c);
      expect(c.name + c.stadium.name).not.toMatch(/김일성|김정일|김정은|김책/);
    }
  });

  it('a northern name writes the surname the north way and takes a northern given name', () => {
    const used = new Set<string>();
    const r = rng('names');
    expect(northName('이민준', r, used)).toMatch(/^리/);
    expect(northName('임도윤', r, used)).toMatch(/^림/);
    expect(northName('유하준', r, used)).toMatch(/^류/);
    expect(northName('김서준', r, used)).toMatch(/^김/);
    expect(northName('남궁민수', r, used)).toMatch(/^남궁/);
    // No leader's or his family's given name.
    for (let i = 0; i < 300; i++) expect(northName('김민준', rng(`n${i}`), new Set())).not.toMatch(/일성|정일|정은|정남|정철|한솔/);
  });

  it('the scenarios: a deadline and a sandbox, northern homes, no twelfth club', () => {
    expect(scenarioDef('unified')!.titleWithin).toBe(10);
    expect(scenarioDef('unifiedFree')!.free).toBe(true);
    for (const id of ['unified', 'unifiedFree'] as const) {
      const st = settings(id);
      expect(st.twelve).toBeUndefined();
      expect(st.scenario).toBe(id);
    }
  });
});

describe('the draft class with the north', () => {
  it('the north adds its amateurs from its first year: renamed, from the north, ranked with everyone', () => {
    const south = draftClass('v192-class', 2027);
    const all = draftClass('v192-class', 2027, { since: 2026 });
    expect(south.length).toBe(400);
    expect(all.length).toBe(400 + NORTH_CLASS.size);
    const north = all.filter((p) => p.origin.sourceId?.startsWith('N'));
    expect(north.length).toBe(NORTH_CLASS.size);
    expect(north.every((p) => isNorth(p.education.region))).toBe(true);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.amateur.draftRank)).size).toBe(all.length);
    // Before the unification there is none.
    expect(draftClass('v192-class', 2025, { since: 2026 }).length).toBe(400);
  });

  it('the north holds back its best at first, less each year', () => {
    const best = (year: number) => Math.max(...draftClass('v192-class', year, { since: 2026 }).filter((p) => p.origin.sourceId?.startsWith('N')).map((p) => p.scouting.futureValue));
    const top = (year: number) => Math.max(...draftClass('v192-class', year).map((p) => p.scouting.futureValue));
    // In the first year the north's best is below the south's best; five years on the north has its full class.
    expect(best(2026)).toBeLessThan(top(2026));
    expect(NORTH_CLASS.heldBack - NORTH_CLASS.heldBackStep * 5).toBeLessThanOrEqual(0);
  });

  it('makeNorthern keeps the player and moves him north', () => {
    const p = draftClass('v192-class', 2027)[0]!;
    const n = makeNorthern(p, 'x', new Set());
    expect(n.id).toBe(p.id);
    expect(n.hidden).toEqual(p.hidden);
    expect(isNorth(n.education.region)).toBe(true);
    expect(n.education.school).not.toBe(p.education.school);
  });

  it('1.9.3: northern amateurs come from all seven regions, many towns and schools, with many given names', () => {
    const used = new Set<string>();
    const ps = draftClass('v192-class', 2027).map((p, i) => makeNorthern(p, `div${i}`, used));
    const count = (f: (p: (typeof ps)[number]) => string) => new Set(ps.map(f)).size;
    expect(count((p) => p.education.region)).toBe(NORTH_REGIONS.length);
    expect(count((p) => p.birthplace)).toBeGreaterThan(45);
    expect(count((p) => p.education.school)).toBeGreaterThan(55);
    expect(count((p) => p.name.slice(-2))).toBeGreaterThan(110);
  });
});

describe('a unified league', () => {
  it('founding: five northern clubs with ours, each with its tryout of the north’s adult players', () => {
    const s = createLeague('v192-found');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: settings('unifiedFree') });
    expect(s.teams.length).toBe(16);
    expect(s.unified!.clubs.length).toBe(NORTH_AI_CLUBS);
    expect(s.unified!.clubs.map((c) => c.cityId)).not.toContain('pyongyang');
    for (const c of s.unified!.clubs) {
      const ids = registeredIds(s, c.teamId);
      expect(ids.length).toBe(NORTH_TRYOUT);
      expect(ids.every((id) => isNorth(s.players[id]!.education.region))).toBe(true);
      expect(c.firstTeam).toBe(s.user!.firstTeamYear);
    }
    expect(s.twelve).toBeUndefined();
  }, 240_000);

  it('the first sixteen-club season: two leagues of eight, the north three and three, 144 games each, a special draft', () => {
    const s = unified();
    const ids = firstTeamIds(s);
    expect(ids.length).toBe(16);
    const sides = s.leagueSides!.sides;
    expect(ids.filter((id) => sides[id] === 'dream').length).toBe(8);
    const north = [s.user!.teamId, ...s.unified!.clubs.map((c) => c.teamId)];
    expect(north.filter((id) => sides[id] === 'dream').length).toBe(3);
    expect(sides[s.user!.teamId]).toBe('dream');
    const games: Record<string, number> = {};
    for (const g of s.schedule) (games[g.home] = (games[g.home] ?? 0) + 1), (games[g.away] = (games[g.away] ?? 0) + 1);
    for (const id of ids) expect(games[id]).toBe(144);
    for (const c of s.unified!.clubs) {
      expect(c.picks!.length).toBe(10);
      expect(registeredIds(s, c.teamId).length).toBeGreaterThan(55);
    }
    // Northern players were drafted.
    expect(Object.values(s.players).some((p) => p.teamId && isNorth(p.education.region) && p.origin.kind === 'draftClass')).toBe(true);
  }, 600_000);
});
