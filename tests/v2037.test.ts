/* 2.0.37 (the user's requests): the parent's move to a bigger city (the 현대 case) and mergers of failing clubs in a
   league of twelve (the 오릭스–긴테쓰 case). */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { cityById } from '../src/club/cities';
import { MERGER, mergerDecision } from '../src/league/merger';
import { registeredIds } from '../src/league/state';
import { biggerCities, RELOCATE, relocationDecision } from '../src/league/relocation';
import type { LeagueState } from '../src/league/state';
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

describe('relocation (2.0.37)', () => {
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

describe('club mergers (2.0.37)', () => {
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
