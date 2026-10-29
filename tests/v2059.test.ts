/* 2.0.59 (the user's request): games called off for rain, a heat wave and (in the north of a unified Korea) snow and
   cold, weighted by where the home ballpark is; each goes to a later day and is played. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { firstTeamIds, type LeagueState } from '../src/league/state';
import { weatherFor, type Weather } from '../src/league/weather';
import { loadSave } from './helpers';

/** How often the weather calls off a game at `home`'s park on days of `month`, and why. */
function rates(s: LeagueState, home: string, month: number, n = 4000) {
  const out: Record<Weather, number> = { rain: 0, heat: 0, snow: 0 };
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
    // A club plays one game a day.
    const days = new Set<string>();
    for (const g of s.scores) for (const t of [g.home, g.away]) {
      expect(days.has(`${t}|${g.date}`)).toBe(false);
      days.add(`${t}|${g.date}`);
    }
  });
});
