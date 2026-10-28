/* 2.0.57 (the user's report): the owner's free agent could not be offered more than the owner's limit. Now the owner
   pays up to its limit and the club the rest, from its payroll budget (or its fund, a bonus paid at once). */
import { describe, expect, it } from 'vitest';
import { checkRound, maxGuaranteed, openCommitments, ownerShare, payrollBeforeOffers, splitOffer, guaranteed, signTalk } from '../src/league/fa';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

/** The 2.0.55 save at its first free-agent round, with the best outside free agent the owner's gift. */
function market() {
  const s: LeagueState = loadSave('2.0.55');
  s.pending = null;
  for (let g = 0; g < 3000 && (s.pending as { kind?: string } | null)?.kind !== 'faRound'; g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else apply(s, { kind: 'nextSeason' });
  }
  const m = s.offseason!.fa!;
  const id = m.order.find((x) => m.talks[x]!.from !== s.user!.teamId)!;
  const t = m.talks[id]!;
  m.gift = { id, total: Math.round(guaranteed(t.price) / 1000) * 1000, years: t.price.years };
  return { s, m, id, t, next: m.year + 1 };
}

describe('the owner’s free agent over the owner’s limit (2.0.57)', () => {
  it('is an offer the club can make, its rest in the budget', { timeout: 300_000 }, () => {
    const { s, m, id, t, next } = market();
    const u = s.user!;
    const within = splitOffer(m.gift!.total - 5000, t.price.years, 0.3, 0, next);
    expect(ownerShare(m, id, within)).toBe(1);
    expect(openCommitments(s, m, { [id]: within }).budget).toBe(0);
    // 30% over: the owner pays its limit, the club the rest.
    const over = splitOffer(Math.round(m.gift!.total * 1.3), t.price.years, 0.3, 0, next);
    const share = ownerShare(m, id, over);
    expect(share).toBeCloseTo(m.gift!.total / guaranteed(over), 6);
    expect(share).toBeCloseTo(1 / 1.3, 1);
    const used = openCommitments(s, m, { [id]: over }).budget;
    expect(used).toBeGreaterThan(0);
    // Room in the budget: allowed; none: refused for the budget, not for the owner's limit.
    u.payrollBudget = payrollBeforeOffers(s, m, next) + used + 1000;
    expect(checkRound(s, m, { kind: 'faRound', offers: { [id]: over }, run: 'round' }, next)).toBeNull();
    expect(maxGuaranteed(s, m, t, over, next, {})).toBeGreaterThan(m.gift!.total);
    u.payrollBudget = payrollBeforeOffers(s, m, next);
    expect(checkRound(s, m, { kind: 'faRound', offers: { [id]: over }, run: 'round' }, next)).toMatch(/연봉 예산/);
    expect(maxGuaranteed(s, m, t, over, next, {})).toBe(m.gift!.total);
    // Signed: the owner's part comes on top of the budget, the club's part is in it.
    const budget = u.payrollBudget + used + 1000;
    u.payrollBudget = budget;
    const fund = u.fund;
    signTalk(s, m, t, u.teamId, over, 1, next);
    const ownerAnnual = Math.round((over.annual + over.bonus / over.years) * share);
    expect(u.parentGifts?.at(-1)).toMatchObject({ id, annual: ownerAnnual });
    expect(u.payrollBudget).toBe(budget + ownerAnnual);
    expect(u.fund).toBe(fund);
  });
});

describe('the winter’s advance settled on opening day (2.0.57)', () => {
  it('takes back no more than the fund has: the season opens at nothing or more', async () => {
    const { openBooks } = await import('../src/league/finance');
    const s = loadSave('2.0.55');
    const u = s.user!;
    // Opening day of next season, the advance spent in the winter down to an empty fund.
    s.year += 1;
    u.support = 500_000;
    u.supportAdvance = { season: s.year, amount: 500_000 };
    u.fund = 30_000;
    openBooks(s);
    expect(u.fund).toBeGreaterThanOrEqual(0);
    expect(u.seasonSupport!.year).toBe(s.year);
    expect(u.seasonSupport!.amount).toBeLessThanOrEqual(u.support);
    expect(u.supportAdvance).toBeUndefined();
  });
});
