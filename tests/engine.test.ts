import { describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { simulateGame } from '../src/league/engine/game';
import type { FieldPos, GameIn, GameOut, TeamBox, TeamIn } from '../src/league/engine/types';

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
