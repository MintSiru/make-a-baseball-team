/* 1.8.1: the 1.8 feedback — two leagues send their top three each with a wild card, bigger ballparks at the founding,
   and the scenario 돌아온 탕아. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { STADIUM_PLANS } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { playPostseason, roundName } from '../src/league/postseason';
import { SCENARIOS, withScenario } from '../src/league/scenarios';
import { currentStandings } from '../src/league/season';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { endRegular, loadSave } from './helpers';

const free: ExpansionSettings = { name: '검증 고래', short: '검증', color: '#1f6fb2', cityId: 'ulsan', parentType: 'midsize', parentName: '검증그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null };

/** Two leagues drawn from the final table: `dream` gets these overall places (1-based), magic the rest. */
function twoLeagues(s: LeagueState, dreamPlaces: number[]) {
  const rows = currentStandings(s);
  const leagues = Object.fromEntries(rows.map((r, i) => [r.teamId, dreamPlaces.includes(i + 1) ? 'dream' : 'magic']));
  s.twelve = { teamId: rows[0]!.teamId, cityId: 'x', founded: 2020, firstTeam: 2021, format: 'two', gm: 'balanced', manager: 'balanced', leagues } as never;
  return rows.map((r) => r.teamId);
}

describe('two leagues, the top three each and a wild card', () => {
  it('a league 4th better than the other league 3rd plays it for the place; then cross-league semi-playoffs and playoffs', () => {
    const s = loadSave();
    endRegular(s);
    const n = currentStandings(s).length;
    // Dream: 1st–4th and the last two overall; magic: the middle. Dream's 4th (4th overall) beats magic's 3rd.
    const ids = twoLeagues(s, [1, 2, 3, 4, n - 1, n]);
    playPostseason(s);
    const b = s.bracket!;
    expect(b.style).toBe('cross');
    const [d1, d2, d3, m1, m2, m3, d4] = b.seeds;
    expect([d1, d2, d3, d4]).toEqual(ids.slice(0, 4));
    const wc = s.postseason.filter((x) => x.round === 'wildcard');
    expect(wc.map((x) => [x.high, x.low])).toEqual([[d4, m3]]);
    expect(Math.max(wc[0]!.highWins, wc[0]!.lowWins)).toBe(2);
    const magicThird = wc[0]!.winner;
    const semi = s.postseason.filter((x) => x.round === 'semipo');
    expect(semi.map((x) => [x.high, x.low])).toEqual([
      [d2, magicThird],
      [m2, d3],
    ]);
    for (const x of semi) expect(Math.max(x.highWins, x.lowWins)).toBe(3);
    const po = s.postseason.filter((x) => x.round === 'po');
    const w = (high: string) => semi.find((x) => x.high === high)!.winner;
    expect(po.map((x) => [x.high, x.low])).toEqual([
      [d1, w(m2!)],
      [m1, w(d2!)],
    ]);
    const ks = s.postseason.at(-1)!;
    expect(ks.round).toBe('ks');
    expect([ks.high, ks.low].sort()).toEqual(po.map((x) => x.winner).sort());
    expect(roundName(s, 'wildcard')).toContain('와일드카드');
    const gameIds = s.postseason.flatMap((x) => x.games.map((g) => g.id));
    expect(new Set(gameIds).size).toBe(gameIds.length);
  }, 240_000);

  it('no wild card when every 4th is behind the other league 3rd', () => {
    const s = loadSave();
    endRegular(s);
    // Alternate the places: each league's 4th is 7th or 8th overall, behind the other league's 3rd (5th or 6th).
    twoLeagues(s, [1, 3, 5, 7, 9, 11]);
    playPostseason(s);
    expect(s.postseason.some((x) => x.round === 'wildcard')).toBe(false);
    expect(s.postseason.map((x) => x.round)).toEqual(['semipo', 'semipo', 'po', 'po', 'ks']);
  }, 240_000);
});

describe('bigger ballparks and 돌아온 탕아', () => {
  it('offers a 30,000 and a 40,000-seat park at the founding', () => {
    expect(STADIUM_PLANS.newGrand.seats).toBe(30_000);
    expect(STADIUM_PLANS.newMega.seats).toBe(40_000);
    const s = apply(apply(createLeague('v181-park'), { kind: 'toFounding' }), { kind: 'found', settings: { ...free, stadium: 'newMega' } });
    expect(s.user!.settings.stadium).toBe('newMega');
  }, 120_000);

  it('the Hyundai Unicorns come home to 문학 while SSG plays in its 청라 dome', () => {
    const def = SCENARIOS.find((x) => x.id === 'prodigal')!;
    expect(def.titleWithin).toBe(5);
    // Whatever the form says, the scenario's name, colour, owner and home hold.
    const settings = withScenario({ ...free, color: '#000000', name: '아무개' }, 'prodigal');
    expect(settings).toMatchObject({ name: '현대 유니콘스', short: '현대', color: '#007F55', cityId: 'incheon', parentType: 'conglomerate', parentName: '현대그룹', stadium: 'existing' });
    const s = apply(apply(createLeague('v181-prodigal'), { kind: 'toFounding' }), { kind: 'found', settings });
    const us = s.teams.find((t) => t.id === s.user!.teamId)!;
    expect(us.name).toBe('현대 유니콘스');
    expect(us.color).toBe('#007F55');
    expect(us.stadium).toMatchObject({ name: '인천 문학야구장', capacity: 23_000, size: 'large' });
    expect(s.teams.find((t) => t.id === 'ssg')!.stadium).toMatchObject({ name: '인천 청라돔', size: 'dome' });
  }, 120_000);
});

describe('ballpark expansion cap', () => {
  it('a park can be expanded up to 40,000 seats', async () => {
    const { projectOptions } = await import('../src/league/ballpark');
    const s = loadSave();
    const team = s.teams.find((t) => t.id === s.user!.teamId)!;
    const expand = () => projectOptions(s).find((o) => o.kind === 'expand')!;
    team.stadium.capacity = 30_000;
    expect(expand().blocked ?? '').not.toContain('40,000');
    team.stadium.capacity = 38_000;
    expect(expand().blocked).toContain('40,000');
  });
});
