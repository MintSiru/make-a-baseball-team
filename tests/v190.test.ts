/* 1.9.0: the 1.8 feedback — no postseason prize shares; each game's ticket money goes to the two clubs and the
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

  it('each game is split home / away / league, and clubs out of the postseason get nothing', () => {
    const s = loadSave('1.8.2');
    endRegular(s);
    playPostseason(s);
    const games = s.postseason.flatMap((x) => x.games);
    expect(games.every((g) => (g.gate ?? 0) > 0)).toBe(true);
    const takes = postseasonTakes(s);
    for (const [id, take] of Object.entries(takes)) {
      const expected = games.reduce((a, g) => a + (g.home === id ? Math.round(g.gate! * G.home) : g.away === id ? Math.round(g.gate! * G.away) : 0), 0);
      expect(take).toBe(expected);
    }
    const playing = new Set(games.flatMap((g) => [g.home, g.away]));
    expect(Object.keys(takes).sort()).toEqual([...playing].sort());
    // The clubs take 70% of the gate; the league keeps the rest for its costs.
    const gate = games.reduce((a, g) => a + g.gate!, 0);
    const paid = Object.values(takes).reduce((a, b) => a + b, 0);
    expect(paid / gate).toBeCloseTo(G.home + G.away, 2);
    const champ = s.postseason.find((x) => x.round === 'ks')!.winner;
    expect(postseasonGateOf(s, champ).take).toBe(takes[champ]);
  }, 240_000);
});
