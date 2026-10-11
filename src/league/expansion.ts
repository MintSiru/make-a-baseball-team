import { k as __i18n_k } from '../i18n/index';
/* The user's expansion club: founding in summer 2026, the first drafts, the special draft from the
   other clubs, free agents, foreign players and the step up to the first team.

   Rules follow the NC (2011–13) and KT (2013–15) precedents where known (docs/RULES.md §8) and the
   game assumptions in RULES.md §9. Money is in 만 원 (10,000 = 1억). */
import { employedAlumni, fameOf } from './alumni';
import { startYear } from './era';
import { generateDraftPool, rng } from '../draftroom';
import { cityById } from '../club/cities';
import { scenarioDef, supportFactor } from './scenarios';
import { aiFantasyChoice, isFantasyWinter, makeFantasyPick } from './fantasy';
import { baseSupport, electMayor } from './parent';
import { capPlayers, foreignCap, foreignCost, slotForeigners } from './foreigncap';
import { milestone, unlock } from './milestones';
import type { ParentCompanyType } from '../club/types';
import { fromDraftProspect, placeClass } from '../model/player';
import type { Player, PlayerId, Team, TeamId } from '../model/types';
import { EXPANSION_DEFAULTS, KBO_2026, minimumSalaryFor } from '../rules/kbo2026';
import { foreignContract, MANWON_PER_USD, renewSalary, salaryIn, usdTotal } from './contracts';
import { splitContract, usd } from './foreign';
import { dealTotal, reply, signsElsewhere, suggestedOffer, termsFor, type ForeignOffer } from './foreigntalks';
import { projectedPayroll as marketPayroll } from './market';
import { clubOptionsDue } from './fa';
import { foreignSlots } from './manager';
import {
  advanceOffseason,
  aiDraftChoice,
  aiForeignRenewals,
  developmentContract,
  foreignOn,
  makePick,
  removeFromRoster,
  foreignLeaves,
  foreignRenewalAsk,
  lastRecord,
  rosterLimit,
  setOffseasonHooks,
  sign,
  standardSlots,
  type OffseasonStep,
} from './offseason';
import { ageIn, currentValue, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { DIFFICULTY, FOREIGN_TALKS, OFFSEASON, PARENT } from './tuning';
import { foreignPoolAsk, foreignPoolPlayers, leavePool, poolEntry } from './foreignpool';
import { marchEvents, nextNationalDecision, novemberEvents } from './national';
import { disputeDecision } from './dispute';
import { homecomings } from './returnees';
import { autoProtect, checkRival, checkRivalProtect, resolveRival, resolveRivalProtect, rivalDecision, rivalProtectDecision, rivalStep } from './rival';
import {
  autoAnnual,
  campDecision,
  checkAnnual,
  developmentDecision,
  isAnnual,
  militaryDecision,
  retireDecision,
  resolveAnnual,
  rookieBonusDecision,
  salariesDecision,
  postingDecision,
  sponsorDecision,
  staffDecision,
  yearlyGrant,
  type AnnualInput,
} from './userclub';
import { developmentIds, emptyRoster, firstTeamIds, orgIds, registeredIds, type Decision, type DraftSlot, type ExpansionSettings, type LeagueState, type RivalSettings, type UserClub } from './state';

export const EXPANSION_ID = 'new';
export const FOUNDING_DATE = '2026-07-01';
/** July 1 of the starting year (2026, or earlier for 「백 투 더 패스트」). */
export const foundingDate = () => `${startYear()}-07-01`;

// ── Money and difficulty ─────────────────────────────────────────────────────────────────────────

/** Game assumptions until the finance system (V0.6): what each kind of owner puts in. 만 원. */
const PARENT_MONEY: Record<ParentCompanyType, { fund: number; payroll: number; developmentFund: number }> = {
  conglomerate: { fund: 3_200_000, payroll: 1_100_000, developmentFund: 1_000_000 },
  midsize: { fund: 2_300_000, payroll: 850_000, developmentFund: 400_000 },
  namingRights: { fund: 1_700_000, payroll: 700_000, developmentFund: 200_000 },
  citizen: { fund: 1_400_000, payroll: 550_000, developmentFund: 200_000 },
};
const DIFFICULTY_MONEY = DIFFICULTY.money;

export const STADIUM_PLANS = {
  existing: { label: __i18n_k("league.expansion.existing.label.eb9ed559"), seats: null as number | null, opens: null as number | null },
  // Opening three to five seasons after the founding (2029–2031 in the usual calendar).
  newMedium: { label: __i18n_k("league.expansion.newMedium.label.ce1f6012"), seats: 15_000, get opens() { return startYear() + 3; } },
  newLarge: { label: __i18n_k("league.expansion.newLarge.label.b74bcba1"), seats: 22_000, get opens() { return startYear() + 4; } },
  dome: { label: __i18n_k("league.expansion.dome.label.db5119df"), seats: 20_000, get opens() { return startYear() + 5; } },
} as const;

export function budgetFor(settings: ExpansionSettings) {
  const m = PARENT_MONEY[settings.parentType];
  const city = cityById(settings.cityId)!;
  const k = DIFFICULTY_MONEY[settings.difficulty];
  const marketAdj = (city.market - 60) * 400; // ±0.4억 per market point
  const stadiumAdj = settings.stadium === 'existing' ? 0 : 50_000;
  // A scenario's owner may be richer or poorer than the usual (1.6.0).
  const sc = scenarioDef(settings.scenario)?.money;
  return {
    fund: Math.round(m.fund * k * (sc?.fund ?? 1)),
    payrollBudget: Math.round((m.payroll + marketAdj + stadiumAdj) * k * (sc?.payroll ?? 1)),
    entryFee: EXPANSION_DEFAULTS.entryFee,
    developmentFund: m.developmentFund,
    deposit: EXPANSION_DEFAULTS.deposit,
  };
}

/** Felt difficulty, 1 (easy) to 5 (hard) stars, from money, market and ballpark. */
export function difficultyStars(settings: ExpansionSettings): number {
  const b = budgetFor(settings);
  const city = cityById(settings.cityId)!;
  const money = 1 - Math.min(1, b.payrollBudget / 1_200_000);
  const market = 1 - city.market / 100;
  const seats = settings.stadium === 'existing' ? city.stadium.seats : STADIUM_PLANS[settings.stadium].seats!;
  const park = seats < 10_000 ? 1 : seats < 15_000 ? 0.5 : 0;
  const base = { easy: -0.08, normal: 0, hard: 0.08 }[settings.difficulty];
  // The owner beyond its money (V0.16): in the balance runs a citizen club was the hardest by far, more than its
  // budget alone shows (docs/BALANCE.md).
  const owner = { conglomerate: 0, midsize: 0.03, namingRights: 0.03, citizen: 0.12 }[settings.parentType];
  return Math.max(1, Math.min(5, Math.round(1 + (money * 0.5 + market * 0.3 + park * 0.2 + base + owner) * 5)));
}

/**
 * What this combination will be hard about (1.6.0, from the 1.4 review): concrete risks beyond the stars, from the
 * market, the ballpark, the owner, the start and the rules chosen.
 */
export function foundingRisks(settings: ExpansionSettings): string[] {
  const b = budgetFor(settings);
  const city = cityById(settings.cityId)!;
  const out: string[] = [];
  const eok = (n: number) => __i18n_k("league.expansion.foundingRisks.eok.db0fc332", { value: Math.round(n / 10000) });
  const foreign = Math.round((OFFSEASON.foreign.newReserveUSD * 3 + KBO_2026.foreign.asiaQuotaCapUSD) * MANWON_PER_USD);
  out.push(__i18n_k("league.expansion.foundingRisks.fa4f3aab", { eok: eok(foreign), eok2: eok(b.payrollBudget), value: Math.round((foreign / b.payrollBudget) * 100) }));
  if (city.market < 50) out.push(__i18n_k("league.expansion.foundingRisks.b43324b9", { market: city.market }));
  else if (city.market >= 75) out.push(__i18n_k("league.expansion.foundingRisks.a334a86c", { market: city.market, competition: city.competition }));
  const seats = settings.stadium === 'existing' ? city.stadium.seats : null;
  if (seats != null && seats < 10_000) out.push(__i18n_k("league.expansion.foundingRisks.46e7df40", { name: city.stadium.name, value: seats.toLocaleString('ko-KR') }));
  if (settings.stadium !== 'existing') out.push(__i18n_k("league.expansion.foundingRisks.55abc3c9", { opens: STADIUM_PLANS[settings.stadium].opens, name: city.stadium.name }));
  if (settings.parentType === 'conglomerate') out.push(__i18n_k("league.expansion.foundingRisks.a15cfdb2"));
  if (settings.parentType === 'midsize') out.push(__i18n_k("league.expansion.foundingRisks.49d0c912"));
  if (settings.parentType === 'namingRights') out.push(__i18n_k("league.expansion.foundingRisks.7e7cc5ec"));
  if (settings.parentType === 'citizen') out.push(__i18n_k("league.expansion.foundingRisks.e09fbc64"));
  out.push(settings.promotion === 'immediate' ? __i18n_k("league.expansion.foundingRisks.0746f336") : __i18n_k("league.expansion.foundingRisks.7e610145"));
  if (settings.firing) out.push(__i18n_k("league.expansion.foundingRisks.8a38701e", { fireBelow: PARENT.fireBelow, value: settings.scenario === 'comeback' ? __i18n_k("league.expansion.foundingRisks.ea3abb94") : '' }));
  if (settings.difficulty === 'hard') out.push(__i18n_k("league.expansion.foundingRisks.1e12cf59"));
  return out;
}

const user = (s: LeagueState): UserClub => {
  if (!s.user) throw new Error('no user club');
  return s.user;
};
/** Pays from the fund. Founding fees are capital: the owner's yearly support does not cover them. */
const spend = (s: LeagueState, label: string, amount: number, capital = false) => {
  const u = user(s);
  u.fund -= amount;
  u.ledger.push({ year: s.year, label, amount: -amount, ...(capital ? { capital } : {}) });
};

// ── Founding ─────────────────────────────────────────────────────────────────────────────────────

export function foundClub(s: LeagueState, settings: ExpansionSettings) {
  if (s.user) throw new Error('a club is already founded');
  const city = cityById(settings.cityId);
  if (!city) throw new Error(`unknown city ${settings.cityId}`);
  const y0 = startYear();
  const firstTeamYear = settings.promotion === 'immediate' ? y0 + 1 : y0 + 2;
  const plan = STADIUM_PLANS[settings.stadium];
  const team: Team = {
    id: EXPANSION_ID,
    name: settings.name.trim(),
    short: settings.short.trim(),
    color: settings.color,
    region: city.name,
    kind: 'expansion',
    founded: y0,
    firstTeamFrom: firstTeamYear,
    benefitsUntil: firstTeamYear + EXPANSION_DEFAULTS.benefitSeasons - 1,
    parent: { type: settings.parentType, name: settings.parentName.trim() },
    stadium: { name: city.stadium.name, size: city.stadium.seats < 10_000 ? 'small' : 'medium', capacity: city.stadium.seats, ownership: 'municipalLease' },
  };
  s.teams.push(team);
  s.rosters[EXPANSION_ID] = emptyRoster();
  const b = budgetFor(settings);
  s.user = { teamId: EXPANSION_ID, settings, fund: b.fund, payrollBudget: b.payrollBudget, firstTeamYear, ledger: [], support: Math.round(baseSupport(settings.parentType) * DIFFICULTY_MONEY[settings.difficulty] * supportFactor(settings)), trust: scenarioDef(settings.scenario)?.owner?.startTrust ?? PARENT.startTrust, budgetScale: 1 };
  if (settings.scenario) s.user.scenario = { status: 'active' };
  // A citizen club is founded by the mayor elected in June 2026 (parent.ts).
  if (settings.parentType === 'citizen') s.user.mayor = electMayor(s, y0);
  spend(s, __i18n_k("league.expansion.foundClub.b77f9a73"), b.entryFee, true);
  spend(s, __i18n_k("league.expansion.foundClub.db42ddad"), b.developmentFund, true);
  s.user.ledger.push({ year: s.year, label: __i18n_k("league.expansion.foundClub.label.6c985efe", { value: b.deposit / 10000 }), amount: 0 });
  if (plan.opens) s.user.ledger.push({ year: s.year, label: __i18n_k("league.expansion.foundClub.label.4fa11646", { label: plan.label, opens: plan.opens }), amount: 0 });
  // 1.6.0, scenario 강철야구: the first squad is retired players and players nobody drafted, and a bigger tryout.
  s.pending = settings.scenario === 'steel' ? { kind: 'tryout', candidates: [...comebackPool(s), ...tryoutPool(s).filter((p) => p.status === 'amateur')].map((p) => p.id), max: STEEL.tryout } : { kind: 'tryout', candidates: tryoutPool(s).map((p) => p.id), max: 20 };
  milestone(s, y0, __i18n_k("league.expansion.foundClub.01955d41", { foundingDate: foundingDate(), name: team.name, name2: city.name }), 'founded');
  unlock(s, 'founded', y0);
}

/** 강철야구: how many it signs at the tryout, and the retired players it looks at (the best now, the famous first on a tie). */
const STEEL = { tryout: 36, retired: 30, maxAge: 41, retiredSince: 8 } as const;

/** Retired players who could come back: a first-team career, retired lately, not on any club's staff. */
function comebackPool(s: LeagueState): Player[] {
  const y0 = startYear();
  const staff = employedAlumni(s);
  return Object.values(s.players)
    .filter((p) => p.status === 'retired' && !isForeign(p) && p.career.some((c) => !c.level) && (p.career.at(-1)?.year ?? 0) >= y0 - STEEL.retiredSince && ageIn(p, y0 + 1) <= STEEL.maxAge && !staff.has(p.id))
    .sort((a, b) => currentValue(b) + fameOf(s, b) * 0.1 - (currentValue(a) + fameOf(s, a) * 0.1))
    .slice(0, STEEL.retired);
}

/** Independent-league players, overseas returnees and recently released pros for the founding tryout. */
function tryoutPool(s: LeagueState): Player[] {
  const y0 = startYear();
  // The usual calendar keeps its seed (the same tryout as before 1.6.0).
  const seed = `${s.seed}|tryout|${y0}`;
  const pool = placeClass(
    generateDraftPool(seed)
      .players.filter((p) => ['독립구단', '해외독립 복귀', '마이너 복귀', '대졸'].includes(p.pathway) && p.age >= 21)
      .map((p) => fromDraftProspect(p, y0, seed))
      .map((p) => ({ ...p, id: `t${y0}-${p.origin.sourceId}` })),
    seed,
  )
    .sort((a, b) => keepValue(b, y0 + 1) - keepValue(a, y0 + 1))
    .slice(0, 25);
  for (const p of pool) s.players[p.id] = p;
  const released = Object.values(s.players)
    .filter((p) => p.status === 'retired' && p.career.length && (p.career.at(-1)?.year ?? 0) >= y0 - 1 && ageIn(p, y0 + 1) <= 33)
    .sort((a, b) => keepValue(b, y0 + 1) - keepValue(a, y0 + 1))
    .slice(0, 15);
  return [...released, ...pool];
}

// ── Offseason hooks ──────────────────────────────────────────────────────────────────────────────

const inFoundingPeriod = (s: LeagueState, next: number) => !!s.user && next <= s.user.firstTeamYear;

/** Draft order before a new club reaches the first team (the user's, and since V0.9 the twelfth club): priority
    picks, first in every round, extra picks after round two. */
function draftSlots(s: LeagueState, draftYear: number, order: TeamId[]): DraftSlot[] {
  const founding: { teamId: TeamId; first: boolean }[] = [];
  const u = s.user;
  if (u && !order.includes(u.teamId) && draftYear + 1 <= u.firstTeamYear) founding.push({ teamId: u.teamId, first: draftYear === startYear() });
  const tw = s.twelve;
  if (tw && !order.includes(tw.teamId) && draftYear + 1 <= tw.firstTeam) founding.push({ teamId: tw.teamId, first: draftYear === tw.founded });
  if (!founding.length) return standardSlots(order);
  const slots: DraftSlot[] = [];
  for (const f of founding) if (f.first) for (let i = 0; i < EXPANSION_DEFAULTS.rookiePriorityPicks; i++) slots.push({ teamId: f.teamId, label: __i18n_k("league.expansion.draftSlots.label.b31947fa") });
  const rounds = standardSlots(order).length / order.length;
  for (let round = 1; round <= rounds; round++) {
    for (const f of founding) slots.push({ teamId: f.teamId, label: `${round}R` });
    for (const teamId of order) slots.push({ teamId, label: `${round}R` });
    if (round === 2) for (const f of founding) if (f.first) for (let i = 0; i < EXPANSION_DEFAULTS.extraPicksAfterRound2; i++) slots.push({ teamId: f.teamId, label: __i18n_k("league.expansion.draftSlots.label.c6ab1579") });
  }
  return slots;
}

/** Each existing club protects its best 20 eligible players (foreign players, soldiers and new signings are exempt). */
export function protectedLists(s: LeagueState, next: number) {
  const lists: Record<TeamId, PlayerId[]> = {};
  for (const teamId of firstTeamIds(s, next - 1)) {
    if (teamId === s.user?.teamId) continue;
    const eligible = registeredIds(s, teamId)
      .map((id) => s.players[id]!)
      .filter((p) => !isForeign(p) && p.proSince < next && !(p.contract?.kind === 'freeAgent' && p.contract.signedIn === next - 1));
    const ranked = eligible.sort((a, b) => keepValue(b, next) - keepValue(a, next));
    lists[teamId] = ranked.slice(EXPANSION_DEFAULTS.specialDraft.protected).map((p) => p.id);
  }
  return lists;
}

function foreignCandidates(s: LeagueState, next: number): Player[] {
  const out: Player[] = [];
  const specs: ['pitcher' | 'hitter', boolean, number][] = [
    ['pitcher', false, 8],
    ['hitter', false, 6],
    ['pitcher', true, 4],
    ['hitter', true, 2],
  ];
  let k = 0;
  const r = rng(`${s.seed}|foreign-offer|${next}`);
  for (const [kind, asia, n] of specs)
    for (let i = 0; i < n; i++) {
      const p = makeForeign(s.seed, `fc${next}-${k++}`, next, { kind, asiaQuota: asia });
      p.status = 'amateur';
      // Asking price from the scout's grade and his background; new signings are capped at 100만 달러 (20만 for the Asia quota).
      p.contract = foreignContract(EXPANSION_ID, next, splitContract(p.origin.background!.ask, r), asia);
      s.players[p.id] = p;
      out.push(p);
    }
  // Foreign players with KBO experience other clubs let go (V0.7.3): the same cap, priced by their KBO record.
  for (const p of foreignPoolPlayers(s)) {
    p.contract = foreignContract(EXPANSION_ID, next, splitContract(foreignPoolAsk(s, p), rng(`${s.seed}|foreign-pool-offer|${next}|${p.id}`)), !!p.origin.asiaQuota);
    out.push(p);
  }
  return out;
}

function decide(s: LeagueState, step: OffseasonStep): Decision | null {
  const u = s.user;
  const o = s.offseason;
  if (!u || !o) return null;
  const next = o.year + 1;
  const entering = next === u.firstTeamYear;
  const space = rosterLimit(next) - registeredIds(s, u.teamId).length;
  switch (step) {
    case 'military':
      return militaryDecision(s);
    case 'international':
      // A November national team with our players first (V0.12), then the sponsor.
      return nextNationalDecision(s, novemberEvents(o.year)) ?? sponsorDecision(s, o.year);
    case 'develop':
      // The twelfth club (V0.9): founded this winter, or offered by the board; a naming-rights club's rare
      // shareholder dispute (V0.12).
      return rivalDecision(s, o.year) ?? disputeDecision(s, o.year);
    case 'retire':
      // Staff first; our players who want to retire follow (V0.11, userclub.ts).
      return staffDecision(s, o.year) ?? retireDecision(s);
    case 'posting': {
      // Posted players coming home first (their clubs hold the rights), then this winter's postings.
      const back = homecomings(s, next);
      return back.length ? { kind: 'returnee', rows: back } : postingDecision(s, next);
    }
    case 'renew':
      return salariesDecision(s);
    case 'camp':
      // The March tournament's squad (V0.12), then the camp plans.
      return nextNationalDecision(s, marchEvents(next)) ?? campDecision(s);
    case 'freeAgency': {
      if (isFantasyWinter(s, o.year)) return null;
      // Club options on free-agent deals that end now, before the market opens (the market itself runs in the step).
      const due = clubOptionsDue(s, u.teamId, next);
      return due.length ? { kind: 'faOptions', rows: due.map((p) => ({ id: p.id, years: p.contract!.fa!.extra!.years, annual: p.contract!.fa!.extra!.annual })) } : null;
    }
    case 'special':
      // None in the fantasy draft's winter (1.6.0): the clubs have just drafted the whole league; and 강철야구 builds
      // its first team without the other clubs' players.
      if (isFantasyWinter(s, o.year) || (entering && u.settings.scenario === 'steel')) return null;
      // Our own special draft in our founding winter; later, the twelfth club's, where we protect our 20.
      if (!entering) return rivalProtectDecision(s, next);
      return { kind: 'specialDraft', lists: protectedLists(s, next), protectedCount: EXPANSION_DEFAULTS.specialDraft.protected, fee: EXPANSION_DEFAULTS.specialDraft.feePerPlayer };
    case 'check': {
      // The AI never cuts the user's club; over the limit (after foreign signings), the user chooses whom to release.
      const size = registeredIds(s, u.teamId).length;
      if (size <= rosterLimit(next)) return null;
      const candidates = registeredIds(s, u.teamId).filter((id) => !isForeign(s.players[id]!));
      return { kind: 'roster', candidates, release: size - rosterLimit(next), limit: rosterLimit(next) };
    }
    case 'released': {
      // Every winter the user's club gets the first look at players the other clubs let go.
      if (space <= 0) return null;
      const candidates = o.released.map((id) => s.players[id]!).filter((p) => p && keepValue(p, next) >= 40);
      return candidates.length ? { kind: 'released', candidates: candidates.map((p) => p.id), max: space } : null;
    }
    case 'foreign': {
      // The AI clubs settle their own foreign players first, so the ones they let go can be signed.
      aiForeignRenewals(s, next);
      if (next < u.firstTeamYear) return null; // no foreign players in the futures year (NC precedent)
      // First our own: re-sign or let go (V0.5); the signing decision follows.
      return foreignRenewDecision(s, next) ?? foreignSigningDecision(s, next);
    }
    default:
      return null;
  }
}

/** The user's foreign players whose contracts end: what each asks to stay, and who is leaving anyway. */
export function foreignRenewDecision(s: LeagueState, next: number): Decision | null {
  const u = user(s);
  const ending = foreignOn(s, u.teamId).filter((p) => !p.contract?.salaries.some((x) => x.season >= next));
  if (!ending.length) return null;
  return {
    kind: 'foreignRenew',
    rows: ending.map((p) => ({ id: p.id, ask: foreignRenewalAsk(p, next), war: lastRecord(p, next - 1)?.war ?? 0, leaving: foreignLeaves(s, p, next) })),
  };
}

/**
 * While the free-agent market is open (V0.16): about what next season's foreign players will add to the payroll
 * budget, since they sign at the end of the winter, after the free agents — the asks of those whose deals end
 * and a typical new signing for each slot still open. Offers that leave no room for them leave the club short.
 */
export function foreignReserve(s: LeagueState, teamId: TeamId, next: number): number {
  const slots = foreignSlots(s, teamId, next);
  const all = foreignOn(s, teamId);
  const ending = all.filter((p) => !p.contract?.salaries.some((x) => x.season >= next));
  const taking = slotForeigners(s, teamId, next);
  const count = (asia: boolean) => taking.filter((p) => !!p.origin.asiaQuota === asia).length;
  const usd =
    ending.reduce((a, p) => a + foreignRenewalAsk(p, next), 0) +
    Math.max(0, slots.regular - count(false)) * OFFSEASON.foreign.newReserveUSD +
    Math.max(0, slots.asia - count(true)) * KBO_2026.foreign.asiaQuotaCapUSD;
  return Math.round(usd * MANWON_PER_USD);
}

/** New foreign signings for the open slots, or null when every slot is filled. */
export function foreignSigningDecision(s: LeagueState, next: number): Decision | null {
  const u = user(s);
  const slots = foreignSlots(s, u.teamId, next);
  const have = slotForeigners(s, u.teamId, next);
  const regular = slots.regular - have.filter((p) => !p.origin.asiaQuota).length;
  const asia = slots.asia - have.filter((p) => p.origin.asiaQuota).length;
  if (regular <= 0 && asia <= 0) return null;
  const candidates = foreignCandidates(s, next);
  // 1.3.0: talks, not a price list (foreigntalks.ts): each one's ask, his club's fee, any offer elsewhere.
  const terms = Object.fromEntries(candidates.map((p) => [p.id, termsFor(s.seed, next, p, usdTotal(p.contract))]));
  return { kind: 'foreign', candidates: candidates.map((p) => p.id), regular, asia, terms, round: 1 };
}

setOffseasonHooks({ begin: yearlyGrant, draftSlots, decide, rookies: rookieBonusDecision, development: developmentDecision, auto: rivalStep });

// ── Resolving decisions ──────────────────────────────────────────────────────────────────────────

export type DecisionInput =
  | { kind: 'tryout'; ids: PlayerId[] }
  | { kind: 'draftPick'; id: PlayerId | null } // null: let the scouts pick
  /** 판타지 드래프트 (1.6.0): a player, or null for the scouts' pick; `autoUntil` hands our picks to the scouts through that round. */
  | { kind: 'fantasyPick'; id: PlayerId | null; autoUntil?: number }
  | { kind: 'specialDraft'; picks: Record<TeamId, PlayerId> }
  | { kind: 'released'; ids: PlayerId[] }
  /** `offers`: what we offer each (1.3.0; his ask within the cap when missing). */
  | { kind: 'foreign'; ids: PlayerId[]; offers?: Record<PlayerId, ForeignOffer> }
  | { kind: 'roster'; ids: PlayerId[]; develop?: PlayerId[] }
  /** The twelfth club (V0.9): its design, or null to vote it down when the board offers it. */
  | { kind: 'rival'; settings: RivalSettings | null }
  | { kind: 'rivalProtect'; ids: PlayerId[] }
  | AnnualInput;

const isAnnualInput = (input: DecisionInput): input is AnnualInput => isAnnual(input.kind);
const nextSeasonOf = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year + 1);

/** Next season's payroll, counting the renewal estimate for players whose salary is not set yet. */
export const projectedPayroll = (s: LeagueState, teamId: TeamId, season: number) => marketPayroll(s, teamId, season);

/** Checks a decision against the rules and the budget. Returns a message for the player, or null when it is fine. */
export function checkDecision(s: LeagueState, input: DecisionInput): string | null {
  const d = s.pending;
  const u = user(s);
  if (!d || d.kind !== input.kind) return __i18n_k("league.expansion.checkDecision.d443b36f");
  if (isAnnualInput(input)) return checkAnnual(s, d, input);
  const next = nextSeasonOf(s);
  const payrollAfter = (ids: PlayerId[]) => projectedPayroll(s, u.teamId, next) + ids.reduce((a, id) => a + (salaryIn(s.players[id]!, next) || renewSalary(s.players[id]!, next)), 0);
  switch (input.kind) {
    case 'tryout':
    case 'released': {
      const dd = d as Extract<Decision, { kind: 'tryout' | 'released' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.expansion.checkDecision.98ce3a2b");
      if (input.ids.length > dd.max) return __i18n_k("league.expansion.checkDecision.3c960698", { max: dd.max });
      return null;
    }
    case 'fantasyPick': {
      const f = s.offseason?.fantasy;
      if (!f) return __i18n_k("league.expansion.checkDecision.3fa20ab1");
      if (input.id && !f.pool.includes(input.id)) return __i18n_k("league.expansion.checkDecision.11dcd2b0");
      if (input.autoUntil != null && (!Number.isInteger(input.autoUntil) || input.autoUntil < 1)) return __i18n_k("league.expansion.checkDecision.67c59ed1");
      return null;
    }
    case 'draftPick': {
      const draft = s.offseason?.draft;
      if (!draft) return __i18n_k("league.expansion.checkDecision.0ed089e1");
      if (input.id && !draft.pool.includes(input.id)) return __i18n_k("league.expansion.checkDecision.11dcd2b0");
      return null;
    }
    case 'specialDraft': {
      const dd = d as Extract<Decision, { kind: 'specialDraft' }>;
      for (const [teamId, id] of Object.entries(input.picks)) if (!dd.lists[teamId]?.includes(id)) return __i18n_k("league.expansion.checkDecision.c53e54a2");
      const cost = Object.keys(input.picks).length * dd.fee;
      if (cost > u.fund) return __i18n_k("league.expansion.checkDecision.7fe7aebf", { value: cost / 10000 });
      if (cost > 0 && payrollAfter(Object.values(input.picks)) > u.payrollBudget) return __i18n_k("league.expansion.checkDecision.84d90a10");
      return null;
    }
    case 'roster': {
      const dd = d as Extract<Decision, { kind: 'roster' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.expansion.checkDecision.cbbbf8df");
      if (input.ids.length < dd.release) return __i18n_k("league.expansion.checkDecision.a1e081c4", { limit: dd.limit, release: dd.release });
      const develop = input.develop ?? [];
      if (develop.some((id) => !input.ids.includes(id))) return __i18n_k("league.expansion.checkDecision.22686096");
      // Only new conversions count: a club can already be over the cap through trades or the second draft.
      if (develop.length && developmentIds(s, u.teamId).length + develop.length > OFFSEASON.development.cap) return __i18n_k("league.expansion.checkDecision.bb840372", { cap: OFFSEASON.development.cap });
      return null;
    }
    case 'rival':
      return checkRival(s, d as Extract<Decision, { kind: 'rival' }>, input.settings);
    case 'rivalProtect':
      return checkRivalProtect(d as Extract<Decision, { kind: 'rivalProtect' }>, input.ids);
    case 'foreign': {
      const dd = d as Extract<Decision, { kind: 'foreign' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.expansion.checkDecision.98ce3a2b");
      const picked = input.ids.map((id) => s.players[id]!);
      if (picked.filter((p) => !p.origin.asiaQuota).length > dd.regular) return __i18n_k("league.expansion.checkDecision.96e5184c", { regular: dd.regular });
      if (picked.filter((p) => p.origin.asiaQuota).length > dd.asia) return __i18n_k("league.expansion.checkDecision.b5555ee3", { asia: dd.asia });
      let payroll = projectedPayroll(s, u.teamId, next),
        fees = 0;
      for (const p of picked) {
        const t = dd.terms?.[p.id];
        if (!t) {
          payroll += salaryIn(p, next);
          continue;
        }
        const o = input.offers?.[p.id] ?? suggestedOffer(t, newSigningCap(p));
        if (!(o.guaranteed > 0) || !(o.options >= 0)) return __i18n_k("league.expansion.checkDecision.4291e95d", { name: p.name });
        if (dealTotal(t, o) > newSigningCap(p)) return __i18n_k("league.expansion.checkDecision.b75d2c42", { name: p.name, usd: usd(newSigningCap(p)) });
        payroll += Math.round(o.guaranteed * MANWON_PER_USD);
        fees += Math.round(t.fee * MANWON_PER_USD);
      }
      if (input.ids.length && payroll > u.payrollBudget) return __i18n_k("league.expansion.checkDecision.84d90a10");
      if (fees > 0 && fees > u.fund) return __i18n_k("league.expansion.checkDecision.3db45ed5");
      return null;
    }
  }
}

/** Applies a checked decision and lets the game go on. Throws when the decision breaks a rule. */
export function resolveDecision(s: LeagueState, input: DecisionInput) {
  const problem = checkDecision(s, input);
  if (problem) throw new Error(problem);
  const u = user(s);
  const next = nextSeasonOf(s);
  const d = s.pending!;
  if (isAnnualInput(input)) {
    s.pending = resolveAnnual(s, d, input);
    if (!s.pending && s.offseason) advanceOffseason(s);
    return;
  }
  switch (input.kind) {
    case 'tryout': {
      for (const id of input.ids) {
        const p = s.players[id]!;
        const first = startYear() + 1;
        p.proSince = Math.max(p.proSince, first);
        sign(s, p, u.teamId, { teamId: u.teamId, kind: 'standard', signedIn: first - 1, signingBonus: 0, salaries: [{ season: first, amount: p.career.length ? renewSalary(p, first) : minimumSalaryFor(first) }] });
      }
      // Unchosen amateurs leave; unchosen released pros stay retired.
      for (const id of (d as Extract<Decision, { kind: 'tryout' }>).candidates) if (!input.ids.includes(id) && s.players[id]?.status === 'amateur') delete s.players[id];
      break;
    }
    case 'draftPick': {
      const draft = s.offseason!.draft!;
      const p = input.id ? s.players[input.id]! : aiDraftChoice(s, draft, u.teamId, draft.next + 1)!;
      makePick(s, draft, p);
      break;
    }
    case 'fantasyPick': {
      const f = s.offseason!.fantasy!;
      if (input.autoUntil) f.autoUntil = input.autoUntil;
      const p = input.id ? s.players[input.id]! : aiFantasyChoice(s, f, u.teamId);
      if (p) makeFantasyPick(s, f, p);
      break;
    }
    case 'specialDraft': {
      const fee = (d as Extract<Decision, { kind: 'specialDraft' }>).fee;
      for (const [teamId, id] of Object.entries(input.picks)) {
        const p = s.players[id]!;
        removeFromRoster(s, p);
        p.teamId = u.teamId;
        if (p.contract) p.contract.teamId = u.teamId;
        s.rosters[u.teamId]!.futures.push(p.id);
        spend(s, __i18n_k("league.expansion.resolveDecision.306fab83", { short: s.teams.find((t) => t.id === teamId)?.short, name: p.name }), fee);
      }
      break;
    }
    case 'released':
      for (const id of input.ids) {
        const p = s.players[id]!;
        sign(s, p, u.teamId, { teamId: u.teamId, kind: 'standard', signedIn: next - 1, signingBonus: 0, salaries: [{ season: next, amount: renewSalary(p, next) }] });
      }
      if (s.offseason) s.offseason.released = s.offseason.released.filter((id) => !input.ids.includes(id));
      break;
    case 'rival':
      resolveRival(s, d as Extract<Decision, { kind: 'rival' }>, input.settings);
      break;
    case 'rivalProtect':
      resolveRivalProtect(s, d as Extract<Decision, { kind: 'rivalProtect' }>, input.ids);
      break;
    case 'roster':
      // Released players join the pool other clubs look at; the rest retire. Some stay as development players.
      for (const id of input.ids) {
        const p = s.players[id]!;
        if (input.develop?.includes(id)) {
          p.contract = developmentContract(u.teamId, next);
          continue;
        }
        removeFromRoster(s, p);
        p.teamId = null;
        s.offseason?.released.push(id);
      }
      break;
    case 'foreign': {
      const again = resolveForeign(s, d as Extract<Decision, { kind: 'foreign' }>, input, next);
      // Another round of talks while slots are open and someone is still talking (1.3.0).
      if (again) {
        s.pending = again;
        return;
      }
      break;
    }
  }
  s.pending = null;
  if (s.offseason) advanceOffseason(s);
}

/** The cap on a new foreign signing, transfer fee included (RULES.md §5). */
export const newSigningCap = (p: Player) => (p.origin.asiaQuota ? KBO_2026.foreign.asiaQuotaCapUSD : KBO_2026.foreign.newContractCapUSD);

/** A round of foreign talks (1.3.0): the offered answer, the others may sign elsewhere; the next round, or null when the
    talks are over (every slot filled, nobody left, or three rounds). */
function resolveForeign(s: LeagueState, dd: Extract<Decision, { kind: 'foreign' }>, input: Extract<DecisionInput, { kind: 'foreign' }>, next: number): Decision | null {
  const u = user(s);
  const round = dd.round ?? 1;
  const log: string[] = [];
  const talking = new Set(dd.candidates);
  const signed: Player[] = [];
  const drop = (id: PlayerId) => {
    talking.delete(id);
    // New faces go away; KBO-experienced players stay on the market for the other clubs.
    if (poolEntry(s, id)) s.players[id]!.contract = null;
    else delete s.players[id];
  };
  for (const id of input.ids) {
    const p = s.players[id]!;
    const t = dd.terms?.[id];
    if (!t) {
      // A decision from before the talks: signed as listed.
      leavePool(s, id);
      sign(s, p, u.teamId, p.contract);
      talking.delete(id);
      signed.push(p);
      continue;
    }
    const offer = input.offers?.[id] ?? suggestedOffer(t, newSigningCap(p));
    const answer = reply(t, offer, round, `${s.seed}|foreign-talk|${next}|${id}|${round}`);
    if (answer.kind === 'accept') {
      const bonus = Math.round((offer.guaranteed * 0.2) / 10_000) * 10_000;
      const c = foreignContract(u.teamId, next, { bonus, salary: offer.guaranteed - bonus, options: offer.options }, !!p.origin.asiaQuota, newSigningCap(p));
      if (t.fee) {
        c.usd!.fee = t.fee;
        const won = Math.round(t.fee * MANWON_PER_USD);
        u.fund -= won;
        u.ledger.push({ year: next - 1, label: __i18n_k("league.expansion.resolveForeign.label.7bfb281d", { name: p.name }), amount: -won });
      }
      leavePool(s, id);
      sign(s, p, u.teamId, c);
      talking.delete(id);
      signed.push(p);
      log.push(__i18n_k("league.expansion.resolveForeign.bb2ee22c", { name: p.name, usd: usd(offer.guaranteed), value: offer.options ? __i18n_k("league.expansion.resolveForeign.7aade862", { usd: usd(offer.options) }) : '', value2: t.fee ? __i18n_k("league.expansion.resolveForeign.133dce41", { usd: usd(t.fee) }) : '' }));
    } else if (answer.kind === 'counter') {
      t.counter = answer.amount;
      t.last = 'counter';
      log.push(__i18n_k("league.expansion.resolveForeign.794d9cc2", { name: p.name, usd: usd(answer.amount) }));
    } else {
      log.push(__i18n_k("league.expansion.resolveForeign.3cdf40a5", { name: p.name }));
      drop(id);
    }
  }
  for (const line of log) (u.log ??= []).push({ year: next - 1, text: __i18n_k("league.expansion.resolveForeign.text.e8959e05", { round: round, line: line }) });
  // Those we did not talk to this round may sign somewhere else (on the talks' screen only).
  for (const id of [...talking]) {
    const t = dd.terms?.[id];
    if (!t || input.ids.includes(id)) continue;
    if (signsElsewhere(t, `${s.seed}|foreign-elsewhere|${next}|${id}|${round}`)) {
      log.push(__i18n_k("league.expansion.resolveForeign.bda6babd", { name: s.players[id]!.name, value: t.rival?.label ?? __i18n_k("league.expansion.resolveForeign.c094ff4c") }));
      drop(id);
    }
  }
  const regular = dd.regular - signed.filter((p) => !p.origin.asiaQuota).length;
  const asia = dd.asia - signed.filter((p) => p.origin.asiaQuota).length;
  const left = [...talking];
  const wanted = left.some((id) => (s.players[id]!.origin.asiaQuota ? asia > 0 : regular > 0));
  // No offer at all ends the talks.
  if (dd.terms && input.ids.length && round < FOREIGN_TALKS.rounds && wanted) return { kind: 'foreign', candidates: left, regular, asia, terms: Object.fromEntries(left.map((id) => [id, dd.terms![id]!])), round: round + 1, log };
  for (const id of left) drop(id);
  return null;
}

/** What the scouts would choose, for an "auto" button and for tests. */
export function autoDecision(s: LeagueState): DecisionInput | null {
  const d = s.pending;
  if (!d || !s.user) return null;
  if (isAnnual(d.kind)) return autoAnnual(s, d);
  const next = nextSeasonOf(s);
  const best = (ids: PlayerId[], n: number) => [...ids].sort((a, b) => keepValue(s.players[b]!, next) - keepValue(s.players[a]!, next)).slice(0, Math.max(0, n));
  switch (d.kind) {
    case 'tryout':
      return { kind: 'tryout', ids: best(d.candidates, 12) };
    case 'draftPick':
      return { kind: 'draftPick', id: null };
    case 'fantasyPick':
      return { kind: 'fantasyPick', id: null };
    case 'released':
      return { kind: 'released', ids: best(d.candidates, Math.min(d.max, 5)) };
    case 'specialDraft': {
      // Best unprotected player from each club, best clubs' picks first, while money and payroll allow.
      const options = Object.entries(d.lists)
        .map(([teamId, ids]) => [teamId, best(ids, 1)[0]] as const)
        .filter((x): x is readonly [TeamId, PlayerId] => !!x[1])
        .sort((a, b) => keepValue(s.players[b[1]]!, next) - keepValue(s.players[a[1]]!, next));
      const picks: Record<TeamId, PlayerId> = {};
      for (const [teamId, id] of options) if (checkDecision(s, { kind: 'specialDraft', picks: { ...picks, [teamId]: id } }) === null) picks[teamId] = id;
      return { kind: 'specialDraft', picks };
    }
    case 'roster':
      return { kind: 'roster', ids: [...d.candidates].sort((a, b) => keepValue(s.players[a]!, next) - keepValue(s.players[b]!, next)).slice(0, d.release) };
    case 'rival':
      return { kind: 'rival', settings: d.suggestion };
    case 'rivalProtect':
      return { kind: 'rivalProtect', ids: autoProtect(s, d, next) };
    case 'foreign': {
      const cands = d.candidates.map((id) => s.players[id]!);
      const pick = (asia: boolean, pitcher: boolean | null, n: number) =>
        cands
          .filter((p) => !!p.origin.asiaQuota === asia && (pitcher === null || isPitcher(p) === pitcher))
          .sort((a, b) => b.scouting.current - a.scouting.current)
          .slice(0, n)
          .map((p) => p.id);
      const pitchers = Math.min(2, d.regular);
      const wanted = [...pick(false, true, pitchers), ...pick(false, false, d.regular - pitchers), ...pick(true, null, d.asia)];
      const ids: PlayerId[] = [];
      // Within the budget and the foreign salary cap (V0.7.8).
      const next = nextSeasonOf(s);
      const underCap = (trial: PlayerId[]) => {
        const staying = capPlayers(s, user(s).teamId, next);
        const adding = trial.map((x) => s.players[x]!).filter((p) => !p.origin.asiaQuota);
        return foreignCost([...staying, ...adding]) <= foreignCap(s, user(s).teamId, next, [...staying, ...adding]);
      };
      // His ask within the cap (or his counter), no options.
      const offers: Record<PlayerId, ForeignOffer> = {};
      for (const id of wanted) {
        const t = d.terms?.[id];
        if (t) offers[id] = suggestedOffer(t, newSigningCap(s.players[id]!));
        if (checkDecision(s, { kind: 'foreign', ids: [...ids, id], offers }) === null && underCap([...ids, id])) ids.push(id);
      }
      return { kind: 'foreign', ids, offers: Object.fromEntries(ids.filter((id) => offers[id]).map((id) => [id, offers[id]!])) };
    }
    default:
      return null;
  }
}
