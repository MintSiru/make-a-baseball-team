/* 2.0.42 (the user's requests): bigger uses for a large fund — a mega expansion past 40,000 seats, a ballpark remodel,
   investing in the city, buying the club out of its owner, more cash in a trade — and a medal for each won scenario,
   remembered for the new-game screen. */
import { afterEach, describe, expect, it } from 'vitest';
import type { Player } from '../src/model/types';
import { canNaturalize, NATURALIZE, naturalizeChance, naturalizeDecision, naturalizeWinter, resolveNaturalize } from '../src/league/naturalize';
import { finishEvent, takeNationalWatch } from '../src/league/national';
import { INTERNATIONAL } from '../src/league/international';
import { stopsOf } from '../src/league/stops';
import { apply } from '../src/league/actions';
import { traitsOf } from '../src/league/traits';
import type { Decision, LeagueState } from '../src/league/state';
import { isForeign, keepValue } from '../src/league/players';
import { megaCost, openProjects, projectOptions, startProject } from '../src/league/ballpark';
import { FACILITIES, facilityOptions, scoreboardDemand } from '../src/league/facilities';
import { parentSupport } from '../src/league/finance';
import { medalConditions, SCENARIOS, scenarioWinter } from '../src/league/scenarios';
import { checkSpend, cityGain, costOf, spend, SPEND } from '../src/league/spending';
import { clubState } from '../src/league/fans';
import { sweepProblem } from '../src/league/sweep';
import { cashValue, checkTrade } from '../src/league/trade';
import { BALLPARK, TRADES } from '../src/league/tuning';
import { hashUnit } from '../src/draftroom';
import { playAsiaSeries } from '../src/league/asiaseries';
import { NPB_CLUBS } from '../src/league/mlb';
import { removeFromRoster } from '../src/league/offseason';
import { loadSave } from './helpers';

const winter = () => {
  const s = loadSave('2.0.39');
  s.phase = 'offseason';
  s.offseason = { year: s.year, step: 0, done: [] } as never;
  s.pending = null;
  s.user!.fund = 200_000_000;
  return s;
};

describe('a mega expansion and a remodel (2.0.42)', () => {
  it('builds past 40,000 seats ten thousand at a time, each dearer', () => {
    const s = winter();
    const team = s.teams.find((t) => t.id === s.user!.teamId)!;
    team.stadium = { ...team.stadium, capacity: 30_000 };
    expect(projectOptions(s).find((o) => o.kind === 'mega')!.blocked).toBeTruthy();
    team.stadium = { ...team.stadium, capacity: BALLPARK.maxSeats };
    const first = megaCost(s);
    expect(first).toBe(BALLPARK.megaCost);
    startProject(s, 'mega');
    expect(megaCost(s)).toBeGreaterThan(first);
    openProjects(s, s.year + 1);
    expect(team.stadium.capacity).toBe(BALLPARK.maxSeats + BALLPARK.megaSeats);
  });

  it('remodels the ballpark in three levels, each drawing more people', () => {
    const s = winter();
    expect(FACILITIES.remodel.levels).toHaveLength(3);
    expect(facilityOptions(s).find((o) => o.kind === 'remodel')?.blocked).toBeNull();
    const before = scoreboardDemand(s, s.user!.teamId);
    s.user!.facilities = { ...(s.user!.facilities ?? {}), remodel: 3 };
    expect(scoreboardDemand(s, s.user!.teamId)).toBeCloseTo(before + 0.13);
  });
});

describe('investing in the city (2.0.42)', () => {
  it('grows the fan base, once a winter, a little less each time', () => {
    const s = winter();
    const c = clubState(s, s.user!.teamId);
    const pop = c.popularity;
    const gain = cityGain(s, 1);
    spend(s, 'city', 1);
    expect(c.popularity).toBe(Math.round(pop * (1 + gain)));
    expect(s.user!.fund).toBe(200_000_000 - SPEND.city.tiers[1]!.cost);
    expect(checkSpend(s, 'city', 0)).toBeTruthy();
    expect(cityGain(s, 1)).toBeCloseTo(gain * SPEND.city.fade);
  });

  it('does more for a small market than a big one', () => {
    const s = winter();
    s.user!.settings.cityId = 'seoul';
    const big = cityGain(s, 0);
    s.user!.settings.cityId = 'ulleung';
    expect(cityGain(s, 0)).toBeGreaterThan(big);
  });
});

describe('independence from the owner (2.0.42)', () => {
  it('ends the owner’s sweeps, its support and its firing', () => {
    const s = winter();
    const u = s.user!;
    u.settings.scenario = null as never;
    const cost = costOf('independence', 0, s);
    expect(cost).toBe(SPEND.independence[u.settings.parentType]);
    spend(s, 'independence');
    expect(u.independent).toBe(s.year);
    expect(u.fund).toBe(200_000_000 - cost);
    expect(sweepProblem(s, s.year)).toBe('independent');
    expect(parentSupport(s, u.teamId, 500_000, u.firstTeamYear + 1)).toBe(0);
    expect(checkSpend(s, 'independence')).toBeTruthy();
    expect(checkSpend(s, 'gift')).toBeTruthy();
  });

  it('is closed in a scenario where the owner’s verdict is the goal', () => {
    const s = winter();
    s.user!.settings.scenario = 'comeback';
    expect(checkSpend(s, 'independence')).toBeTruthy();
  });
});

describe('cash in a trade (2.0.42)', () => {
  it('lets us give up to 100억, counting what is past 20억 at half', () => {
    expect(cashValue(200_000)).toBeCloseTo(20);
    expect(cashValue(1_000_000)).toBeCloseTo(20 + 40);
    const s = loadSave('2.0.39');
    s.phase = 'offseason';
    s.pending = null;
    s.user!.fund = 5_000_000;
    const other = s.teams.find((t) => t.id !== s.user!.teamId && s.rosters[t.id])!.id;
    const theirs = s.rosters[other]!.active.find((id) => s.players[id]!.origin.kind !== 'foreign')!;
    const big = checkTrade(s, other, [], [theirs], { cashOut: 1_000_000 });
    expect(big.problem ?? '').not.toContain(String(TRADES.cash.max / 10_000));
    const tooBig = checkTrade(s, other, [], [theirs], { cashOut: 1_010_000 });
    expect(tooBig.problem).toBeTruthy();
    const receive = checkTrade(s, other, [theirs], [], { cashIn: 300_000 });
    expect(receive.problem).toBeTruthy();
  });
});

describe('scenario medals (2.0.42)', () => {
  it('names three conditions for every scenario with a goal', () => {
    for (const def of SCENARIOS) expect(medalConditions(def)).toHaveLength(def.free ? 0 : 3);
  });

  it('gives a medal by how soon the title came', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    u.settings.scenario = 'recession';
    u.scenario = { status: 'active' };
    u.fired = undefined;
    const year = s.history.at(-1)!.year;
    s.history.at(-1)!.champion = u.teamId;
    u.firstTeamYear = year - 1; // the second season: gold (within 2 of 5)
    scenarioWinter(s, year);
    expect(u.scenario.status).toBe('won');
    expect(u.scenario.medal).toBe('gold');
    u.scenario = { status: 'active' };
    u.firstTeamYear = year - 4; // the fifth: bronze
    scenarioWinter(s, year);
    expect(u.scenario.medal).toBe('bronze');
  });
});

describe('the Asia Series (2.0.42)', () => {
  it('is off unless set', () => {
    const s = loadSave('2.0.39');
    expect(playAsiaSeries(s, s.year, s.user!.teamId)).toBeNull();
  });

  it('plays a round robin and a final, with a KBO player of the NPB champion in it', () => {
    const s = loadSave('2.0.39');
    s.asiaSeries = true;
    const me = s.user!.teamId;
    // One of ours went to the NPB club that will win Japan this year.
    const key = `${s.seed}|asia|${s.year}`;
    const npb = NPB_CLUBS[Math.floor(hashUnit(`${key}|npb`) * NPB_CLUBS.length)]!;
    const p = Object.values(s.players).find((x) => x.teamId === me && x.status === 'active' && x.origin.kind !== 'foreign' && x.role !== 'SP' && x.role !== 'RP' && x.career.some((c) => !c.level))!;
    // His last KBO season was ours.
    p.career.filter((c) => !c.level).at(-1)!.teamId = me;
    removeFromRoster(s, p);
    p.teamId = null;
    p.status = 'overseas';
    p.mlb = { posted: s.year - 1, years: 3, total: 1_000_000, club: npb, seasons: [], league: 'npb' };
    const x = playAsiaSeries(s, s.year, me)!;
    expect(x).not.toBeNull();
    expect(x.games).toHaveLength(7);
    expect(x.games.filter((g) => g.home === 'kbo' || g.away === 'kbo').length).toBeGreaterThanOrEqual(3);
    expect(x.exKbo).toContain(p.id);
    expect(x.boxes!.some((b) => JSON.stringify(b).includes(p.id))).toBe(true);
    expect((s.news ?? []).some((n) => n.id === `asia-${s.year}`)).toBe(true);
    expect((s.alerts ?? []).some((a) => a.id === `asia-ex-${s.year}-${p.id}`)).toBe(true);
    // Once a year.
    expect(playAsiaSeries(s, s.year, me)).toBeNull();
  });
});

describe('naturalization (2.0.42)', () => {
  const keep = { ...NATURALIZE };
  afterEach(() => Object.assign(NATURALIZE, keep));
  const veteran = (s: ReturnType<typeof loadSave>, p: Player, seasons: number) => {
    const row = p.career.find((c) => !c.level) ?? null;
    if (!row) return false;
    p.career = Array.from({ length: seasons }, (_, i) => ({ ...row, year: s.year - i, teamId: p.teamId! }));
    p.birthday = `${s.year - 32}-05-01`;
    return true;
  };

  it('makes another club’s long-serving foreign player a domestic one, with news', () => {
    const s = loadSave('2.0.39');
    const me = s.user!.teamId;
    NATURALIZE.chance = 1;
    NATURALIZE.most = 1;
    const p = Object.values(s.players).find((x) => isForeign(x) && x.teamId && x.teamId !== me && x.status === 'active' && keepValue(x, s.year + 1) >= 45 && x.career.some((c) => !c.level))!;
    expect(veteran(s, p, 6)).toBe(true);
    expect(canNaturalize(s, p, s.year + 1)).toBe(true);
    naturalizeWinter(s, s.year + 1);
    expect(isForeign(p)).toBe(false);
    expect(p.origin.naturalized?.year).toBe(s.year);
    expect(p.contract?.kind).toBe('multiYear');
    expect(p.contract?.salaries).toHaveLength(NATURALIZE.years);
    expect((s.news ?? []).some((n) => n.id === `naturalize-${p.id}`)).toBe(true);
  });

  it('asks us first about ours, and backing him frees a foreign place', () => {
    const s = loadSave('2.0.39');
    const me = s.user!.teamId;
    NATURALIZE.chance = 1;
    NATURALIZE.most = 1;
    const p = Object.values(s.players).find((x) => isForeign(x) && x.teamId === me && x.status === 'active' && x.career.some((c) => !c.level))!;
    expect(veteran(s, p, 5)).toBe(true);
    const next = s.year + 1;
    const d = naturalizeDecision(s, next);
    expect(d?.kind).toBe('naturalize');
    if (d?.kind !== 'naturalize') return;
    expect(d.id).toBe(p.id);
    // Asked once a winter.
    expect(naturalizeDecision(s, next)).toBeNull();
    resolveNaturalize(s, d, 'support', next);
    expect(isForeign(p)).toBe(false);
    expect(p.teamId).toBe(me);
  });

  it('leaves a short-serving foreign player alone', () => {
    const s = loadSave('2.0.39');
    NATURALIZE.chance = 1;
    NATURALIZE.most = 1;
    const p = Object.values(s.players).find((x) => isForeign(x) && x.teamId && x.status === 'active' && x.career.some((c) => !c.level))!;
    veteran(s, p, 4);
    expect(canNaturalize(s, p, s.year + 1)).toBe(false);
  });
});

describe('naturalization and loyalty (2.0.42)', () => {
  it('is likelier for a devoted player, and for years with his club', () => {
    const s = loadSave('2.0.39');
    const p = Object.values(s.players).find((x) => isForeign(x) && x.teamId && x.career.some((c) => !c.level))!;
    const row = p.career.find((c) => !c.level)!;
    p.career = Array.from({ length: 6 }, (_, i) => ({ ...row, year: s.year - i, teamId: i < 3 ? p.teamId! : 'other' }));
    p.hidden.traits = { ...traitsOf(p) };
    const traits = p.hidden.traits as unknown as Record<string, number>;
    traits.loyalty = 30;
    const cool = naturalizeChance(p);
    traits.loyalty = 85;
    const warm = naturalizeChance(p);
    expect(warm).toBeGreaterThan(cool);
    p.career = p.career.map((c) => ({ ...c, teamId: p.teamId! }));
    p.career.push({ ...row, year: s.year - 6, teamId: p.teamId! }, { ...row, year: s.year - 7, teamId: p.teamId! });
    expect(naturalizeChance(p)).toBeGreaterThan(warm);
    expect(naturalizeChance(p)).toBeLessThanOrEqual(NATURALIZE.most * NATURALIZE.loyalMost);
  });
});

/** The decision waiting (read through a call: the test set it to null above). */
const pendingOf = (x: LeagueState) => x.pending;

describe('watching the national team (2.0.42)', () => {
  it('stops when a tournament is over, to watch its deciding game or go on', () => {
    const s = loadSave('2.0.39');
    s.pending = null;
    const e = INTERNATIONAL.find((x) => x.year >= s.year && !s.international.some((y) => y.id === x.id && y.finish))!;
    finishEvent(s, e);
    expect(s.nationalWatchDue).toBe(e.id);
    expect(takeNationalWatch(s)).toBe(true);
    const d = pendingOf(s) as Extract<Decision, { kind: 'nationalWatch' }>;
    expect(d.kind).toBe('nationalWatch');
    const entry = s.international.find((x) => x.id === e.id)!;
    expect(entry.watch!.games.some((g) => g.id === d.gameId)).toBe(true);
    expect(entry.watch!.boxes!.length).toBeGreaterThan(0);
    apply(s, { kind: 'decide', input: { kind: 'nationalWatch', answer: 'skip' } });
    expect(pendingOf(s)?.kind).not.toBe('nationalWatch');
    expect(takeNationalWatch(s)).toBe(false);
  });

  it('does not stop when the stop is off', () => {
    const s = loadSave('2.0.39');
    s.user!.settings.stops = stopsOf(s).filter((k) => k !== 'national');
    const e = INTERNATIONAL.find((x) => x.year >= s.year && !s.international.some((y) => y.id === x.id && y.finish))!;
    finishEvent(s, e);
    expect(s.nationalWatchDue).toBeUndefined();
  });
});
