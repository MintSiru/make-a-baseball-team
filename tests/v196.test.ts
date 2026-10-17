/* 1.9.6: the legacy start's players and money as they were (names by birth decade, velocity by birth year, the
   attendance and broadcast money of each year, the 1998–1999 foreign tryout draft and the caps after it, overseas
   Korean players, no draft interest from abroad before 1998). */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { usdTotal } from '../src/league/contracts';
import { setEra } from '../src/league/era';
import { eraList, eraName, ERA_GIVEN_NAMES } from '../src/league/eranames';
import { autoDecision } from '../src/league/expansion';
import { boom } from '../src/league/fans';
import { broadcastPool } from '../src/league/finance';
import { createLeague } from '../src/league/history';
import { isKyopo, kyopoLimit } from '../src/league/kyopo';
import { LEGACY_ERA } from '../src/league/legacy1982';
import { eraVelocity, isForeign, withEra } from '../src/league/players';
import { withScenario } from '../src/league/scenarios';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { historicForeignCap } from '../src/rules/history';
import labels from '../src/i18n/names/korean-name-labels.json';
import type { Player } from '../src/model/types';

const settings = (): ExpansionSettings =>
  withScenario({ name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null }, 'legacy');

const history = { era: LEGACY_ERA, historical: true };

describe('names and velocity by birth decade', () => {
  it('draws from the decade around the birth year, and keeps today’s names from about 2000', () => {
    expect(eraList(1955, 0.5)).toContain('영수');
    expect(eraList(1985, 0.1)).toContain('지훈');
    expect(eraList(2006, 0.5)).toBeNull();
    // A 1969 birth goes to the 1960s or the 1970s list.
    const lists = new Set([0.1, 0.9].map((u) => eraList(1969, u)?.includes('현철')));
    expect(lists.size).toBe(2);
    const used = new Set<string>();
    expect(eraName('김민준', 1958, 'k', used).startsWith('김')).toBe(true);
    expect(eraName('남궁민준', 1958, 'k2', used).startsWith('남궁')).toBe(true);
    expect(eraName('김민준', 2003, 'k3', used)).toBe('김민준');
  });

  it('has every decade name in the name tables (English and Japanese)', () => {
    const have = new Set((labels.givenNames as string[][]).map((r) => r[0]));
    expect(ERA_GIVEN_NAMES.filter((n) => !have.has(n))).toEqual([]);
  });

  it('slows pitchers born earlier, a few outliers less', () => {
    const slow = [1950, 1960, 1970, 1980, 1990, 2000].map((y) => Math.max(...Array.from({ length: 40 }, (_, i) => eraVelocity(y, `v${i}`))));
    expect(slow).toEqual([11, 9, 6, 3, 1, 0]);
    const outliers = Array.from({ length: 700 }, (_, i) => eraVelocity(1955, `o${i}`)).filter((v) => v < 5).length / 700;
    expect(outliers).toBeGreaterThan(0.04);
    expect(outliers).toBeLessThan(0.11);
  });

  it('changes nothing in a game that does not play history', () => {
    setEra(0);
    const p = { name: '김민준', birthday: '1960-05-05', velocity: 150, origin: { kind: 'draftClass' }, amateur: { intent: 'abroad' }, id: 'x' } as unknown as Player;
    expect(withEra([p], 'k')[0]).toBe(p);
    expect(boom(2026)).toBe(1);
    expect(historicForeignCap(1999)).toBeNull();
  });
});

describe('the money of each year', () => {
  it('reads attendance and broadcast money from the calendar in a history game', () => {
    setEra(history);
    expect(boom(1982)).toBeCloseTo(0.35);
    expect(boom(1995)).toBeGreaterThan(boom(1990));
    expect(boom(2004)).toBeLessThan(boom(1995) / 2);
    expect(boom(2015)).toBeCloseTo(0.6);
    expect(boom(2026)).toBe(1);
    expect(broadcastPool(1982)).toBeLessThan(broadcastPool(2000));
    expect(broadcastPool(2014)).toBeLessThan(broadcastPool(2015));
    expect(historicForeignCap(1998)).toBe(120_000);
    expect(historicForeignCap(2005)).toBe(300_000);
    expect(historicForeignCap(2014)).toBeNull();
    setEra(0);
  });
});

/** A legacy game played from 1982 to 2000's opening day, with notes taken at each regular season's end. */
let league: LeagueState | null = null;
const ends: { year: number; kyopo: Player[]; foreign: Player[]; activeKyopo: number[] }[] = [];
const tryoutTurns: { year: number; round: number; candidates: number }[] = [];
function legacy(): LeagueState {
  if (league) return league;
  const s = createLeague('v196', undefined, LEGACY_ERA);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: settings() });
  for (let g = 0; g < 60000 && !(s.year === 2000 && s.phase === 'regular'); g++) {
    if (s.pending) {
      if (s.pending.kind === 'foreign' && s.pending.tryout) tryoutTurns.push({ year: s.year + 1, round: s.pending.round ?? 1, candidates: s.pending.candidates.length });
      apply(s, { kind: 'decide', input: autoDecision(s)! });
    } else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') {
      const on = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
      ends.push({
        year: s.year,
        kyopo: on.filter(isKyopo),
        foreign: on.filter(isForeign),
        activeKyopo: Object.values(s.rosters).map((r) => r.active.filter((id) => isKyopo(s.players[id]!)).length),
      });
      apply(s, { kind: 'postseason' });
    } else apply(s, { kind: 'nextSeason' });
  }
  setEra(0);
  return (league = s);
}

describe('a legacy game to 2000', () => {
  it('reaches 2000 with names of their decades on the first rosters', { timeout: 300_000 }, () => {
    const s = legacy();
    expect(s.year).toBe(2000);
    const first = Object.values(s.players).filter((p) => p.proSince <= 1982 && Number(p.birthday.slice(0, 4)) < 1962);
    const old = new Set(eraList(1955, 0)!.concat(eraList(1965, 0)!));
    const share = first.filter((p) => old.has(p.name.slice(1))).length / first.length;
    expect(share).toBeGreaterThan(0.8);
  });

  it('brings overseas Korean players from 1983 and holds two to a first team where the rule says so', () => {
    legacy();
    expect(ends.find((e) => e.year === 1982)!.kyopo).toHaveLength(0);
    expect(ends.find((e) => e.year === 1990)!.kyopo.length).toBeGreaterThan(0);
    setEra(history);
    for (const e of ends) {
      const limit = kyopoLimit(e.year);
      if (limit !== null) expect(Math.max(0, ...e.activeKyopo)).toBeLessThanOrEqual(limit);
    }
    setEra(0);
    for (const p of ends.at(-1)!.kyopo) expect(isForeign(p)).toBe(false);
  });

  it('drafts the foreign players of 1998 at the tryout, paid within the cap, and keeps the cap after', () => {
    legacy();
    expect(ends.filter((e) => e.year < 1998).every((e) => e.foreign.length === 0)).toBe(true);
    const f98 = ends.find((e) => e.year === 1998)!.foreign;
    expect(f98.length).toBeGreaterThanOrEqual(14);
    for (const e of ends.filter((x) => x.year >= 1998)) for (const p of e.foreign) expect(usdTotal(p.contract)).toBeLessThanOrEqual(120_000);
    expect(tryoutTurns.some((t) => t.year === 1998 && t.round === 1)).toBe(true);
  });

  it('has no draftee bound abroad before 1998', () => {
    const s = legacy();
    const abroad = Object.values(s.players).filter((p) => p.amateur.intent === 'abroad' && (p.origin.draftYear ?? 9999) < 1998);
    expect(abroad).toHaveLength(0);
  });
});
