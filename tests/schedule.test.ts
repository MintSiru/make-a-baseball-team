import { describe, expect, it } from 'vitest';
import { makeSchedule, openingDay, roundRobin, seriesPlan } from '../src/league/schedule';
import { standings } from '../src/league/standings';

const TEAMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

describe('schedule', () => {
  const games = makeSchedule(TEAMS, 2026, 'sched');

  it('gives every club 144 games, 16 against each opponent split 8 home and 8 away', () => {
    expect(games).toHaveLength(720);
    for (const t of TEAMS) {
      expect(games.filter((g) => g.home === t || g.away === t)).toHaveLength(144);
      for (const o of TEAMS.filter((x) => x !== t)) {
        expect(games.filter((g) => g.home === t && g.away === o)).toHaveLength(8);
        expect(games.filter((g) => g.home === o && g.away === t)).toHaveLength(8);
      }
    }
  });

  it('never has a club play twice in a day or on a Monday', () => {
    const byDate = new Map<string, string[]>();
    for (const g of games) byDate.set(g.date, [...(byDate.get(g.date) ?? []), g.home, g.away]);
    for (const [date, clubs] of byDate) {
      expect(new Set(clubs).size).toBe(clubs.length);
      expect(new Date(date + 'T00:00:00Z').getUTCDay()).not.toBe(1);
    }
    expect(games[0]!.date).toBe('2026-03-28');
    expect(games.at(-1)!.date < '2026-10-01').toBe(true);
  });

  it('opens on the last Saturday of March', () => {
    expect(openingDay(2026).toISOString().slice(0, 10)).toBe('2026-03-28');
    expect(openingDay(2027).getUTCDay()).toBe(6);
  });

  it('splits pair games into two- and three-game series', () => {
    expect(seriesPlan(16).reduce((a, b) => a + b, 0)).toBe(16);
    expect(seriesPlan(15).reduce((a, b) => a + b, 0)).toBe(15);
    expect(seriesPlan(14).reduce((a, b) => a + b, 0)).toBe(14);
  });

  it('builds round robins for odd club counts with one bye per round', () => {
    const rounds = roundRobin(11);
    expect(rounds).toHaveLength(11);
    for (const round of rounds) expect(round).toHaveLength(5);
    const pairs = new Set(rounds.flat().map(([a, b]) => [a, b].sort().join('-')));
    expect(pairs.size).toBe(55);
  });
});

describe('standings', () => {
  it('leaves ties out of winning percentage and breaks ties head to head', () => {
    const table = standings(
      ['a', 'b'],
      [
        { id: '1', date: 'x', home: 'a', away: 'b', hs: 3, as: 1 },
        { id: '2', date: 'x', home: 'b', away: 'a', hs: 2, as: 2 },
        { id: '3', date: 'x', home: 'b', away: 'a', hs: 5, as: 0 },
      ],
    );
    const a = table.find((r) => r.teamId === 'a')!;
    expect(a).toMatchObject({ w: 1, l: 1, t: 1, pct: 0.5 });
    expect(table[0]!.gb).toBe(0);
    // Equal records and split head to head: b's run differential (+3) ranks it first.
    expect(table[0]!.teamId).toBe('b');
  });
});
