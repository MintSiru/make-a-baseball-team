/* 2.0.59 (the user's request): games called off for rain, a heat wave and (in the north of a unified Korea) snow and
   cold, weighted by where the home ballpark is; each goes to a later day and is played. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { firstTeamIds, type LeagueState } from '../src/league/state';
import { callRuling, typhoonDay, typhoonOn, weatherFor, zoneOf, type Weather } from '../src/league/weather';
import { BLOCK, setNotForSale, setTradeBlock, standingOffers, tradeBlock } from '../src/league/offers';
import { pickValue, tradeValue } from '../src/league/trade';
import { isForeign } from '../src/league/players';
import { loadSave } from './helpers';

/** How often the weather calls off a game at `home`'s park on days of `month`, and why. */
function rates(s: LeagueState, home: string, month: number, n = 4000) {
  const out: Record<Weather, number> = { rain: 0, heat: 0, snow: 0, typhoon: 0 };
  for (let i = 0; i < n; i++) {
    const why = weatherFor(s, { id: `wx-${home}-${month}-${i}`, date: `${s.year}-${String(month).padStart(2, '0')}-15`, home, away: 'x' });
    if (why) out[why]++;
  }
  return { rain: out.rain / n, heat: out.heat / n, snow: out.snow / n };
}

describe('the weather by region (2.0.59)', () => {
  it('rain most in July and on the south coast, heat in 대구, snow only in the north, none under a dome', () => {
    const s = loadSave('2.0.57');
    const lotte = rates(s, 'lotte', 7),
      lg = rates(s, 'lg', 7),
      samsung = rates(s, 'samsung', 8),
      lgAug = rates(s, 'lg', 8);
    expect(lotte.rain).toBeGreaterThan(lg.rain);
    expect(lg.rain).toBeGreaterThan(rates(s, 'lg', 4).rain);
    expect(samsung.heat).toBeGreaterThan(lgAug.heat * 1.5);
    expect(rates(s, 'lotte', 3).snow).toBe(0);
    // 고척: a dome.
    expect(rates(s, 'kiwoom', 7).rain).toBe(0);
    // Our club in 청진 (unified Korea): snow and cold in March and October, none in July.
    const me = s.user!.teamId;
    s.user!.settings.cityId = 'chongjin';
    s.teams.find((t) => t.id === me)!.stadium = { ...s.teams.find((t) => t.id === me)!.stadium, size: 'large', name: '청진' };
    expect(rates(s, me, 3).snow).toBeGreaterThan(0.05);
    expect(rates(s, me, 10).snow).toBeGreaterThan(0.01);
    expect(rates(s, me, 7).snow).toBe(0);
    s.user!.settings.cityId = 'kaesong';
    const kaesong = rates(s, me, 3).snow;
    s.user!.settings.cityId = 'chongjin';
    expect(rates(s, me, 3).snow).toBeGreaterThan(kaesong);
  });
});

describe('a season with the weather (2.0.59)', () => {
  it('calls off some tens of games and plays every one later', { timeout: 300_000 }, () => {
    const s = loadSave('2.0.57');
    s.pending = null;
    const year = s.year;
    for (let g = 0; g < 3000 && !(s.phase === 'regular' && regularOver(s)); g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else apply(s, { kind: 'regularEnd' });
    }
    expect(s.year).toBe(year);
    const off = s.calledOff ?? [];
    expect(off.length).toBeGreaterThan(15);
    expect(off.length).toBeLessThan(100);
    for (const x of off) expect(x.to > x.date).toBe(true);
    expect(off.some((x) => x.home === 'kiwoom')).toBe(false);
    // Every club plays its whole season, and the schedule stays in date order.
    const played: Record<string, number> = {};
    for (const g of s.scores) for (const t of [g.home, g.away]) played[t] = (played[t] ?? 0) + 1;
    const counts = firstTeamIds(s).map((t) => played[t] ?? 0);
    expect(new Set(counts).size).toBe(1);
    for (let i = 1; i < s.schedule.length; i++) expect(s.schedule[i]!.date >= s.schedule[i - 1]!.date).toBe(true);
    // A club plays one game a day, two only in a doubleheader (or a suspended game's end) against the same club.
    const days = new Map<string, string[]>();
    for (const g of s.scores)
      for (const t of [g.home, g.away]) {
        const k = `${t}|${g.date}`;
        days.set(k, [...(days.get(k) ?? []), g.home === t ? g.away : g.home]);
      }
    for (const opps of days.values()) {
      expect(opps.length).toBeLessThanOrEqual(2);
      if (opps.length === 2) expect(opps[0]).toBe(opps[1]);
    }
    // Rain during games: some no games, some called with the score standing (after five innings at least), now and
    // then a suspended game finished later; doubleheaders outside July and August.
    const dh = off.filter((x) => x.dh);
    expect(dh.length).toBeGreaterThan(0);
    for (const x of dh) expect(['07', '08']).not.toContain(x.date.slice(5, 7));
    expect(off.filter((x) => x.noGame).length).toBeGreaterThan(0);
    const called = s.scores.filter((g) => g.called);
    expect(called.length).toBeGreaterThan(0);
    for (const g of called) expect(g.called).toBeGreaterThanOrEqual(4);
    for (const g of s.scores.filter((x) => x.from)) expect(g.date > g.from!).toBe(true);
    expect(Object.keys(s.suspendedGames ?? {})).toEqual([]);
    console.log('weather', off.length, 'dh', dh.length, 'noGame', off.filter((x) => x.noGame).length, 'called', called.length, 'suspended', s.scores.filter((x) => x.from).length, 'last', s.schedule.at(-1)?.date);
  });
});

describe('typhoons (2.0.59)', () => {
  it('come in late summer, mostly to the south, call off the games under them and can wreck our park', () => {
    const s = loadSave('2.0.57');
    const days: string[] = [];
    for (let m = 3; m <= 10; m++) for (let d = 1; d <= 28; d++) days.push(`${s.year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    const over = days.map((date) => ({ date, zones: typhoonOn(s, date) })).filter((x) => x.zones);
    expect(over.every((x) => ['08', '09', '10'].includes(x.date.slice(5, 7)))).toBe(true);
    // Over many seasons: the south far more often than the capital, the far north never.
    let south = 0,
      central = 0,
      north = 0;
    for (let k = 0; k < 40; k++) {
      s.seed = `typhoon-${k}`;
      for (const date of days) {
        const z = typhoonOn(s, date);
        if (z?.has('south')) south++;
        if (z?.has('central')) central++;
        if (z?.has('north3')) north++;
      }
    }
    expect(south).toBeGreaterThan(central * 2);
    expect(north).toBe(0);
    // A day it is over 부산: a game there is called off for it; our park there takes the hit.
    let hit: string | undefined;
    for (let k = 0; k < 200 && !hit; k++) {
      s.seed = `landfall-${k}`;
      hit = days.find((date) => typhoonOn(s, date)?.has('south') && !typhoonOn(s, `${date.slice(0, 8)}${String(Number(date.slice(8)) - 1).padStart(2, '0')}`));
    }
    expect(hit).toBeTruthy();
    expect(weatherFor(s, { id: 'ty-1', date: hit!, home: 'lotte', away: 'lg' })).toBe('typhoon');
    s.user!.teamId = 'lotte';
    expect(zoneOf(s, 'lotte')).toBe('south');
    const alerts = (s.alerts ?? []).length;
    typhoonDay(s, hit!);
    expect((s.alerts ?? []).length).toBe(alerts + 1);
  });
});

describe('the trade block (2.0.59)', () => {
  it('brings up to three offers of fair value at once, and takes them back off the block', () => {
    const s = loadSave('2.0.57');
    s.pending = null;
    const u = s.user!;
    const ours = Object.values(s.players)
      .filter((p) => p.teamId === u.teamId && p.status === 'active' && !isForeign(p))
      .sort((a, b) => tradeValue(s, b) - tradeValue(s, a));
    const p = ours[1]!;
    setNotForSale(s, p.id, true);
    setTradeBlock(s, p.id, true);
    expect(tradeBlock(s)).toEqual([p.id]);
    expect(u.notForSale ?? []).not.toContain(p.id);
    const offers = standingOffers(s).filter((o) => o.block && o.give.includes(p.id));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.length).toBeLessThanOrEqual(BLOCK.clubs);
    expect(new Set(offers.map((o) => o.teamId)).size).toBe(offers.length);
    for (const o of offers) {
      const v = o.get.reduce((a, id) => a + tradeValue(s, s.players[id]!), 0) + (o.extras.picksIn ?? []).reduce((a, r) => a + pickValue(s, o.teamId, r), 0);
      expect(v).toBeGreaterThan(tradeValue(s, p) * 0.7);
    }
    expect((s.alerts ?? []).some((a) => a.id.startsWith('block-') && a.players?.includes(p.id))).toBe(true);
    // Not for sale takes him off the block; off the block, its offers go.
    setNotForSale(s, p.id, true);
    expect(tradeBlock(s)).toEqual([]);
    setTradeBlock(s, p.id, true);
    setTradeBlock(s, p.id, false);
    expect(standingOffers(s).some((o) => o.block)).toBe(false);
  });
});

describe('rain during a game (2.0.59)', () => {
  it('no game before five innings, the score of the last whole inning, suspended when the visitors just tied or led', () => {
    const at = (inning: number, top: boolean) => ({ inning, top });
    const nine = [0, 1, 0, 0, 2, 0, 0, 0, 1];
    // Over by then: nothing.
    expect(callRuling(nine, [0, 0, 0, 3, 0, 0, 0, 2], at(9, true))).toBeNull();
    expect(callRuling(nine, [0, 0, 0, 1, 0, 0, 0, 0, 0], at(9, false))).toBeNull();
    // Before five innings.
    expect(callRuling(nine, [0, 0, 0, 0, 0, 0, 0, 0, 0], at(4, false))?.kind).toBe('noGame');
    expect(callRuling(nine, [0, 0, 0, 0, 0, 0, 0, 0, 0], at(5, true))?.kind).toBe('noGame');
    // Four and a half with the home side ahead; five whole innings.
    expect(callRuling(nine, [0, 0, 4, 0, 0, 0, 0, 0, 0], at(5, true))).toEqual({ kind: 'final', inning: 5, top: true });
    expect(callRuling(nine, [0, 0, 0, 0, 0, 0, 0, 0, 0], at(6, false))).toEqual({ kind: 'final', inning: 6, top: false });
    // The visitors tie it in the top of the 7th, the home side yet to bat: suspended.
    expect(callRuling([0, 0, 0, 0, 0, 0, 2, 0, 0], [0, 2, 0, 0, 0, 0, 0, 0, 0], at(7, true))?.kind).toBe('suspended');
    // The visitors already ahead: the score after six stands.
    expect(callRuling([1, 0, 0, 0, 0, 0, 2, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], at(7, true))).toEqual({ kind: 'final', inning: 6, top: false });
  });
});
