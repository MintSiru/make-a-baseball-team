/* 2.0.38 (the user's request): a pop-up when a pitch our club planned is learned — or is not. */
import { describe, expect, it } from 'vitest';
import { LEARN, learnable, learnWinter } from '../src/league/newpitch';
import { isPitcher } from '../src/league/players';
import { loadSave } from './helpers';

describe('learning a new pitch (2.0.38)', () => {
  for (const [took, odds] of [
    [true, { min: 1, max: 1 }],
    [false, { min: 0, max: 0 }],
  ] as const) {
    it(took ? 'tells us when it took' : 'tells us when it did not', () => {
      const s = loadSave('2.0.36');
      const p = Object.values(s.players).find((x) => x.teamId === s.user!.teamId && isPitcher(x) && learnable(x).length > 0)!;
      const type = learnable(p)[0]!;
      s.user!.pitchPlans = { [p.id]: type };
      const was = { min: LEARN.min, max: LEARN.max };
      Object.assign(LEARN, odds);
      try {
        learnWinter(s, s.year);
      } finally {
        Object.assign(LEARN, was);
      }
      const a = (s.alerts ?? []).find((x) => x.id === `learn-${s.year}-${p.id}`);
      expect(a).toBeDefined();
      expect(a!.minor).toBeFalsy();
      expect(a!.tone).toBe(took ? 'good' : 'bad');
      expect(a!.players).toEqual([p.id]);
      expect(!!p.learned?.some((x) => x.type === type)).toBe(took);
    });
  }
});
