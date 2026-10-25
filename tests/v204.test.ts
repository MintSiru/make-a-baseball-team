/* 2.0.4: head-to-head records (a batter against each pitcher, a club against each other), the spray chart, a pitcher's
   mix by season and the percentile bars. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { headToHead, headToHeadAll, meetingRates, meetingsOf } from '../src/league/matchups';
import { closeSeason } from '../src/league/offseason';
import { isPitcher } from '../src/league/players';
import { batDetail, mixBySeason, percentilesOf, sprayOf, xwobaOf } from '../src/league/savant';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { currentStandings } from '../src/league/season';

describe('head-to-head from scores', () => {
  it('counts wins, losses and ties both ways', () => {
    const h = headToHead([
      { id: 'a', date: '2026-04-01', home: 'x', away: 'y', hs: 3, as: 1 },
      { id: 'b', date: '2026-04-02', home: 'y', away: 'x', hs: 2, as: 2 },
      { id: 'c', date: '2026-04-03', home: 'y', away: 'x', hs: 5, as: 4 },
    ]);
    expect(h.x!.y).toEqual([1, 1, 1]);
    expect(h.y!.x).toEqual([1, 1, 1]);
    expect(meetingRates([10, 8, 3, 6, 1, 2, 2])).toEqual({ avg: 3 / 8, obp: 5 / 10, slg: 6 / 8 });
  });
});

describe('a season of records', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v204-season');
    for (let d = 0; d < 40; d++) playDay(s);
  }, 300_000);

  it('keeps every first-team plate appearance (a sacrifice bunt too) under its batter and pitcher', () => {
    let pa = 0,
      h = 0,
      hr = 0;
    for (const l of Object.values(s.lines)) {
      if (!l.bat) continue;
      pa += l.bat.pa;
      h += l.bat.h;
      hr += l.bat.hr;
    }
    const book = Object.values(s.matchups ?? {});
    expect(book.reduce((a, m) => a + m[0]!, 0)).toBe(pa);
    expect(book.reduce((a, m) => a + m[2]!, 0)).toBe(h);
    expect(book.reduce((a, m) => a + m[4]!, 0)).toBe(hr);
    // The same meeting seen from both sides.
    const [key, m] = Object.entries(s.matchups!).sort((a, b) => b[1][0]! - a[1][0]!)[0]!;
    const [b, p] = key.split('|') as [string, string];
    expect(meetingsOf(s, b, false).find((r) => r.opponent === p)!.season).toEqual(m);
    expect(meetingsOf(s, p, true).find((r) => r.opponent === b)!.season).toEqual(m);
  });

  it('draws every hit on the spray chart, home runs over the fence', () => {
    for (const [id, l] of Object.entries(s.lines)) {
      if (!l.bat || isPitcher(s.players[id]!)) continue;
      const pts = sprayOf(s, id);
      expect(pts.length).toBe(l.bat.h);
      expect(pts.filter((x) => x.hit === 3).length).toBe(l.bat.hr);
      for (const x of pts) {
        expect(Math.abs(x.dir)).toBeLessThanOrEqual(45);
        if (x.hit === 3) expect(x.dist).toBeGreaterThan(90);
        else expect(x.dist).toBeLessThan(130);
      }
    }
  });

  it('ranks the regulars from 1 to 100, the better xwOBA higher', () => {
    // The regulars the ranking itself counts (two plate appearances per team game; 2.0.47: was a fixed 80, which
    // early in a season let in a hitter below the ranking's own field).
    const games = percentilesOf(s, Object.keys(s.lines)[0]!).games;
    const regs = Object.entries(s.lines)
      .filter(([id, l]) => l.bat && !isPitcher(s.players[id]!) && l.bat.pa >= Math.max(80, games * 2))
      .map(([id, l]) => ({ id, x: xwobaOf(l.bat!)! }))
      .sort((a, b) => a.x - b.x);
    const low = percentilesOf(s, regs[0]!.id).batting!,
      high = percentilesOf(s, regs[regs.length - 1]!.id).batting!;
    const at = (rows: typeof low) => rows.find((r) => r.key === 'xwoba')!.pct;
    expect(at(high)).toBeGreaterThan(90);
    expect(at(low)).toBeLessThan(10);
    for (const r of [...low, ...high]) {
      expect(r.pct).toBeGreaterThanOrEqual(1);
      expect(r.pct).toBeLessThanOrEqual(100);
    }
    const d = batDetail(s.lines[regs[0]!.id]!.bat!, 'SS');
    expect(d.kPct).toBeGreaterThan(0);
    expect(d.ev).not.toBeNull();
  });

  it('closes the books: the clubs’ season series, the all-time book, the pitchers’ mix kept and the spray dropped', () => {
    const standings = currentStandings(s);
    closeSeason(s);
    const last = s.history.at(-1)!;
    for (const row of standings) {
      const sum = Object.values(last.h2h![row.teamId] ?? {}).reduce((a, [w, l, t]) => [a[0]! + w, a[1]! + l, a[2]! + t], [0, 0, 0]);
      expect(sum).toEqual([row.w, row.l, row.t]);
    }
    // Every season since 2.0.4 (the league's made-up history included), this one in it once.
    const all = headToHeadAll(s);
    const kept = s.history.filter((x) => x.h2h).length;
    expect(kept).toBeGreaterThan(1);
    for (const [a, row] of Object.entries(last.h2h!))
      for (const [b, [w]] of Object.entries(row)) expect(all[a]![b]![0]).toBe(s.history.reduce((n, x) => n + (x.h2h?.[a]?.[b]?.[0] ?? 0), 0) || w);
    expect(s.matchups).toBeUndefined();
    expect(Object.keys(s.matchupsAll!).length).toBeGreaterThan(1000);
    for (const p of Object.values(s.players)) {
      const r = p.career.find((x) => x.year === s.year && !x.level);
      if (!r) continue;
      expect(r.bat?.spray).toBeUndefined();
      if (r.pit && isPitcher(p)) {
        expect(r.mix!.reduce((a, [, x]) => a + x, 0)).toBeCloseTo(100, 0);
        expect(mixBySeason(s, p).at(-1)!.year).toBe(s.year);
      }
    }
  });
});
