/* 1.8.2: the 1.8 feedback — after seasons of surplus the owner takes part of a large fund back. */
import { describe, expect, it } from 'vitest';
import { ownerSweep, seasonSurplus, SWEEP, sweepProblem } from '../src/league/sweep';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

/** Our club's books from `from` on: one entry a season of `amount` (만 원), and a fund of `fund`. */
function books(s: LeagueState, from: number, to: number, amount: number, fund: number) {
  const u = s.user!;
  u.ledger = [];
  u.firstTeamYear = from;
  for (let y = from; y <= to; y++) u.ledger.push({ year: y, label: `${y} 결산`, amount, settlement: true });
  u.fund = fund;
  delete u.sweeps;
}

describe('the owner takes the surplus', () => {
  it('only after three seasons of surplus and over the threshold', () => {
    const s = loadSave();
    const type = s.user!.settings.parentType;
    books(s, 2027, 2029, 50_000, SWEEP.threshold[type] + 10_000);
    expect(seasonSurplus(s, 2029)).toBe(50_000);
    expect(sweepProblem(s, 2029)).toBeNull();
    // Two seasons are not enough.
    expect(sweepProblem(s, 2028)).not.toBeNull();
    // A season in deficit breaks the run.
    s.user!.ledger.push({ year: 2028, label: 'FA', amount: -60_000 });
    expect(sweepProblem(s, 2029)).not.toBeNull();
    // Too little in the fund.
    books(s, 2027, 2029, 50_000, SWEEP.threshold[type] - 10_000);
    expect(sweepProblem(s, 2029)).not.toBeNull();
  });

  it('takes a share of what is above the level it lets the club keep, with an alert, and not again for three seasons', () => {
    const s = loadSave();
    const u = s.user!;
    const type = u.settings.parentType;
    // A fund far over the threshold makes it near certain; find a winter the dice allow.
    let year = 2029;
    let taken = 0;
    for (; year < 2060 && !taken; year++) {
      books(s, year - 2, year, 80_000, SWEEP.threshold[type] + 5_000_000);
      taken = ownerSweep(s, year);
    }
    year--;
    const before = SWEEP.threshold[type] + 5_000_000;
    expect(taken).toBe(Math.round(((before - SWEEP.keep[type]) * SWEEP.share[type]) / 10_000) * 10_000);
    expect(u.fund).toBe(before - taken);
    expect(u.ledger.at(-1)!).toMatchObject({ year, amount: -taken, sweep: true });
    expect(s.alerts?.some((a) => a.id === `sweep-${year}`)).toBe(true);
    // The sweep itself is not counted as a deficit, and the next one waits for three new seasons of surplus.
    expect(seasonSurplus(s, year)).toBe(80_000);
    u.ledger.push({ year: year + 1, label: 'x', amount: 80_000 }, { year: year + 2, label: 'x', amount: 80_000 });
    u.fund = before;
    expect(sweepProblem(s, year + 2)).not.toBeNull();
    u.ledger.push({ year: year + 3, label: 'x', amount: 80_000 });
    expect(sweepProblem(s, year + 3)).toBeNull();
  });
});
