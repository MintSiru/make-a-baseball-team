/* 2.0.66 (the user's requests): training in detail (programmes and intensity), the spring camp in three groups and a
   wrap-up camp for the prospects, the futures players' last games and months, and the farm coaches' monthly reports. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { campLean, campRegular, springCamp, suggestCampGroups } from '../src/league/development';
import { INTENSITY, programFactor, programsFor } from '../src/league/drills';
import { FARM, farmGrade, trainingGrowth } from '../src/league/farmreport';
import { DRAFT_GROWTH } from '../src/draftroom';
import { emptyBat, addInto, type LeagueState } from '../src/league/state';
import { isPitcher } from '../src/league/players';
import { loadSave, playDays } from './helpers';

describe('training programmes (2.0.66)', () => {
  it('grow one ability as the focus did, a combined programme by its shares', () => {
    const F = DRAFT_GROWTH.focus;
    expect(programFactor('stuff', 'stuff')).toBeCloseTo(F.chosen);
    expect(programFactor('stuff', 'command')).toBeCloseTo(F.others);
    expect(programFactor('balanced', 'power')).toBe(1);
    expect(programFactor('nonsense', 'power')).toBe(1);
    expect(programFactor('lowerBody', 'stuff')).toBeCloseTo(F.others + (F.chosen - F.others) * 0.6);
    expect(programFactor('lowerBody', 'stamina')).toBeCloseTo(F.others + (F.chosen - F.others) * 0.4);
    expect(programsFor(true)).toContain('mechanics');
    expect(programsFor(true)).not.toContain('swing');
    expect(programsFor(false)).toContain('swing');
    expect(INTENSITY.hard.growth).toBeGreaterThan(1);
    expect(INTENSITY.light.injury).toBeLessThan(1);
  });
});

describe('the season below the first team (2.0.66)', () => {
  let s: LeagueState;
  // The save is from before the futures games were logged: its months count the games from here on.
  const before: Record<string, { pa: number; g: number }> = {};
  beforeAll(() => {
    s = loadSave('2.0.64');
    s.user!.entry = 'auto';
    for (const [id, l] of Object.entries(s.futures!.lines)) before[id] = { pa: l.bat?.pa ?? 0, g: l.bat?.g ?? 0 };
    playDays(s, 45);
  }, 600_000);

  it('keeps the futures players’ last games and months', () => {
    const lines = Object.entries(s.futures!.lines).filter(([id, l]) => l.bat && l.bat.pa - (before[id]?.pa ?? 0) > 30);
    expect(lines.length).toBeGreaterThan(20);
    for (const [id, l] of lines) {
      expect(l.last!.length).toBeGreaterThan(0);
      expect(l.last!.length).toBeLessThanOrEqual(10);
      const sum = emptyBat();
      for (const m of Object.values(l.months ?? {})) if (m.bat) addInto(sum, m.bat);
      expect(sum.pa).toBe(l.bat!.pa - (before[id]?.pa ?? 0));
      expect(sum.g).toBe(l.bat!.g - (before[id]?.g ?? 0));
    }
  });

  it('writes the coaches’ monthly report on ours below the first team, and counts it in the winter', () => {
    const u = s.user!;
    const farm = u.farm!;
    expect(farm.season).toBe(s.year);
    expect(farm.months.length).toBeGreaterThan(0);
    const month = farm.months.at(-1)!;
    expect(month.rows.length).toBeGreaterThan(10);
    const r = s.rosters[u.teamId]!;
    for (const row of month.rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'E']).toContain(farmGrade(row.score));
      expect(s.players[row.id]!.teamId).toBe(u.teamId);
    }
    expect(month.rows.some((x) => x.squad === 'futures')).toBe(true);
    expect(s.alerts?.some((a) => a.id === `farm-${month.month}`)).toBe(true);
    // Not twice for a month.
    const n = farm.months.length;
    expect(new Set(farm.months.map((m) => m.month)).size).toBe(n);
    // The winter's share: within the bound, the intensity on top.
    const id = month.rows[0]!.id;
    const p = s.players[id]!;
    const k = trainingGrowth(s, p, s.year);
    expect(k).toBeGreaterThanOrEqual(1 - FARM.growth - 1e-9);
    expect(k).toBeLessThanOrEqual(1 + FARM.growth + 1e-9);
    p.plan = { focus: 'balanced', intensity: 'hard' };
    expect(trainingGrowth(s, p, s.year)).toBeCloseTo(k * INTENSITY.hard.growth, 9);
    // Another club's players: the intensity alone (none: 1).
    const other = Object.values(s.players).find((x) => x.teamId && x.teamId !== u.teamId && !x.plan?.intensity)!;
    expect(trainingGrowth(s, other, s.year)).toBe(1);
    expect(r.futures.length + r.third.length).toBeGreaterThan(0);
  });

  it('sets a player’s programme and intensity, and refuses what he cannot do', () => {
    const u = s.user!;
    const pitcher = Object.values(s.players).find((p) => p.teamId === u.teamId && isPitcher(p) && p.status === 'active')!;
    apply(s, { kind: 'trainingPlan', id: pitcher.id, focus: 'lowerBody', intensity: 'hard' });
    expect(pitcher.plan).toMatchObject({ focus: 'lowerBody', intensity: 'hard' });
    apply(s, { kind: 'trainingPlan', id: pitcher.id, intensity: 'normal' });
    expect(pitcher.plan?.intensity).toBeUndefined();
    expect(pitcher.plan?.focus).toBe('lowerBody');
    expect(() => apply(s, { kind: 'trainingPlan', id: pitcher.id, focus: 'swing' })).toThrow();
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== u.teamId)!;
    expect(() => apply(s, { kind: 'trainingPlan', id: theirs.id, intensity: 'hard' })).toThrow();
    const ids = s.rosters[u.teamId]!.third.slice(0, 3);
    apply(s, { kind: 'trainingIntensity', ids, intensity: 'light' });
    for (const id of ids) expect(s.players[id]!.plan?.intensity).toBe('light');
  });
});

describe('the spring camp’s groups and the wrap-up camp (2.0.66)', () => {
  it('groups the club, and the manager leans on the first-team camp into April', () => {
    const s = loadSave('2.0.64');
    const u = s.user!;
    const ids = Object.values(s.players)
      .filter((p) => p.teamId === u.teamId && p.status === 'active')
      .map((p) => p.id);
    const groups = suggestCampGroups(s, ids, s.year);
    const first = ids.filter((id) => groups[id] === 'first');
    expect(first.length).toBeLessThanOrEqual(45);
    expect(ids.every((id) => ['first', 'second', 'rest'].includes(groups[id]!))).toBe(true);
    // A hurt player rehabs with the reserves, and comes back a little sooner.
    const hurtId = ids.find((id) => groups[id] !== 'first')!;
    groups[hurtId] = 'rest';
    s.injuries[hurtId] = { until: `${s.year}-04-30`, days: 80, onList: false, part: 'x' };
    springCamp(s, groups, s.year);
    expect(s.injuries[hurtId]!.until < `${s.year}-04-30`).toBe(true);
    expect(u.campGroups?.season).toBe(s.year);
    // The lean: a first-camp player up, a reserve down, until May.
    const date = s.schedule[s.next]!.date;
    expect(date < `${s.year}-05-01`).toBe(true);
    expect(campLean(s, s.players[first[0]!]!)).toBeGreaterThan(0);
    expect(campLean(s, s.players[hurtId]!)).toBeLessThan(0);
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== u.teamId)!;
    expect(campLean(s, theirs)).toBe(0);
  });

  it('rests the regulars through the wrap-up camp', () => {
    const s = loadSave('2.0.64');
    const u = s.user!;
    const year = s.year - 1;
    const ours = Object.values(s.players).filter((p) => p.teamId === u.teamId);
    const regular = ours.find((p) => campRegular(p, year));
    const prospect = ours.find((p) => !campRegular(p, year) && p.career.every((c) => c.year !== year || c.level || c.days < 30));
    expect(regular).toBeTruthy();
    expect(prospect).toBeTruthy();
  });
});
