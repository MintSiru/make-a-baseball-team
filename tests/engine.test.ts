import { describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { simulateGame } from '../src/league/engine/game';
import type { FieldPos, GameIn, GameOut, PlayEvent, TeamBox, TeamIn } from '../src/league/engine/types';

const POS: FieldPos[] = ['CF', 'SS', '2B', '1B', '3B', 'LF', 'RF', 'DH', 'C'];
const team = (id: string, g: number): TeamIn => ({
  teamId: id,
  lineup: POS.map((pos, i) => ({ id: `${id}-b${i}`, bats: i % 3 === 0 ? 'L' : 'R', contact: g, power: g, eye: g, speed: g, defense: g, pos })),
  starter: { id: `${id}-sp`, throws: 'R', stuff: g, command: g, breaking: g, stamina: g, pitchLimit: 90 },
  bullpen: (['CL', 'SU', 'HL', 'HL', 'LO', 'MU', 'MU', 'LR'] as const).map((role, i) => ({
    id: `${id}-rp${i}`,
    throws: i % 2 ? 'L' : 'R',
    stuff: g,
    command: g,
    breaking: g,
    stamina: 40,
    pitchLimit: 30,
    role,
  })),
});
const game = (i: number, home = 55, away = 55, maxInnings: number | null = 11): GameIn => ({ gameId: `t${i}`, home: team('H', home), away: team('A', away), maxInnings, park: 1 });
const play = (i: number, home = 55, away = 55, maxInnings: number | null = 11) => simulateGame(game(i, home, away, maxInnings), rng(`engine-test-${i}`));
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

function checkBox(out: GameOut, own: TeamBox, other: TeamBox) {
  expect(sum(own.lineScore, (x) => x)).toBe(own.runs);
  expect(sum(own.batting, (b) => b.r)).toBe(own.runs);
  expect(sum(own.batting, (b) => b.h)).toBe(own.hits);
  expect(sum(other.pitching, (p) => p.r)).toBe(own.runs);
  for (const b of own.batting) expect(b.ab).toBe(b.pa - b.bb - b.hbp - b.sf - b.sh);
  for (const p of own.pitching) expect(p.er).toBeLessThanOrEqual(p.r);
  expect(own.pitching[0]!.gs).toBe(1);
  expect(sum(own.pitching, (p) => p.gs)).toBe(1);
}

describe('game engine', () => {
  it('is deterministic for a seed', () => {
    expect(play(1)).toEqual(play(1));
    expect(play(1)).not.toEqual(play(2));
  });

  it('keeps every box score consistent', () => {
    for (let i = 0; i < 300; i++) {
      const out = play(i);
      checkBox(out, out.home, out.away);
      checkBox(out, out.away, out.home);
      // The away side always bats nine innings or more; the home side skips the bottom when ahead.
      expect(out.away.lineScore.length).toBe(out.innings);
      expect(out.home.lineScore.length === out.innings || out.home.lineScore.length === out.innings - 1).toBe(true);
    }
  });

  it('gives one win and one loss to decided games, at most one save, none to ties', () => {
    let ties = 0;
    for (let i = 0; i < 400; i++) {
      const out = play(i);
      const all = [...out.home.pitching, ...out.away.pitching];
      if (out.result === 'tie') {
        ties++;
        expect(sum(all, (p) => p.w + p.l + p.sv)).toBe(0);
        expect(out.innings).toBe(11);
        continue;
      }
      const [win, lose] = out.result === 'home' ? [out.home, out.away] : [out.away, out.home];
      expect(sum(win.pitching, (p) => p.w)).toBe(1);
      expect(sum(lose.pitching, (p) => p.l)).toBe(1);
      expect(sum(lose.pitching, (p) => p.w + p.sv)).toBe(0);
      expect(sum(win.pitching, (p) => p.sv)).toBeLessThanOrEqual(1);
      expect(win.runs).toBeGreaterThan(lose.runs);
    }
    expect(ties).toBeGreaterThan(0);
  });

  it('plays postseason games until someone wins', () => {
    for (let i = 0; i < 200; i++) expect(play(i, 55, 55, null).result).not.toBe('tie');
  });

  it('lets the better team win most games', () => {
    let wins = 0;
    for (let i = 0; i < 300; i++) if (play(i, 62, 48).result === 'home') wins++;
    expect(wins / 300).toBeGreaterThan(0.75);
  });
});

describe('the bench (1.7.0)', () => {
  const withBench = (id: string): TeamIn => {
    const t = team(id, 45);
    t.bench = [
      { id: `${id}-ph`, bats: 'L', contact: 70, power: 70, eye: 70, speed: 40, defense: 40, pos: 'DH', defenseAt: { '1B': 40, LF: 35, RF: 35 } },
      { id: `${id}-pr`, bats: 'R', contact: 35, power: 30, eye: 35, speed: 80, defense: 50, pos: 'DH', defenseAt: { CF: 50, LF: 50, RF: 50 } },
      { id: `${id}-glove`, bats: 'R', contact: 35, power: 30, eye: 35, speed: 50, defense: 75, pos: 'DH', defenseAt: { SS: 75, '2B': 72, '3B': 70 } },
      { id: `${id}-c2`, bats: 'R', contact: 30, power: 30, eye: 30, speed: 30, defense: 55, pos: 'DH', defenseAt: { C: 55 } },
    ];
    for (const b of t.lineup) b.speed = 30;
    return t;
  };
  it('pinch hitters, runners and late gloves come in, bat in the slot of the man they replace and keep the box straight', () => {
    const seen = { PH: 0, PR: 0, DEF: 0 };
    for (let i = 0; i < 120; i++) {
      const out = simulateGame({ gameId: `b${i}`, home: withBench('H'), away: withBench('A'), maxInnings: 12, park: 1 }, rng(`bench-${i}`));
      for (const [own, other] of [[out.home, out.away], [out.away, out.home]] as const) {
        checkBox(out, own, other);
        const ids = own.batting.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const b of own.batting) if (b.sub) seen[b.sub]++;
        // 1.7.1: a late glove only ever replaces the starter (the first substitute in his slot).
        own.batting.forEach((b, i) => {
          if (b.sub === 'DEF') expect(own.batting[i - 1]!.sub).toBeUndefined();
        });
        // Nine starters, the rest came off the bench.
        expect(own.batting.filter((b) => !b.sub)).toHaveLength(9);
      }
    }
    expect(seen.PH).toBeGreaterThan(20);
    expect(seen.PR).toBeGreaterThan(3);
    expect(seen.DEF).toBeGreaterThan(3);
  });
  it('logs each change for the play-by-play, without changing the game', () => {
    for (let i = 0; i < 30; i++) {
      const g = () => ({ gameId: `b${i}`, home: withBench('H'), away: withBench('A'), maxInnings: 12, park: 1 });
      const log: PlayEvent[] = [];
      const out = simulateGame(g(), rng(`bench-${i}`), log);
      expect(simulateGame(g(), rng(`bench-${i}`))).toEqual(out);
      const subs = log.filter((e): e is Extract<PlayEvent, { k: 'sub' }> => e.k === 'sub');
      const lines = [...out.home.batting, ...out.away.batting].filter((b) => b.sub);
      expect(subs.map((e) => `${e.sub}:${e.in}`).sort()).toEqual(lines.map((b) => `${b.sub}:${b.id}`).sort());
      for (const e of subs) expect(e.i).toBeGreaterThanOrEqual(7);
    }
  });
  it('without a bench the game plays as before', () => {
    const a = play(7);
    const t = game(7);
    t.home.bench = [];
    t.away.bench = [];
    expect(simulateGame(t, rng('engine-test-7'))).toEqual(a);
  });
});
