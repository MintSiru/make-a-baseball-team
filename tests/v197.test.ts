/* 1.9.7: the legacy start played long — the split season's standings, each year's postseason note, the league's
   timeline and the legacy achievements. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { postseasonNote } from '../src/league/historic';
import { createLeague } from '../src/league/history';
import { LEGACY_ERA } from '../src/league/legacy1982';
import { achievementsFor, ACHIEVEMENTS, LEGACY_ACHIEVEMENTS } from '../src/league/milestones';
import { withScenario } from '../src/league/scenarios';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { halfStandingsView } from '../src/league/views';

const settings = (): ExpansionSettings =>
  withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');

let league: LeagueState | null = null;
const halves: Record<number, number[][] | null> = {};
/** A legacy game to 1991's opening day, the split tables taken at each regular season's end. */
function legacy(): LeagueState {
  if (league) return league;
  const s = createLeague('v197', undefined, LEGACY_ERA);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: settings() });
  for (let g = 0; g < 40000 && !(s.year === 1991 && s.phase === 'regular'); g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') {
      setEra(s);
      halves[s.year] = halfStandingsView(s)?.map((t) => t.map((r) => r.games)) ?? null;
      apply(s, { kind: 'postseason' });
    } else apply(s, { kind: 'nextSeason' });
  }
  setEra(0);
  return (league = s);
}

describe('the legacy start played long', () => {
  it('shows the first and second halves’ tables in a split season only', { timeout: 300_000 }, () => {
    legacy();
    for (const year of [1983, 1985, 1988]) {
      const [first, second] = halves[year]!;
      expect(first!.length).toBeGreaterThanOrEqual(7);
      expect(Math.min(...first!)).toBeGreaterThan(0);
      expect(Math.min(...second!)).toBeGreaterThan(0);
    }
    expect(halves[1989]).toBeNull();
    expect(halves[1990]).toBeNull();
  });

  it('notes each year’s postseason format', () => {
    setEra({ era: LEGACY_ERA, historical: true });
    expect(postseasonNote(1983)).toContain('전기');
    expect(postseasonNote(1987)).toContain('두 번');
    expect(postseasonNote(1990)).toContain('준플레이오프');
    expect(postseasonNote(1995)).toContain('3경기');
    expect(postseasonNote(2020)).toBeNull();
    setEra(0);
  });

  it('keeps the league’s timeline: the first opening, the foundings, the new names and the rule changes', () => {
    const s = legacy();
    const events = s.legacy!.events!;
    const at = (year: number) => events.filter((e) => e.year === year).map((e) => e.text);
    expect(at(1982).join(' ')).toContain('원년');
    expect(at(1985).some((t) => t.includes('창단'))).toBe(true);
    expect(at(1989).length).toBeGreaterThan(0);
    expect(at(1990).some((t) => t.includes('LG'))).toBe(true);
    expect(events.some((e) => e.text.includes('재일교포'))).toBe(true);
  });

  it('adds the legacy achievements only to a legacy game', () => {
    expect(achievementsFor({ historical: false })).toBe(ACHIEVEMENTS);
    const all = achievementsFor({ historical: true });
    expect(all.length).toBe(ACHIEVEMENTS.length + LEGACY_ACHIEVEMENTS.length);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    const s = legacy();
    const known = new Set(all.map((a) => a.id));
    for (const a of s.user!.achievements ?? []) expect(known.has(a.id)).toBe(true);
  });
});
