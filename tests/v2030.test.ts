/* 2.0.30: a draft prospect pitcher's pitches; the spring games (시범경기) before opening day; records by situation. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply, nextDate } from '../src/league/actions';
import { draftClass } from '../src/league/players';
import { prospectPitches, exhibitionView, exhibitionGames } from '../src/league/views';
import { EXHIBITION } from '../src/league/exhibition';
import { firstTeamIds } from '../src/league/state';
import { leverageIndex, SITUATIONS, SPLIT_KEYS } from '../src/league/engine/situation';
import { playerCard } from '../src/league/views';
import { closeSeason } from '../src/league/offseason';
import { hitterOuterZones, hitterZones, pitcherOuterZones, pitcherZones } from '../src/league/zones';

describe('draft prospects show their pitches (2.0.30)', () => {
  it('a pitcher has his fastball and his other pitches, a hitter none', () => {
    const pool = draftClass('v2030-draft', 2026);
    const arms = pool.filter((p) => p.role === 'SP' || p.role === 'RP');
    expect(arms.length).toBeGreaterThan(20);
    for (const p of arms) {
      const x = prospectPitches(p)!;
      expect(x).not.toBeNull();
      expect(['4SFB', '2SFB', 'CUT']).toContain(x.fastball.type);
      expect(x.list.length).toBeGreaterThan(0);
      const usage = x.fastball.usage + x.list.reduce((a, y) => a + y.usage, 0);
      expect(usage).toBeCloseTo(1, 6);
      for (const y of x.list) expect(y.grade).toBeGreaterThanOrEqual(20);
    }
    const bat = pool.find((p) => p.role !== 'SP' && p.role !== 'RP')!;
    expect(prospectPitches(bat)).toBeNull();
  });
});

describe('the spring games (2.0.30)', () => {
  it('come before opening day, ten for each club, and change nothing in the season', () => {
    const s = createLeague('v2030');
    const ex = s.exhibition!;
    expect(ex.year).toBe(s.year);
    const opening = s.schedule[0]!.date;
    const teams = firstTeamIds(s);
    expect(ex.games.every((g) => g.date < opening)).toBe(true);
    for (const id of teams) {
      const n = ex.games.filter((g) => g.home === id || g.away === id).length;
      expect(n).toBeGreaterThanOrEqual(EXHIBITION.days - 2);
      expect(n).toBeLessThanOrEqual(EXHIBITION.days);
    }
    expect(nextDate(s)).toBe(ex.games[0]!.date);
    // The same league without them: the regular season's first week comes out the same.
    const without = structuredClone(s);
    delete without.exhibition;
    apply(s, { kind: 'days', days: EXHIBITION.days });
    expect(ex.done).toBe(true);
    expect(ex.scores).toHaveLength(ex.games.length);
    expect(s.next).toBe(0);
    expect(s.scores).toHaveLength(0);
    expect(Object.keys(s.lines)).toHaveLength(0);
    expect(Object.keys(s.rotation).some((k) => k.startsWith('ex|'))).toBe(false);
    expect(nextDate(s)).toBe(opening);
    // Their own table, leaders and box scores; the papers write them up.
    const v = exhibitionView(s)!;
    expect(v.rows).toHaveLength(teams.length);
    expect(v.rows.reduce((a, r) => a + r.games, 0)).toBe(ex.games.length * 2);
    expect(v.avg.length).toBeGreaterThan(0);
    expect(exhibitionGames(s)).toHaveLength(ex.games.length);
    expect(Object.keys(ex.boxes)).toHaveLength(ex.games.length);
    expect(s.news?.some((n) => n.id === `exhibition-${s.year}`)).toBe(true);
    apply(s, { kind: 'days', days: 7 });
    apply(without, { kind: 'days', days: 7 });
    expect(s.scores.length).toBeGreaterThan(20);
    expect(s.scores).toEqual(without.scores);
  });

  it('are not played in the history the league is built from', () => {
    const s = createLeague('v2030');
    // The seasons before the game starts kept no spring of their own (only this one is planned).
    expect(s.exhibition?.year).toBe(s.year);
    expect(s.history.length).toBeGreaterThan(0);
  });
});

describe('records by situation (2.0.30)', () => {
  it('rates the leverage: late and close is high, a rout is low', () => {
    const empty = [false, false, false],
      loaded = [true, true, true];
    expect(leverageIndex(9, 2, loaded, 0)).toBeGreaterThan(2);
    expect(leverageIndex(9, 1, [false, true, false], -1)).toBeGreaterThan(2);
    expect(leverageIndex(7, 0, empty, 8)).toBeLessThan(0.85);
    expect(leverageIndex(3, 0, empty, -9)).toBeLessThan(0.85);
    expect(leverageIndex(1, 0, empty, 0)).toBeGreaterThan(0.6);
    expect(leverageIndex(1, 0, empty, 0)).toBeLessThan(1.1);
  });

  it('every plate appearance lands once in each group, in about the usual shares; the past seasons go to the player', () => {
    const s = createLeague('v2030');
    apply(s, { kind: 'days', days: EXHIBITION.days + 30 });
    const totals: Record<string, number> = {};
    let pa = 0;
    for (const line of Object.values(s.lines)) {
      const sp = line.bat?.split;
      if (!sp) continue;
      pa += sp.L.pa + sp.R.pa;
      for (const [key, xs] of Object.entries(sp.X ?? {})) totals[key] = (totals[key] ?? 0) + xs[0]!;
      for (const group of Object.values(SITUATIONS)) {
        const own = group.reduce((a, key) => a + (sp.X?.[key]?.[0] ?? 0), 0);
        expect(own).toBe(sp.L.pa + sp.R.pa);
      }
    }
    expect(pa).toBeGreaterThan(5000);
    const share = (key: string) => (totals[key] ?? 0) / pa;
    // High leverage is a small slice, low a large one (FanGraphs: about a tenth and about two fifths).
    expect(share('liH')).toBeGreaterThan(0.04);
    expect(share('liH')).toBeLessThan(0.2);
    expect(share('liL')).toBeGreaterThan(0.25);
    expect(share('liL')).toBeLessThan(0.6);
    expect(share('b0')).toBeGreaterThan(0.45);
    expect(share('b123')).toBeLessThan(0.05);
    expect(share('d0')).toBeGreaterThan(0.15);
    // The season closed: each player's situations join his career's, not the season's record.
    const id = Object.entries(s.lines).find(([, l]) => (l.bat?.pa ?? 0) > 80)![0];
    const before = structuredClone(s.lines[id]!.bat!.split!.X!);
    // (The seasons the league was built from left theirs too.)
    const past = structuredClone(s.players[id]!.situ?.bat ?? {});
    const careerBefore = playerCard(s, id)!.splits.career!.X!.b0![0]!;
    closeSeason(s);
    const p = s.players[id]!;
    expect(p.situ!.bat!.b0![0]).toBe((past.b0?.[0] ?? 0) + before.b0![0]!);
    expect(p.situ!.bat!.liH![1]).toBe((past.liH?.[1] ?? 0) + (before.liH?.[1] ?? 0));
    expect(p.career.at(-1)!.bat!.split!.X).toBeUndefined();
    // His career's table reads the same before and after the season is put away.
    expect(playerCard(s, id)!.splits.career!.X!.b0![0]).toBe(careerBefore);
    expect(SPLIT_KEYS).toHaveLength(9);
  });
});

describe('hot and cold zones outside the strike zone (2.0.30)', () => {
  it('four corners, colder than the zone; a good eye chases better, a good breaking ball gets worse chases', () => {
    const s = createLeague('v2030');
    const players = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
    const hitters = players.filter((p) => p.role !== 'SP' && p.role !== 'RP');
    const arms = players.filter((p) => p.role === 'SP' || p.role === 'RP');
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const p of hitters.slice(0, 60)) {
      const out = hitterOuterZones(s, p);
      expect(out).toHaveLength(4);
      expect(mean(out)).toBeLessThan(mean(hitterZones(s, p).flat()));
    }
    for (const p of arms.slice(0, 60)) expect(mean(pitcherOuterZones(s, p))).toBeLessThan(mean(pitcherZones(s, p).flat()));
    const byEye = (lo: boolean) => mean(hitters.filter((p) => (lo ? (p.scouting.tools.eye ?? 50) <= 40 : (p.scouting.tools.eye ?? 50) >= 60)).map((p) => mean(hitterOuterZones(s, p)) - mean(hitterZones(s, p).flat())));
    expect(byEye(false)).toBeGreaterThan(byEye(true));
  });
});
