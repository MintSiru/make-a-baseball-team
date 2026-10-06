/* V0.8: the free-agent negotiation. Offers with bonus, salary, incentives and period options; demands and
   promises; players who weigh offers for days; the club's limits; incentives, options and the demotion cut. */
import { beforeAll, describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/core/version';
import { apply } from '../src/league/actions';
import { capPay, MANWON_PER_USD, salaryIn } from '../src/league/contracts';
import { autoDecision, checkDecision, EXPANSION_ID, foreignReserve } from '../src/league/expansion';
import {
  capHit,
  faContract,
  faPrice,
  fitOf,
  guaranteed,
  meetTerms,
  offerTotal,
  offerValue,
  judgeReinforcePromises,
  judgeStarterPromises,
  payIncentives,
  playRound,
  promiseDoubt,
  reaction,
  settleClubOptions,
  settlePeriodOptions,
  splitOffer,
  utility,
  type FaMarket,
  type FaOffer,
} from '../src/league/fa';
import { demotionCut } from '../src/league/finance';
import { foreignSlots } from '../src/league/manager';
import { KBO_2026 } from '../src/rules/kbo2026';
import { createLeague } from '../src/league/history';
import { freeAgentsFor } from '../src/league/offseason';
import { movePlayer } from '../src/league/market';
import { ageIn, isForeign } from '../src/league/players';
import { emptyBat, orgPlayers, type LeagueState } from '../src/league/state';
import { FA, OFFSEASON } from '../src/league/tuning';
import { makeSave, parseSave, serializeSave } from '../src/save/format';
import { endRegular } from './helpers';

let s: LeagueState;
let m: FaMarket;
const next = () => s.offseason!.year + 1;

beforeAll(() => {
  s = createLeague('v080-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  while (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  endRegular(s);
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  // (`apply` changes the state behind TypeScript's back.)
  const pending = () => s.pending as LeagueState['pending'];
  while (pending() && pending()!.kind !== 'faRound') apply(s, { kind: 'decide', input: autoDecision(s)! });
  m = s.offseason!.fa!;
}, 480_000);

const clone = () => {
  const c = structuredClone(s);
  return { c, cm: c.offseason!.fa! };
};
/** A talk with another club's free agent that is still open. */
const outsideTalk = (mk: FaMarket) => mk.order.map((id) => mk.talks[id]!).find((t) => t.from !== EXPANSION_ID && !t.signed && !t.gone)!;

describe('the market opens', () => {
  it('lists this winter’s free agents with a price, an ask and a few demands, and pauses for the club', () => {
    expect(s.pending?.kind).toBe('faRound');
    expect(m.round).toBe(0);
    expect(m.order.length).toBeGreaterThan(5);
    for (const id of m.order) {
      const t = m.talks[id]!;
      expect(t.price.years).toBeGreaterThanOrEqual(1);
      expect(t.price.bonus).toBeLessThan(guaranteed(t.price));
      expect(t.ask).toBeGreaterThan(offerValue(t.price));
      expect(t.floor).toBeLessThan(t.ask);
      expect(t.demands.length).toBeLessThanOrEqual(3);
    }
    // Several kinds of demands across the class.
    expect(new Set(m.order.flatMap((id) => m.talks[id]!.demands.map((d) => d.kind))).size).toBeGreaterThan(2);
    // The winter before the first team: three outside signings without compensation.
    expect(m.userFree).toBe(true);
    expect(m.userLimit).toBe(3);
  });

  it('prices by recent WAR and age: bonus-heavy for big deals, incentives on top', () => {
    const rows = m.order.map((id) => ({ p: s.players[id]!, o: faPrice(s.players[id]!, next()) }));
    // Rounding the bonus and salaries to 10 million won can lift a deal just under the 4-billion band over it.
    const big = rows.filter((x) => guaranteed(x.o) >= 405000);
    for (const x of big) expect(x.o.bonus / guaranteed(x.o)).toBeGreaterThanOrEqual(0.44);
    for (const x of rows) expect(offerTotal(x.o)).toBeGreaterThan(guaranteed(x.o));
    const old = rows.find((x) => x.p.career.length && x.o.years <= 2);
    if (old) expect(old.o.years).toBeLessThan(4);
  });
});

describe('room for the foreign players (V0.16)', () => {
  it('the market shows what the foreign players, signed after it, will take from the budget', () => {
    // The club enters the first team: no foreign player yet, every slot (one more for a new club) to fill.
    expect(orgPlayers(s, EXPANSION_ID).filter(isForeign)).toHaveLength(0);
    const slots = foreignSlots(s, EXPANSION_ID, next());
    expect(slots.regular).toBe(KBO_2026.foreign.regular + 1);
    expect(foreignReserve(s, EXPANSION_ID, next())).toBe(Math.round((slots.regular * OFFSEASON.foreign.newReserveUSD + slots.asia * KBO_2026.foreign.asiaQuotaCapUSD) * MANWON_PER_USD));
  });
});

describe('what a player wants', () => {
  it('values the bonus above salary and incentives at half', () => {
    const base: FaOffer = { years: 4, bonus: 0, annual: 50000, options: 0 };
    expect(offerValue({ ...base, bonus: 40000, annual: 40000 })).toBeGreaterThan(offerValue(base));
    expect(offerValue({ ...base, options: 20000 })).toBe(offerValue(base) + 20000 * FA.value.options);
    expect(offerValue({ ...base, extra: { years: 2, holder: 'player' } })).toBeGreaterThan(offerValue({ ...base, extra: { years: 2, holder: 'club' } }));
  });

  it('marks down offers that miss his demands; a promise meets a starting job or a reinforcement', () => {
    const { c, cm } = clone();
    const t = outsideTalk(cm);
    const o: FaOffer = { ...t.price };
    t.demands = [];
    const plain = fitOf(c, t, EXPANSION_ID, o, next()).k;
    t.demands = [{ kind: 'years', min: o.years + 1 }];
    expect(fitOf(c, t, EXPANSION_ID, o, next()).k).toBeLessThan(plain);
    expect(fitOf(c, t, EXPANSION_ID, { ...o, years: o.years + 1 }, next()).k).toBeCloseTo(plain, 5);
    t.demands = [{ kind: 'optOut' }];
    expect(fitOf(c, t, EXPANSION_ID, o, next()).wants.join()).toMatch(/옵트아웃/);
    expect(fitOf(c, t, EXPANSION_ID, { ...o, extra: { years: 2, holder: 'player' } }, next()).k).toBeGreaterThan(fitOf(c, t, EXPANSION_ID, o, next()).k);
    t.demands = [{ kind: 'reinforce', spot: 'SP' }];
    const without = fitOf(c, t, EXPANSION_ID, o, next());
    const promised = fitOf(c, t, EXPANSION_ID, { ...o, promises: ['reinforce'] }, next());
    expect(promised.k).toBeGreaterThanOrEqual(without.k);
    // His own club's offer is worth more to him.
    t.demands = [];
    expect(utility(c, t, t.from, o, next())).toBeGreaterThan(utility(c, t, EXPANSION_ID, o, next()));
  });

  it('broken promises cost the club later free agents’ trust', () => {
    const { c } = clone();
    expect(promiseDoubt(c, 2026)).toBe(0);
    c.user!.promises = [{ year: 2026, id: 'x', name: 'x', kind: 'starter', kept: false }];
    expect(promiseDoubt(c, 2026)).toBeCloseTo(FA.promise.trust, 5);
    expect(promiseDoubt(c, 2026 + FA.promise.winters)).toBe(0);
  });

  it('the scouts’ “meet his terms” reaches what he takes today', () => {
    const t = outsideTalk(m);
    const o = meetTerms(s, m, t, next());
    expect(reaction(s, m, t, o, next()).ratio).toBeGreaterThanOrEqual(0.98);
    expect(reaction(s, m, t, { ...o, annual: Math.round(o.annual * 0.5), bonus: Math.round(o.bonus * 0.5) }, next()).band).not.toBe('great');
  });
});

describe('weighing offers', () => {
  it('takes an overwhelming offer at once, and weighs an acceptable one for days before he signs', () => {
    const { c, cm } = clone();
    const t = outsideTalk(cm);
    t.interest = {};
    t.offers = {};
    // Acceptable: he thinks it over, then signs on his day.
    const o = meetTerms(c, cm, t, next(), 1.02);
    apply(c, { kind: 'decide', input: { kind: 'faRound', offers: { [t.id]: o }, run: 'round' } });
    const t2 = c.offseason!.fa!.talks[t.id]!;
    expect(t2.signed).toBeUndefined();
    expect(t2.decideOn).toBe(FA.rounds[0]! + t2.patience);
    expect(t2.notes.at(-1)!.text).toMatch(/고민/);
    // Let the days run until news: he signs with us.
    while (c.pending?.kind === 'faRound' && !c.offseason!.fa!.talks[t.id]!.signed) apply(c, { kind: 'decide', input: { kind: 'faRound', offers: {}, run: 'news' } });
    const done = c.players[t.id]!;
    expect(done.teamId).toBe(EXPANSION_ID);
    expect(done.contract!.signingBonus).toBe(o.bonus);
    expect(done.contract!.fa!.years).toBe(o.years);
    // Overwhelming: signed in the first round.
    const { c: c2, cm: m2 } = clone();
    const u = outsideTalk(m2);
    u.interest = {};
    u.offers = {};
    apply(c2, { kind: 'decide', input: { kind: 'faRound', offers: { [u.id]: meetTerms(c2, m2, u, next(), 1.3) }, run: 'round' } });
    expect(c2.players[u.id]!.teamId).toBe(EXPANSION_ID);
  }, 120_000);

  it('the founding winter’s signings owe no compensation', () => {
    const { c, cm } = clone();
    const t = cm.order.map((id) => cm.talks[id]!).find((x) => x.from !== EXPANSION_ID && x.grade !== 'C' && !x.signed)!;
    if (!t) return;
    t.interest = {};
    t.offers = {};
    const fund = c.user!.fund;
    apply(c, { kind: 'decide', input: { kind: 'faRound', offers: { [t.id]: meetTerms(c, cm, t, next(), 1.3) }, run: 'round' } });
    expect(c.players[t.id]!.teamId).toBe(EXPANSION_ID);
    expect(c.pending?.kind).toBe('faRound');
    expect(c.user!.fund).toBe(fund);
  }, 120_000);

  it('plays a whole market without the club: everyone ends signed or retired, within the limits', () => {
    const { c, cm } = clone();
    let guard = 0;
    while (!cm.closed && guard++ < 40) playRound(c, cm, next());
    expect(cm.closed).toBe(true);
    for (const id of cm.order) {
      const t = cm.talks[id]!;
      expect(!!t.signed || !!t.gone).toBe(true);
    }
    for (const [club, n] of Object.entries(cm.signedOut)) expect(n).toBeLessThanOrEqual(club === EXPANSION_ID ? cm.userLimit : cm.limit);
    // Signings spread over the winter, not all on the last day.
    const days = cm.order.map((id) => cm.talks[id]!.signed?.day).filter((d): d is number => d !== undefined);
    expect(days.filter((d) => d < FA.rounds.at(-1)!).length).toBeGreaterThan(days.length / 2);
  });
});

describe('the club’s side', () => {
  it('checks lengths, the minimum salary, the outside limit and the payroll budget', () => {
    const t = outsideTalk(m);
    const ok = meetTerms(s, m, t, next());
    expect(checkDecision(s, { kind: 'faRound', offers: { [t.id]: { ...ok, years: 7 } }, run: 'round' })).toMatch(/1~6년/);
    expect(checkDecision(s, { kind: 'faRound', offers: { [t.id]: { ...ok, annual: 100 } }, run: 'round' })).toMatch(/최저연봉/);
    expect(checkDecision(s, { kind: 'faRound', offers: { [t.id]: { ...ok, promises: ['starter'] } }, run: 'round' })).toSatisfy((x: string | null) => x === null || /요구하지 않은/.test(x));
    const { c } = clone();
    c.user!.payrollBudget = 1000;
    expect(checkDecision(c, { kind: 'faRound', offers: { [t.id]: ok }, run: 'round' })).toMatch(/연봉 예산/);
    const outside = m.order.filter((id) => m.talks[id]!.from !== EXPANSION_ID).slice(0, m.userLimit + 1);
    const cheap = Object.fromEntries(outside.map((id) => [id, splitOffer(20000, 1, 0, 0, next())]));
    const { c: c2 } = clone();
    c2.user!.payrollBudget = 10_000_000;
    expect(checkDecision(c2, { kind: 'faRound', offers: cheap, run: 'round' })).toMatch(/3명까지/);
  });

  it('writes the deal: bonus spread over the cap and the budget, incentives, the period option', () => {
    const p = s.players[m.order[0]!]!;
    const o: FaOffer = { years: 4, bonus: 200000, annual: 60000, options: 40000, extra: { years: 1, holder: 'club' }, promises: ['starter'] };
    const c = faContract(EXPANSION_ID, 2027, o, p);
    expect(c!.salaries).toHaveLength(4);
    expect(c!.fa).toMatchObject({ years: 4, options: 40000, extra: { years: 1, holder: 'club', annual: 60000 }, promises: ['starter'] });
    const q = structuredClone(p);
    q.contract = c;
    expect(capPay(q, 2027)).toBe(60000 + 50000);
    expect(capPay(q, 2031)).toBe(0);
    expect(capHit(o)).toBe(60000 + 50000 + 5000);
  });

  it('pays incentives by games, innings or relief work', () => {
    const { c } = clone();
    const played = (g: number) => (x: (typeof c.players)[string]) => x.teamId && x.position && x.career.some((r) => r.year === 2026 && !r.level && (r.bat?.g ?? 0) >= g);
    const regular = Object.values(c.players).find(played(100))!;
    const bench = Object.values(c.players).find((x) => played(1)(x) && !played(70)(x))!;
    regular.contract = faContract(regular.teamId!, 2026, { years: 2, bonus: 0, annual: 30000, options: 20000 }, regular);
    bench.contract = faContract(bench.teamId!, 2026, { years: 2, bonus: 0, annual: 30000, options: 20000 }, bench);
    payIncentives(c, 2026);
    expect(regular.contract!.fa!.paid).toEqual([{ season: 2026, amount: 10000 }]);
    expect(bench.contract!.fa!.paid).toEqual([]);
    // Paid once a season, and counted against the cap.
    payIncentives(c, 2026);
    expect(regular.contract!.fa!.paid).toHaveLength(1);
    expect(capPay(regular, 2026)).toBe(30000 + 10000);
  });

  it('club options are the club’s to take up; a player with an opt-out leaves when the market pays more', () => {
    const { c } = clone();
    const [a, b] = Object.values(c.players).filter((x) => x.teamId === EXPANSION_ID && x.status === 'active' && !x.origin.asiaQuota && x.origin.kind !== 'foreign');
    const n = c.offseason!.year + 1;
    a!.contract = faContract(EXPANSION_ID, n - 2, { years: 2, bonus: 0, annual: 20000, options: 0, extra: { years: 1, holder: 'club' } }, a!);
    b!.contract = faContract(EXPANSION_ID, n - 2, { years: 2, bonus: 0, annual: 20000, options: 0, extra: { years: 1, holder: 'club' } }, b!);
    settleClubOptions(c, [a!.id], [a!.id, b!.id], n);
    expect(salaryIn(a!, n)).toBe(20000);
    expect(b!.service.optionFree).toBe(n - 1);
    expect(freeAgentsFor(c, n).map((x) => x.id)).toContain(b!.id);
    // A player option at a salary far under his price: he opts out.
    const star = Object.values(c.players).find((x) => x.teamId && x.teamId !== EXPANSION_ID && x.status === 'active' && ageIn(x, n) <= 33 && faPrice(x, n).annual > 30000 && x.origin.kind !== 'foreign')!;
    star.contract = faContract(star.teamId!, n - 2, { years: 2, bonus: 0, annual: 3000, options: 0, extra: { years: 2, holder: 'player' } }, star);
    settlePeriodOptions(c, n);
    expect(star.service.optionFree).toBe(n - 1);
  });

  it('cuts half of 1/300 of a 3억+ salary for each day a player is sent down', () => {
    const { c } = clone();
    const p = Object.values(c.players).find((x) => x.teamId && x.status === 'active' && x.origin.kind !== 'foreign' && x.career.some((r) => r.year === 2026 && !r.level))!;
    const year = 2026;
    p.contract = { teamId: p.teamId!, kind: 'standard', signedIn: 2025, signingBonus: 0, salaries: [{ season: year, amount: 60000 }] };
    const rec = p.career.find((r) => r.year === year && !r.level)!;
    c.schedule = [{ ...c.schedule[0]!, date: `${year}-03-28` }, { ...c.schedule[0]!, date: `${year}-09-30` }] as LeagueState['schedule'];
    rec.days = 100;
    for (const r of p.career.filter((x) => x.year === year && !x.level && x !== rec)) r.days = 0;
    const span = 187;
    expect(demotionCut(c, p, year)).toBe(Math.round((60000 / 300) * 0.5 * (span - 100)));
    p.contract.salaries[0]!.amount = 20000;
    expect(demotionCut(c, p, year)).toBe(0);
  });
});

describe('promises', () => {
  it('a starting job promised and not given is a broken promise; a reinforcement brought in keeps the other', () => {
    const { c, cm } = clone();
    const hitters = Object.values(c.players).filter((x) => x.teamId === EXPANSION_ID && x.position && x.origin.kind !== 'foreign');
    const [benched, other] = hitters;
    benched!.contract = faContract(EXPANSION_ID, 2026, { years: 2, bonus: 0, annual: 20000, options: 0, promises: ['starter'] }, benched!);
    benched!.career = benched!.career.filter((r) => r.year !== 2026);
    benched!.career.push({ year: 2026, teamId: EXPANSION_ID, age: 30, days: 40, bat: { ...emptyBat(), g: 30 }, pit: null, war: 0 });
    judgeStarterPromises(c, 2026);
    expect(c.user!.promises?.at(-1)).toMatchObject({ id: benched!.id, kind: 'starter', kept: false });
    expect(c.alerts?.some((x) => x.id === `fa-promise-2026-${benched!.id}-starter`)).toBe(true);
    expect(promiseDoubt(c, 2026)).toBeGreaterThan(0);
    // The reinforce promise: judged before opening day against who was there when the market opened.
    const n = cm.year + 1;
    other!.contract = { ...faContract(EXPANSION_ID, n, { years: 3, bonus: 0, annual: 20000, options: 0, promises: ['reinforce'] }, other!, 'SP')! };
    const sp = Object.values(c.players).find((x) => x.teamId && x.teamId !== EXPANSION_ID && x.role === 'SP' && x.scouting.current >= FA.promise.reinforceValue && x.origin.kind !== 'foreign')!;
    judgeReinforcePromises(c, cm, n);
    expect(c.user!.promises?.at(-1)).toMatchObject({ id: other!.id, kind: 'reinforce', kept: false });
    other!.contract!.fa!.kept = {};
    movePlayer(c, sp, EXPANSION_ID);
    judgeReinforcePromises(c, cm, n);
    expect(c.user!.promises?.at(-1)).toMatchObject({ id: other!.id, kind: 'reinforce', kept: true });
  });
});

describe('saves', () => {
  it('a 0.7.8 save waiting on the old market opens the new one', () => {
    const old = JSON.parse(JSON.stringify(s)) as LeagueState & { offseason: Record<string, unknown> };
    delete old.offseason.fa;
    old.pending = { kind: 'faMarket', candidates: [], grades: {}, limit: 1 } as unknown as LeagueState['pending'];
    const text = serializeSave({ ...makeSave(s.seed, [], { at: { year: 2026, phase: 'offseason' }, state: old }), sim: '0.7.8' });
    const save = parseSave(text);
    expect(save.sim).toBe(SIM_VERSION);
    const st = save.snapshot!.state as LeagueState;
    expect(st.pending?.kind).toBe('faRound');
    expect(st.offseason!.fa!.order.length).toBeGreaterThan(0);
  });
});
