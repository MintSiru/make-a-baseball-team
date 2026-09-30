/* V0.7.7: realistic injuries, the military grade after an operation, foreign players as good as the real ones. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision, EXPANSION_ID } from '../src/league/expansion';
import { bootstrap, playFullSeason } from '../src/league/history';
import { carryOverInjuries, INJURY_TYPES, majorSurgeries, offRoster, sidelined } from '../src/league/injuries';
import { medicalReview, socialOnly } from '../src/league/military';
import { isForeign, isPitcher } from '../src/league/players';
import { firstTeamIds, orgPlayers, type LeagueState } from '../src/league/state';
import { era, obp, slg } from '../src/league/stats';
import { createLeague } from '../src/league/history';
import { militaryDecision } from '../src/league/userclub';
import { electMayor, ownerEvents, sponsorOffers, sponsorReview } from '../src/league/parent';
import { faGrades, marketValue, parentGift } from '../src/league/market';
import { freeAgentsFor } from '../src/league/offseason';

let s: LeagueState;
beforeAll(() => {
  s = bootstrap('v077-test');
  while (s.year <= 2025) playFullSeason(s);
}, 300_000);

describe('injuries', () => {
  it('put about fifteen players a club on the injured list each season, most for three weeks or more', () => {
    const year = s.year - 1;
    const list = Object.values(s.players).flatMap((p) => (p.injuries ?? []).filter((i) => i.date.startsWith(String(year)) && !i.futures));
    const clubs = firstTeamIds(s, year).length;
    expect(list.length / clubs).toBeGreaterThan(10);
    expect(list.length / clubs).toBeLessThan(22);
    expect(list.filter((i) => i.days >= 21).length / list.length).toBeGreaterThan(0.4);
    // Every injury has a name from the catalogue; operations are marked.
    const names = new Set([...INJURY_TYPES.pitcher, ...INJURY_TYPES.hitter].map((t) => t.part));
    expect(list.every((i) => names.has(i.part))).toBe(true);
    expect(list.filter((i) => i.surgery === 'major').every((i) => i.days >= 90)).toBe(true);
  });

  it('keeps pitchers out with pitchers’ injuries and hitters with hitters’', () => {
    const pitcherParts = new Set(INJURY_TYPES.pitcher.map((t) => t.part));
    const hitterOnly = new Set(INJURY_TYPES.hitter.map((t) => t.part).filter((x) => !pitcherParts.has(x)));
    for (const p of Object.values(s.players)) for (const i of p.injuries ?? []) if (isPitcher(p)) expect(hitterOnly.has(i.part)).toBe(false);
  });

  it('leaves a mark after a major operation', () => {
    const operated = Object.values(s.players).filter((p) => majorSurgeries(p).length);
    expect(operated.length).toBeGreaterThan(0);
    expect(operated.every((p) => p.hidden.injuryRisk > 0.05)).toBe(true);
  });

  it('runs an operation over the winter, off the injured list', () => {
    const copy = structuredClone(s);
    const p = Object.values(copy.players).find((x) => x.status === 'active' && x.teamId)!;
    copy.injuries = { [p.id]: { until: `${copy.year}-08-01`, days: 400, onList: true, part: '팔꿈치 인대 재건술 (토미존)', surgery: 'major' } };
    copy.injuries.knock = { until: `${copy.year}-06-01`, days: 3, onList: false, dtd: true };
    carryOverInjuries(copy, `${copy.year}-03-28`);
    expect(copy.injuries[p.id]).toMatchObject({ onList: false, surgery: 'major' });
    expect(copy.injuries.knock).toBeUndefined();
  });

  it('keeps a player with a knock on the first team but out of the lineup', () => {
    const copy = structuredClone(s);
    const id = copy.rosters[copy.teams[0]!.id]!.active[0]!;
    copy.injuries[id] = { until: '2099-01-01', days: 3, onList: false, dtd: true, part: '사구 타박상' };
    expect(sidelined(copy, id)).toBe(true);
    expect(offRoster(copy, id)).toBe(false);
    copy.injuries[id] = { until: '2099-01-01', days: 30, onList: true, part: '옆구리 근육 손상' };
    expect(offRoster(copy, id)).toBe(true);
  });
});

describe('the military grade after an operation', () => {
  it('grades players who have not served: 4급 social service only, 5급 exempt', () => {
    const copy = structuredClone(s);
    const pending = Object.values(copy.players).filter((p) => !isForeign(p) && p.status === 'active' && p.teamId && p.service.military === 'pending').slice(0, 60);
    for (const p of pending) p.injuries = [{ date: `${copy.year - 1}-05-01`, days: 300, part: '전방십자인대 재건술', surgery: 'major' }];
    medicalReview(copy, copy.year - 1);
    const grades = pending.map((p) => p.service.exam?.grade);
    expect(grades.every((g) => g === 3 || g === 4 || g === 5)).toBe(true);
    expect(grades.filter((g) => g === 4).length).toBeGreaterThan(grades.length / 2);
    for (const p of pending) {
      if (p.service.exam!.grade === 5) expect(p.service.military).toBe('exempt');
      if (p.service.exam!.grade === 4) expect(socialOnly(p)).toBe(true);
    }
    // The same winter again changes nothing; a second operation is looked at again.
    const before = JSON.stringify(pending.map((p) => p.service));
    medicalReview(copy, copy.year - 1);
    expect(JSON.stringify(pending.map((p) => p.service))).toBe(before);
    const again = pending.find((p) => p.service.exam!.grade === 4)!;
    again.injuries!.push({ date: `${copy.year}-06-01`, days: 200, part: '어깨 탈구 수술', surgery: 'major' });
    medicalReview(copy, copy.year);
    expect(again.service.exam!.surgeries).toBe(2);
  });

  it('offers only social service to a 4급 player of the user’s club', () => {
    const u = createLeague('v077-user');
    apply(u, { kind: 'toFounding' });
    apply(u, {
      kind: 'found',
      settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
    });
    while (u.pending) apply(u, { kind: 'decide', input: autoDecision(u)! });
    apply(u, { kind: 'regularEnd' });
    apply(u, { kind: 'postseason' });
    apply(u, { kind: 'nextSeason' });
    // Make one of ours an operated, unserved 22-year-old before the military decision comes up.
    let checked = false;
    while (u.pending) {
      if (u.pending.kind === 'military') {
        const p = orgPlayers(u, EXPANSION_ID).find((x) => !isForeign(x) && x.status === 'active' && x.service.military === 'pending' && u.pending!.kind === 'military' && u.pending!.candidates.includes(x.id))!;
        p.injuries = [{ date: `${u.year}-07-01`, days: 420, part: '팔꿈치 인대 재건술 (토미존)', surgery: 'major' }];
        p.service.exam = { year: u.year, grade: 4, reason: '팔꿈치 인대 재건술 (토미존)', surgeries: 1 };
        u.pending = militaryDecision(u)!;
        expect(u.pending.kind === 'military' && u.pending.social).toContain(p.id);
        const forced = u.pending.kind === 'military' ? u.pending.forced.filter((id) => id !== p.id) : [];
        const others = Object.fromEntries(forced.map((id) => [id, 'army' as const]));
        expect(() => apply(u, { kind: 'decide', input: { kind: 'military', orders: { ...others, [p.id]: 'army' } } })).toThrow(/4급/);
        apply(u, { kind: 'decide', input: { kind: 'military', orders: { ...others, [p.id]: 'social' } } });
        expect(p.status).toBe('military');
        expect(p.service.route).toBe('social');
        checked = true;
        continue;
      }
      apply(u, { kind: 'decide', input: autoDecision(u)! });
    }
    expect(checked).toBe(true);
  }, 600_000);
});

describe('foreign players', () => {
  it('hit and pitch like the KBO’s real imports: well above the league', () => {
    let ops = 0,
      lgOps = 0,
      ratio = 0,
      n = 0;
    for (const year of [2023, 2024, 2025]) {
      const h = s.history.find((x) => x.year === year)!;
      const bat = { ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, sf: 0, pa: 0 } as Record<string, number>;
      const pit = { outs: 0, er: 0 } as Record<string, number>;
      for (const p of Object.values(s.players)) {
        if (!isForeign(p)) continue;
        const c = p.career.find((x) => x.year === year && !x.level);
        if (c?.bat) for (const k of Object.keys(bat)) bat[k]! += (c.bat as unknown as Record<string, number>)[k] ?? 0;
        if (c?.pit) for (const k of Object.keys(pit)) pit[k]! += (c.pit as unknown as Record<string, number>)[k] ?? 0;
      }
      ops += obp(bat as never) + slg(bat as never);
      lgOps += obp(h.totals.bat) + slg(h.totals.bat);
      ratio += era(pit as never) / era(h.totals.pit);
      n++;
    }
    // Real 2023–2025: foreign hitters about .10 OPS above the league, foreign pitchers about 80% of its ERA.
    expect((ops - lgOps) / n).toBeGreaterThan(0.06);
    expect(ratio / n).toBeLessThan(0.9);
    expect(ratio / n).toBeGreaterThan(0.65);
  });
});

describe('owners (V0.7.7)', () => {
  let u: LeagueState;
  const found = (parentType: 'conglomerate' | 'midsize' | 'namingRights' | 'citizen', seed: string) => {
    const x = createLeague(seed);
    apply(x, { kind: 'toFounding' });
    apply(x, {
      kind: 'found',
      settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType, parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
    });
    while (x.pending) apply(x, { kind: 'decide', input: autoDecision(x)! });
    return x;
  };
  beforeAll(() => {
    u = found('citizen', 'v077-owner');
  }, 300_000);

  it('a citizen club starts with the mayor who founded it, who is elected every four years', () => {
    expect(u.user!.mayor).toMatchObject({ since: 2026, until: 2030 });
    const stances = new Set<string>();
    for (let y = 2030; y <= 2070; y += 4) {
      const m = electMayor(u, y, { name: '김영수', stance: 'neutral', since: y - 4, until: y });
      expect(m.until).toBe(y + 4);
      stances.add(m.stance);
    }
    expect([...stances].sort()).toEqual(['friendly', 'hostile', 'neutral']);
  });

  it('a large deficit brings the council down on the club, most surely under a hostile mayor', () => {
    let events = 0;
    for (let year = 2030; year < 2050; year++) {
      const x = structuredClone(u);
      const club = x.clubs![EXPANSION_ID]!;
      x.user!.mayor = { name: '박정훈', stance: 'hostile', since: year - 1, until: year + 3 };
      x.user!.support = 1_000_000;
      club.reports.push({ ...club.reports.at(-1)!, year, operating: -2_000_000, cashFlows: 0 });
      const trust = x.user!.trust!;
      const scale = x.user!.budgetScale!;
      const factor = ownerEvents(x, year);
      if (x.alerts?.some((a) => a.id === `council-${year}`)) {
        events++;
        expect(factor < 1 || x.user!.trust! < trust || x.user!.budgetScale! < scale || club.popularity < u.clubs![EXPANSION_ID]!.popularity).toBe(true);
      }
    }
    expect(events).toBeGreaterThan(10);
  });

  it('naming sponsors offer different money for different goals, and one may walk out after a miss', () => {
    const n = found('namingRights', 'v077-naming');
    const offers = sponsorOffers(n, 2027);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((o) => o.goal?.kind)).size).toBeGreaterThan(1);
    // The one that wants the most pays the most.
    const post = offers.find((o) => o.goal?.kind === 'rank' && o.goal.rank <= 5);
    if (post) expect(post.annual).toBeGreaterThanOrEqual(Math.min(...offers.map((o) => o.annual)));
    // A sponsor that wants the title from a club that finished last walks out sooner or later.
    let out = 0;
    for (let year = 2028; year < 2040; year++) {
      const x = structuredClone(n);
      x.history.push({ ...x.history.at(-1)!, year, table: [{ ...x.history.at(-1)!.table[0]!, teamId: EXPANSION_ID, rank: 11 }] });
      x.clubs![EXPANSION_ID]!.sponsor = { name: '한빛증권', annual: 900_000, until: year + 3, goal: { kind: 'rank', rank: 1 }, risk: 0.5, from: year, missed: 1 };
      sponsorReview(x, year);
      if (x.clubs![EXPANSION_ID]!.sponsor!.until === year) out++;
      else expect(x.clubs![EXPANSION_ID]!.sponsor!.missed).toBe(2);
    }
    expect(out).toBeGreaterThan(3);
  }, 300_000);

  it('a conglomerate now and then buys the club a free agent, paid outside the budget', () => {
    const c = found('conglomerate', 'v077-gift');
    // The first winter with a free-agent market for the club (the one before the first team has its own rules).
    c.user!.firstTeamYear = 2020;
    apply(c, { kind: 'regularEnd' });
    apply(c, { kind: 'postseason' });
    apply(c, { kind: 'nextSeason' });
    while (c.pending && c.pending.kind !== 'faMarket') apply(c, { kind: 'decide', input: autoDecision(c)! });
    expect(c.pending?.kind).toBe('faMarket');
    const fas = freeAgentsFor(c, 2027);
    const grades = faGrades(c, 2027, fas);
    const gifts = Array.from({ length: 60 }, (_, i) => parentGift({ ...c, seed: `gift-${i}` }, 2027, fas, grades)).filter(Boolean);
    expect(gifts.length).toBeGreaterThan(1);
    expect(gifts.length).toBeLessThan(20);
    const g = gifts[0]!;
    expect(c.players[g.id]!.teamId).not.toBe(EXPANSION_ID);
    expect(g.annual).toBeGreaterThanOrEqual(marketValue(c.players[g.id]!, 2027).annual);
    // Kept, the offer does not count against the payroll budget.
    const d = { ...(c.pending as Extract<NonNullable<LeagueState['pending']>, { kind: 'faMarket' }>), gift: g };
    c.pending = d;
    c.user!.payrollBudget = 0;
    expect(checkDecision(c, { kind: 'faMarket', offers: { [g.id]: { annual: g.annual, years: g.years } } })).toBeNull();
  }, 300_000);
});
