/* 2.0.51 (the user's request): the Asian Games' gold — and the military exemption with it — missed 5–10% of the time
   at most (it was 45%). */
import { describe, expect, it } from 'vitest';
import { INTERNATIONAL, ODDS } from '../src/league/international';
import { finishEvent } from '../src/league/national';
import { loadSave } from './helpers';

describe('the Asian Games gold (2.0.51)', () => {
  it('is drawn 93% of the time', () => {
    const odds = Object.fromEntries(ODDS.asianGames);
    expect(odds.champion).toBeGreaterThanOrEqual(0.9);
    expect(odds.champion).toBeLessThanOrEqual(0.95);
    expect(ODDS.asianGames.reduce((a, [, w]) => a + w, 0)).toBeCloseTo(1, 9);
  });

  it('and so the squad’s unserved players are exempt nearly every time', { timeout: 120_000 }, () => {
    const base = loadSave('2.0.46');
    const ag = INTERNATIONAL.find((e) => e.kind === 'asianGames' && e.year > base.year)!;
    let gold = 0;
    const n = 40;
    for (let i = 0; i < n; i++) {
      const s = structuredClone(base);
      s.seed = `v2051-ag-${i}`;
      if (finishEvent(s, ag).medal) gold++;
    }
    expect(gold).toBeGreaterThanOrEqual(n - 6);
  });
});
