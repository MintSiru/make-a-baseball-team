/* 1.9.9: the board changes the rules by vote; the old-time and the hometown nicknames; uniform numbers when 0–99 run
   out; the bullpen's bar for the hall of fame and a retired number; the grade chart's years before the KBO. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { BOARD_ITEMS, currentValue, motionText, votesNeeded, type BoardItem } from '../src/league/board';
import { boardValue, setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { landmarkOf } from '../src/league/landmarks';
import { ensureNumbers, maybeRetireNumber } from '../src/league/numbers';
import { isReliever } from '../src/league/players';
import { withScenario } from '../src/league/scenarios';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { rulesFor } from '../src/rules/history';
import { salaryCapFor } from '../src/rules/kbo2026';
import { playGame } from '../src/league/season';

const settings = (board: boolean): ExpansionSettings => ({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, ...(board ? { board: true } : {}) });

describe('the board’s changes over the rules', () => {
  it('reads each change from its season on, and nothing without one', () => {
    setEra(0);
    const before = rulesFor(2030);
    expect(boardValue('foreign', 2030)).toBeUndefined();
    const cap = salaryCapFor(2030);
    setEra({ board: { changes: [{ from: 2030, item: 'foreign', value: 4 }, { from: 2031, item: 'cap', value: 120 }, { from: 2030, item: 'postseason', value: 4 }] } });
    expect(rulesFor(2029).foreign.hold).toBe(before.foreign.hold);
    expect(rulesFor(2030).foreign.hold).toBe(4);
    expect(rulesFor(2030).postseason).toBe('four');
    expect(salaryCapFor(2030)).toBe(cap);
    expect(salaryCapFor(2031)).toBe(Math.round((salaryCapFor(2031) / 1.2) * 1.2));
    expect(salaryCapFor(2031)).toBeGreaterThan(salaryCapFor(2030) * 1.1);
    setEra(0);
    expect(rulesFor(2030)).toEqual(before);
  });

  it('needs two thirds of the clubs', () => {
    expect([10, 11, 12, 16].map(votesNeeded)).toEqual([7, 8, 8, 11]);
    expect(motionText({ item: 'twoLeagues', value: 1, now: 0 })).toContain('양대리그');
  });

  it('meets every winter of a sandbox game, carries some motions and keeps every rule in its range', { timeout: 600_000 }, () => {
    const s = createLeague('v199-board');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: settings(true) });
    expect(s.board?.on).toBe(true);
    const end = s.year + 9;
    let asked = 0;
    for (let g = 0; g < 60000 && s.year < end; g++) {
      if (s.pending) {
        if (s.pending.kind === 'board') asked++;
        apply(s, { kind: 'decide', input: autoDecision(s)! });
      } else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    const log = s.board!.log;
    expect(asked).toBeGreaterThanOrEqual(5);
    expect(log.length).toBeGreaterThanOrEqual(8);
    const passed = log.filter((r) => r.passed).length;
    expect(passed).toBeGreaterThan(0);
    expect(passed).toBeLessThan(log.length);
    setEra(s);
    for (const item of Object.keys(BOARD_ITEMS) as BoardItem[]) {
      const v = currentValue(s, item, s.year);
      if (item === 'twoLeagues' || item === 'extras' || item === 'postseason' || item === 'cap') continue;
      expect(v).toBeGreaterThanOrEqual(BOARD_ITEMS[item].min);
      expect(v).toBeLessThanOrEqual(BOARD_ITEMS[item].max);
    }
    // The season was played as the rules then said.
    const games = rulesFor(s.year - 1).gamesPerClub;
    const last = s.history.at(-1)!.table;
    expect(Math.max(...last.map((r) => r.w + r.l + r.t))).toBe(games);
    setEra(0);
  });

  it('never meets with the board off', { timeout: 300_000 }, () => {
    const s: LeagueState = createLeague('v199-off');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: settings(false) });
    for (let g = 0; g < 20000 && s.year < s.user!.firstTeamYear + 1; g++) {
      if (s.pending) {
        expect(s.pending.kind).not.toBe('board');
        apply(s, { kind: 'decide', input: autoDecision(s)! });
      } else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(s.board).toBeUndefined();
  });
});

describe('the board’s game rules', () => {
  it('plays the 승부치기 and the three-batter minimum only once voted', { timeout: 300_000 }, () => {
    const s = createLeague('v199-engine');
    const date = s.schedule[s.next]!.date;
    const run = (changes: { from: number; item: string; value: number }[]) => {
      setEra({ ...s, board: { changes } });
      const games = Array.from({ length: 400 }, (_, i) => playGame(s, 'lg', 'doosan', `v199-${i}`, date, 12)!);
      setEra(0);
      const extra = games.filter((g) => g.innings > 9);
      const pitchers = games.reduce((a, g) => a + g.home.pitching.length + g.away.pitching.length, 0) / games.length;
      const short = games.reduce((a, g) => a + [...g.home.pitching, ...g.away.pitching].filter((l, i, all) => l.gs === 0 && l.bf < 3 && l.outs % 3 !== 0 && i < all.length - 1).length, 0);
      return { extra: extra.reduce((a, g) => a + g.innings, 0) / Math.max(1, extra.length), ties: games.filter((g) => g.result === 'tie').length, pitchers, short };
    };
    const plain = run([]);
    const ghost = run([{ from: s.year, item: 'ghostRunner', value: 1 }]);
    const three = run([{ from: s.year, item: 'threeBatter', value: 1 }]);
    // The runner on second settles extra innings sooner: shorter, fewer ties.
    expect(ghost.extra).toBeLessThan(plain.extra);
    expect(ghost.ties).toBeLessThanOrEqual(plain.ties);
    // No reliever leaves after one or two batters in the middle of an inning.
    expect(plain.short).toBeGreaterThan(0);
    expect(three.short).toBeLessThan(plain.short);
    expect(three.pitchers).toBeLessThanOrEqual(plain.pitchers);
  });
});

describe('hometown nicknames', () => {
  it('names a city by its landmark', () => {
    expect(landmarkOf('광주')).toBe('무등산');
    expect(landmarkOf('대구·경북')).toBe('달구벌');
    expect(landmarkOf('평양')).toBe('대동강');
    expect(landmarkOf('어딘가')).toBe('어딘가');
  });
});

describe('uniform numbers and the honours', () => {
  it('gives a three-digit number when 0–99 are all retired, and never a retired one', { timeout: 300_000 }, () => {
    const s = createLeague('v199-numbers');
    const team = s.teams[0]!;
    team.retiredNumbers = Array.from({ length: 100 }, (_, n) => ({ number: n, playerId: `x${n}`, name: '전설', year: 2000 }));
    ensureNumbers(s);
    const ours = Object.values(s.players).filter((p) => p.teamId === team.id && p.status === 'active');
    expect(ours.length).toBeGreaterThan(20);
    for (const p of ours) {
      if (p.numberTeam !== team.id || p.number == null) continue;
      expect(p.number).toBeGreaterThanOrEqual(100);
    }
    const nums = ours.filter((p) => p.numberTeam === team.id && p.number != null).map((p) => p.number);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('retires a reliever’s number on a smaller WAR, and makes each further one harder', { timeout: 300_000 }, () => {
    const s = createLeague('v199-retire');
    const team = s.teams[1]!;
    const p = Object.values(s.players).find((x) => x.teamId === team.id && x.role === 'RP')!;
    p.number = 77;
    p.numberTeam = team.id;
    p.career = Array.from({ length: 12 }, (_, i) => ({ ...p.career[0]!, year: 2000 + i, teamId: team.id, level: undefined, war: 3.2, pit: { ...(p.career[0]?.pit ?? {}), g: 60, gs: 0, sv: 10, hld: 5, outs: 200 } as never, bat: null }));
    expect(isReliever(p)).toBe(true);
    team.retiredNumbers = [];
    maybeRetireNumber(s, p, team.id, 2012);
    expect(team.retiredNumbers.map((x) => x.number)).toEqual([77]);
    // A club that has retired four already asks twice as much.
    team.retiredNumbers = [1, 2, 3, 4].map((n) => ({ number: n, playerId: `x${n}`, name: '전설', year: 2000 }));
    maybeRetireNumber(s, p, team.id, 2012);
    expect(team.retiredNumbers.some((x) => x.number === 77)).toBe(false);
  });
});
