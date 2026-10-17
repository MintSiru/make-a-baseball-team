/* 1.9.1: any number of clubs — schedules for leagues of 6 to 16 clubs and any number of games, and two leagues
   without a twelfth club (leagueSides). */
import { describe, expect, it } from 'vitest';
import { anyPairGames, anySeriesPlan, makeSchedule, seriesPlan } from '../src/league/schedule';
import { startPostseason } from '../src/league/postseason';
import { startSeason } from '../src/league/season';
import { firstTeamIds } from '../src/league/state';
import { sidesOf, twoLeagues } from '../src/league/twelve';
import { endRegular, loadSave } from './helpers';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

describe('schedules for any league', () => {
  const cases: [number, number, boolean][] = [
    [6, 80, false],
    [6, 100, false],
    [7, 108, false],
    [8, 126, false],
    [8, 132, true],
    [9, 128, false],
    [13, 144, false],
    [14, 144, true],
    [16, 144, false],
    [16, 144, true],
  ];
  it.each(cases)('%i clubs, %i games (two leagues: %s): every club plays them all, home and away close, done by mid-October', (n, games, two) => {
    const teams = ids(n);
    const sides = two ? teams.map((_, i) => (i < n / 2 ? 0 : 1)) : undefined;
    const sch = makeSchedule(teams, 2027, 'seed', undefined, games, sides);
    const played: Record<string, number> = {},
      home: Record<string, number> = {},
      pairs = new Set<string>();
    for (const g of sch) {
      played[g.home] = (played[g.home] ?? 0) + 1;
      played[g.away] = (played[g.away] ?? 0) + 1;
      home[g.home] = (home[g.home] ?? 0) + 1;
      pairs.add([g.home, g.away].sort().join('|'));
    }
    for (const t of teams) {
      expect(played[t]).toBe(games);
      expect(Math.abs(home[t]! - games / 2)).toBeLessThanOrEqual(5);
    }
    expect(pairs.size).toBe((n * (n - 1)) / 2);
    expect(sch.at(-1)!.date <= '2027-10-15').toBe(true);
    // No club plays twice on a day.
    const day = new Map<string, Set<string>>();
    for (const g of sch) {
      const on = day.get(g.date) ?? new Set();
      expect(on.has(g.home) || on.has(g.away)).toBe(false);
      on.add(g.home).add(g.away);
      day.set(g.date, on);
    }
  });

  it('two leagues of eight: more games inside the league, the rest spread over the other league', () => {
    const sides = ids(16).map((_, i) => (i < 8 ? 0 : 1));
    const per = anyPairGames(16, 'seed', 2027, 144, sides);
    expect(per(0, 1)).toBe(12);
    const cross = Array.from({ length: 8 }, (_, j) => per(0, 8 + j));
    expect(cross.reduce((a, b) => a + b, 0)).toBe(144 - 12 * 7);
    expect(Math.max(...cross) - Math.min(...cross)).toBeLessThanOrEqual(1);
  });

  it('series: three-game sets where they fit, and the six-set plan kept for 12–18 games', () => {
    expect(anySeriesPlan(7)).toEqual([3, 2, 2]);
    expect(anySeriesPlan(8)).toEqual([3, 3, 2]);
    expect(anySeriesPlan(20).reduce((a, b) => a + b, 0)).toBe(20);
    expect(seriesPlan(16)).toEqual([3, 3, 3, 3, 2, 2]);
  });

  it('ten and eleven clubs keep their old schedules (the pool layout only takes what the six-cycle one cannot)', () => {
    for (const n of [10, 11]) {
      const a = makeSchedule(ids(n), 2027, 'seed');
      const b = makeSchedule(ids(n), 2027, 'seed', undefined, 144);
      expect(b).toEqual(a);
    }
  });
});

describe('two leagues without a twelfth club', () => {
  it('a league set up in two leagues plays more games inside its league and draws the two-league postseason', () => {
    const s = loadSave('1.8.4');
    endRegular(s);
    // Eleven clubs in leagues of six and five: the two-league postseason.
    s.leagueSides = { sides: Object.fromEntries(firstTeamIds(s).map((id, i) => [id, i % 2 ? 'magic' : 'dream'])) };
    expect(twoLeagues(s)).toBe(true);
    expect(sidesOf(s)).toBe(s.leagueSides.sides);
    startPostseason(s);
    expect(s.bracket!.mode).toBe('two');
    // Ten clubs in two leagues of five (the user's club out of the first team for the test): the schedule.
    s.teams.find((t) => t.id === s.user!.teamId)!.firstTeamFrom = s.year + 5;
    delete s.leagueSides.sides[s.user!.teamId];
    expect(twoLeagues(s)).toBe(true);
    startSeason(s);
    const count = new Map<string, number>();
    for (const g of s.schedule) {
      const k = [g.home, g.away].sort().join('|');
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    const sides = s.leagueSides.sides;
    const same = [...count].filter(([k]) => sides[k.split('|')[0]!] === sides[k.split('|')[1]!]).map(([, v]) => v);
    const cross = [...count].filter(([k]) => sides[k.split('|')[0]!] !== sides[k.split('|')[1]!]).map(([, v]) => v);
    expect(Math.min(...same)).toBeGreaterThan(Math.max(...cross));
  }, 240_000);
});
