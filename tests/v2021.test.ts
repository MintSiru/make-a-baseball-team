/* 2.0.21: the salary cap leaves foreign players out (as the KBO does), and the FA market's cap line reads the same
   top-40 total as the season's settlement. */
import { beforeAll, describe, expect, it } from 'vitest';
import { capTotal } from '../src/league/cap';
import { capPay } from '../src/league/contracts';
import { capRoomFor } from '../src/league/fa';
import { createLeague } from '../src/league/history';
import { isForeign } from '../src/league/players';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { salaryCapFor } from '../src/rules/kbo2026';

describe('the salary cap total', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2021-cap');
  }, 300_000);

  it('counts the top forty domestic players, foreign players out', () => {
    const id = s.teams[0]!.id;
    const y = s.year;
    const soldiers = Object.values(s.players).filter((p) => p.teamId === id && p.status === 'military');
    const domestic = [...orgPlayers(s, id), ...soldiers]
      .filter((p) => !isForeign(p))
      .map((p) => capPay(p, y))
      .sort((a, b) => b - a)
      .slice(0, 40)
      .reduce((a, b) => a + b, 0);
    expect(capTotal(s, id, y)).toBe(domestic);
    const foreign = orgPlayers(s, id).filter(isForeign);
    expect(foreign.length).toBeGreaterThan(0);
    // Raising a foreign player's pay leaves the total alone.
    const f = foreign[0]!;
    const keep = f.contract!.salaries.map((x) => ({ ...x }));
    for (const x of f.contract!.salaries) x.amount *= 10;
    expect(capTotal(s, id, y)).toBe(domestic);
    f.contract!.salaries = keep;
  });

  it('gives the FA market the same total (the market’s players left out, the rest at the pay they can expect)', () => {
    const id = s.teams[1]!.id;
    const next = s.year + 1;
    const room = capRoomFor(s, id, next);
    expect(room).toBe(salaryCapFor(next) - capTotal(s, id, next, { estimate: true }));
    // Never more than forty players count.
    expect(capTotal(s, id, next, { estimate: true })).toBeLessThanOrEqual(
      orgPlayers(s, id)
        .filter((p) => !isForeign(p))
        .length * 1e9,
    );
    const one = orgPlayers(s, id).find((p) => !isForeign(p) && capPay(p, next) > 0)!;
    expect(capTotal(s, id, next, { estimate: true, without: new Set([one.id]) })).toBeLessThan(capTotal(s, id, next, { estimate: true }));
  });
});
