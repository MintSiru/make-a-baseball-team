/* 2.0.19: inflation on the amounts shown (nominal won at the year's prices), the game's economy unchanged. */
import { describe, expect, it } from 'vitest';
import { priceLevel } from '../src/league/pricelevel';
import { DEFAULT_PREFS, parseDisplay, saveDisplay } from '../src/ui/display';
import { money, moneyShort, setMoneyYear, shownLevel } from '../src/ui/format';

describe('the price level', () => {
  it('is 1 in 2026, about a fifth in 1982, and grows by the rate after 2026', () => {
    expect(priceLevel(2026, 0.025)).toBe(1);
    expect(priceLevel(1982, 0.025)).toBeCloseTo(0.21, 2);
    expect(priceLevel(2036, 0.03)).toBeCloseTo(1.03 ** 10, 6);
    for (let y = 1982; y < 2040; y++) expect(priceLevel(y + 1, 0.02)).toBeGreaterThan(priceLevel(y, 0.02));
  });

  it('keeps only valid settings', () => {
    expect(parseDisplay(JSON.stringify({ money: 'nominal', inflation: 3 }))).toMatchObject({ money: 'nominal', inflation: 3 });
    expect(parseDisplay(JSON.stringify({ money: 'x', inflation: 7 }))).toMatchObject({ money: 'real', inflation: DEFAULT_PREFS.inflation });
  });
});

describe('nominal amounts', () => {
  it('shows today’s won by default and the year’s prices when asked', () => {
    try {
      saveDisplay({ ...DEFAULT_PREFS });
    } catch {
      // No page to apply it to.
    }
    setMoneyYear(2036);
    expect(shownLevel()).toBe(1);
    expect(money(30000)).toBe(money(30000, 2026));
    try {
      saveDisplay({ ...DEFAULT_PREFS, money: 'nominal', inflation: 5 });
    } catch {
      // As above.
    }
    expect(shownLevel()).toBeCloseTo(1.05 ** 10, 6);
    // 3억 in 2036 at 5% a year: 4.9억.
    expect(moneyShort(30000)).toContain('4.9');
    // A past season at its own prices.
    expect(shownLevel(1982)).toBeCloseTo(0.21, 2);
    setMoneyYear(2026);
    try {
      saveDisplay({ ...DEFAULT_PREFS });
    } catch {
      // As above.
    }
  });
});
