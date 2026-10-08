/* 1.1.0: the player model from the 1.0 feedback — growth types, hidden traits and personality, the staff's reports,
   foreign player types, two-pitch pitchers and a pitch mix of each pitcher's own. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PERSONALITIES, rng, type Tools } from '../src/draftroom';
import type { GrowthType, Player } from '../src/model/types';
import { draftClass, FOREIGN_TYPES, foreignTypeOf, makeForeign } from '../src/league/players';
import { repertoire } from '../src/league/pitches';
import { traitReport } from '../src/league/reports';
import type { LeagueState } from '../src/league/state';
import { declineOf, growTools, GROWTH_ORDER, rollTraits, traitsOf, troubleFactor } from '../src/league/traits';
import { OFFSEASON } from '../src/league/tuning';
import { retirementChance } from '../src/league/offseason';
import { parseSave } from '../src/save/format';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('hidden traits', () => {
  const rolls = Array.from({ length: 8000 }, (_, i) => {
    const personality = PERSONALITIES[i % 8]!;
    const curve = (['early', 'normal', 'normal', 'normal', 'late'] as const)[i % 5];
    return { personality, t: rollTraits('v110', `p${i}`, personality, curve) };
  });

  it('are drawn once per player, the same every time', () => {
    expect(rollTraits('v110', 'p1', '책임감 강한 리더', 'late')).toEqual(rollTraits('v110', 'p1', '책임감 강한 리더', 'late'));
    expect(rollTraits('v110', 'p1', '책임감 강한 리더', 'late')).not.toEqual(rollTraits('v110', 'p2', '책임감 강한 리더', 'late'));
  });

  it('come in five growth types, the extreme ones rarer', () => {
    const share = (g: GrowthType) => rolls.filter((x) => x.t.growth === g).length / rolls.length;
    expect(share('normal')).toBeCloseTo(0.6, 1);
    expect(share('veryEarly')).toBeGreaterThan(0.04);
    expect(share('veryEarly')).toBeLessThan(share('early'));
    expect(share('veryLate')).toBeGreaterThan(0.04);
    expect(share('veryLate')).toBeLessThan(share('late'));
  });

  it('lean with the personality, the league average where it was', () => {
    const of = (who: string, k: 'work' | 'mental' | 'leadership' | 'controversy') => mean(rolls.filter((x) => x.personality === who).map((x) => x.t[k]));
    expect(of('꾸준함을 믿는 성실형', 'work')).toBeGreaterThan(of('큰 무대를 즐기는 대담형', 'work') + 10);
    expect(of('큰 무대를 즐기는 대담형', 'mental')).toBeGreaterThan(of('분석을 즐기는 연구형', 'mental') + 15);
    expect(of('책임감 강한 리더', 'leadership')).toBeGreaterThan(of('승부욕 강한 도전자', 'leadership') + 15);
    expect(of('큰 무대를 즐기는 대담형', 'controversy')).toBeGreaterThan(of('꾸준함을 믿는 성실형', 'controversy') + 10);
    expect(mean(rolls.map((x) => x.t.work))).toBeCloseTo(50, 0);
    expect(mean(rolls.map((x) => x.t.mental))).toBeCloseTo(50, 0);
    // A genius or a troublemaker is rare.
    expect(rolls.filter((x) => x.t.genius >= 80).length / rolls.length).toBeLessThan(0.05);
    expect(troubleFactor({ id: 'a', personality: '', hidden: { traits: { ...rolls[0]!.t, controversy: 70 } } as never })).toBeGreaterThan(5);
  });
});

/** A prospect of one growth type, average in everything else, aged `from` with a long way to his ceiling. */
function prospect(growth: GrowthType, genius = 50, work = 50): Player {
  const now: Tools = { contact: 35, power: 35, eye: 35, speed: 50, defense: 40 };
  const pot: Tools = { contact: 70, power: 70, eye: 70, speed: 60, defense: 65 };
  return {
    id: `x-${growth}`,
    personality: '',
    hidden: { current: { ...now }, potential: pot, growthCurve: 'normal', developmentRate: 1, observerBias: 0, injuryRisk: 0.08, traits: { growth, genius, work, mental: 50, leadership: 50, loyalty: 50, controversy: 30 } },
  } as unknown as Player;
}
const level = (t: Tools) => mean(Object.values(t) as number[]);
/** Ability by age from 19 to 38: growth, aging and the late-career decline, without noise. */
function career(p: Player): Map<number, number> {
  const r = () => 0.5;
  const out = new Map<number, number>();
  const V = OFFSEASON.veteranDecline;
  for (let age = 19; age <= 38; age++) {
    const next = growTools(p, age, 0, r);
    const extra = declineOf(p, age, V.perYear, V.steepPerYear);
    for (const k of Object.keys(next) as (keyof Tools)[]) next[k] = Math.max(20, next[k]! - extra);
    p.hidden.current = next;
    out.set(age, level(next));
  }
  return out;
}
const peakAge = (c: Map<number, number>) => [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];

describe('growth types', () => {
  const runs = Object.fromEntries(GROWTH_ORDER.map((g) => [g, career(prospect(g))])) as Record<GrowthType, Map<number, number>>;

  // 1.6.0: every type has its prime at 27–32; the types differ in when they get there and when they fall.
  const arrives = (c: Map<number, number>) => {
    const top = Math.max(...c.values());
    return [...c].find(([, v]) => v >= top * 0.97)![0];
  };

  it('arrive in order, from 초조숙 to 초만성; 보통 peaks in the 27–32 prime, the others a little either side', () => {
    const at = GROWTH_ORDER.map((g) => arrives(runs[g]));
    for (let i = 1; i < at.length; i++) expect(at[i]!).toBeGreaterThanOrEqual(at[i - 1]!);
    expect(at[4]! - at[0]!).toBeGreaterThanOrEqual(4);
    expect(peakAge(runs.normal)).toBeGreaterThanOrEqual(27);
    expect(peakAge(runs.normal)).toBeLessThanOrEqual(32);
    for (const g of GROWTH_ORDER) {
      expect(peakAge(runs[g])).toBeGreaterThanOrEqual(25);
      expect(peakAge(runs[g])).toBeLessThanOrEqual(31);
    }
  });

  it('a 초조숙 career is short, a 초만성 one long: the fall and the retirement come years apart', () => {
    expect(runs.veryEarly.get(34)!).toBeLessThan(runs.normal.get(34)! - 5);
    expect(runs.veryLate.get(36)!).toBeGreaterThan(runs.normal.get(36)! + 3);
    const at = (growth: GrowthType, age: number) => {
      const p = prospect(growth);
      p.scouting = { current: 55 } as Player['scouting'];
      p.birthday = `${2030 - age}-04-01`;
      p.career = [];
      p.origin = { kind: 'draftClass' } as Player['origin'];
      return retirementChance(p, 2030, false);
    };
    expect(at('veryEarly', 33)).toBeGreaterThan(at('normal', 33) * 2);
    expect(at('veryLate', 35)).toBeLessThan(at('normal', 35) / 2);
  });

  it('an early developer is ahead at 21 and behind at 35; a late one the other way round', () => {
    expect(runs.veryEarly.get(21)!).toBeGreaterThan(runs.veryLate.get(21)! + 5);
    expect(runs.veryLate.get(35)!).toBeGreaterThan(runs.veryEarly.get(35)! + 3);
    expect(runs.late.get(22)!).toBeLessThan(runs.normal.get(22)!);
  });

  it('보통 reaches its prime by 27, holds it to 32 and falls from 33', () => {
    const c = runs.normal;
    const top = Math.max(...c.values());
    expect(c.get(27)!).toBeGreaterThan(top - 0.5);
    expect(c.get(32)!).toBeGreaterThan(top - 1);
    expect(c.get(24)!).toBeLessThan(top - 1.5);
    expect(c.get(34)!).toBeLessThan(top - 2);
  });

  it('genius and work ethic speed growth; work ethic holds off the decline', () => {
    const at22 = (genius: number, work: number) => career(prospect('normal', genius, work)).get(22)!;
    expect(at22(90, 50)).toBeGreaterThan(at22(50, 50) + 1);
    expect(at22(50, 90)).toBeGreaterThan(at22(50, 50));
    expect(declineOf(prospect('normal', 50, 85), 35, 0.3, 0.45)).toBeLessThan(declineOf(prospect('normal', 50, 15), 35, 0.3, 0.45));
  });
});

describe('pitches', () => {
  const arms = Array.from({ length: 1200 }, (_, i) => {
    const role = i % 2 ? 'RP' : 'SP';
    return { id: `arm${i}`, role, throws: i % 3 ? '우' : '좌', birthday: '2000-05-05', archetype: i % 7 === 0 ? '포크볼 불펜' : '파워 불펜', origin: { kind: 'draftClass' }, hidden: { current: { breaking: 50 } } } as unknown as Player;
  });

  it('a third of relievers throw a fastball and one breaking ball; starters almost never', () => {
    const two = (role: string) => arms.filter((p) => p.role === role && repertoire(p).length === 1).length / arms.filter((p) => p.role === role).length;
    expect(two('RP')).toBeGreaterThan(0.25);
    expect(two('RP')).toBeLessThan(0.42);
    expect(two('SP')).toBeLessThan(0.1);
  });

  it('keeps the weighted grade at the tool, whatever the count', () => {
    for (const p of arms.slice(0, 200)) {
      const r = repertoire(p);
      if (r.length === 1) expect(r[0]!.offset).toBe(0);
      else expect(0.6 * r[0]!.offset + 0.3 * r[1]!.offset + 0.1 * (r.length > 2 ? mean(r.slice(2).map((x) => x.offset)) : r[1]!.offset)).toBeCloseTo(0, 6);
    }
  });

  it('mixes them in proportions of his own', () => {
    const shares = arms.map((p) => repertoire(p).reduce((a, x) => a + x.usage, 0));
    expect(Math.max(...shares) - Math.min(...shares)).toBeGreaterThan(0.25);
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0.18 - 1e-9);
    expect(Math.max(...shares)).toBeLessThanOrEqual(0.66 + 1e-9);
    // A forkball reliever's best pitch is the forkball more often than not.
    const fork = arms.filter((p) => p.archetype === '포크볼 불펜');
    expect(fork.filter((p) => repertoire(p)[0]!.type === 'FO').length / fork.length).toBeGreaterThan(0.5);
    // Best pitch thrown most.
    for (const p of arms.slice(0, 100)) {
      const r = repertoire(p);
      for (let i = 1; i < r.length; i++) expect(r[i]!.usage).toBeLessThan(r[i - 1]!.usage);
    }
  });
});

describe('foreign players', () => {
  const signings = Array.from({ length: 600 }, (_, i) => makeForeign('v110', `f${i}`, 2028, { kind: i % 2 ? 'hitter' : 'pitcher', asiaQuota: i % 10 === 0 }));

  it('come in types that show in their abilities', () => {
    for (const p of signings) expect(FOREIGN_TYPES.has(p.archetype)).toBe(true);
    expect(new Set(signings.map((p) => p.archetype)).size).toBe(FOREIGN_TYPES.size);
    const avg = (type: string, k: keyof Tools) => mean(signings.filter((p) => p.archetype === type).map((p) => p.hidden.current[k]!));
    expect(avg('거포형', 'power')).toBeGreaterThan(avg('교타형', 'power') + 6);
    expect(avg('교타형', 'contact')).toBeGreaterThan(avg('거포형', 'contact') + 5);
    expect(avg('구위형', 'stuff')).toBeGreaterThan(avg('제구형', 'stuff') + 5);
    expect(avg('제구형', 'command')).toBeGreaterThan(avg('구위형', 'command') + 6);
    for (const p of signings.filter((x) => x.archetype === '유틸리티')) expect(p.alt!.length).toBeGreaterThanOrEqual(2);
    // Every one has a personality and traits now.
    for (const p of signings) {
      expect(PERSONALITIES).toContain(p.personality);
      expect(p.hidden.traits).toBeDefined();
    }
  });

  it('signed before 1.1.0 get a type read from what they do best', () => {
    const p = signings.find((x) => x.archetype === '거포형')!;
    expect(foreignTypeOf({ ...p, archetype: '외국인 타자' })).toBe('거포형');
    const q = signings.find((x) => x.archetype === '구위형' && x.hidden.current.stuff! - 65 > x.hidden.current.command! - 60 + 3)!;
    expect(foreignTypeOf({ ...q, archetype: '외국인 투수' })).toBe('구위형');
  });
});

describe('scout and coach reports', () => {
  const pool = draftClass('v110-report', 2027).slice(0, 300);
  const state = (rating: number, teamId = 'us'): LeagueState =>
    ({
      seed: 'v110-report',
      year: 2027,
      phase: 'regular',
      user: { teamId, settings: { difficulty: 'normal' } },
      clubs: { [teamId]: { staff: Object.fromEntries(['manager', 'hitting', 'pitching', 'fielding', 'farm', 'scouting', 'medical', 'analytics'].map((r) => [r, { id: r, name: '김코치', role: r, rating }])) } },
    }) as unknown as LeagueState;
  /** How far the reads miss, in levels, over the pool. */
  const miss = (s: LeagueState, ours: boolean) =>
    mean(
      pool.flatMap((p0) => {
        const p = { ...p0, teamId: ours ? s.user!.teamId : null, career: ours ? [{ year: 2026, teamId: s.user!.teamId, level: 'futures' }] : [] } as unknown as Player;
        const t = traitsOf(p);
        const rep = traitReport(s, p)!;
        return (['genius', 'work', 'mental', 'leadership', 'loyalty'] as const).map((k) => {
          const truth = t[k] >= 80 ? 5 : t[k] >= 62 ? 4 : t[k] >= 38 ? 3 : t[k] >= 20 ? 2 : 1;
          const read = rep.reads.find((x) => x.key === k)!;
          return read.level == null ? 2 : Math.abs(read.level - truth);
        });
      }),
    );

  it('come closer to the truth with better staff, and coaches know their own players better than scouts know anyone', () => {
    const weak = miss(state(25), false),
      strong = miss(state(80), false),
      coaches = miss(state(50), true);
    expect(strong).toBeLessThan(weak);
    expect(coaches).toBeLessThan(miss(state(50), false));
  });

  it('read the same on every look, and name who signs them', () => {
    const s = state(60);
    const p = pool[0]!;
    expect(traitReport(s, p)).toEqual(traitReport(s, p));
    expect(traitReport(s, p)!.by).toBe('scout');
    expect(traitReport(s, p)!.staff).toContain('스카우트 팀장');
    expect(traitReport(s, p)!.reads.map((r) => r.key)).toEqual(['growth', 'injury', 'genius', 'work', 'mental', 'leadership', 'loyalty', 'controversy']);
    expect(traitReport({ ...s, user: null } as LeagueState, p)).toBeNull();
  });
});

describe('a 1.0.0 save', () => {
  it('gives every player traits, and every foreign player a personality and a type', () => {
    const save = parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.0.0.json.gz', import.meta.url))).toString('utf8'));
    expect(save.migratedFrom).toBe('1.0.0');
    const s = save.snapshot!.state as LeagueState;
    const players = Object.values(s.players);
    for (const p of players) expect(p.hidden.traits).toBeDefined();
    const foreign = players.filter((p) => p.origin.kind === 'foreign');
    expect(foreign.length).toBeGreaterThan(20);
    for (const p of foreign) {
      expect(FOREIGN_TYPES.has(p.archetype)).toBe(true);
      expect(p.personality).not.toBe('');
    }
    // Seeded: the same save migrates to the same traits.
    const again = parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.0.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
    expect(again.players[foreign[0]!.id]!.hidden.traits).toEqual(foreign[0]!.hidden.traits);
  }, 120_000);
});
