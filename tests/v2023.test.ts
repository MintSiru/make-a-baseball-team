/* 2.0.23: another scenario's conditions added to a game under way (conditions.ts). */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { checkCondition, conditionCrowd, conditionMoney, hasCondition } from '../src/league/conditions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { firstTeamIds } from '../src/league/state';
import { inWard } from '../src/league/ward';

const settings: ExpansionSettings = { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null };

const step = (s: LeagueState) => {
  if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
  else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
  else apply(s, { kind: 'nextSeason' });
};

describe('conditions added to a game under way', () => {
  it('cuts our money, every crowd and our health as the scenarios do, once each', () => {
    const s = createLeague('v2023-money');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings });
    expect(conditionMoney(s, 'support')).toBe(1);
    expect(conditionCrowd(s)).toBe(1);
    expect(inWard(s, s.user!.teamId)).toBe(false);
    apply(s, { kind: 'addCondition', id: 'recession' });
    apply(s, { kind: 'addCondition', id: 'unpopular' });
    apply(s, { kind: 'addCondition', id: 'ward' });
    expect(hasCondition(s, 'recession')).toBe(true);
    expect(conditionMoney(s, 'support')).toBeCloseTo(0.75 * 0.85);
    expect(conditionMoney(s, 'payroll')).toBeCloseTo(0.75);
    expect(conditionCrowd(s)).toBeCloseTo(0.72);
    expect(inWard(s, s.user!.teamId)).toBe(true);
    expect(inWard(s, 'lg')).toBe(false);
    // Once only.
    expect(checkCondition(s, 'recession')).not.toBeNull();
    apply(s, { kind: 'addCondition', id: 'recession' });
    expect(s.conditions!.filter((c) => c.id === 'recession')).toHaveLength(1);
  });

  it('never doubles the game’s own scenario', () => {
    const s = createLeague('v2023-own');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { ...settings, scenario: 'recession' } });
    expect(checkCondition(s, 'recession')).not.toBeNull();
    expect(conditionMoney(s, 'support')).toBe(1);
  });

  it('founds the north’s five clubs in the coming winter and plays sixteen clubs in two leagues', { timeout: 600_000 }, () => {
    const s = createLeague('v2023-unified');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings });
    const first = s.user!.firstTeamYear;
    for (let g = 0; g < 40000 && !(s.year === first && s.phase === 'regular'); g++) step(s);
    expect(checkCondition(s, 'unified')).toBeNull();
    apply(s, { kind: 'addCondition', id: 'unified' });
    const added = s.year;
    expect(s.user!.settings.twelve?.mode).toBe('off');
    for (let g = 0; g < 60000 && !(s.year === added + 2 && s.phase === 'regular'); g++) step(s);
    expect(s.unified?.clubs).toHaveLength(5);
    expect(s.unified!.clubs.every((c) => c.founded === added && c.firstTeam === added + 2)).toBe(true);
    const ids = firstTeamIds(s);
    expect(ids).toHaveLength(16);
    const sides = s.leagueSides!.sides;
    expect(ids.filter((id) => sides[id] === 'dream')).toHaveLength(8);
    // The north's clubs on both sides, our southern club among the old ones.
    const north = s.unified!.clubs.map((c) => c.teamId);
    expect(new Set(north.map((id) => sides[id])).size).toBe(2);
    for (const c of north) expect(s.rosters[c]!.active.length).toBeGreaterThan(20);
  });

  it('is refused in a league already in two leagues (2.0.43: a twelfth club is welcome)', () => {
    const s = createLeague('v2023-refuse');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings });
    s.leagueSides = { sides: {} };
    expect(checkCondition(s, 'unified')).not.toBeNull();
  });
});
