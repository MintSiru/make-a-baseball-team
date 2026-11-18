/* 2.0.88 (the user's requests): ① fewer foreign places next season (the board cut them): we choose whom to let go;
   ② a stand-in for a long-injured foreign player still standing in at the season's end: the one we chose stays. */
import { afterEach, describe, expect, it } from 'vitest';
import { setEraBoard } from '../src/league/era';
import { autoDecision, checkDecision, decide, resolveDecision } from '../src/league/expansion';
import { OFFSEASON_STEPS } from '../src/league/offseason';
import { isForeign, makeForeign } from '../src/league/players';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { endTemps } from '../src/league/tempforeign';
import { foreignSlots } from '../src/league/manager';
import { rulesFor } from '../src/rules/history';
import { loadSave } from './helpers';

afterEach(() => setEraBoard([]));

/** The winter after the save's season, at the limits step. */
function atLimits(s: LeagueState) {
  s.phase = 'offseason';
  s.pending = null;
  const i = OFFSEASON_STEPS.indexOf('limits');
  s.offseason = { year: s.year, step: i, draft: null, released: [], done: OFFSEASON_STEPS.slice(0, i) as string[] } as never;
}

describe('2.0.88: whom to let go when the foreign places shrink', () => {
  it('asks us, with the counts to let go; the ones we pick leave, the others stay', () => {
    const s = loadSave('2.0.87');
    const me = s.user!.teamId;
    const next = s.year + 1;
    // A third regular foreign player of ours under contract next season too.
    const extra = makeForeign(s.seed, 'v2088-third', s.year, { kind: 'hitter', asiaQuota: false });
    extra.teamId = me;
    extra.status = 'active';
    extra.contract = { teamId: me, kind: 'foreign', signedIn: s.year - 1, signingBonus: 0, salaries: [{ season: s.year, amount: 9000 }, { season: next, amount: 9000 }] } as never;
    s.players[extra.id] = extra;
    s.rosters[me]!.futures.push(extra.id);
    const regular = orgPlayers(s, me).filter((p) => isForeign(p) && !p.origin.asiaQuota && !p.contract?.temp);
    expect(regular.length).toBe(3);
    // Next season: one regular place fewer than we have (a new club's extra place during its benefit seasons counts).
    const bonus = foreignSlots(s, me, next).regular - rulesFor(next).foreign.hold;
    const changes = [{ from: next, item: 'foreign' as const, value: regular.length - 1 - bonus }];
    s.board = { on: true, since: s.year - 1, changes, log: [] };
    setEraBoard(changes);
    atLimits(s);
    const d = decide(s, 'limits')!;
    expect(d.kind).toBe('foreignCut');
    if (d.kind !== 'foreignCut') return;
    expect(d.regular).toBe(1);
    expect(d.asia).toBe(0);
    s.pending = d;
    // The scouts' pick is the least valuable; we pick the best one instead.
    expect(autoDecision(s)!.kind).toBe('foreignCut');
    expect(checkDecision(s, { kind: 'foreignCut', ids: [] })).not.toBeNull();
    expect(checkDecision(s, { kind: 'foreignCut', ids: regular.slice(0, 2).map((p) => p.id) })).not.toBeNull();
    const best = [...regular].sort((a, b) => b.scouting.current - a.scouting.current)[0]!;
    resolveDecision(s, { kind: 'foreignCut', ids: [best.id] });
    expect(best.teamId).not.toBe(me);
    for (const p of regular.filter((x) => x !== best)) expect(p.teamId).toBe(me);
  }, 300_000);
});

describe('2.0.88: a stand-in at the season’s end', () => {
  function standIn(s: LeagueState, keep?: 'temp' | 'injured') {
    const me = s.user!.teamId;
    const injured = orgPlayers(s, me).find((p) => isForeign(p) && !p.origin.asiaQuota && !p.contract?.temp)!;
    s.injuries[injured.id] = { until: `${s.year + 1}-05-01`, days: 200, onList: true, part: '팔꿈치' };
    const temp = makeForeign(s.seed, `v2088-temp-${keep ?? 'none'}`, s.year, { kind: 'pitcher', asiaQuota: false });
    temp.teamId = me;
    temp.status = 'active';
    temp.contract = { teamId: me, kind: 'foreign', signedIn: s.year, signingBonus: 0, salaries: [{ season: s.year, amount: 3000 }], temp: true } as never;
    s.players[temp.id] = temp;
    s.rosters[me]!.futures.push(temp.id);
    (s.tempForeign ??= []).push({ teamId: me, id: temp.id, for: injured.id, from: `${s.year}-06-01`, ...(keep ? { keep } : {}) });
    return { injured, temp, me };
  }

  it('the stand-in kept: he stays (his deal ends with the season), the injured player goes, no replacement counted', () => {
    const s = loadSave('2.0.87');
    const { injured, temp, me } = standIn(s, 'temp');
    const changes = s.foreignChanges?.[me] ?? 0;
    endTemps(s);
    expect(temp.teamId).toBe(me);
    expect(temp.contract?.temp).toBeFalsy();
    expect(injured.teamId).not.toBe(me);
    expect(s.foreignChanges?.[me] ?? 0).toBe(changes);
    expect(s.tempForeign ?? []).toHaveLength(0);
  });

  it('by default (the injured player): the stand-in leaves', () => {
    const s = loadSave('2.0.87');
    const { injured, temp, me } = standIn(s);
    endTemps(s);
    expect(injured.teamId).toBe(me);
    expect(temp.teamId).not.toBe(me);
  });
});
