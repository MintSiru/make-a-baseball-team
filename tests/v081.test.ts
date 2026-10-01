/* V0.8.1: the free-agent market made easier. Typed amounts, offers scaled to win, the most the budget allows,
   automatic raises up to a ceiling, and bonuses paid at once from the fund. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { capPay } from '../src/league/contracts';
import { autoDecision, checkDecision, EXPANSION_ID } from '../src/league/expansion';
import { budgetUse, guaranteed, maxGuaranteed, meetTerms, playRound, scaleOffer, userOffers, utility, winTerms, type FaMarket, type FaOffer } from '../src/league/fa';
import { createLeague } from '../src/league/history';
import { projectedPayroll } from '../src/league/market';
import type { LeagueState } from '../src/league/state';
import { parseEok } from '../src/ui/format';

let s: LeagueState;
const pending = () => s.pending as LeagueState['pending'];

beforeAll(() => {
  s = createLeague('v081-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  while (pending()) apply(s, { kind: 'decide', input: autoDecision(s)! });
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  while (pending() && pending()!.kind !== 'faRound') apply(s, { kind: 'decide', input: autoDecision(s)! });
}, 480_000);

const clone = () => {
  const c = structuredClone(s);
  return { c, m: c.offseason!.fa! };
};
const next = (c: LeagueState) => c.offseason!.year + 1;
const outside = (m: FaMarket) => m.order.map((id) => m.talks[id]!).find((t) => t.from !== EXPANSION_ID && !t.signed && !t.gone)!;

describe('typing amounts', () => {
  it('reads what a phone keyboard types, and waits while it is not a number yet', () => {
    expect(parseEok('12')).toBe(12);
    expect(parseEok('12.5')).toBe(12.5);
    expect(parseEok('1,200')).toBe(1200);
    expect(parseEok(' 30억 ')).toBe(30);
    expect(parseEok('12.')).toBe(12);
    expect(parseEok('')).toBeNull();
    expect(parseEok('.')).toBeNull();
    expect(parseEok('abc')).toBeNull();
  });
});

describe('offers that win', () => {
  it('scales an offer keeping its shape', () => {
    const o: FaOffer = { years: 4, bonus: 200000, annual: 50000, options: 40000, promises: ['starter'], ceiling: 600000, prepaid: true };
    const b = scaleOffer(o, guaranteed(o) * 1.1, 2028);
    expect(guaranteed(b)).toBeCloseTo(guaranteed(o) * 1.1, -4);
    expect(b.bonus / guaranteed(b)).toBeCloseTo(o.bonus / guaranteed(o), 2);
    expect(b).toMatchObject({ years: 4, promises: ['starter'], ceiling: 600000, prepaid: true });
  });

  it('“sign now” beats every rival and goes past what he takes at once', () => {
    const { c, m } = clone();
    const t = outside(m);
    t.offers = { kia: { ...meetTerms(c, m, t, next(c), 1.05), day: 0 } };
    const o = winTerms(c, m, t, next(c));
    expect(utility(c, t, EXPANSION_ID, o, next(c))).toBeGreaterThan(utility(c, t, 'kia', t.offers.kia!, next(c)));
    expect(utility(c, t, EXPANSION_ID, o, next(c))).toBeGreaterThan(t.floor * 1.12);
  });

  it('knows the most the payroll budget allows, and the fund for a bonus paid at once', () => {
    const { c, m } = clone();
    const t = outside(m);
    const o = meetTerms(c, m, t, next(c));
    const most = maxGuaranteed(c, m, t, o, next(c), userOffers(c, m));
    expect(checkDecision(c, { kind: 'faRound', offers: { [t.id]: scaleOffer(o, most * 0.98, next(c)) }, run: 'round' })).toBeNull();
    expect(checkDecision(c, { kind: 'faRound', offers: { [t.id]: scaleOffer(o, most * 1.1, next(c)) }, run: 'round' })).toMatch(/연봉 예산/);
    // Paid at once, the bonus leaves the budget but has to fit in the fund.
    const pre = { ...o, prepaid: true };
    expect(budgetUse(pre)).toBeLessThan(budgetUse(o));
    c.user!.fund = o.bonus - 10000;
    expect(checkDecision(c, { kind: 'faRound', offers: { [t.id]: pre }, run: 'round' })).toMatch(/구단 자금/);
    expect(checkDecision(c, { kind: 'faRound', offers: { [t.id]: { ...o, ceiling: guaranteed(o) - 10000 } }, run: 'round' })).toMatch(/상한/);
  });
});

describe('automatic raises up to a ceiling', () => {
  it('beats the best rival in the same round, as far as the ceiling goes', () => {
    const { c, m } = clone();
    const t = outside(m);
    t.interest = {};
    const rival = { ...meetTerms(c, m, t, next(c), 1.04), day: 0 };
    t.offers = { kia: rival };
    const low = meetTerms(c, m, t, next(c), 0.95);
    t.offers[EXPANSION_ID] = { ...low, ceiling: Math.round(guaranteed(low) * 1.5), day: 0 };
    playRound(c, m, next(c));
    const mine = t.offers[EXPANSION_ID] ?? t.signed?.offer;
    expect(guaranteed(mine!)).toBeGreaterThan(guaranteed(low));
    if (!t.signed) expect(utility(c, t, EXPANSION_ID, t.offers[EXPANSION_ID]!, next(c))).toBeGreaterThan(utility(c, t, 'kia', t.offers.kia!, next(c)));
    expect(t.notes.some((n) => /올렸습니다/.test(n.text))).toBe(true);
  });

  it('stops at the ceiling and says so', () => {
    const { c, m } = clone();
    const t = outside(m);
    t.interest = {};
    t.offers = { kia: { ...meetTerms(c, m, t, next(c), 1.3), day: 0 } };
    const low = meetTerms(c, m, t, next(c), 0.9);
    t.offers[EXPANSION_ID] = { ...low, ceiling: guaranteed(low) + 1000, day: 0 };
    playRound(c, m, next(c));
    expect(t.notes.some((n) => /상한.*닿/.test(n.text))).toBe(true);
    if (t.offers[EXPANSION_ID]) expect(guaranteed(t.offers[EXPANSION_ID]!)).toBeLessThanOrEqual(guaranteed(low) + 1000);
  });

  it('the scouts keep our own free agents with room to raise', () => {
    const a = autoDecision(s)!;
    expect(a.kind).toBe('faRound');
    const offers = (a as { offers: Record<string, FaOffer | null> }).offers;
    for (const o of Object.values(offers)) if (o && s.offseason!.fa!.gift?.id === undefined) expect(o.ceiling ?? guaranteed(o)).toBeGreaterThanOrEqual(guaranteed(o));
  });
});

describe('a bonus paid at once', () => {
  it('comes out of the fund at signing and stays out of the payroll budget, not the salary cap', () => {
    const { c, m } = clone();
    const t = outside(m);
    t.interest = {};
    t.offers = {};
    c.user!.fund = 5_000_000;
    c.user!.payrollBudget = 5_000_000;
    const o = { ...winTerms(c, m, t, next(c)), prepaid: true };
    const fund = c.user!.fund;
    apply(c, { kind: 'decide', input: { kind: 'faRound', offers: { [t.id]: o }, run: 'round' } });
    const p = c.players[t.id]!;
    expect(p.teamId).toBe(EXPANSION_ID);
    expect(p.contract!.fa!.prepaid).toBe(true);
    expect(c.user!.fund).toBe(fund - p.contract!.signingBonus);
    expect(c.user!.ledger.at(-1)!.label).toMatch(/일시불/);
    const n = next(c);
    const without = projectedPayroll(c, EXPANSION_ID, n) - p.contract!.salaries[0]!.amount;
    p.contract!.fa!.prepaid = false;
    expect(projectedPayroll(c, EXPANSION_ID, n) - p.contract!.salaries[0]!.amount).toBeGreaterThan(without);
    p.contract!.fa!.prepaid = true;
    expect(capPay(p, n)).toBeGreaterThan(p.contract!.salaries[0]!.amount);
  });
});
