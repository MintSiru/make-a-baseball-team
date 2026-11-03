/* 2.0.74: the settings' rule editor offers each rule's value in force — the 2026 rule book's roster limit of 68 used to
   fall between the steps of five (60·65·70) and the select showed blank. */
import { afterAll, describe, expect, it } from 'vitest';
import { BOARD_ITEMS, checkRule, currentValue, items, ruleOptions, ruleSeason, setRule, stepFrom, type BoardItem } from '../src/league/board';
import { setEra } from '../src/league/era';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA } from '../src/league/legacy1982';
import type { LeagueState, UserClub } from '../src/league/state';

function fresh(seed: string, shift = 0): LeagueState {
  const s = createLeague(seed, undefined, shift);
  s.user = { teamId: s.teams[0]!.id } as UserClub;
  setEra(s);
  return s;
}

/** Every item the editor shows: the value in force is among its options, and each option may be set. */
function offersEveryValue(s: LeagueState) {
  const season = ruleSeason(s);
  const list = items(s, season);
  expect(list.length).toBeGreaterThan(10);
  for (const item of list) {
    const now = currentValue(s, item, season);
    const options = ruleOptions(s, item);
    expect(options, item).toContain(now);
    expect(new Set(options).size, item).toBe(options.length);
    for (const v of options) expect(checkRule(s, item, v), `${item} ${v}`).toBeNull();
  }
}

describe('the rule editor offers the value in force', () => {
  afterAll(() => setEra(0));

  it('in a new game (the 2026 rule book)', () => {
    const s = fresh('v2074-modern');
    expect(currentValue(s, 'rosterLimit', ruleSeason(s))).toBe(68);
    offersEveryValue(s);
  }, 300_000);

  it('in a new 1982 game, the rule book of the day off the steps', () => {
    const s = fresh('v2074-legacy', LEGACY_ERA);
    const season = ruleSeason(s);
    expect(currentValue(s, 'rosterLimit', season)).toBe(45);
    offersEveryValue(s);
    // Off the steps and back: the rule book's value takes the change back, other values off the steps stay refused.
    setRule(s, 'rosterLimit', 62);
    setEra(s);
    expect(currentValue(s, 'rosterLimit', season)).toBe(62);
    expect(ruleOptions(s, 'rosterLimit')).toContain(45);
    expect(checkRule(s, 'rosterLimit', 46)).not.toBeNull();
    setRule(s, 'rosterLimit', 45);
    setEra(s);
    expect(s.board!.changes.some((c) => c.item === 'rosterLimit')).toBe(false);
    expect(currentValue(s, 'rosterLimit', season)).toBe(45);
  }, 300_000);
});

describe('board motions move along the steps', () => {
  it('the roster limit: 65 and 68 are on them', () => {
    expect(BOARD_ITEMS.rosterLimit).toEqual({ min: 62, max: 74, step: 3 });
    expect(stepFrom('rosterLimit', 68, true)).toBe(71);
    expect(stepFrom('rosterLimit', 68, false)).toBe(65);
    expect(stepFrom('rosterLimit', 65, false)).toBe(62);
    expect(stepFrom('rosterLimit', 74, true)).toBeNull();
    expect(stepFrom('rosterLimit', 62, false)).toBeNull();
  });

  it('a value off the steps goes to the nearest step that way, never the wrong way', () => {
    // A change from before the steps moved (the old 70) and a history game's rule book (45, 126 games).
    expect(stepFrom('rosterLimit', 70, true)).toBe(71);
    expect(stepFrom('rosterLimit', 70, false)).toBe(68);
    expect(stepFrom('rosterLimit', 45, true)).toBe(62);
    expect(stepFrom('rosterLimit', 45, false)).toBeNull();
    expect(stepFrom('rosterLimit', 80, false)).toBe(74);
    expect(stepFrom('games', 126, false)).toBeNull();
    expect(stepFrom('games', 126, true)).toBe(128);
  });

  it('on the steps, one step either way as before', () => {
    for (const item of Object.keys(BOARD_ITEMS) as BoardItem[]) {
      const { min, max, step } = BOARD_ITEMS[item];
      for (let v = min; v <= max; v += step) {
        expect(stepFrom(item, v, true)).toBe(v + step <= max ? v + step : null);
        expect(stepFrom(item, v, false)).toBe(v - step >= min ? v - step : null);
      }
    }
  });
});
