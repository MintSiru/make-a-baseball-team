/* 2.0.48 (user report): a foreign player replaced in 2030 still listed with his remaining salary in 2036. The money
   was paid in 2030's books only; the release screen listed every season's entry. */
import { describe, expect, it } from 'vitest';
import { capTotal } from '../src/league/cap';
import { deadMoney, deadMoneyAhead, projectedPayroll } from '../src/league/market';
import { loadSave } from './helpers';

describe('released players’ money (2.0.48)', () => {
  it('a past season’s entry is neither shown, paid, counted in the payroll nor in the cap', () => {
    const s = loadSave('2.0.46');
    const u = s.user!;
    const team = u.teamId;
    const payroll = projectedPayroll(s, team, s.year);
    const cap = capTotal(s, team, s.year);
    u.deadMoney = [
      { season: s.year - 6, amount: 120_000, label: '옛 외국인 교체 잔여 연봉', id: 'old' },
      { season: s.year, amount: 30_000, label: '올해 방출 잔여 연봉', id: 'now' },
      { season: s.year + 1, amount: 50_000, label: '내년 방출 잔여 연봉', id: 'next' },
    ];
    // The screen: this season's and later only.
    expect(deadMoneyAhead(s).map((x) => x.id)).toEqual(['now', 'next']);
    // The books and the payroll take a season's own entries; the past one costs nothing now.
    expect(deadMoney(s, s.year)).toBe(30_000);
    expect(projectedPayroll(s, team, s.year)).toBe(payroll + 30_000);
    // The salary cap counts the players under contract only, released players' money not at all.
    expect(capTotal(s, team, s.year)).toBe(cap);
    // In the winter the coming season's is what is still to pay.
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0 } as never;
    expect(deadMoneyAhead(s).map((x) => x.id)).toEqual(['next']);
  });
});
