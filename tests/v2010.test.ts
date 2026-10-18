/* 2.0.10: the payroll at a glance. */
import { beforeAll, describe, expect, it } from 'vitest';
import { capPay } from '../src/league/contracts';
import { createLeague } from '../src/league/history';
import { PAYROLL_SEASONS, payrollOf, payrollSeason } from '../src/league/payroll';
import { orgIds, type LeagueState } from '../src/league/state';

describe('the payroll', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2010-payroll');
  }, 300_000);

  it('lists the whole club with five seasons of pay that add up to the totals', () => {
    const team = s.teams[0]!.id;
    const book = payrollOf(s, team);
    expect(book.seasons).toHaveLength(PAYROLL_SEASONS);
    expect(book.seasons[0]).toBe(payrollSeason(s));
    for (const id of orgIds(s, team)) expect(book.rows.some((r) => r.id === id)).toBe(true);
    book.seasons.forEach((y, i) => {
      expect(book.totals[i]).toBe(book.rows.reduce((a, r) => a + capPay(s.players[r.id]!, y), 0));
    });
    expect(book.totals[0]).toBeGreaterThan(0);
    // A contract's last season, service time and free agency for each domestic player.
    for (const r of book.rows) {
      if (r.until !== null) expect(r.until).toBeGreaterThanOrEqual(Math.min(...s.players[r.id]!.contract!.salaries.map((x) => x.season)));
      if (!r.foreign) expect(r.service.seasons).toBe(s.players[r.id]!.service.creditedSeasons);
    }
    expect(book.rows.some((r) => r.fa.year !== null)).toBe(true);
  });

  it('measures this season against the cap', () => {
    const book = payrollOf(s, s.teams[0]!.id);
    if (book.seasons[0]! >= 2023) {
      expect(book.cap).not.toBeNull();
      expect(book.cap!.cap).toBeGreaterThan(0);
      expect(book.cap!.total).toBeLessThanOrEqual(book.totals[0]! + 1);
    }
  });
});
