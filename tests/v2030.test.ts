/* 2.0.30: a draft prospect pitcher's pitches; the spring games (시범경기) before opening day. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply, nextDate } from '../src/league/actions';
import { draftClass } from '../src/league/players';
import { prospectPitches, exhibitionView, exhibitionGames } from '../src/league/views';
import { EXHIBITION } from '../src/league/exhibition';
import { firstTeamIds } from '../src/league/state';

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
