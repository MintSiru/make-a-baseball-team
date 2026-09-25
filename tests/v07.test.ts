/* V0.7: positions, box scores and play-by-play, awards, records, news, timeline. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { positionGrades } from '../src/league/positions';
import type { LeagueState } from '../src/league/state';
import { boxView, lineupView, recordRoom } from '../src/league/views';

let s: LeagueState;
beforeAll(() => {
  s = createLeague('v07-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  apply(s, { kind: 'days', days: 40 });
}, 480_000);

describe('box scores and play-by-play', () => {
  it('keeps the user club games with a log that adds up to the score', () => {
    const mine = Object.values(s.boxes!).filter((b) => b.home === EXPANSION_ID || b.away === EXPANSION_ID);
    expect(mine.length).toBeGreaterThan(20);
    const withLog = mine.filter((b) => s.pbp?.[b.id]);
    expect(withLog.length).toBeGreaterThan(0);
    for (const b of withLog) {
      const log = s.pbp![b.id]!;
      const runs = log.reduce((a, e) => a + (e.k === 'pa' ? e.runs : 0), 0);
      // Runs on steals or wild pitches before the last out of an inning can escape the per-PA count.
      expect(runs).toBeLessThanOrEqual(b.rhe[0][0] + b.rhe[1][0]);
      expect(runs).toBeGreaterThanOrEqual(b.rhe[0][0] + b.rhe[1][0] - 3);
      const last = [...log].reverse().find((e) => e.k === 'pa');
      if (last?.k === 'pa') expect(last.score[0] + last.score[1]).toBeLessThanOrEqual(b.rhe[0][0] + b.rhe[1][0]);
    }
    const v = boxView(s, withLog[0]!.id)!;
    expect(v.away.bat.length).toBe(9);
    expect(v.plays!.length).toBeGreaterThan(50);
  });
  it('prunes other clubs to the last few days', () => {
    const dates = new Set(Object.values(s.boxes!).filter((b) => b.home !== EXPANSION_ID && b.away !== EXPANSION_ID && !/-(wildcard|semipo|po|ks)-/.test(b.id)).map((b) => b.date));
    expect(dates.size).toBeLessThanOrEqual(3);
  });
});

describe('positions and lineup', () => {
  it('records games at each position and grades every hitter', () => {
    const regular = Object.values(s.players).find((p) => p.teamId === EXPANSION_ID && (s.lines[p.id]?.bat?.posG?.[p.position ?? 'DH'] ?? 0) > 10)!;
    expect(regular).toBeTruthy();
    const grades = positionGrades(s, regular);
    expect(grades[0]!.main).toBe(true);
    expect(grades[0]!.games).toBeGreaterThan(10);
  });
  it('builds a nine-man lineup with grades', () => {
    const v = lineupView(s, EXPANSION_ID, 'L')!;
    expect(v.lineup).toHaveLength(9);
    expect(v.lineup.every((b) => b.grade >= 20)).toBe(true);
    expect(v.starters.length).toBe(5);
  });
});

describe('awards, records and news', () => {
  it('names an MVP, a rookie, golden gloves and titles every season', () => {
    const h = s.history.find((x) => x.year === 2026)!;
    expect(h.awards?.mvp).toBeTruthy();
    expect(h.awards!.goldenGloves.length).toBeGreaterThanOrEqual(9);
    expect(h.awards!.titles.find((t) => t.label === '홈런')).toBeTruthy();
    expect(s.players[h.awards!.mvp!]!.honors?.some((x) => x.includes('MVP'))).toBe(true);
  });
  it('keeps a record room', () => {
    const r = recordRoom(s);
    expect(r.season.find((x) => x.label === '홈런')!.rows).toHaveLength(5);
    expect(r.career.find((x) => x.label === '안타')!.rows.length).toBe(10);
  });
  it('writes news, a timeline and achievements for the club', () => {
    expect(s.news?.some((n) => n.kind === 'award')).toBe(true);
    expect(s.user!.timeline?.some((t) => t.key === 'founded')).toBe(true);
    expect(s.user!.achievements?.some((a) => a.id === 'founded')).toBe(true);
    apply(s, { kind: 'interview', id: s.rosters[EXPANSION_ID]!.active[0]! });
    expect(s.news!.at(-1)!.kind).toBe('interview');
  });
});
