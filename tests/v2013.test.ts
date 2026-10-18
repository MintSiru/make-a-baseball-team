/* 2.0.13: with the board off, the general manager sets the league's rules from the coming season. */
import { beforeAll, describe, expect, it } from 'vitest';
import { checkRule, currentValue, ruleSeason, setRule } from '../src/league/board';
import { setEra } from '../src/league/era';
import { createLeague } from '../src/league/history';
import type { LeagueState, UserClub } from '../src/league/state';
import { rulesFor } from '../src/rules/history';

describe('the rules by hand', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v2013-rules');
    s.user = { teamId: s.teams[0]!.id } as UserClub;
  }, 300_000);

  it('sets a rule from the coming season and takes it back', () => {
    const season = ruleSeason(s);
    setEra(s);
    const before = rulesFor(season).foreign.hold;
    const to = before === 4 ? 3 : 4;
    expect(checkRule(s, 'foreign', to)).toBeNull();
    setRule(s, 'foreign', to);
    expect(s.board!.changes).toContainEqual({ from: season, item: 'foreign', value: to, manual: true });
    setEra(s);
    expect(rulesFor(season).foreign.hold).toBe(to);
    expect(rulesFor(season - 1).foreign.hold).toBe(before);
    expect(currentValue(s, 'foreign', season)).toBe(to);
    // Back to the rule book: the change goes.
    setRule(s, 'foreign', before);
    setEra(s);
    expect(s.board!.changes.some((c) => c.item === 'foreign')).toBe(false);
    expect(rulesFor(season).foreign.hold).toBe(before);
    expect((s.news ?? []).some((n) => n.id.startsWith(`rule-${season}-foreign`))).toBe(true);
  });

  it('refuses values out of range, and anything while the board meets', () => {
    expect(checkRule(s, 'games', 130)).not.toBeNull();
    expect(checkRule(s, 'foreign', 9)).not.toBeNull();
    s.board!.on = true;
    expect(checkRule(s, 'foreign', 3)).not.toBeNull();
    s.board!.on = false;
    setEra(0);
  });
});
