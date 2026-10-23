/* 2.0.34 (the user's requests): asking the owner for more payroll budget, the owner's help with our own free agents,
   the contracts tab, and what the payroll budget is made of. */
import { describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { apply } from '../src/league/actions';
import { askBudget, askBudgetChance, askBudgetProblem, askedAmount, BUDGET_ASK } from '../src/league/budgetask';
import { askOwnerChance, askOwnerProblem } from '../src/league/ownerask';
import { contractBook } from '../src/league/contractbook';
import { yearlyGrant } from '../src/league/userclub';
import { orgIds, type LeagueState } from '../src/league/state';
import { ageIn, isPitcher } from '../src/league/players';
import { armReady, available, bullpenFor } from '../src/league/manager';
import { FAVORITES_MAX, favoritesView, isFavorite, setFavorite } from '../src/league/favorites';

const base = (() => {
  const s = createLeague('v2034');
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
  s.pending = null;
  return s;
})();
const fresh = (seed = 'v2034'): LeagueState => {
  const s = { ...structuredClone(base), seed };
  // A new club has nobody until its special draft: give it a few players.
  const me = s.user!.teamId;
  for (const p of Object.values(s.players).filter((x) => x.teamId && x.teamId !== me && x.status === 'active' && x.contract?.kind !== 'foreign' && ageIn(x, s.year + 1) <= 30).slice(0, 5)) {
    const r = s.rosters[p.teamId!]!;
    for (const k of ['active', 'futures', 'third'] as const) r[k] = r[k].filter((x) => x !== p.id);
    p.teamId = me;
    s.rosters[me]!.active.push(p.id);
  }
  return s;
};

describe('asking the owner for more payroll budget (2.0.34)', () => {
  it('is likelier for a small raise, once a season, and a yes raises this season’s budget', () => {
    const s = fresh();
    s.phase = 'regular';
    expect(askBudgetProblem(s)).toBeNull();
    const [small, mid, big] = BUDGET_ASK.shares.map((x) => askBudgetChance(s, x));
    expect(small).toBeGreaterThan(mid!);
    expect(mid).toBeGreaterThan(big!);
    let yes = 0,
      no = 0;
    for (let i = 0; i < 30 && (!yes || !no); i++) {
      const t = fresh(`v2034-${i}`);
      t.phase = 'regular';
      const before = t.user!.payrollBudget;
      const trust = t.user!.trust ?? 60;
      const amount = askedAmount(t, 0.1);
      if (askBudget(t, 0.1)) {
        yes++;
        expect(t.user!.payrollBudget).toBe(before + amount);
      } else {
        no++;
        expect(t.user!.payrollBudget).toBe(before);
        expect(t.user!.trust).toBeLessThan(trust);
      }
      expect(t.alerts!.some((a) => a.id.startsWith('budget-ask-'))).toBe(true);
      // Once a season.
      expect(askBudgetProblem(t)).not.toBeNull();
      expect(() => askBudget(t, 0.05)).toThrow();
    }
    expect(yes).toBeGreaterThan(0);
    expect(no).toBeGreaterThan(0);
  });

  it('cannot be asked in the postseason', () => {
    const s = fresh();
    s.phase = 'postseason';
    expect(askBudgetProblem(s)).not.toBeNull();
  });
});

describe('the owner and our own free agents (2.0.34)', () => {
  it('may be asked for one of ours, a little likelier than for another club’s', () => {
    const s = fresh();
    const me = s.user!.teamId;
    const ours = orgIds(s, me)[0]!;
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== me && p.status === 'active' && ageIn(p, s.year + 1) <= 30)!.id;
    const price = { years: 4, bonus: 200_000, annual: 150_000, options: 0 };
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [], fa: { year: s.year, round: 0, closed: false, talks: { [ours]: { id: ours, from: me, price, offers: {} }, [theirs]: { id: theirs, from: s.players[theirs]!.teamId, price, offers: {} } } } } as never;
    expect(askOwnerProblem(s, ours)).toBeNull();
    expect(askOwnerChance(s, ours)).toBeGreaterThan(askOwnerChance(s, theirs));
  });
});

describe('the contracts tab (2.0.34)', () => {
  it('lists every contract with its money, term and details', () => {
    const s = fresh();
    const me = s.user!.teamId;
    const id = orgIds(s, me)[0]!;
    const p = s.players[id]!;
    const y = s.year;
    p.contract = { teamId: me, kind: 'freeAgent', signedIn: y - 1, signingBonus: 300_000, salaries: [y, y + 1, y + 2, y + 3].map((season) => ({ season, amount: 100_000 })), fa: { years: 4, options: 40_000, incentive: 'games', paid: [{ season: y - 1, amount: 10_000 }], extra: { years: 2, holder: 'player', annual: 100_000 }, promises: ['starter'], kept: { starter: true } } };
    const book = contractBook(s, me);
    expect(book.rows.length).toBe(orgIds(s, me).length);
    const r = book.rows.find((x) => x.id === id)!;
    expect(r.kind).toBe('FA');
    expect(r.total).toBe(300_000 + 400_000 + 40_000);
    expect(r.until).toBe(y + 3);
    expect(r.lines.some((l) => l.includes('옵트아웃'))).toBe(true);
    expect(r.lines.some((l) => l.includes('주전 보장') && l.includes('지킴'))).toBe(true);
    expect(r.lines.some((l) => l.includes('옵션'))).toBe(true);
  });
});

describe('what the payroll budget is made of (2.0.34)', () => {
  it('is recorded each winter, the budget being the base × the owner’s scale × the dynamic level, the floor under it', () => {
    const s = fresh();
    const y = s.year + 1;
    s.year = y;
    s.phase = 'offseason';
    s.offseason = { year: y, step: 0, draft: null, released: [], done: [] };
    yearlyGrant(s);
    const w = s.user!.budgetWhy!;
    expect(w.season).toBe(y + 1);
    const made = Math.max(Math.round((w.base * w.scale * w.dynamic) / 1000) * 1000, w.floor) + w.gifts;
    expect(Math.abs(s.user!.payrollBudget - made)).toBeLessThanOrEqual(1000);
  });
});

describe('an out in the air caught in the infield is called so (2.0.34)', () => {
  it('names an infielder when the ball came down short of the grass, and an outfielder only when it reached it', async () => {
    const { drawBall } = await import('../src/league/battedball');
    const { infieldAirOut, INFIELD_DEPTH, playText } = await import('../src/league/playtext');
    const { hitSpot } = await import('../src/league/pitchfeed');
    const { rng } = await import('../src/draftroom');
    expect(infieldAirOut({ ev: 105, la: 15, dir: 2 })).toBe('투수 직선타');
    expect(infieldAirOut({ ev: 160, la: 30, dir: 0 })).toBeNull();
    const r = rng('v2034-air');
    let short = 0;
    for (let i = 0; i < 4000; i++) {
      const aim = [-28, 0, 28][i % 3]!;
      const ball = drawBall('FO', (r() - 0.5) * 2, { pull: 0, lift: 0, edge: 0 }, false, r, aim);
      const text = playText({ k: 'pa', i: 1, top: true, b: 'b', p: 'p', res: 'OUT', runs: 0, rbi: 0, outs: 1, bases: [false, false, false], score: [0, 0], ball } as never, `k${i}`, () => '타자');
      const spot = hitSpot('OUT', text, r, ball)!;
      if (/좌익수|중견수|우익수/.test(text)) expect(spot.dist, text).toBeGreaterThanOrEqual(INFIELD_DEPTH);
      if (/(투수|1루수|2루수|3루수|유격수) (뜬공|직선타)/.test(text) && ball.la < 50) {
        short++;
        expect(spot.dist, text).toBeLessThan(INFIELD_DEPTH);
      }
    }
    // Soft flies to the infield happen, but they are not the usual fly out.
    expect(short).toBeGreaterThan(0);
    expect(short).toBeLessThan(4000 * 0.3);
  });
});

describe('the rotation’s turns (2.0.34)', () => {
  it('goes foreign starters, then the home-grown ace, then the Asia-quota starter, then the rest', async () => {
    const { rotationFor } = await import('../src/league/manager');
    const s = fresh();
    const tools = (v: number) => ({ stuff: v, command: v, breaking: v, stamina: v, contact: 30, power: 30, eye: 30, speed: 30, defense: 30, arm: 30 });
    const arm = (id: string, v: number, kind: 'foreign' | 'draftClass', asia = false) =>
      ({ id, name: id, role: 'SP', origin: { kind, ...(asia ? { asiaQuota: true } : {}) }, scouting: { current: v, futureValue: v, tools: tools(v) }, hidden: { current: tools(v), potential: tools(v) } }) as never;
    const ps = [arm('ace', 70, 'draftClass'), arm('f1', 55, 'foreign'), arm('f2', 50, 'foreign'), arm('asia', 60, 'foreign', true), arm('h2', 52, 'draftClass'), arm('h3', 48, 'draftClass'), arm('h4', 40, 'draftClass')];
    for (const p of ps) s.players[(p as { id: string }).id] = p;
    const order = rotationFor(s, ps.map((p) => (p as { id: string }).id)).map((p) => p.id);
    expect(order).toEqual(['f1', 'f2', 'ace', 'asia', 'h2']);
    // With one foreign starter the ace pitches second.
    const one = rotationFor(s, ['ace', 'f1', 'asia', 'h2', 'h3', 'h4']).map((p) => p.id);
    expect(one).toEqual(['f1', 'ace', 'asia', 'h2', 'h3']);
  });
});

describe('a six-man rotation in a league of twelve (2.0.34)', () => {
  it('is offered with twelve first-team clubs, and then every club turns six starters', async () => {
    const { rotationFor, rotationSize, sixManAllowed } = await import('../src/league/manager');
    const s = fresh();
    const ids = s.teams.filter((t) => t.firstTeamFrom !== null && t.firstTeamFrom <= s.year).length;
    expect(ids).toBeLessThan(12);
    expect(sixManAllowed(s)).toBe(false);
    // Not offered: the action changes nothing.
    apply(s, { kind: 'sixMan', on: true });
    expect(s.sixMan).toBeUndefined();
    expect(rotationSize(s)).toBe(5);
    // Twelve first-team clubs.
    for (const t of s.teams) t.firstTeamFrom = s.year - 1;
    while (s.teams.filter((t) => t.firstTeamFrom !== null).length < 12) s.teams.push({ ...structuredClone(s.teams[0]!), id: `x${s.teams.length}` });
    expect(sixManAllowed(s)).toBe(true);
    apply(s, { kind: 'sixMan', on: true });
    expect(s.sixMan).toBe(true);
    expect(rotationSize(s)).toBe(6);
    const team = s.teams.find((t) => (s.rosters[t.id]?.active.length ?? 0) > 20)!;
    const staff = [...s.rosters[team.id]!.active, ...s.rosters[team.id]!.futures];
    expect(rotationFor(s, staff).length).toBe(6);
    apply(s, { kind: 'sixMan', on: false });
    expect(rotationFor(s, staff).length).toBe(5);
  });
});

describe('how ready an arm is (2.0.34)', () => {
  it('goes by the same rules the manager picks his bullpen by, and says when a resting arm is back', () => {
    const s = fresh('v2034-arm');
    const team = s.teams.find((t) => t.firstTeamFrom !== null && t.firstTeamFrom <= s.year)!.id;
    // Six healthy arms (2.0.41: the league of this seed has one hurt).
    const pen = s.rosters[team]!.active.filter((id) => isPitcher(s.players[id]!) && available(s, id)).slice(0, 6);
    const date = `${s.year}-05-10`;
    const day = (n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
    // Yesterday 35 pitches, the day before 10 pitches a second day running, three days ago 60, today, and two fresh.
    s.arms[pen[0]!] = { lastDate: day(-1), lastPitches: 35, streak: 1 };
    s.arms[pen[1]!] = { lastDate: day(-1), lastPitches: 10, streak: 2 };
    s.arms[pen[2]!] = { lastDate: day(-2), lastPitches: 60, streak: 1 };
    s.arms[pen[3]!] = { lastDate: date, lastPitches: 15, streak: 1 };
    s.arms[pen[4]!] = { lastDate: day(-1), lastPitches: 12, streak: 1 };
    delete s.arms[pen[5]!];
    const inPen = new Set(bullpenFor(s, team, pen, date, new Set()).map((r) => r.id));
    for (const id of pen) {
      const arm = armReady(s, s.players[id]!, date, false);
      expect(arm.ready, id).toBe(inPen.has(id));
      if (!arm.ready) {
        expect(arm.back! > date).toBe(true);
        expect(arm.pct).toBeLessThan(70);
      }
    }
    expect(armReady(s, s.players[pen[0]!]!, date, false).back).toBe(day(1));
    expect(armReady(s, s.players[pen[3]!]!, date, false).why).toBe('today');
    expect(armReady(s, s.players[pen[1]!]!, date, false).why).toBe('streak');
    expect(armReady(s, s.players[pen[4]!]!, date, false)).toMatchObject({ ready: true, pct: 70 });
    expect(armReady(s, s.players[pen[5]!]!, date, false)).toMatchObject({ ready: true, pct: 100, why: 'fresh' });
    // A starter three days after his start is resting; on his day, ready.
    s.arms[pen[0]!] = { lastDate: day(-3), lastPitches: 95, streak: 1 };
    const sp = armReady(s, s.players[pen[0]!]!, date, true);
    expect(sp.ready).toBe(false);
    expect(sp.why).toBe('short');
    expect(armReady(s, s.players[pen[0]!]!, sp.back!, true).ready).toBe(true);
  });
});

describe('favourite players (2.0.34)', () => {
  it('stars anyone, keeps the list short, lists each with a line, and the action works while a decision waits', () => {
    const s = fresh('v2034-fav');
    const others = Object.values(s.players).filter((p) => p.teamId && p.status === 'active');
    const hitter = others.find((p) => !isPitcher(p))!;
    const pitcher = others.find((p) => isPitcher(p))!;
    setFavorite(s, hitter.id, true);
    apply(s, { kind: 'favorite', id: pitcher.id, on: true });
    expect(isFavorite(s, hitter.id)).toBe(true);
    expect(isFavorite(s, pitcher.id)).toBe(true);
    const rows = favoritesView(s);
    expect(rows.map((r) => r.id)).toEqual([hitter.id, pitcher.id]);
    expect(rows[0]!.arm).toBeNull();
    expect(rows[1]!.arm).not.toBeNull();
    for (const r of rows) expect(r.name.length).toBeGreaterThan(0);
    apply(s, { kind: 'favorite', id: hitter.id, on: false });
    expect(isFavorite(s, hitter.id)).toBe(false);
    setFavorite(s, 'nobody', true);
    expect(s.user!.favorites).toEqual([pitcher.id]);
    for (const p of others.slice(0, FAVORITES_MAX + 10)) setFavorite(s, p.id, true);
    expect(s.user!.favorites!.length).toBe(FAVORITES_MAX);
  });
});
