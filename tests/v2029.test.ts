/* 2.0.29: our rank inside our own league in two leagues; the hard slider; draft picks worth more in trades. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply } from '../src/league/actions';
import { clubStanding, standingsView } from '../src/league/views';
import { firstTeamIds, registeredIds } from '../src/league/state';
import { HARD_SLIDER, pitchVariant } from '../src/league/pitches';
import { checkTrade, pickValue, tradableOf, tradeValue } from '../src/league/trade';
import { keepValue } from '../src/league/players';

const league = () => {
  const s = createLeague('v2029');
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
  // Run one of the clubs already in the league, in May.
  s.user!.teamId = firstTeamIds(s)[0]!;
  s.pending = null;
  s.next = s.schedule.findIndex((g) => g.date >= `${s.year}-05-10`);
  return s;
};

describe('two leagues on our overview (2.0.29)', () => {
  it('ranks us inside our own league, with its name and its table', () => {
    const s = league();
    const ids = firstTeamIds(s);
    const whole = clubStanding(s, s.user!.teamId);
    expect(whole.league).toBeNull();
    expect(whole.table).toHaveLength(ids.length);
    s.leagueSides = { sides: Object.fromEntries(ids.map((id, i) => [id, i % 2 ? 'magic' : 'dream'])) } as never;
    for (const id of ids) {
      const x = clubStanding(s, id);
      expect(x.league).toBeTruthy();
      expect(x.table.length).toBe(ids.length / 2);
      expect(x.row!.rank).toBeLessThanOrEqual(ids.length / 2);
      // The same order as the whole table, within the league.
      const order = standingsView(s).filter((r) => x.table.some((t) => t.teamId === r.teamId)).map((r) => r.teamId);
      expect(x.table.map((r) => r.teamId)).toEqual(order);
    }
  });
});

describe('the hard slider (2.0.29)', () => {
  it('comes from the hard throwers only, more of them the harder they throw', () => {
    const arm = (i: number, velocity: number) => ({ id: `hs${i}`, role: 'SP', origin: { kind: 'draftClass' }, velocity }) as never;
    const share = (v: number) => Array.from({ length: 2000 }, (_, i) => pitchVariant(arm(i, v), 'SL')).filter((x) => x === 'hardSL').length / 2000;
    expect(share(140)).toBe(0);
    expect(share(HARD_SLIDER.from + 1)).toBeGreaterThan(0.05);
    expect(share(153)).toBeGreaterThan(share(146) + 0.1);
    expect(share(160)).toBeLessThanOrEqual(HARD_SLIDER.most + 0.04);
  });
});

describe('draft picks in trades (2.0.29)', () => {
  it("prices another club's first-rounder above a 55 player, and two ordinary players do not buy it", () => {
    const s = league();
    const me = s.user!.teamId;
    const all = firstTeamIds(s).flatMap((id) => registeredIds(s, id).map((x) => s.players[x]!));
    const at = (g: number) => {
      const xs = all.filter((p) => Math.round(keepValue(p, s.year)) === g).map((p) => tradeValue(s, p)).sort((a, b) => a - b);
      return xs[Math.floor(xs.length / 2)]!;
    };
    for (const id of firstTeamIds(s)) {
      expect(pickValue(s, id, 1)).toBeGreaterThan(at(55));
      expect(pickValue(s, id, 2)).toBeGreaterThan(at(50) * 0.75);
    }
    // One of ours at 55, or two at 50–53, for a club's first-round pick: no (two for two or one for one, so neither
    // roster grows: their least valued players come back with the pick).
    const at55 = tradableOf(s, me).filter((p) => Math.round(keepValue(p, s.year)) === 55);
    const low = tradableOf(s, me).filter((p) => {
      const v = keepValue(p, s.year);
      return v >= 50 && v < 53.5;
    });
    expect(at55.length).toBeGreaterThan(0);
    expect(low.length).toBeGreaterThanOrEqual(2);
    const offer = (give: string[]) =>
      firstTeamIds(s)
        .filter((id) => id !== me)
        .map((other) => {
          const fringe = tradableOf(s, other)
            .sort((a, b) => tradeValue(s, a) - tradeValue(s, b))
            .slice(0, give.length)
            .map((p) => p.id);
          return checkTrade(s, other, give, fringe, { picksIn: [1] });
        })
        .filter((c) => !c.problem);
    const checks = [...offer([at55[0]!.id]), ...offer([low[0]!.id, low[1]!.id])];
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) expect(c.accepted).toBe(false);
  });
});
