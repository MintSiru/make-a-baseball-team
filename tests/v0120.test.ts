/* V0.12: positions that fit, foreign names, uniform numbers, a future that moves, more national-team events and the
   club's say on call-ups, scandals with warning signs, an investor's claim, and the owner's budget. */
import { beforeAll, describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { disputeDecision, resolveDispute } from '../src/league/dispute';
import { clubState } from '../src/league/fans';
import { clubReport, openBooks, settleFinances } from '../src/league/finance';
import { createLeague } from '../src/league/history';
import { eventById, eventsIn, INTERNATIONAL, timing } from '../src/league/international';
import { offRoster } from '../src/league/injuries';
import { finishEvent, resolveNational, selectNationalTeam } from '../src/league/national';
import { checkNumber, setNumber } from '../src/league/numbers';
import { ageIn, draftClass, isForeign, isPitcher, makeForeign } from '../src/league/players';
import { balanceDepth, positionMove } from '../src/league/positions';
import { checkInspect, inspect, scandalDay, serveSuspensions, suspended } from '../src/league/scandals';
import { driftPotential, seasonStep } from '../src/league/scouting';
import { playDay } from '../src/league/season';
import { orgPlayers, type Decision, type LeagueState } from '../src/league/state';
import { DISPUTE, FINANCE, SCANDAL } from '../src/league/tuning';
import { resolveAnnual } from '../src/league/userclub';
import { POSITION_SHARES } from '../src/model/position';
import type { Player } from '../src/model/types';
import { migrateState } from '../src/save/migrate';

let s: LeagueState;
let founded: LeagueState;
const pending = (x: LeagueState) => x.pending as LeagueState['pending'];
const decideAll = (x: LeagueState) => {
  while (pending(x)) apply(x, { kind: 'decide', input: autoDecision(x)! });
};
const ours = (x: LeagueState) => orgPlayers(x, EXPANSION_ID).filter((p) => p.status === 'active' && !isForeign(p));

beforeAll(() => {
  s = createLeague('v0120-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  decideAll(s);
  founded = structuredClone(s);
  // On to opening day of the first first-team season (2027), answering everything the scouts' way.
  const opening = () => s.year === 2027 && s.phase === 'regular';
  for (let guard = 0; guard < 200 && !opening(); guard++) {
    decideAll(s);
    if (opening()) break;
    if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else if (s.phase === 'postseason') apply(s, { kind: 'nextSeason' });
  }
  decideAll(s);
}, 900_000);

describe('domestic positions', () => {
  it('a draft class is shared out in KBO-like numbers, the best gloves in the middle', () => {
    const cls = draftClass('v0120-class', 2030).filter((p) => p.role === 'IF' || p.role === 'OF');
    for (const role of ['IF', 'OF'] as const) {
      const group = cls.filter((p) => p.role === role);
      for (const [pos, share] of POSITION_SHARES[role]) expect(Math.abs(group.filter((p) => p.position === pos).length - group.length * share)).toBeLessThanOrEqual(1.5);
    }
    const def = (pos: string) => {
      const xs = cls.filter((p) => p.position === pos);
      return xs.reduce((a, p) => a + (p.scouting.futureTools.defense ?? 40), 0) / xs.length;
    };
    expect(def('SS')).toBeGreaterThan(def('1B') + 8);
    expect(def('CF')).toBeGreaterThan(def('LF') + 5);
  });

  it('a player who lost the glove or legs moves down the spectrum', () => {
    const p = (position: string, defense: number, speed: number) => ({ position, scouting: { tools: { defense, speed, power: 50, contact: 45 } } }) as unknown as Player;
    expect(positionMove(p('SS', 55, 50))).toBeNull();
    expect(positionMove(p('SS', 42, 50))).toBe('3B');
    expect(positionMove(p('CF', 50, 40))).toBe('RF');
    expect(positionMove(p('CF', 38, 40))).toBe('LF');
    expect(positionMove(p('2B', 35, 40))).toBe('1B');
    expect(positionMove(p('C', 20, 20))).toBeNull();
  });

  it('AI clubs spread their hitters over the field', () => {
    const hitters = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId && p.teamId !== EXPANSION_ID && p.position && p.position !== 'C' && !isForeign(p));
    const count = (pos: string) => hitters.filter((p) => p.position === pos).length;
    for (const pos of ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) expect(count(pos) / hitters.length).toBeGreaterThan(0.08);
    expect(count('SS') / hitters.length).toBeLessThan(0.22);
    const club = structuredClone(orgPlayers(s, 'lg').filter((p) => p.status === 'active'));
    for (const p of club.filter((x) => x.position && x.position !== 'C')) p.position = 'SS';
    balanceDepth(club);
    expect(new Set(club.filter((x) => x.position && x.position !== 'C').map((x) => x.position)).size).toBeGreaterThan(1);
  });
});

describe('foreign names', () => {
  it('come from more places, rarely repeat, and Japanese names keep their order', () => {
    const xs = Array.from({ length: 1500 }, (_, i) => makeForeign('v0120-names', `n${i}`, 2030, { kind: i % 2 ? 'hitter' : 'pitcher', asiaQuota: i % 4 === 0 }));
    expect(new Set(xs.map((p) => p.name)).size / xs.length).toBeGreaterThan(0.95);
    const places = new Set(xs.map((p) => p.birthplace));
    for (const place of ['퀴라소', '브라질', '니카라과', '일본', '대만', '호주']) expect(places.has(place)).toBe(true);
    expect(xs.some((p) => p.name.endsWith(' 주니어'))).toBe(true);
    const japanese = xs.find((p) => p.birthplace === '일본')!;
    expect(['다나카', '사토', '스즈키', '다카하시', '와타나베', '이토', '야마모토', '나카무라', '고바야시', '가토'].some((f) => japanese.name.startsWith(f)) || japanese.name.split(' ').length === 2).toBe(true);
  });
});

describe('uniform numbers', () => {
  it('the general manager picks one; a teammate wearing it swaps; retired and wrong ranges refused', () => {
    const c = structuredClone(s);
    const [a, b] = ours(c).filter((p) => p.contract?.kind !== 'development' && p.number != null);
    const before = a!.number!;
    expect(setNumber(c, a!.id, b!.number!)).toBeNull();
    expect(a!.number).not.toBe(before);
    expect(b!.number).toBe(before);
    expect(checkNumber(c, a!.id, 150)).toMatch(/0~99/);
    const team = c.teams.find((t) => t.id === EXPANSION_ID)!;
    team.retiredNumbers = [{ number: 7, playerId: 'x', name: '전설', year: 2026 }];
    expect(checkNumber(c, a!.id, 7)).toMatch(/영구결번/);
    const other = Object.values(c.players).find((p) => p.teamId === 'lg')!;
    expect(checkNumber(c, other.id, 3)).toMatch(/우리 구단/);
  });
});

describe('a future that moves', () => {
  it('ceilings break out, stall and drift, more after a season that points that way', () => {
    const young = Object.values(s.players).filter((p) => p.status === 'active' && !isForeign(p) && ageIn(p, 2027) <= 24).slice(0, 300);
    let moved = 0;
    for (const [i, p] of young.entries()) {
      const c = structuredClone(p);
      const before = JSON.stringify(c.hidden.potential);
      driftPotential(c, 2026, rng(`drift-${i}`));
      if (JSON.stringify(c.hidden.potential) !== before) moved++;
      for (const k of Object.keys(c.hidden.potential) as (keyof typeof c.hidden.potential)[]) expect(c.hidden.potential[k]!).toBeGreaterThanOrEqual(c.hidden.current[k] ?? 20);
    }
    expect(moved).toBe(young.length);
  });

  it('the scouts move a young player a step for a season far from his level', () => {
    const p = { birthday: '2005-01-01' } as unknown as Player;
    expect(seasonStep(p, 1.5, false, 2027)).toBe(5);
    expect(seasonStep(p, 2.5, false, 2027)).toBe(10);
    expect(seasonStep(p, 1.4, true, 2027)).toBe(0);
    expect(seasonStep(p, -2, true, 2027)).toBe(-5);
  });
});

describe('national teams', () => {
  it('several events a year: the WBC in March, the Asian Games in the season, the Premier12 in November', () => {
    expect(eventsIn(2026).map((e) => e.kind)).toEqual(['wbc', 'asianGames']);
    expect(timing(eventById('2026-wbc')!)).toBe('spring');
    expect(timing(eventById('2026-asianGames')!)).toBe('season');
    expect(timing(eventById('2027-premier12')!)).toBe('winter');
    expect(INTERNATIONAL.filter((e) => e.kind === 'apbc' && e.year > 2026)[0]!.year).toBe(2029);
  });

  it('a March tournament exempts nobody; an Asian Games squad takes at most three from a club', () => {
    const wbc = s.international.find((e) => e.id === '2027-wbc') ?? finishEvent(structuredClone(s), eventById('2029-wbc')!);
    expect(wbc.medal).toBe(false);
    const c = structuredClone(s);
    const ag = selectNationalTeam(c, { ...eventById('2030-asianGames')!, year: 2027, id: 'test-ag' });
    const per: Record<string, number> = {};
    for (const id of ag.squad) per[c.players[id]!.teamId!] = (per[c.players[id]!.teamId!] ?? 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(3);
    expect(ag.squad).toHaveLength(24);
  });

  it('an in-season call-up waits for the club, which may ask to keep a player home', () => {
    const c = structuredClone(founded);
    const star = ours(c).find((p) => !isPitcher(p))!;
    star.birthday = '2004-03-01';
    star.scouting.current = 80;
    // Play to the day the Asian Games squad is named.
    for (let i = 0; i < 40 && !pending(c); i++) apply(c, { kind: 'days', days: 1 });
    const d = pending(c);
    expect(d?.kind).toBe('national');
    const next = c.next;
    expect(playDay(c)).toBe(false);
    expect(c.next).toBe(next);
    const nd = d as Extract<Decision, { kind: 'national' }>;
    expect(nd.rows.map((r) => r.id)).toContain(star.id);
    c.pending = null;
    resolveNational(c, nd, [star.id]);
    const entry = c.international.find((e) => e.id === nd.event)!;
    const kept = entry.excused?.includes(star.id) ?? false;
    expect(entry.squad.includes(star.id)).toBe(!kept);
    expect(entry.squad).toHaveLength(24);
    expect(c.news!.some((n) => n.id === `excuse-${nd.event}-${star.id}`)).toBe(true);
  });
});

describe('scandals', () => {
  const day = (x: LeagueState) => x.schedule[x.next]!.date;

  it('drunk driving: 70 games or a year, five years the second time, for life the third', () => {
    const c = structuredClone(s);
    const p = ours(c)[0]!;
    const save = { ...SCANDAL.rates };
    Object.assign(SCANDAL.rates, { dui: SCANDAL.gameDays * 5, assault: 0, fixing: 0, doping: 0 });
    const hidden = SCANDAL.dui.hidden;
    SCANDAL.dui.hidden = 0;
    try {
      for (const x of ours(c)) if (x !== p) x.status = 'retired';
      expect(scandalDay(c, day(c))).toBe(true);
      expect(pending(c)?.kind).toBe('scandal');
      const sus = c.suspended![p.id]!;
      expect(sus.games === 70 || !!sus.until).toBe(true);
      expect(suspended(c, p.id)).toBe(true);
      expect(offRoster(c, p.id)).toBe(true);
      if (sus.games) {
        serveSuspensions(c, EXPANSION_ID);
        expect(c.suspended![p.id]!.games).toBe(69);
      }
      // Back from the ban, and a third time.
      c.pending = null;
      delete c.suspended![p.id];
      p.life!.offenses!.dui = 2;
      scandalDay(c, '2027-06-01');
      expect(p.status).toBe('retired');
    } finally {
      Object.assign(SCANDAL.rates, save);
      SCANDAL.dui.hidden = hidden;
    }
  });

  it('the club answers; the fans judge it', () => {
    const c = structuredClone(s);
    const p = ours(c)[0]!;
    (c.suspended ??= {})[p.id] = { reason: '폭행 징계', since: '2027-05-01', games: 30 };
    const d = { kind: 'scandal', id: p.id, offense: 'assault', penalty: '폭행, 30경기 출장정지' } as Extract<Decision, { kind: 'scandal' }>;
    c.pending = d;
    const mood = clubState(c, EXPANSION_ID).interest;
    resolveAnnual(c, d, { kind: 'scandal', answer: 'extra' });
    expect(c.suspended![p.id]!.games).toBe(30 + SCANDAL.extraGames);
    expect(clubState(c, EXPANSION_ID).interest).toBeCloseTo(mood + SCANDAL.answer.extra);
  });

  it('doping shows itself first; the club can catch it before the KBO does', () => {
    const c = structuredClone(s);
    const save = { ...SCANDAL.rates };
    Object.assign(SCANDAL.rates, { dui: 0, assault: 0, fixing: 0, doping: SCANDAL.gameDays * 5 });
    const test = SCANDAL.doping.test;
    SCANDAL.doping.test = 0;
    try {
      scandalDay(c, '2027-04-01');
      const user = ours(c).find((p) => p.life?.suspicion?.real)!;
      expect(user).toBeDefined();
      const tool = isPitcher(user) ? 'stuff' : 'power';
      const boosted = user.hidden.current[tool]!;
      Object.assign(SCANDAL.rates, { doping: 0 });
      for (let i = 0; i < 40; i++) scandalDay(c, new Date(Date.parse('2027-04-02') + i * 86400000).toISOString().slice(0, 10));
      expect(c.news!.filter((n) => n.id.startsWith(`sign-${user.id}`)).length).toBeGreaterThanOrEqual(2);
      expect(checkInspect(c, user.id)).toBeNull();
      const fund = c.user!.fund;
      inspect(c, user.id);
      expect(c.user!.fund).toBe(fund - SCANDAL.doping.inspectCost);
      expect(user.life?.suspicion).toBeUndefined();
      expect(user.hidden.current[tool]).toBe(boosted - SCANDAL.doping.boost);
      expect(c.suspended?.[user.id]).toBeUndefined();
      expect(checkInspect(c, user.id)).toMatch(/이미/);
    } finally {
      Object.assign(SCANDAL.rates, save);
      SCANDAL.doping.test = test;
    }
  });
});

describe('the investor', () => {
  it('a naming-rights club may face a claim; a fight is decided the next winter', () => {
    const c = structuredClone(s);
    c.user!.settings.parentType = 'namingRights';
    const chance = DISPUTE.chance;
    DISPUTE.chance = 1;
    try {
      const d = disputeDecision(c, 2027) as Extract<Decision, { kind: 'dispute' }>;
      expect(d.kind).toBe('dispute');
      const fund = c.user!.fund;
      resolveDispute(c, d, 'fight', 2027);
      expect(c.user!.fund).toBe(fund - DISPUTE.legal);
      expect(disputeDecision(c, 2028)).toBeNull();
      expect(c.user!.dispute?.decided).toBe(2028);
      expect(c.alerts!.some((a) => a.id === 'dispute-verdict-2028')).toBe(true);
      expect(disputeDecision(c, 2029)).toBeNull();
    } finally {
      DISPUTE.chance = chance;
    }
    // A conglomerate never sees it.
    const g = structuredClone(s);
    expect(disputeDecision(g, 2027)).toBeNull();
  });
});

describe('the owner’s budget', () => {
  it('is paid at opening; the season’s result is the club’s; an empty fund is topped up at a cost in trust', () => {
    const u = s.user!;
    expect(u.seasonSupport?.year).toBe(2027);
    expect(u.ledger.some((l) => l.label.includes('시즌 예산 확정'))).toBe(true);
    const c = structuredClone(s);
    c.gate = {};
    c.user!.fund = -1;
    const trust = c.user!.trust ?? 60;
    const table = c.teams.filter((t) => c.rosters[t.id]).map((t, i) => ({ teamId: t.id, rank: i + 1 }));
    const tickets = clubState(c, EXPANSION_ID).seasonTickets;
    settleFinances(c, 2027, table);
    expect(c.user!.fund).toBe(0);
    expect(c.user!.trust).toBeLessThan(trust);
    expect(c.user!.ledger.some((l) => l.label.includes('긴급 지원'))).toBe(true);
    expect(tickets?.year).toBe(2027);
  });

  it('season tickets: a deeper discount sells more, and holders come whatever the record', () => {
    const sold = (discount: number) => {
      const c = structuredClone(s);
      clubState(c, EXPANSION_ID).seasonTicketDiscount = discount;
      c.user!.seasonSupport = undefined;
      openBooks(c);
      return clubState(c, EXPANSION_ID).seasonTickets!;
    };
    const none = sold(0),
      deep = sold(0.3);
    expect(deep.sold).toBeGreaterThan(none.sold);
    expect(deep.paid / deep.sold).toBeLessThan(none.paid / none.sold);
  });

  it('the front office costs more at a bigger club', () => {
    const report = (id: string) => clubReport(s, id, 2027, {}).expenses.frontOffice;
    expect(report('samsung')).toBeGreaterThan(report('nc'));
    expect(report('nc')).toBeGreaterThanOrEqual(FINANCE.frontOffice.base);
  });
});

describe('saves', () => {
  it('a 0.11 save gets ids for its national teams', () => {
    const c = structuredClone(s);
    c.international = c.international
      .filter((e) => e.kind === 'asianGames' || e.kind === 'olympics')
      .map((e) => ({ year: e.year, name: e.name, medal: e.medal, squad: e.squad }) as LeagueState['international'][number]);
    c.sim = '0.11.0';
    migrateState(c, '0.11.0');
    expect(c.international.every((e) => e.id && e.finish && e.left)).toBe(true);
    expect(c.international.find((e) => e.year === 2023)?.id).toBe('2023-asianGames');
  });
});
