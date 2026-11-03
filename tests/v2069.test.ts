/* 2.0.69 (the user's request): the Larry Bird rule, a board rule in force from the start. 2.0.73 made it the KBO's own
   (one named player a club, tests/v2073.test.ts); the rule's place on the board stays. */
import { describe, expect, it } from 'vitest';
import { birdRuleOn } from '../src/league/bird';
import { currentValue, ruleLabel, setRule } from '../src/league/board';
import { setEra } from '../src/league/era';
import { loadSave } from './helpers';

describe('the Larry Bird rule (2.0.69)', () => {
  it('stands from the start, and the general manager (or the board) may take it away', () => {
    const s = loadSave('2.0.67');
    setEra(s);
    const next = s.year + 1;
    expect(birdRuleOn(next)).toBe(true);
    expect(currentValue(s, 'birdRule', next)).toBe(1);
    expect(ruleLabel('birdRule')).toBe('래리 버드 룰');
    if (s.board) s.board.on = false;
    setRule(s, 'birdRule', 0);
    setEra(s);
    expect(birdRuleOn(next)).toBe(false);
    expect(birdRuleOn(s.year)).toBe(true);
    expect(currentValue(s, 'birdRule', next)).toBe(0);
  });
});
