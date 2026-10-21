/* 2.0.36 (the user's requests): the parent's move to a bigger city (the 현대 case) and mergers of failing clubs in a
   league of twelve (the 오릭스–긴테쓰 case). 2.0.37: a player who leaves for another sport and may come back, and
   development foreign players (an optional rule). */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { cityById } from '../src/club/cities';
import { MERGER, mergerDecision } from '../src/league/merger';
import { registeredIds } from '../src/league/state';
import { biggerCities, RELOCATE, relocationDecision } from '../src/league/relocation';
import type { LeagueState } from '../src/league/state';
import { DEV_FOREIGN, devForeignAfter, devForeignBefore, devForeignDecision, devForeignersOf, isDevForeign, makeDevForeign, promote, resolveDevForeign, slotOpen } from '../src/league/devforeign';
import { slotExempt, slotForeigners } from '../src/league/foreigncap';
import { developPlayer } from '../src/league/offseason';
import { OTHER_SPORT, otherSportWinter } from '../src/league/othersport';
import { ageIn, isForeign } from '../src/league/players';
import { rng } from '../src/draftroom';
import { loadSave } from './helpers';

const save = () => loadSave('2.0.30');
/** Our club in a small city, a couple of seasons on. */
const small = () => {
  const s = save();
  s.user!.settings.cityId = 'gunsan';
  s.teams.find((t) => t.id === s.user!.teamId)!.region = cityById('gunsan')!.name;
  return s;
};
const year = (s: LeagueState) => s.user!.firstTeamYear + RELOCATE.after;
const withOdds = <T>(chance: number, approve: number, f: () => T): T => {
  const c = RELOCATE.chance,
    a = RELOCATE.approve.base,
    per = RELOCATE.approve.perMarket,
    tries = RELOCATE.approve.perTry;
  RELOCATE.chance = chance;
  RELOCATE.approve.base = approve;
  RELOCATE.approve.perMarket = 0;
  RELOCATE.approve.perTry = 0;
  try {
    return f();
  } finally {
    RELOCATE.chance = c;
    RELOCATE.approve.base = a;
    RELOCATE.approve.perMarket = per;
    RELOCATE.approve.perTry = tries;
  }
};
const decide = (s: LeagueState, input: unknown) => apply(s, { kind: 'decide', input } as never);

describe('relocation (2.0.36)', () => {
  it('is proposed for a small market only, never for a citizen club', () => {
    const s = save();
    expect(withOdds(1, 1, () => relocationDecision(s, year(s)))).toBeNull();
    const t = small();
    const d = withOdds(1, 1, () => relocationDecision(t, year(t)));
    expect(d?.kind).toBe('relocate');
    if (d?.kind !== 'relocate') return;
    expect(d.target).toBe(biggerCities(t, cityById('gunsan')!.market)[0]!.id);
    const c = small();
    c.user!.settings.parentType = 'citizen';
    expect(withOdds(1, 1, () => relocationDecision(c, year(c)))).toBeNull();
  });

  it('the general manager says no: nothing moves and the parent is put out a little', () => {
    const s = small();
    const trust = s.user!.trust ?? 50;
    s.pending = withOdds(1, 1, () => relocationDecision(s, year(s)));
    decide(s, { kind: 'relocate', answer: 'refuse' });
    expect(s.user!.settings.cityId).toBe('gunsan');
    expect(s.user!.trust).toBeLessThan(trust);
  });

  it('approved: the club moves — city, ballpark, the name’s city, the fans', () => {
    const s = small();
    const me = s.teams.find((t) => t.id === s.user!.teamId)!;
    me.name = `${cityById('gunsan')!.name} 고래단`;
    // A small city's fan base (the fixture's club is Ulsan's).
    s.clubs![me.id]!.popularity = 5_000;
    const pop = s.clubs![me.id]!.popularity;
    s.pending = withOdds(1, 1, () => relocationDecision(s, year(s)));
    const target = (s.pending as { target: string }).target;
    withOdds(1, 1, () => decide(s, { kind: 'relocate', answer: 'accept' }));
    const to = cityById(target)!;
    expect(s.user!.settings.cityId).toBe(target);
    expect(me.region).toBe(to.name);
    expect(me.name.startsWith(to.name)).toBe(true);
    expect(me.stadium.name).toBe(to.stadium.name);
    expect(s.clubs![me.id]!.popularity).toBeGreaterThan(pop);
    expect(s.user!.relocations?.at(-1)).toMatchObject({ from: 'gunsan', to: target });
  });

  it('turned down: a temporary home on the way and another try each winter, or the plan dropped', () => {
    const s = small();
    s.pending = withOdds(1, 0, () => relocationDecision(s, year(s)));
    const target = (s.pending as { target: string }).target;
    withOdds(1, 0, () => decide(s, { kind: 'relocate', answer: 'accept' }));
    expect(s.pending?.kind).toBe('relocate');
    const temp = (s.pending as { temp: string }).temp;
    expect(temp).toBeTruthy();
    expect(temp).not.toBe(target);
    decide(s, { kind: 'relocate', answer: 'temporary' });
    expect(s.user!.settings.cityId).toBe(temp);
    expect(s.user!.relocation).toMatchObject({ target, temp });
    // The next winter, the board gives in.
    expect(withOdds(1, 1, () => relocationDecision(s, year(s) + 1))).toBeNull();
    expect(s.user!.settings.cityId).toBe(target);
    expect(s.user!.relocation).toBeUndefined();

    const t = small();
    t.pending = withOdds(1, 0, () => relocationDecision(t, year(t)));
    withOdds(1, 0, () => decide(t, { kind: 'relocate', answer: 'accept' }));
    const trust = t.user!.trust ?? 50;
    decide(t, { kind: 'relocate', answer: 'drop' });
    expect(t.user!.settings.cityId).toBe('gunsan');
    expect(t.user!.trust).toBeLessThan(trust);
  });
});

describe('club mergers (2.0.36)', () => {
  const setup = () => {
    const s = save();
    const me = s.user!.teamId;
    const weak = Object.keys(s.rosters).find((id) => id !== me && registeredIds(s, id).length > 20 && s.clubs?.[id])!;
    const c = s.clubs![weak]!;
    const base = c.reports[0] ?? { year: s.year - 1, fans: 0, homeGames: 72, price: 1, revenue: { gate: 1, broadcast: 1, sponsors: 1, naming: 0, merchandise: 0, concessions: 0, postseason: 0 }, expenses: { players: 0, staff: 0, frontOffice: 0, gameDays: 0, ballpark: 0, farm: 0, marketing: 0 }, operating: 0, support: 0 };
    c.reports = [1, 2, 3].map((k) => ({ ...base, year: s.year - k, support: 1e9 }));
    return { s, weak };
  };
  const odds = <T>(f: () => T): T => {
    const was = { ...MERGER };
    Object.assign(MERGER, { clubs: 2, chance: 1 });
    try {
      return f();
    } finally {
      Object.assign(MERGER, was);
    }
  };

  it('a club the parent has kept alive for three seasons is put to a vote; approved, the healthier club takes its best and a new club takes its place', () => {
    const { s, weak } = setup();
    const d = odds(() => mergerDecision(s, s.year));
    expect(d?.kind).toBe('merger');
    if (d?.kind !== 'merger') return;
    expect(d.weak).toBe(weak);
    const partner = d.partner;
    const before = { weak: registeredIds(s, weak).length, partner: registeredIds(s, partner).length };
    const oldName = s.teams.find((t) => t.id === weak)!.name;
    s.pending = d;
    odds(() => {
      MERGER.yes = 1;
      decide(s, { kind: 'merger', vote: 'yes' });
    });
    expect(s.mergers?.at(-1)).toMatchObject({ approved: true, into: partner, absorbed: oldName, teamId: weak });
    expect(s.teams.find((t) => t.id === weak)!.name).not.toBe(oldName);
    expect(registeredIds(s, weak).length).toBe(before.weak);
    expect(registeredIds(s, partner).length).toBe(before.partner);
    // Not again for a decade.
    expect(odds(() => mergerDecision(s, s.year + 1))).toBeNull();
  });

  it('turned down: the club is sold under a new name', () => {
    const { s, weak } = setup();
    s.pending = odds(() => mergerDecision(s, s.year));
    const oldName = s.teams.find((t) => t.id === weak)!.name;
    odds(() => {
      MERGER.yes = 0;
      decide(s, { kind: 'merger', vote: 'no' });
    });
    expect(s.mergers?.at(-1)).toMatchObject({ approved: false, into: null, teamId: weak });
    expect(s.teams.find((t) => t.id === weak)!.name).not.toBe(oldName);
  });

  it('a league of fewer than twelve clubs has none', () => {
    const { s } = setup();
    expect(mergerDecision(s, s.year)).toBeNull();
  });
});

describe('another sport (2.0.37)', () => {
  const odds = <T>(chance: number, back: number, f: () => T): T => {
    const was = { chance: OTHER_SPORT.chance, back: OTHER_SPORT.back.chance };
    OTHER_SPORT.chance = chance;
    OTHER_SPORT.back.chance = back;
    try {
      return f();
    } finally {
      OTHER_SPORT.chance = was.chance;
      OTHER_SPORT.back.chance = was.back;
    }
  };

  it('a player who leaves for another sport is off the roster, his club keeps his rights, and the papers have it', () => {
    const s = loadSave('2.0.34');
    odds(0.02, 0, () => otherSportWinter(s, s.year));
    const away = Object.entries(s.otherSport ?? {});
    expect(away.length).toBeGreaterThan(0);
    for (const [id, a] of away) {
      const p = s.players[id]!;
      expect(p.status).toBe('retired');
      expect(p.teamId).toBeNull();
      expect(isForeign(p)).toBe(false);
      expect(s.rosters[a.teamId]!.active.concat(s.rosters[a.teamId]!.futures, s.rosters[a.teamId]!.third)).not.toContain(id);
      expect(a.since).toBe(s.year);
      expect((s.news ?? []).some((n) => n.id === `other-sport-${s.year}-${id}`)).toBe(true);
    }
  });

  it('comes back to his old club two winters on, rusty; after five he is gone for good', () => {
    const s = loadSave('2.0.34');
    odds(0.02, 0, () => otherSportWinter(s, s.year));
    const [id, a] = Object.entries(s.otherSport!)[0]!;
    const p = s.players[id]!;
    const before = Object.values(p.hidden.current).reduce((x, y) => x + y!, 0);
    // Not the winter after: too soon.
    odds(0, 1, () => otherSportWinter(s, s.year + 1));
    expect(s.otherSport![id]).toBeDefined();
    odds(0, 1, () => otherSportWinter(s, s.year + 2));
    expect(s.otherSport![id]).toBeUndefined();
    expect(p.status).toBe('active');
    expect(p.teamId).toBe(a.teamId);
    expect(p.contract?.kind).toBe('standard');
    expect(Object.values(p.hidden.current).reduce((x, y) => x + y!, 0)).toBeLessThan(before);

    const t = loadSave('2.0.34');
    odds(0.02, 0, () => otherSportWinter(t, t.year));
    const [id2] = Object.entries(t.otherSport!)[0]!;
    for (let y = 1; y <= OTHER_SPORT.back.until; y++) odds(0, 0, () => otherSportWinter(t, t.year + y));
    expect(t.otherSport![id2]).toBeUndefined();
    expect(t.players[id2]!.status).toBe('retired');
  });
});

describe('development foreign players (2.0.37)', () => {
  const save = () => {
    const s = loadSave('2.0.34');
    s.devForeign = 2;
    return s;
  };

  it('are young, raw and well below what they may become', () => {
    for (let i = 0; i < 20; i++) {
      const p = makeDevForeign('dev-check', `x${i}`, 2030);
      expect(isForeign(p)).toBe(true);
      expect(p.origin.devForeign).toBe(true);
      const age = ageIn(p, 2030);
      expect(age).toBeGreaterThanOrEqual(DEV_FOREIGN.ages[0]);
      expect(age).toBeLessThanOrEqual(DEV_FOREIGN.ages[1] + 1);
      const cur = Object.values(p.hidden.current).reduce((a, b) => a + b!, 0),
        pot = Object.values(p.hidden.potential).reduce((a, b) => a + b!, 0);
      expect(pot - cur).toBeGreaterThan(20);
    }
  });

  it('are off by default: no prospects asked for and none signed', () => {
    const s = loadSave('2.0.34');
    expect(devForeignDecision(s, s.year + 1)).toBeNull();
    devForeignAfter(s, s.year + 1);
    expect(Object.values(s.players).some((p) => p.origin.devForeign)).toBe(false);
  });

  it('ours: chosen from a list, signed on development contracts outside the foreign slots and the cap', () => {
    const s = save();
    const u = s.user!.teamId;
    const next = s.year + 1;
    const d = devForeignDecision(s, next);
    expect(d?.kind).toBe('devForeign');
    if (d?.kind !== 'devForeign') return;
    expect(d.max).toBe(2);
    const slotsBefore = slotForeigners(s, u, next).length;
    resolveDevForeign(s, d, d.candidates.slice(0, 2), next);
    const mine = devForeignersOf(s, u);
    expect(mine.length).toBe(2);
    for (const p of mine) {
      expect(p.contract?.kind).toBe('development');
      expect(slotExempt(s, p, next)).toBe(true);
    }
    expect(slotForeigners(s, u, next).length).toBe(slotsBefore);
    // The ones not chosen are forgotten.
    for (const id of d.candidates.slice(2)) expect(s.players[id]).toBeUndefined();
    // Both places taken: nothing asked next winter.
    expect(devForeignDecision(s, next)).toBeNull();
  });

  it('grow like the club’s own youngsters', () => {
    const s = save();
    const p = makeDevForeign('dev-grow', 'g1', s.year);
    const r = rng('grow');
    const sum = () => Object.values(p.hidden.current).reduce((a, b) => a + b!, 0);
    const before = sum();
    for (let y = 0; y < 3; y++) developPlayer(p, s.year + y, 0, r);
    expect(sum()).toBeGreaterThan(before + 5);
  });

  it('the other clubs fill their places; one three seasons in goes, a ready one takes an open slot', () => {
    const s = save();
    const next = s.year + 1;
    const was = DEV_FOREIGN.aiFill;
    DEV_FOREIGN.aiFill = 1;
    try {
      devForeignAfter(s, next);
    } finally {
      DEV_FOREIGN.aiFill = was;
    }
    const ai = s.teams.find((t) => t.id !== s.user!.teamId && t.firstTeamFrom !== null && t.firstTeamFrom <= next)!;
    const theirs = devForeignersOf(s, ai.id);
    expect(theirs.length).toBe(2);
    // Three seasons later the first goes.
    const [old, ready] = theirs as [typeof theirs[0], typeof theirs[0]];
    old.proSince = next - DEV_FOREIGN.seasons;
    devForeignBefore(s, next);
    expect(s.players[old.id]?.teamId ?? null).toBeNull();
    // A slot opened and he is good enough: registered.
    // Its regular imports gone: the slots are open.
    for (const sq of ['active', 'futures', 'third'] as const)
      s.rosters[ai.id]![sq] = s.rosters[ai.id]![sq].filter((id) => !(isForeign(s.players[id]!) && !isDevForeign(s.players[id]!) && !s.players[id]!.origin.asiaQuota));
    ready.hidden.current = { ...ready.hidden.potential };
    ready.scouting.current = 60;
    for (const k of Object.keys(ready.scouting.tools)) (ready.scouting.tools as Record<string, number>)[k] = 65;
    expect(slotOpen(s, ai.id, next)).toBe(true);
    devForeignBefore(s, next);
    expect(isDevForeign(ready)).toBe(false);
    expect(ready.contract?.kind).toBe('foreign');
    expect(slotForeigners(s, ai.id, next).some((p) => p.id === ready.id)).toBe(true);
  });

  it('registered: on a foreign contract, in a slot', () => {
    const s = save();
    const p = makeDevForeign('dev-up', 'u1', s.year);
    p.contract = { teamId: s.user!.teamId, kind: 'development', signedIn: s.year - 1, signingBonus: 0, salaries: [{ season: s.year, amount: 3000 }] };
    promote(p);
    expect(p.contract.kind).toBe('foreign');
    expect(isDevForeign(p)).toBe(false);
  });
});
