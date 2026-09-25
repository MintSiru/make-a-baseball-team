/* V0.6: attendance, accounts, owner, staff, ballpark. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { projectOptions } from '../src/league/ballpark';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { attendance, clubState } from '../src/league/fans';
import { broadcastPool, postseasonShares } from '../src/league/finance';
import { createLeague } from '../src/league/history';
import { developPlayer } from '../src/league/offseason';
import { signSponsor } from '../src/league/parent';
import { staffOf, STAFF_ROLES } from '../src/league/staff';
import type { LeagueState } from '../src/league/state';
import { rng } from '../src/draftroom';

let s: LeagueState;
beforeAll(() => {
  s = createLeague('v06-test');
}, 240_000);

describe('attendance', () => {
  it('matches the 2025 league and never passes the seats', () => {
    let fans = 0,
      games = 0;
    for (const [id, c] of Object.entries(s.clubs!)) {
      const r = c.reports.find((x) => x.year === 2025);
      if (!r) continue;
      fans += r.fans;
      games += r.homeGames;
      const cap = s.teams.find((t) => t.id === id)!.stadium.capacity;
      expect(r.fans / r.homeGames).toBeLessThanOrEqual(cap);
    }
    const avg = fans / games;
    expect(avg).toBeGreaterThan(14_500);
    expect(avg).toBeLessThan(20_000);
  });
  it('draws fewer at a higher price', () => {
    const g = { id: 'x', date: `${s.year}-05-02`, home: 'kt', away: 'kiwoom' };
    const c = clubState(s, 'kt');
    const was = c.price;
    c.price = 0.8;
    const cheap = attendance(s, g);
    c.price = 1.5;
    const dear = attendance(s, g);
    c.price = was;
    expect(dear).toBeLessThan(cheap);
  });
});

describe('accounts', () => {
  it('reports every club every season, and the broadcast money is shared equally', () => {
    for (const c of Object.values(s.clubs!)) expect(c.reports.some((r) => r.year === 2025)).toBe(true);
    const shares = Object.values(s.clubs!).map((c) => c.reports.find((r) => r.year === 2025)!.revenue.broadcast);
    expect(new Set(shares).size).toBe(1);
    expect(shares[0]).toBe(Math.round(broadcastPool(2025) / 10));
  });
  it('shares the postseason pool by the KBO rule', () => {
    const post = Object.values(s.clubs!).map((c) => c.reports.find((r) => r.year === 2025)!.revenue.postseason).filter((x) => x > 0);
    expect(post.length).toBeGreaterThanOrEqual(4);
    expect(postseasonShares({ ...s, postseasonGate: 0 }, [])).toEqual({});
  });
});

describe('staff', () => {
  it('gives every club eight department heads', () => {
    for (const t of s.teams) expect(Object.keys(staffOf(s, t.id)).sort()).toEqual([...STAFF_ROLES].sort());
  });
  it('lets good coaches speed up growth', () => {
    const p = Object.values(s.players).find((x) => x.status === 'active' && x.proSince >= s.year - 1 && x.role !== 'SP' && x.role !== 'RP')!;
    const a = structuredClone(p),
      b = structuredClone(p);
    developPlayer(a, s.year, 0, rng('same'), 1, {});
    developPlayer(b, s.year, 0, rng('same'), 1, { contact: 0.08, power: 0.08, eye: 0.08 });
    const sum = (x: typeof p) => (x.hidden.current.contact ?? 0) + (x.hidden.current.power ?? 0) + (x.hidden.current.eye ?? 0);
    expect(sum(b)).toBeGreaterThanOrEqual(sum(a));
  });
});

describe('the user club', () => {
  let u: LeagueState;
  beforeAll(() => {
    u = createLeague('v06-user');
    apply(u, { kind: 'toFounding' });
    apply(u, {
      kind: 'found',
      settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'namingRights', parentName: '한울', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
    });
    while (u.pending) apply(u, { kind: 'decide', input: autoDecision(u)! });
    for (let i = 0; i < 2; i++) {
      apply(u, { kind: 'regularEnd' });
      apply(u, { kind: 'postseason' });
      apply(u, { kind: 'nextSeason' });
      while (u.pending) apply(u, { kind: 'decide', input: autoDecision(u)! });
    }
  }, 480_000);

  it('gets goals, a verdict and a budget from the owner', () => {
    expect(u.user!.goals?.year).toBe(u.year);
    expect(u.user!.evaluations?.length).toBeGreaterThanOrEqual(1);
    expect(u.user!.support).toBeGreaterThan(0);
    expect(u.user!.ledger.some((l) => l.label.includes('운영 결산'))).toBe(true);
  });

  it('builds only in the winter, and a new naming sponsor renames the club', () => {
    expect(projectOptions(u).every((o) => o.blocked)).toBe(true); // in season
    signSponsor(u, { name: '새솔은행', annual: 900_000, years: 3 }, u.year);
    const team = u.teams.find((t) => t.id === EXPANSION_ID)!;
    expect(team.name).toBe('새솔 고래단');
    expect(clubState(u, EXPANSION_ID).sponsor?.until).toBe(u.year + 3);
  });

  it('changes the ticket price', () => {
    apply(u, { kind: 'ticketPrice', level: 1.23 });
    expect(clubState(u, EXPANSION_ID).price).toBe(1.23);
    apply(u, { kind: 'ticketPrice', level: 9 });
    expect(clubState(u, EXPANSION_ID).price).toBe(1.6);
  });

  it('starts ballpark work in the winter while a decision waits, and it opens with the next season', () => {
    apply(u, { kind: 'regularEnd' });
    apply(u, { kind: 'postseason' });
    apply(u, { kind: 'nextSeason' });
    expect(u.pending).toBeTruthy();
    // The front office works beside the decision; the rest of the game waits.
    const next = u.year + 1;
    const team = () => u.teams.find((t) => t.id === EXPANSION_ID)!;
    u.user!.fund += 300_000;
    const fund = u.user!.fund;
    apply(u, { kind: 'ticketPrice', level: 1.1 });
    expect(clubState(u, EXPANSION_ID).price).toBe(1.1);
    const fences = projectOptions(u).find((o) => o.kind === 'fencesIn')!;
    expect(fences.blocked).toBeNull();
    apply(u, { kind: 'stadiumProject', project: 'fencesIn' });
    const project = u.user!.projects!.at(-1)!;
    expect(project).toMatchObject({ kind: 'fences', opens: next });
    expect(team().stadium.park).not.toBe(project.park);
    expect(u.user!.fund).toBe(fund - fences.cost);
    const day = u.next;
    apply(u, { kind: 'days', days: 1 });
    expect(u.next).toBe(day);
    while (u.pending) apply(u, { kind: 'decide', input: autoDecision(u)! });
    expect(u.year).toBe(next);
    expect(u.phase).toBe('regular');
    expect(team().stadium.park).toBe(project.park);
  }, 240_000);
});
