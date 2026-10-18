/* 2.0.16: the home run derby as a bracket; the national team's games to watch (dates, stages, opponents, box scores
   and play-by-play), the decisive games fitting the finish. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { NATIONAL_GAMES, nationalGamesOf } from '../src/league/nationalgames';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { ALL_STAR } from '../src/league/tuning';
import { boxView } from '../src/league/views';

function playTo(s: LeagueState, md: string) {
  for (let g = 0; g < 2000 && s.phase === 'regular' && (s.schedule[s.next]?.date ?? '9') < `${s.year}-${md}`; g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.user) apply(s, { kind: 'days', days: 1 });
    else playDay(s);
  }
}

describe('the derby bracket', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2016-derby');
    playTo(s, '07-20');
  }, 300_000);

  it('seeds eight by home runs, 1-8 4-5 2-7 3-6, and plays it down to one', () => {
    const d = s.allStar!.game!.derby;
    const b = d.bracket!;
    expect(b).toHaveLength(ALL_STAR.derby.field - 1);
    const seeds = d.rounds.map((r) => r.id);
    const first = b.filter((m) => m.round === 1).map((m) => [seeds.indexOf(m.a), seeds.indexOf(m.b)]);
    expect(first).toEqual([[0, 7], [3, 4], [1, 6], [2, 5]]);
    for (const m of b) {
      expect([m.a, m.b]).toContain(m.winner);
      if (m.ha !== m.hb) expect(m.winner).toBe(m.ha > m.hb ? m.a : m.b);
      else expect(m.swingOff).toBeDefined();
    }
    // Each round's winners meet in the next.
    for (let r = 2; r <= 3; r++) {
      const winners = b.filter((m) => m.round === r - 1).map((m) => m.winner);
      expect(b.filter((m) => m.round === r).flatMap((m) => [m.a, m.b])).toEqual(winners);
    }
    const final = b.find((m) => m.round === 3)!;
    expect(d.winner).toBe(final.winner);
    expect(d.rounds.filter((r) => r.final !== undefined).map((r) => r.id).sort()).toEqual([final.a, final.b].sort());
  });
});

describe('the national games to watch', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2016-national');
  }, 300_000);

  it('dates each game in the window and fits the decisive ones to the finish', () => {
    const done = s.international.filter((e) => e.watch);
    expect(done.length).toBeGreaterThan(0);
    for (const e of done) {
      const games = e.watch!.games;
      expect(games).toHaveLength(e.games!);
      const last = games.at(-1)!;
      const won = (g: (typeof games)[number]) => g.us > g.them;
      for (const g of games) expect(g.us).not.toBe(g.them);
      if (e.finish === 'champion') expect([won(games.at(-2)!), won(last)]).toEqual([true, true]);
      if (e.finish === 'runnerUp') expect([won(games.at(-2)!), won(last), last.stage]).toEqual([true, false, 'final']);
      if (e.finish === 'third') expect([won(last), last.stage]).toEqual([true, 'bronze']);
      if (e.finish === 'fourth') expect([won(last), last.stage]).toEqual([false, 'bronze']);
      if (e.finish === 'first' || e.finish === 'second') expect(won(last)).toBe(false);
      expect([...games.map((g) => g.date)].sort()).toEqual(games.map((g) => g.date));
    }
  });

  it('keeps box scores for the last few events and the relay for the latest, with the opponents named', () => {
    const withBoxes = s.international.filter((e) => e.watch?.boxes);
    expect(withBoxes.length).toBeLessThanOrEqual(NATIONAL_GAMES.keepBoxes);
    expect(s.international.filter((e) => e.watch?.logs).length).toBe(1);
    const latest = s.international.filter((e) => e.watch).at(-1)!;
    const rows = nationalGamesOf(s, latest.id)!;
    expect(rows.every((r) => r.box && r.pbp)).toBe(true);
    const v = boxView(s, rows[0]!.id)!;
    const names = [v.home.name, v.away.name];
    expect(names).toContain('대한민국');
    expect(names).toContain(rows[0]!.opp);
    expect(v.plays!.length).toBeGreaterThan(50);
    const them = rows[0]!.home ? v.away : v.home;
    expect(them.bat.every((b) => b.name !== '?')).toBe(true);
    // Our hitters are the squad's.
    const us = rows[0]!.home ? v.home : v.away;
    for (const b of us.bat) expect(latest.squad).toContain(b.id);
  });
});
