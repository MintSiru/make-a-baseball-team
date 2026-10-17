/* 1.8.4: the 1.8 feedback — no postseason prize shares; each game's ticket money goes to the two clubs and the
   league by a percentage, and postseason tickets cost more each round. */
import { describe, expect, it } from 'vitest';
import { postseasonGateOf, postseasonTakes } from '../src/league/finance';
import { playPostseason, postseasonTicket } from '../src/league/postseason';
import { clubState, leaguePrice } from '../src/league/fans';
import { POSTSEASON_GATE as G } from '../src/league/tuning';
import { endRegular, loadSave } from './helpers';

describe('postseason money by the gate', () => {
  it('tickets cost the home club\'s price times the round\'s factor, more each round', () => {
    const s = loadSave('1.8.2');
    const home = s.teams.find((t) => s.rosters[t.id])!.id;
    clubState(s, home).price = 1.2;
    const rounds = ['wildcard', 'semipo', 'po', 'ks'] as const;
    const prices = rounds.map((r) => postseasonTicket(s, home, r));
    expect(prices[0]).toBeCloseTo(leaguePrice(s.year) * 1.2 * G.price.wildcard);
    for (let i = 1; i < prices.length; i++) expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
  });

  it('each game is split home / away, the champion takes a share of the whole gate, and the champion earns the most', () => {
    const s = loadSave('1.8.2');
    endRegular(s);
    playPostseason(s);
    const games = s.postseason.flatMap((x) => x.games);
    expect(games.every((g) => (g.gate ?? 0) > 0)).toBe(true);
    const gate = games.reduce((a, g) => a + g.gate!, 0);
    const champ = s.postseason.find((x) => x.round === 'ks')!.winner;
    const takes = postseasonTakes(s);
    for (const [id, take] of Object.entries(takes)) {
      const fromGames = games.reduce((a, g) => a + (g.home === id ? Math.round(g.gate! * G.home) : g.away === id ? Math.round(g.gate! * G.away) : 0), 0);
      expect(take).toBe(fromGames + (id === champ ? Math.round(gate * G.champion) : 0));
    }
    const playing = new Set(games.flatMap((g) => [g.home, g.away]));
    expect(Object.keys(takes).sort()).toEqual([...playing].sort());
    expect(Math.max(...Object.values(takes))).toBe(takes[champ]);
    expect(postseasonGateOf(s, champ).take).toBe(takes[champ]);
  }, 240_000);

  it('with twelve clubs, the NPB rule: the host keeps the gate before the final, the final split as the Japan Series', () => {
    const s = loadSave('1.8.2');
    endRegular(s);
    playPostseason(s);
    // Twelve clubs: a rival among the first-team clubs is all twelveClubs() asks.
    s.twelve = { teamId: s.postseason[0]!.high, cityId: 'x', founded: 2020, firstTeam: 2021, format: 'single', gm: 'balanced', manager: 'balanced' } as never;
    const takes = postseasonTakes(s);
    const expected: Record<string, number> = {};
    for (const x of s.postseason)
      x.games.forEach((g, i) => {
        const [h, a] = x.round !== 'ks' ? [1, 0] : i < 4 ? [0.24, 0.24] : [0.315, 0.315];
        expected[g.home] = (expected[g.home] ?? 0) + Math.round(g.gate! * h);
        expected[g.away] = (expected[g.away] ?? 0) + Math.round(g.gate! * a);
      });
    expect(takes).toEqual(expected);
  }, 240_000);
});
