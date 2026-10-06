/* V0.16: the large-scale balance runs (docs/BALANCE.md) found money growing on one side only — ticket prices
   and broadcast money rose every year while salaries and costs did not, so every club grew richer each
   season. Money now stays in today's terms after the announced steps. */
import { describe, expect, it } from 'vitest';
import { capFloorFor } from '../src/league/cap';
import { leaguePrice } from '../src/league/fans';
import { broadcastPool } from '../src/league/finance';
import { salaryCapFor } from '../src/rules/kbo2026';
import { budgetFor, difficultyStars } from '../src/league/expansion';
import type { ExpansionSettings } from '../src/league/state';
import { DIFFICULTY, PARENT } from '../src/league/tuning';
import { payrollFloor } from '../src/league/userclub';

describe('money in today’s terms', () => {
  it('ticket prices rise to 2026 and then hold', () => {
    expect(leaguePrice(2026)).toBeGreaterThan(leaguePrice(2025));
    expect(leaguePrice(2027)).toBe(leaguePrice(2026));
    expect(leaguePrice(2045)).toBe(leaguePrice(2026));
  });
  it('the broadcast deal steps up in 2027 and then holds', () => {
    expect(broadcastPool(2027)).toBeGreaterThan(broadcastPool(2026));
    expect(broadcastPool(2040)).toBe(broadcastPool(2027));
  });
  it('the cap follows the announced steps to 2028, then holds; so does the floor', () => {
    expect(salaryCapFor(2028)).toBeGreaterThan(salaryCapFor(2027));
    expect(salaryCapFor(2035)).toBe(salaryCapFor(2028));
    expect(capFloorFor(2035)).toBe(capFloorFor(2027));
  });
});

describe('the owner’s money (V0.16)', () => {
  const settings: ExpansionSettings = { name: '검증', short: '검증', color: '#1f6fb2', cityId: 'ulsan', parentType: 'citizen', parentName: '검증', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null };
  it('the payroll budget never goes under the league floor × 1.2 (× the difficulty)', () => {
    expect(payrollFloor(2028)).toBe(Math.round((capFloorFor(2028)! * PARENT.payrollFloor) / 1000) * 1000);
    // Even on hard it stays over the floor itself, which a club under it pays as a levy.
    expect(payrollFloor(2028, DIFFICULTY.money.hard)).toBeGreaterThan(capFloorFor(2028)!);
    // A citizen club's own budget is under it: the floor is where it starts.
    expect(budgetFor(settings).payrollBudget).toBeLessThan(payrollFloor(2028));
  });
  it('difficulty moves the owner’s money a quarter up or 15% down', () => {
    const budget = (difficulty: ExpansionSettings['difficulty']) => budgetFor({ ...settings, parentType: 'midsize', difficulty });
    expect(budget('easy').payrollBudget / budget('normal').payrollBudget).toBeCloseTo(1.25, 2);
    expect(budget('hard').fund / budget('normal').fund).toBeCloseTo(0.85, 2);
  });
  it('the felt difficulty puts the citizen club, the hardest in the runs, above the other owners', () => {
    const stars = (parentType: ExpansionSettings['parentType']) => difficultyStars({ ...settings, parentType });
    expect(stars('citizen')).toBeGreaterThan(stars('midsize'));
    expect(stars('midsize')).toBeGreaterThan(stars('conglomerate'));
    expect(difficultyStars({ ...settings, difficulty: 'easy' })).toBeLessThan(difficultyStars(settings));
  });
  it('smaller owners cover more of a new club’s losses than before', () => {
    expect(PARENT.support.midsize).toBe(1_500_000);
    expect(PARENT.support.citizen).toBe(1_400_000);
    expect(PARENT.support.namingRights).toBe(600_000);
  });
});
