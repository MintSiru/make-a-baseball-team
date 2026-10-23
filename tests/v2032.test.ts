/* 2.0.32 (the user's request): the fall instructional league, a winter in Australia and the wrap-up camp as stages of
   the winter of their own, after the November national team and the sponsor (development.ts). */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision, resolveDecision } from '../src/league/expansion';
import { advanceOffseason, OFFSEASON_STEPS } from '../src/league/offseason';
import { DEV, devCandidates, sendDev } from '../src/league/development';
import type { LeagueState } from '../src/league/state';

const base = createLeague('v2032');

const winter = (): LeagueState => {
  const s = structuredClone(base);
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
  s.pending = null;
  s.phase = 'offseason';
  // The winter's steps before the national team done; the November events and the sponsor out of the way.
  const at = OFFSEASON_STEPS.indexOf('international');
  s.offseason = { year: s.year, step: at, draft: null, released: [], done: [...OFFSEASON_STEPS.slice(0, at)] };
  s.user!.sponsorPending = false;
  s.user!.fund = 1_000_000;
  const r = s.rosters[s.user!.teamId]!;
  const young = Object.values(s.players).filter((p) => p.teamId === 'lg' && p.status === 'active' && p.origin.kind === 'draftClass').slice(0, 6);
  for (const p of young) {
    p.teamId = s.user!.teamId;
    p.birthday = `${s.year - 21}-05-01`;
    r.futures.push(p.id);
  }
  return s;
};

/** The winter up to its first decision that is not a national team's. */
const toDev = (s: LeagueState) => {
  advanceOffseason(s);
  while (s.pending?.kind === 'national') resolveDecision(s, autoDecision(s)!);
};

describe('the winter programmes as stages (2.0.32)', () => {
  it('come one after another in the national team step: the fall league, Australia, the wrap-up camp', () => {
    const s = winter();
    toDev(s);
    const d = s.pending!;
    expect(d.kind).toBe('devFall');
    if (d.kind !== 'devFall') return;
    expect(d.max).toBe(DEV.fall.max);
    expect(d.candidates.length).toBeGreaterThanOrEqual(3);
    // Someone not on the list, or more than the fund pays for, refused; two of them sent.
    expect(checkDecision(s, { kind: 'devFall', ids: ['nobody'] })).not.toBeNull();
    const rich = s.user!.fund;
    s.user!.fund = DEV.fall.cost;
    expect(checkDecision(s, { kind: 'devFall', ids: d.candidates.slice(0, 2) })).not.toBeNull();
    s.user!.fund = rich;
    const two = d.candidates.slice(0, 2);
    const fund = s.user!.fund;
    expect(checkDecision(s, { kind: 'devFall', ids: two })).toBeNull();
    resolveDecision(s, { kind: 'devFall', ids: two });
    expect(s.user!.fund).toBe(fund - 2 * DEV.fall.cost);
    for (const id of two) expect(s.players[id]!.devLog?.at(-1)?.kind).toBe('fall');
    // Australia next; nobody goes.
    expect(s.pending?.kind).toBe('devAbl');
    resolveDecision(s, { kind: 'devAbl', ids: [] });
    expect(s.user!.dev?.abl).toBeUndefined();
    expect(s.user!.fund).toBe(fund - 2 * DEV.fall.cost);
    // Then the camp, at a place picked.
    expect(s.pending?.kind).toBe('wrapUp');
    resolveDecision(s, { kind: 'wrapUp', site: 'guam' });
    expect(s.user!.dev?.camp).toMatchObject({ year: s.offseason!.year, site: 'guam' });
    // 2.0.42: then the November tournament's games, watched or not.
    if (s.pending?.kind === 'nationalWatch') resolveDecision(s, { kind: 'nationalWatch', answer: 'skip' });
    // And the winter goes on to its next step.
    expect(['devFall', 'devAbl', 'wrapUp']).not.toContain(s.pending?.kind);
    expect(s.offseason!.step).toBeGreaterThan(OFFSEASON_STEPS.indexOf('international'));
  });

  it('left to the scouts, nobody goes and nothing is spent', () => {
    const s = winter();
    toDev(s);
    const fund = s.user!.fund;
    for (const kind of ['devFall', 'devAbl', 'wrapUp']) {
      expect(s.pending?.kind).toBe(kind);
      resolveDecision(s, autoDecision(s)!);
    }
    expect(['devFall', 'devAbl', 'wrapUp']).not.toContain(s.pending?.kind);
    expect(s.user!.fund).toBe(fund);
    expect(s.user!.dev).toBeUndefined();
  });

  it('skips what was already done this year from the training tab', () => {
    const s = winter();
    sendDev(s, 'fall', devCandidates(s, 'fall').slice(0, 1).map((p) => p.id));
    toDev(s);
    expect(s.pending?.kind).toBe('devAbl');
  });

  it('comes after the sponsor when there is one to choose', () => {
    const s = winter();
    s.user!.sponsorPending = true;
    toDev(s);
    expect(s.pending?.kind).toBe('sponsor');
    resolveDecision(s, autoDecision(s)!);
    expect(s.pending?.kind).toBe('devFall');
  });
});
