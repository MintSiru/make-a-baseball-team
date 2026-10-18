/* 2.0.10: the payroll at a glance. */
import { beforeAll, describe, expect, it } from 'vitest';
import { capPay } from '../src/league/contracts';
import { createLeague } from '../src/league/history';
import { PAYROLL_SEASONS, payrollOf, payrollSeason } from '../src/league/payroll';
import { orgIds, type LeagueState } from '../src/league/state';
import { careerView, playerCard } from '../src/league/views';

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

  it('shows a closed season once, not again from its lines kept for the winter', () => {
    const p = Object.values(s.players).find((x) => x.career.filter((c) => !c.level && c.bat && c.bat.pa > 100).length >= 2)!;
    const last = p.career.filter((c) => !c.level).at(-1)!;
    const year = s.year;
    const lines = s.lines;
    try {
      s.year = last.year;
      s.lines = { [p.id]: { teamId: last.teamId, days: last.days, bat: last.bat, pit: last.pit } as (typeof s.lines)[string] };
      const rows = careerView(s, p).filter((r) => r.year === last.year && !r.futures);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.current).toBe(false);
      const card = playerCard(s, p.id)!;
      const pa = p.career.filter((c) => !c.level).reduce((a, c) => a + (c.bat?.pa ?? 0), 0);
      expect(card.totals.bat?.pa).toBe(pa);
    } finally {
      s.year = year;
      s.lines = lines;
    }
  });
});
