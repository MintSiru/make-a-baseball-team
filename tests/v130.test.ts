/* 1.3.0: the postseason game by game with our plan for each game, talks with foreign players, and the draft combine. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { applyCombine, attends, checkWorkout, combineHeld, combineLines } from '../src/league/combine';
import { usdTotal } from '../src/league/contracts';
import { autoDecision, checkDecision, newSigningCap } from '../src/league/expansion';
import { floorOf, renewAccepts, reply, suggestedOffer, termsFor, type ForeignTerms } from '../src/league/foreigntalks';
import { createLeague } from '../src/league/history';
import { matchInputs } from '../src/league/manager';
import { draftClass, makeForeign } from '../src/league/players';
import { playPostseason, postseasonDay, postseasonRound, startPostseason } from '../src/league/postseason';
import { traitReport } from '../src/league/reports';
import { playRegularSeason } from '../src/league/season';
import type { Decision, LeagueState } from '../src/league/state';
import { COMBINE, ENGINE } from '../src/league/tuning';
import type { Player } from '../src/model/types';
import { parseSave } from '../src/save/format';

const loadSave = () => parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.2.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
const clone = (s: LeagueState) => JSON.parse(JSON.stringify(s)) as LeagueState;

describe('the postseason, game day by game day', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = createLeague('v130-post');
    playRegularSeason(s);
  }, 300_000);

  it('comes out the same as playing it all at once', () => {
    const a = clone(s),
      b = clone(s);
    playPostseason(a);
    startPostseason(b);
    expect(b.phase).toBe('postseason');
    expect(b.postseason).toHaveLength(0);
    expect(b.bracket!.live[0]!.round).toBe('wildcard');
    let days = 0;
    while (postseasonDay(b)) days++;
    expect(days).toBeGreaterThan(5);
    expect(b.postseason).toEqual(a.postseason);
    expect(b.arms).toEqual(a.arms);
    expect(b.postseason.map((x) => x.round)).toEqual(['wildcard', 'semipo', 'po', 'ks']);
  });

  it('stops at the end of a round', () => {
    const b = clone(s);
    startPostseason(b);
    postseasonRound(b);
    expect(b.postseason.map((x) => x.round)).toEqual(['wildcard']);
    expect(b.bracket!.live[0]!.round).toBe('semipo');
    expect(b.bracket!.live[0]!.low).toBe(b.postseason[0]!.winner);
  });

  it('with two leagues: each league winner against the other runner-up, then the Korean Series', () => {
    const b = clone(s);
    const ids = b.teams.map((t) => t.id);
    b.twelve = { teamId: ids[0]!, cityId: 'x', founded: 2020, firstTeam: 2021, format: 'two', gm: 'balanced', manager: 'balanced', leagues: Object.fromEntries(ids.map((id, i) => [id, i % 2 ? 'magic' : 'dream'])) } as never;
    playPostseason(b);
    const rounds = b.postseason.map((x) => x.round);
    expect(rounds.filter((r) => r === 'po')).toHaveLength(2);
    expect(rounds.at(-1)).toBe('ks');
    const ks = b.postseason.at(-1)!;
    const po = b.postseason.filter((x) => x.round === 'po');
    expect([ks.high, ks.low].sort()).toEqual(po.map((x) => x.winner).sort());
    expect(b.bracket!.done).toBe(true);
  });
});

describe('our plan for a postseason game', () => {
  it('starts the pitcher we chose, and goes all out with a short leash and a deeper bullpen', () => {
    const s = loadSave();
    const u = s.user!;
    const other = s.teams.find((t) => t.id !== u.teamId && s.rosters[t.id])!.id;
    const date = s.schedule[s.next]!.date;
    // The starter with the most stamina, so a shorter leash shows.
    const arms = s.rosters[u.teamId]!.active.map((id) => s.players[id]!).filter((p) => p.role === 'SP');
    const chosen = [...arms].sort((a, b) => (b.hidden.current.stamina ?? 0) - (a.hidden.current.stamina ?? 0))[0]!;
    s.phase = 'postseason';
    const plain = matchInputs(clone(s), date, { teamId: u.teamId }, { teamId: other }).home!;
    u.postPlan = { starter: chosen.id };
    const mine = matchInputs(clone(s), date, { teamId: u.teamId }, { teamId: other }).home!;
    expect(mine.starter.id).toBe(chosen.id);
    u.postPlan = { starter: chosen.id, allOut: true };
    const allOut = matchInputs(clone(s), date, { teamId: u.teamId }, { teamId: other }).home!;
    expect(allOut.starter.pitchLimit).toBeLessThan(mine.starter.pitchLimit);
    expect(allOut.starter.pitchLimit - mine.starter.pitchLimit).toBeGreaterThanOrEqual(Math.max(ENGINE.hook.allOut, 55 - mine.starter.pitchLimit));
    expect(allOut.bullpen.length).toBeGreaterThan(plain.bullpen.length);
    // Off the season, or for another club, the plan does nothing.
    s.phase = 'regular';
    expect(matchInputs(clone(s), date, { teamId: u.teamId }, { teamId: other }).home!.starter.id).toBe(plain.starter.id);
  });

  it('is set and cleared by actions, our players only', () => {
    const s = loadSave();
    const u = s.user!;
    s.phase = 'postseason';
    const mine = s.rosters[u.teamId]!.active.find((id) => s.players[id]!.role === 'SP')!;
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== u.teamId && p.role === 'SP')!.id;
    apply(s, { kind: 'postPlan', starter: theirs, allOut: true });
    expect(u.postPlan).toEqual({ allOut: true });
    apply(s, { kind: 'postPlan', starter: mine });
    expect(u.postPlan).toEqual({ starter: mine, allOut: true });
    apply(s, { kind: 'postPlan', starter: null });
    expect(u.postPlan!.starter).toBeUndefined();
  });
});

describe('talks with foreign players', () => {
  const p = makeForeign('v130', 'ft1', 2028, { kind: 'pitcher', asiaQuota: false });
  const t = termsFor('v130', 2028, p, 900_000);

  it('draw the terms once: an ask below the listed total, a fee within the range, sometimes an offer elsewhere', () => {
    expect(termsFor('v130', 2028, p, 900_000)).toEqual(t);
    expect(t.ask).toBeLessThan(900_000);
    expect(t.ask).toBeGreaterThan(700_000);
    expect(t.fee).toBeGreaterThanOrEqual(0);
    expect(t.fee).toBeLessThanOrEqual(300_000);
    const many = Array.from({ length: 400 }, (_, i) => termsFor('v130', 2028, makeForeign('v130', `f${i}`, 2028, { kind: i % 2 ? 'hitter' : 'pitcher', asiaQuota: false }), 800_000));
    const share = (f: (x: ForeignTerms) => boolean) => many.filter(f).length / many.length;
    expect(share((x) => x.fee > 0)).toBeGreaterThan(0.15);
    expect(share((x) => x.fee > 0)).toBeLessThan(0.6);
    expect(share((x) => !!x.rival)).toBeGreaterThan(0.1);
  });

  it('take an offer worth the floor, counter one within reach, walk from a lowball', () => {
    const terms = { ...t, rival: null, patience: 3 };
    const floor = floorOf(terms);
    expect(reply(terms, { guaranteed: floor, options: 0 }, 1, 'k').kind).toBe('accept');
    // Options count at half.
    expect(reply(terms, { guaranteed: floor - 100_000, options: 200_000 }, 1, 'k').kind).toBe('accept');
    const c = reply(terms, { guaranteed: Math.round(floor * 0.92), options: 0 }, 1, 'k');
    expect(c.kind).toBe('counter');
    if (c.kind === 'counter') {
      expect(c.amount).toBeGreaterThanOrEqual(Math.round(floor / 10_000) * 10_000);
      // Meeting the counter next round closes it.
      expect(reply({ ...terms, counter: c.amount }, { guaranteed: c.amount, options: 0 }, 2, 'k').kind).toBe('accept');
    }
    expect(reply(terms, { guaranteed: Math.round(floor * 0.6), options: 0 }, 1, 'k').kind).toBe('walk');
    // Out of patience, no more counters.
    expect(reply({ ...terms, patience: 1 }, { guaranteed: Math.round(floor * 0.92), options: 0 }, 1, 'k').kind).toBe('walk');
    // An offer elsewhere raises the floor.
    expect(floorOf({ ...terms, rival: { label: '일본 구단', value: floor + 300_000 } })).toBe(floor + 300_000);
  });

  it('suggest his ask within the cap, the fee on top', () => {
    const cap = newSigningCap(p);
    const o = suggestedOffer({ ...t, ask: 950_000, fee: 200_000 }, cap);
    expect(o.guaranteed).toBe(cap - 200_000);
  });

  it('re-sign a loyal player for less than he asks, a younger one less keen on two years', () => {
    const q = makeForeign('v130', 'ft2', 2028, { kind: 'hitter', asiaQuota: false });
    q.hidden.traits!.loyalty = 90;
    expect(renewAccepts(q, 1_000_000, 900_000, 1, 30)).toBe(true);
    q.hidden.traits!.loyalty = 10;
    expect(renewAccepts(q, 1_000_000, 900_000, 1, 30)).toBe(false);
    q.hidden.traits!.loyalty = 50;
    expect(renewAccepts(q, 1_000_000, 960_000, 2, 33)).toBe(true);
    expect(renewAccepts(q, 1_000_000, 960_000, 2, 26)).toBe(false);
  });
});

describe('a winter with the combine and the foreign talks', () => {
  let s: LeagueState;
  let talks: Extract<Decision, { kind: 'foreign' }> | null = null;
  const rounds: number[] = [];
  beforeAll(() => {
    s = loadSave();
    let worked = false;
    for (let g = 0; g < 5000 && !(s.year === 2028 && s.phase === 'regular'); g++) {
      if (s.year === 2027 && s.phase === 'regular' && !worked && combineHeld(s, 2027)) {
        const top = applyCombine(s.seed, 2027, draftClass(s.seed, 2027)).find((p) => attends(s.seed, 2027, p))!;
        apply(s, { kind: 'workout', draftYear: 2027, id: top.id, name: top.name });
        worked = true;
      }
      if (s.pending) {
        const d = s.pending;
        if (d.kind === 'foreign' && d.terms) {
          rounds.push(d.round ?? 1);
          if (!talks) talks = JSON.parse(JSON.stringify(d));
          // First round: a lowball to the first candidate, so the talks go on; then the scouts' way.
          if ((d.round ?? 1) === 1 && d.regular + d.asia > 0) {
            const lowball = (id: string) => ({ kind: 'foreign' as const, ids: [id], offers: { [id]: { guaranteed: Math.round((floorOf(d.terms![id]!) * 0.9) / 10_000) * 10_000, options: 0 } } });
            const id = d.candidates.find((x) => checkDecision(s, lowball(x)) === null);
            if (id) {
              apply(s, { kind: 'decide', input: lowball(id) });
              continue;
            }
          }
        }
        apply(s, { kind: 'decide', input: autoDecision(s)! });
        continue;
      }
      if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'days', days: 6 });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
  }, 900_000);

  it('holds the combine on its day and lets us work out a prospect once', () => {
    expect((s.news ?? []).some((n) => n.id === 'combine-2027')).toBe(true);
    const id = s.user!.workouts?.[2027]?.[0];
    expect(id).toBeDefined();
    expect(s.user!.ledger.some((l) => l.label.endsWith('개인 워크아웃') && l.amount === -COMBINE.workoutCost)).toBe(true);
  });

  it('drafts from the reports the combine moved', () => {
    const drafted = Object.values(s.players).filter((p) => p.origin.draftYear === 2027 && p.scouting.combine);
    expect(drafted.length).toBeGreaterThan(20);
  });

  it('runs the foreign talks in rounds, with the fee on the contract', () => {
    expect(talks).not.toBeNull();
    expect(rounds[0]).toBe(1);
    if (rounds.length > 1) expect(rounds[1]).toBe(2);
    expect(Math.max(...rounds)).toBeLessThanOrEqual(3);
    const ours = Object.values(s.players).filter((p) => p.teamId === s.user!.teamId && p.origin.kind === 'foreign');
    for (const p of ours) expect(usdTotal(p.contract)).toBeLessThanOrEqual(p.contract!.usd!.fee ? newSigningCap(p) : Infinity);
  });
});

describe('the combine', () => {
  const players = draftClass('v130-combine', 2029);

  it('measures the top of the class, a few staying away', () => {
    const came = players.filter((p) => attends('v130-combine', 2029, p));
    expect(came.length).toBeGreaterThan(COMBINE.invited * 0.75);
    expect(came.length).toBeLessThanOrEqual(COMBINE.invited);
    for (const p of came) expect(p.amateur.draftRank).toBeLessThanOrEqual(COMBINE.invited);
    const lines = combineLines('v130-combine', 2029, came[0]!);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(combineLines('v130-combine', 2029, came[0]!)).toEqual(lines);
  });

  it('brings the public report closer to the truth, once', () => {
    const before = draftClass('v130-combine', 2029);
    const after = applyCombine('v130-combine', 2029, draftClass('v130-combine', 2029));
    const err = (xs: Player[]) =>
      xs
        .filter((p) => attends('v130-combine', 2029, p))
        .flatMap((p) => Object.keys(p.hidden.current).map((k) => Math.abs(((p.scouting.tools as Record<string, number>)[k] ?? 0) - ((p.hidden.current as Record<string, number>)[k] ?? 0))))
        .reduce((a, b) => a + b, 0);
    expect(err(after)).toBeLessThan(err(before));
    const again = JSON.stringify(applyCombine('v130-combine', 2029, after));
    expect(again).toBe(JSON.stringify(after));
  });

  it('lets our scouts read a worked-out prospect better', () => {
    const s = loadSave();
    const pool = players.slice(0, 150);
    const truth = (v: number) => (v >= 80 ? 5 : v >= 62 ? 4 : v >= 38 ? 3 : v >= 20 ? 2 : 1);
    /** How far the reads of the five plain traits miss, in levels, over the pool. */
    const miss = () =>
      pool
        .flatMap((p) => (['genius', 'work', 'mental', 'leadership', 'loyalty'] as const).map((k) => Math.abs((traitReport(s, p)!.reads.find((r) => r.key === k)!.level ?? 3) - truth(p.hidden.traits![k]))))
        .reduce((a, b) => a + b, 0);
    const before = miss();
    (s.user!.workouts ??= {})[2029] = pool.map((p) => p.id);
    expect(miss()).toBeLessThan(before);
    expect(checkWorkout(s, 2029, 'someone-else')).toBe('올해 드래프트 후보가 아닙니다.');
  });
});
