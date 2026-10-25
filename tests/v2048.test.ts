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

describe('a move to a development contract in the winter (2.0.48)', () => {
  it('any time in the offseason, under the roster limit too, within the rules', async () => {
    const { apply } = await import('../src/league/actions');
    const { canMakeDevelopment } = await import('../src/league/trade');
    const { ageIn, isForeign } = await import('../src/league/players');
    const { developmentIds, registeredIds } = await import('../src/league/state');
    const { OFFSEASON } = await import('../src/league/tuning');
    const s = loadSave('2.0.46');
    const team = s.user!.teamId;
    const next = s.year + 1;
    const young = registeredIds(s, team)
      .map((id) => s.players[id]!)
      .find((p) => !isForeign(p) && p.status === 'active' && ageIn(p, next) <= OFFSEASON.development.maxAge && (p.contract?.kind === 'rookie' || p.contract?.kind === 'standard'))!;
    // In the season: not yet.
    expect(canMakeDevelopment(s, young.id)).toContain('오프시즌');
    // The winter (well under the limit of 68).
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0 } as never;
    s.pending = null;
    expect(registeredIds(s, team).length).toBeLessThan(68);
    expect(canMakeDevelopment(s, young.id)).toBeNull();
    const before = developmentIds(s, team).length;
    apply(s, { kind: 'toDevelopment', id: young.id });
    expect(s.players[young.id]!.contract?.kind).toBe('development');
    expect(s.players[young.id]!.contract?.salaries[0]!.season).toBe(next);
    expect(developmentIds(s, team).length).toBe(before + 1);
    expect(registeredIds(s, team)).not.toContain(young.id);
    expect(canMakeDevelopment(s, young.id)).toContain('이미');
    // Not a player too old, a foreign player, or one with guaranteed years.
    const old = registeredIds(s, team).map((id) => s.players[id]!).find((p) => !isForeign(p) && ageIn(p, next) > OFFSEASON.development.maxAge && (p.contract?.kind === 'rookie' || p.contract?.kind === 'standard'));
    if (old) expect(canMakeDevelopment(s, old.id)).toContain('세까지');
    const foreign = registeredIds(s, team).map((id) => s.players[id]!).find(isForeign)!;
    expect(canMakeDevelopment(s, foreign.id)).toContain('국내');
    const other = registeredIds(s, team).map((id) => s.players[id]!).find((p) => !isForeign(p) && p.id !== young.id && ageIn(p, next) <= OFFSEASON.development.maxAge)!;
    other.contract = { ...other.contract!, kind: 'fa' } as never;
    expect(canMakeDevelopment(s, other.id)).toContain('FA');
  });
});
