/* 1.9.8: the update notes (the change log read into the game) and the legacy postseason of 1982–1985. */
import { describe, expect, it } from 'vitest';
import { RELEASE } from '../src/core/version';
import { newer, UPDATE_NOTES } from '../src/ui/updates';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision, checkDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA } from '../src/league/legacy1982';
import { withScenario } from '../src/league/scenarios';
import { setEra } from '../src/league/era';
import type { ExpansionSettings } from '../src/league/state';
import { eraUsage } from '../src/rules/history';

describe('update notes', () => {
  it('reads every version of the change log, newest first, the current one on top', () => {
    expect(UPDATE_NOTES.length).toBeGreaterThan(40);
    expect(UPDATE_NOTES[0]!.version).toBe(RELEASE);
    for (let i = 1; i < UPDATE_NOTES.length; i++) expect(newer(UPDATE_NOTES[i - 1]!.version, UPDATE_NOTES[i]!.version)).toBe(true);
    expect(UPDATE_NOTES.every((n) => !n.text.includes('**'))).toBe(true);
  });

  it('compares versions by number', () => {
    expect(newer('1.10.0', '1.9.8')).toBe(true);
    expect(newer('1.9.8', '1.9.8')).toBe(false);
    expect(newer('0.16.0', '1.0.0')).toBe(false);
  });
});

describe('our territorial picks', () => {
  it('asks us, among our region’s high-school players only', { timeout: 120_000 }, () => {
    const settings = (): ExpansionSettings =>
      withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');
    const s = createLeague('v198', undefined, LEGACY_ERA);
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: settings() });
    let asked: string[] | null = null;
    for (let g = 0; g < 20000 && !asked && s.year < 1986; g++) {
      const d = s.pending;
      if (d?.kind === 'draftPick' && d.eligible) {
        asked = d.eligible;
        const other = s.offseason!.draft!.pool.find((id) => !d.eligible!.includes(id))!;
        expect(checkDecision(s, { kind: 'draftPick', id: other })).not.toBeNull();
        expect(checkDecision(s, { kind: 'draftPick', id: d.eligible[0]! })).toBeNull();
        apply(s, { kind: 'decide', input: { kind: 'draftPick', id: d.eligible[0]! } });
        expect(s.players[d.eligible[0]!]!.origin.territorial).toBe(true);
      } else if (d) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    setEra(0);
    expect(asked?.length).toBeGreaterThan(0);
  });
});

describe('pitching by era', () => {
  it('rides starters longer and earlier closers in the old days, today’s way from 2015 and in other games', () => {
    setEra({ era: LEGACY_ERA, historical: true });
    const [a, b, c, d] = [eraUsage(1985)!, eraUsage(1993)!, eraUsage(1998)!, eraUsage(2008)!];
    expect(a.rotation).toBe(4);
    expect(a.starterRelief).toBe(true);
    expect(c.rotation).toBe(5);
    expect(a.limitBonus).toBeGreaterThanOrEqual(b.limitBonus);
    expect(b.limitBonus).toBeGreaterThan(c.limitBonus);
    expect(c.limitBonus).toBeGreaterThan(d.limitBonus);
    expect(a.closerFrom).toBeLessThan(9);
    expect(d.closerFrom).toBe(9);
    expect(eraUsage(2015)).toBeNull();
    setEra(0);
    expect(eraUsage(1985)).toBeNull();
  });

  it('completes about as many games as the KBO did in the 1980s', { timeout: 300_000 }, () => {
    const settings = (): ExpansionSettings =>
      withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');
    const s = createLeague('v198-cg', undefined, LEGACY_ERA);
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: settings() });
    const rates: number[] = [];
    for (let g = 0; g < 30000 && s.year < 1988; g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') {
        const pits = Object.values(s.lines).flatMap((l) => (l.pit ? [l.pit] : []));
        rates.push(pits.reduce((x, p) => x + (p.cg ?? 0), 0) / pits.reduce((x, p) => x + p.gs, 0));
        apply(s, { kind: 'postseason' });
      } else apply(s, { kind: 'nextSeason' });
    }
    setEra(0);
    // The KBO 1982–1987: 131–254 complete games, a fifth to three tenths of the starts (RULES.md §14).
    const mean = rates.reduce((x, y) => x + y, 0) / rates.length;
    expect(mean).toBeGreaterThan(0.17);
    expect(mean).toBeLessThan(0.36);
  });
});
