/* 2.0.6: players tied by family and their stories; each pitch on a course of its own; a season's own pitch mix. */
import { beforeAll, describe, expect, it } from 'vitest';
import type { TeamBox } from '../src/league/engine/types';
import { familyGame, familyOf, familySeason, surnameOf } from '../src/league/family';
import { createLeague } from '../src/league/history';
import { developPitches, isKnuckleballer, pitchGrades, repertoire } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import { seasonMix } from '../src/league/savant';
import type { LeagueState } from '../src/league/state';
import { emptyBat } from '../src/league/state';

const born = (s: LeagueState, id: string) => Number(s.players[id]!.birthday.slice(0, 4));

describe('family ties', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v206-family');
  }, 300_000);

  it('reads two-syllable surnames', () => {
    expect(surnameOf('김민수')).toBe('김');
    expect(surnameOf('남궁민')).toBe('남궁');
    expect(surnameOf('선우진')).toBe('선우');
  });

  it('ties men of one surname, at a family’s ages, now and then', () => {
    const f = s.families ?? [];
    expect(f.length).toBeGreaterThan(3);
    expect(f.length).toBeLessThan(80);
    for (const t of f) {
      const a = s.players[t.a]!,
        b = s.players[t.b]!;
      expect(surnameOf(a.name)).toBe(surnameOf(b.name));
      const gap = born(s, t.b) - born(s, t.a);
      if (t.kind === 'father') expect(gap).toBeGreaterThanOrEqual(22);
      if (t.kind === 'brother') {
        expect(gap).toBeGreaterThanOrEqual(1);
        expect(gap).toBeLessThanOrEqual(6);
        expect(a.birthplace).toBe(b.birthplace);
      }
      if (t.kind === 'twin') expect(a.birthday).toBe(b.birthday);
      // Both sides see each other.
      expect(familyOf(s, t.a).some((x) => x.id === t.b)).toBe(true);
      expect(familyOf(s, t.b).some((x) => x.id === t.a)).toBe(true);
    }
    expect((s.news ?? []).some((n) => n.id.startsWith('family-draft-'))).toBe(true);
  });

  it('tells the first time brothers meet, and a brother batting against his brother', () => {
    const t = { kind: 'brother' as const, a: 'x-old', b: 'x-young', year: 2026 };
    const base = Object.values(s.players)[0]!;
    s.players['x-old'] = { ...base, id: 'x-old', name: '김형', teamId: s.teams[0]!.id };
    s.players['x-young'] = { ...base, id: 'x-young', name: '김동생', teamId: s.teams[1]!.id };
    s.families = [...(s.families ?? []), t];
    const box = (ids: { bat: string[]; pit: string[] }, vs?: Record<string, number[]>): TeamBox =>
      ({ batting: ids.bat.map((id) => ({ id })), pitching: ids.pit.map((id) => ({ id })), ...(vs ? { vs } : {}) }) as unknown as TeamBox;
    familyGame(s, box({ bat: ['x-old'], pit: [] }, { 'x-old|x-young': [3, 3, 1, 4, 1, 0, 1] }), box({ bat: [], pit: ['x-young'] }), '2026-05-01');
    const duel = s.news!.find((n) => n.id === 'family-duel-x-old-x-young')!;
    expect(duel.title).toContain('김형');
    expect(duel.facts.hr).toBe(1);
    const before = s.news!.length;
    familyGame(s, box({ bat: ['x-old'], pit: [] }, { 'x-old|x-young': [1, 1, 0, 0, 0, 0, 1] }), box({ bat: [], pit: ['x-young'] }), '2026-05-02');
    expect(s.news!.length).toBe(before);
  });

  it('marks a son passing his father’s career home runs, once', () => {
    const base = Object.values(s.players)[0]!;
    const season = (hr: number) => ({ year: 2020, teamId: 't', age: 30, days: 100, bat: { ...emptyBat(), hr }, pit: null, war: 1 });
    s.players['x-dad'] = { ...base, id: 'x-dad', name: '이아버지', career: [season(30)] };
    s.players['x-son'] = { ...base, id: 'x-son', name: '이아들', career: [season(20), season(15)] };
    s.families = [...(s.families ?? []), { kind: 'father', a: 'x-dad', b: 'x-son', year: 2026 }];
    familySeason(s);
    familySeason(s);
    expect(s.news!.filter((n) => n.id === 'family-pass-hr-x-son').length).toBe(1);
  });
});

describe('each pitch on its own course', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v206-pitches');
  }, 300_000);

  it('keeps the drift centred on his mix, within its bounds, and the pitches apart', () => {
    const arms = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active' && repertoire(p).length >= 2);
    let moved = 0;
    for (const p of arms) {
      const rep = repertoire(p);
      const dev = p.pitchDev ?? {};
      const total = rep.reduce((a, x) => a + x.usage, 0);
      const mean = rep.reduce((a, x) => a + x.usage * (dev[x.type] ?? 0), 0) / total;
      expect(Math.abs(mean)).toBeLessThan(0.3);
      for (const x of rep) expect(Math.abs(dev[x.type] ?? 0)).toBeLessThanOrEqual(10);
      if (rep.some((x) => Math.abs(dev[x.type] ?? 0) >= 2)) moved++;
    }
    expect(moved / arms.length).toBeGreaterThan(0.3);
    // Last season's grades kept for the change on his screen.
    expect(arms.filter((p) => p.pitchLast).length / arms.length).toBeGreaterThan(0.5);
  });

  it('lets a young arm’s weaker pitches catch up over the years, on average', () => {
    const arms = Object.values(s.players)
      // A knuckleballer's pitches stay as they are (2.0.36).
      .filter((x) => isPitcher(x) && repertoire(x).length >= 2 && !isKnuckleballer(x))
      .slice(0, 60)
      .map((x) => structuredClone(x));
    let gap = 0;
    for (const p of arms) {
      delete p.pitchDev;
      const rep = repertoire(p);
      const weakest = rep.reduce((a, x) => (x.offset < a.offset ? x : a));
      const best = rep.reduce((a, x) => (x.offset > a.offset ? x : a));
      for (let y = 2030; y < 2036; y++) developPitches(p, y, 22);
      gap += (p.pitchDev![weakest.type] ?? 0) - (p.pitchDev![best.type] ?? 0);
      expect(pitchGrades(p).length).toBe(rep.length);
    }
    expect(gap / arms.length).toBeGreaterThan(1);
  });

  it('moves a season’s mix from one year to the next', () => {
    const p = Object.values(s.players).find((x) => isPitcher(x) && repertoire(x).length >= 2)!;
    const a = seasonMix(p, 2030).mix!,
      b = seasonMix(p, 2031).mix!;
    expect(a.reduce((n, [, x]) => n + x, 0)).toBeCloseTo(100, 0);
    expect(a.map(([, x]) => x)).not.toEqual(b.map(([, x]) => x));
  });
});
