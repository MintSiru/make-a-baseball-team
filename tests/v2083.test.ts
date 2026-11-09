/* 2.0.83 (the user's request): a pitch that breaks to the glove side works on same-side hitters; one that runs to the
   arm side on opposite-side hitters, at the price of some of the same-side edge. */
import { describe, expect, it } from 'vitest';
import { armIn } from '../src/league/manager';
import { ARM_SIDE_TOTAL, fastballOf, oppositeFactor, platoonFactor, repertoire } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import { slotPlatoon } from '../src/league/tracking';
import { loadSave } from './helpers';

const ARM = new Set(['CH', 'CIR', 'SCR', 'PLM', 'FRK', 'SPL', 'SH', '2SFB', 'SNK']);
const GLOVE = new Set(['SL', 'SW', 'SLV', 'CUT', 'CB', 'KC']);

describe('2.0.83: arm side against opposite-side hitters, glove side against same-side hitters', () => {
  it('an arm-side best pitch gives an edge on opposite-side hitters; a glove-side one none, and more on same-side hitters', () => {
    const s = loadSave('2.0.82');
    const ps = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId && isPitcher(p) && repertoire(p).length);
    const arm = ps.filter((p) => ARM.has(repertoire(p)[0]!.type) && fastballOf(p) === '4SFB');
    const glove = ps.filter((p) => GLOVE.has(repertoire(p)[0]!.type) && fastballOf(p) === '4SFB');
    expect(arm.length).toBeGreaterThan(20);
    expect(glove.length).toBeGreaterThan(20);
    for (const p of arm) {
      expect(oppositeFactor(p)).toBeGreaterThan(0);
      // The two edges (the slot aside) add up to the arm-side total.
      const slot = slotPlatoon(p);
      expect(platoonFactor(p) / slot + oppositeFactor(p) * slot).toBeCloseTo(ARM_SIDE_TOTAL, 2);
    }
    for (const p of glove) expect(oppositeFactor(p)).toBe(0);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(glove.map(platoonFactor))).toBeGreaterThan(mean(arm.map(platoonFactor)));
    // The engine gets both.
    const p = arm[0]!;
    expect(armIn(p, 100).oppo).toBe(oppositeFactor(p));
  });
});
