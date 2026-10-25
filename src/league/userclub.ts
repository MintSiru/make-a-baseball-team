import { k as __i18n_k } from '../i18n/index';
import { noteMove } from './moves';
import { applyEntry, checkEntry } from './postentry';
/* The user's club every year (V0.4): the owner's yearly money, military service, its own free agents,
   rookie bonuses (Draft Room's negotiation), development signings and spring-camp plans.

   Founding-only decisions live in expansion.ts, which also routes every decision through
   checkDecision / resolveDecision / autoDecision. Money in 만 원. */
import { startYear } from './era';
import { medicalReview, socialOnly } from './military';
import { asiaCapFor, foreignCap, slotExempt } from './foreigncap';
import { renewAccepts } from './foreigntalks';
import { capFloorFor } from './cap';
import { foreignSlots } from './manager';
import { draftContracts, rng, type Difficulty, type Role, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import type { Position } from '../model/position';
import { foreignContract, MANWON_PER_USD, renewSalary, salaryIn, slotBonus } from './contracts';
import { usd } from './foreign';
import { cityById } from '../club/cities';
import { budgetFor, foreignSigningDecision, STADIUM_PLANS } from './expansion';
import { ownerSweep } from './sweep';
import {
  developmentContract,
  faSeasonsFor,
  leaveLeague,
  setSalary,
  enlistAs,
  removeFromRoster,
  OFFSEASON_STEPS,
  persuadeChance,
  retiring,
  sangmuChance,
  sign,
} from './offseason';
import { ageIn, futureValue, isForeign, isPitcher, keepValue } from './players';
import { extensionOptions, extensionProblem } from './extensions';
import { aiCompensation, movePlayer, projectedPayroll } from './market';
import { autoRound, checkRound, faPrice, guaranteed, marketValue, resolveRound, settleClubOptions, type RoundInput } from './fa';
import { makeSecondPick } from './seconddraft';
import { baseSupport, evaluate, goalText, nextBudget, ownerEvents, signSponsor, sponsorDue, sponsorOffers, sponsorReview } from './parent';
import { clubState } from './fans';
import { iga } from './josa';
import { changePosition, positionMove } from './positions';
import { STAFF_LABELS, STAFF_ROLES, staffCandidates, staffOf } from './staff';
import { defaultYears, signingBonus, yearsFor } from './staffdeals';
import { alumnusHired, employedAlumni, legendFired } from './alumni';
import { post, postingCandidates, postingMax, postingNote } from './posting';
import { toForeignPool } from './foreignpool';
import { goAbroad, releaseReturnee, signReturnee } from './returnees';
import { addAlert, ownerAlert } from './alerts';
import { splitContract } from './foreign';
import { KBO_2026, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { developmentIds, orgIds, orgPlayers, type Decision, type DraftState, type LeagueState, type SalaryRow, type StaffRole, type UserClub } from './state';
import { OFFSEASON as O, PARENT, TALKS, DIFFICULTY } from './tuning';
import { lifeWinter } from './life';
import { CAMP_IDS, checkCamp, checkDev, devDecision, holdCamp, sendDev, type CampSite } from './development';
import { autoNational, marchEvents, nextNationalDecision, novemberEvents, resolveNational } from './national';
import { autoScandal, resolveScandal } from './scandals';
import { autoDispute, resolveDispute } from './dispute';
import { resolveRelocation } from './relocation';
import { resolveMerger } from './merger';
import { conditionMoney } from './conditions';
import { DYNAMIC, handicap, setHandicap } from './dynamic';
import { autoMeddle, resolveMeddle, scenarioWinter, supportFactor } from './scenarios';
import { autoBroker, checkBroker, resolveBroker } from './broker';
import { canRelease, releasePlayer } from './trade';
import { placeVoluntary } from './voluntary';
import { postingPersuasion } from './abroad';
import { schoolsWinter } from './schools';

/** Difficulty scales the owner's money. */
const DIFFICULTY_MONEY = DIFFICULTY.money;

export const FOCUS_KEYS: Record<'pitcher' | 'hitter', ToolKey[]> = {
  pitcher: ['stuff', 'command', 'breaking', 'stamina'],
  hitter: ['contact', 'power', 'eye', 'speed', 'defense'],
};
const POSITION_ROLE: Record<Position, Role> = { C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', LF: 'OF', CF: 'OF', RF: 'OF' };

export type MilitaryOrder = 'sangmu' | 'army' | 'social';
export interface CampPlan {
  focus?: string;
  role?: 'SP' | 'RP';
  position?: Position;
}

export type AnnualInput =
  | { kind: 'military'; orders: Record<PlayerId, MilitaryOrder> }
  | { kind: 'rookieBonus'; offers: Record<PlayerId, number> }
  | { kind: 'development'; ids: PlayerId[] }
  | { kind: 'camp'; plans: Record<PlayerId, CampPlan> }
  | RoundInput
  | { kind: 'faOptions'; keep: PlayerId[] }
  | { kind: 'faProtect'; ids: PlayerId[] }
  | { kind: 'faCompensation'; player: PlayerId | null }
  | { kind: 'salaries'; choices: Record<PlayerId, SalaryChoice> }
  | { kind: 'secondProtect'; ids: PlayerId[] }
  /** 1.9.0 (postentry.ts): our entry for a postseason series. */
  | { kind: 'postEntry'; ids: PlayerId[] }
  | { kind: 'secondPick'; id: PlayerId | null }
  /** `offers`: a figure (US dollars a season) and years for any of them (1.3.0; his ask for one year when missing). */
  | { kind: 'foreignRenew'; keep: PlayerId[]; offers?: Record<PlayerId, { amount: number; years: 1 | 2 }> }
  | { kind: 'posting'; id: PlayerId | null; /** 2.0.24: several, when the game allows more than one. */ ids?: PlayerId[]; /** 2.0.37: those not posted we try to talk round (abroad.ts). */ persuade?: PlayerId[] }
  | { kind: 'returnee'; ids: PlayerId[] }
  | { kind: 'sponsor'; index: number }
  | { kind: 'staff'; hires: Partial<Record<StaffRole, string>>; /** 1.8.0: contract years for a hire or renewal. */ terms?: Partial<Record<StaffRole, number>> }
  /** Our players who want to retire: the ones the club asks to play on (V0.11). */
  | { kind: 'retire'; ids: PlayerId[] }
  /** Our players named for the national team: the ones the club asks to keep home (V0.12). */
  | { kind: 'national'; ids: PlayerId[] }
  /** The club's answer to a disciplined player (V0.12). */
  | { kind: 'scandal'; answer: 'release' | 'extra' | 'none' | 'voluntary' }
  /** Settle with the investor or fight (V0.12). */
  | { kind: 'dispute'; answer: 'settle' | 'fight' }
  | { kind: 'relocate'; answer: 'accept' | 'refuse' | 'temporary' | 'drop' }
  | { kind: 'merger'; vote: 'yes' | 'no' }
  /** Obey the owner or not (1.6.0). */
  | { kind: 'meddle'; answer: 'obey' | 'refuse' }
  | { kind: 'broker'; answer: 'accept' | 'refuse' }
  /** 2.0.32 (development.ts): who goes to the fall league or to Australia (none: nobody), the wrap-up camp's place
      (null: none this year). */
  | { kind: 'devFall'; ids: PlayerId[] }
  | { kind: 'devAbl'; ids: PlayerId[] }
  | { kind: 'wrapUp'; site: CampSite | null };

/** The club's answer to each player: his ask, the club's merit figure, last year's pay, or a multi-year deal. */
export type SalaryChoice = 'ask' | 'merit' | 'freeze' | 'extension';

/** 만 원 as "1억 7,500만" for club news. */
const money = (n: number) => {
  const eok = Math.floor(n / 10000),
    rest = n % 10000;
  return eok ? (rest ? __i18n_k("league.userclub.money.a0e34170", { eok: eok, value: rest.toLocaleString('ko-KR') }) : __i18n_k("league.userclub.money.0b019595", { eok: eok })) : __i18n_k("league.userclub.money.cd1481f0", { value: rest.toLocaleString('ko-KR') });
};
const note = (u: UserClub, year: number, text: string) => (u.log ??= []).push({ year, text });
const nextSeason = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year + 1);

// ── Money ────────────────────────────────────────────────────────────────────────────────────────

/** The planned ballpark opens before its first season. */
function openNewStadium(s: LeagueState) {
  const u = s.user;
  if (!u || !s.offseason) return;
  const plan = STADIUM_PLANS[u.settings.stadium];
  const next = s.offseason.year + 1;
  if (!plan.opens || plan.opens !== next || !plan.seats) return;
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const name = u.newStadiumName?.trim() || __i18n_k("league.userclub.openNewStadium.name.d7422702", { value: cityById(u.settings.cityId)?.name ?? '' });
  team.stadium = { ...team.stadium, name, capacity: plan.seats, size: u.settings.stadium === 'dome' ? 'dome' : plan.seats >= 20_000 ? 'large' : 'medium' };
  note(u, s.offseason.year, __i18n_k("league.userclub.openNewStadium.15d1bc7d", { name: name, value: plan.seats.toLocaleString('ko-KR'), next: next }));
}

export const STADIUM_NAME_MAX = 20;
export function checkStadiumName(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return __i18n_k("league.userclub.checkStadiumName.6cd606b4");
  if (n.length > STADIUM_NAME_MAX) return __i18n_k("league.userclub.checkStadiumName.535992f8", { sTADIUM_NAME_MAX: STADIUM_NAME_MAX });
  return null;
}

/** Renames the current home ballpark, or names the one being built. */
export function renameStadium(s: LeagueState, name: string, which: 'current' | 'new') {
  const u = s.user;
  if (!u) throw new Error('구단이 없습니다.');
  const problem = checkStadiumName(name);
  if (problem) throw new Error(problem);
  const n = name.trim();
  if (which === 'new') {
    u.newStadiumName = n;
    return;
  }
  const team = s.teams.find((t) => t.id === u.teamId)!;
  note(u, s.year, __i18n_k("league.userclub.renameStadium.2b9c3f59", { name: team.stadium.name, n: n }));
  team.stadium = { ...team.stadium, name: n };
}

/** Foreign players' options: paid after a good season (WAR 2.5 for pitchers, 2.0 for hitters; game assumption). */
function payForeignOptions(s: LeagueState) {
  const u = s.user;
  if (!u || !s.offseason) return;
  const year = s.offseason.year;
  for (const p of orgPlayers(s, u.teamId)) {
    const opt = p.contract?.usd?.options;
    if (!isForeign(p) || !opt || !p.contract?.salaries.some((x) => x.season === year)) continue;
    const war = p.career.find((c) => c.year === year && !c.level)?.war ?? 0;
    if (war < (isPitcher(p) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter)) continue;
    const amount = Math.round(opt * MANWON_PER_USD);
    u.fund -= amount;
    u.ledger.push({ year, label: __i18n_k("league.userclub.payForeignOptions.label.cc99a4b8", { name: p.name, usd: usd(opt) }), amount: -amount });
  }
}

/**
 * The winter's money: the owner judges the season (goals), this year's owner events happen, and next
 * year's support and payroll budget are set (base × difficulty × the owner's running scale; the
 * payroll budget also follows the league's salary cap).
 */
export function yearlyGrant(s: LeagueState) {
  openNewStadium(s);
  payForeignOptions(s);
  const u = s.user;
  if (!u || !s.offseason) return;
  const year = s.offseason.year;
  // The players' winter: weddings, gifts, work on their own (V0.10).
  lifeWinter(s, year);
  const next = year + 1;
  // A naming sponsor judges the season against its goal and may walk out (then a new one is signed now).
  sponsorReview(s, year);
  if (sponsorDue(s, year)) u.sponsorPending = true;
  const ev = evaluate(s, year);
  if (ev) {
    note(u, year, __i18n_k("league.userclub.yearlyGrant.7289a114", { value: ev.lines.map((l) => __i18n_k("league.userclub.yearlyGrant.38e6b031", { label: l.label, value: l.ok ? __i18n_k("league.userclub.yearlyGrant.f3b8c1b4") : __i18n_k("league.userclub.yearlyGrant.a72490af") })).join(' · '), value2: ev.change >= 0 ? '+' : '', value3: Math.round(ev.change * 100), value4: Math.round(ev.trust) }));
    ownerAlert(s, year, ev);
  }
  // A scenario's goal is judged after the owner's verdict (1.6.0).
  scenarioWinter(s, year);
  if (year < startYear() + 1) return; // the founding fund covers the first winter
  const event = ownerEvents(s, year);
  // 1.8.2: after seasons of surplus the owner may take part of a large fund back (sweep.ts).
  ownerSweep(s, year);
  // 2.0.39: the sponsored high schools' sums for next season (schools.ts).
  schoolsWinter(s, year);
  const k = DIFFICULTY_MONEY[u.settings.difficulty];
  // 2.0.25: the dynamic difficulty's level for the season ahead (dynamic.ts).
  setHandicap(s, year);
  const h = handicap(s);
  const b = nextBudget(
    // 2.0.23: and the conditions added to the game (conditions.ts).
    { support: baseSupport(u.settings.parentType) * k * supportFactor(u.settings) * conditionMoney(s, 'support') * (1 - DYNAMIC.support * h), payroll: (budgetFor(u.settings).payrollBudget * salaryCapFor(next) * conditionMoney(s, 'payroll') * (1 - DYNAMIC.payroll * h)) / salaryCapFor(startYear() + 1) },
    u.budgetScale ?? 1,
    event,
  );
  u.support = b.support;
  // Free agents the owner paid for: their salary comes on top of the budget while they are under contract.
  const floor = payrollFloor(next, k);
  u.payrollBudget = Math.max(b.payroll, floor) + giftPayroll(u, next);
  // 2.0.34 (the user's report of a frozen budget): what made it, for the club's office to show.
  u.budgetWhy = {
    season: next,
    base: Math.round((budgetFor(u.settings).payrollBudget * salaryCapFor(next) * conditionMoney(s, 'payroll')) / salaryCapFor(startYear() + 1)),
    scale: u.budgetScale ?? 1,
    dynamic: 1 - DYNAMIC.payroll * h,
    floor,
    gifts: giftPayroll(u, next),
  };
}

/** The least an owner budgets for pay (V0.16): enough over the league's floor for the foreign players and a
    domestic roster, however poor the evaluations — below it a club could only sink further (× the difficulty). */
export const payrollFloor = (season: number, k = 1) => Math.round(((capFloorFor(season) ?? 0) * PARENT.payrollFloor * k) / 1000) * 1000;

/** Salary the owner covers in `season` for the free agents it bought (V0.7.7). */
export const giftPayroll = (u: UserClub, season: number) => (u.parentGifts ?? []).filter((g) => g.from <= season && season <= g.to).reduce((a, g) => a + g.annual, 0);

/** Next season's payroll without some players (whose deals are being decided), renewal estimates included. */
export const payrollWithout = (s: LeagueState, teamId: string, season: number, without: PlayerId[] = []) => projectedPayroll(s, teamId, season, without);

// ── Decisions raised during the offseason ────────────────────────────────────────────────────────

export function militaryDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const next = nextSeason(s);
  const M = O.military;
  // The winter's medical exams come first: an operation can mean 4급 (social service only) or 5급 (exempt).
  medicalReview(s, next - 1);
  const candidates = orgPlayers(s, u.teamId).filter((p) => !isForeign(p) && p.status === 'active' && p.service.military === 'pending' && ageIn(p, next) >= M.minAge);
  if (!candidates.length) return null;
  const byAge = candidates.sort((a, b) => ageIn(b, next) - ageIn(a, next) || b.scouting.current - a.scouting.current);
  const social = byAge.filter(socialOnly).map((p) => p.id);
  return { kind: 'military', candidates: byAge.map((p) => p.id), forced: byAge.filter((p) => ageIn(p, next) >= M.mustAge).map((p) => p.id), ...(social.length ? { social } : {}) };
}

/** The rookie's asking bonus: Draft Room's demand (slot of the pick blended with the slot his rank would get). */
export function bonusAsk(p: Player): number {
  const slot = p.contract?.signingBonus ?? 0;
  return Math.round(draftContracts.demand({ rank: p.amateur.draftRank, intent: p.amateur.intent ?? null }, { slot: slot / 100 }, false) * 100);
}

export function rookieBonusDecision(s: LeagueState, d: DraftState): Decision | null {
  const u = s.user!;
  const clubs = new Set(d.slots.map((x) => x.teamId)).size;
  const picks = orgPlayers(s, u.teamId)
    .filter((p) => p.origin.draftYear === d.year && p.origin.overallPick && p.contract?.kind === 'rookie')
    .sort((a, b) => a.origin.overallPick! - b.origin.overallPick!)
    .map((p) => ({ id: p.id, slot: slotBonus(p.origin.overallPick!, clubs), ask: bonusAsk(p) }));
  return picks.length ? { kind: 'rookieBonus', picks, final: false } : null;
}

export function developmentDecision(s: LeagueState, d: DraftState): Decision | null {
  const u = s.user!;
  const room = Math.min(O.development.perYear, O.development.cap - developmentIds(s, u.teamId).length);
  if (room <= 0 || !d.pool.length) return null;
  const candidates = d.pool
    .map((id) => s.players[id]!)
    .sort((a, b) => a.amateur.draftRank - b.amateur.draftRank)
    .slice(0, 40);
  return { kind: 'development', candidates: candidates.map((p) => p.id), max: room };
}

/** Staff under contract, who is out of contract, and three candidates for every post. */
/** The years a hire or renewal runs: the club's pick when it is allowed, else the usual. */
const termYears = (role: StaffRole, picked: number | undefined, fallback = defaultYears(role)) => (picked && yearsFor(role).includes(picked) ? picked : fallback);

export function staffDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user!;
  const staff = staffOf(s, u.teamId);
  const first = !u.staffSeen;
  // A former player is a candidate for one post at most (1.4.0).
  const taken = new Set<string>();
  const rows = STAFF_ROLES.map((role) => {
    const current = staff[role];
    const expiring = current.until <= year;
    return { role, current, expiring, buyout: expiring ? 0 : (current.until - year) * current.salary, candidates: staffCandidates(s, role, year, taken) };
  });
  if (!first && !rows.some((r) => r.expiring)) return null;
  return { kind: 'staff', rows };
}

export function sponsorDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user!;
  if (!u.sponsorPending) return null;
  const sp = clubState(s, u.teamId).sponsor;
  const ended = sp && sp.until === year && (sp.missed ?? 0) > 0 ? __i18n_k("league.userclub.sponsorDecision.ended.d2e593bb", { name: iga(sp.name), goalText: goalText(sp.goal) }) : undefined;
  return { kind: 'sponsor', offers: sponsorOffers(s, year), ...(ended ? { ended } : {}) };
}

/** Players who ask to be posted to the majors this winter (the club may post one). */
/** The players our club posts: one (`id`) or, 2.0.24, several (`ids`). */
const postedIds = (input: Extract<AnnualInput, { kind: 'posting' }>) => input.ids ?? (input.id ? [input.id] : []);

export function postingDecision(s: LeagueState, next: number): Decision | null {
  const u = s.user!;
  if (next <= u.firstTeamYear) return null;
  const candidates = postingCandidates(s, u.teamId, next).map((p) => p.id);
  return candidates.length ? { kind: 'posting', candidates, max: postingMax(s) } : null;
}

/** Our players who have decided to retire this winter (V0.11): the club may ask them to play one more season. */
export function retireDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const o = s.offseason;
  if (!o) return null;
  const next = o.year + 1;
  const ours = retiring(s, o.year)
    .map((id) => s.players[id]!)
    .filter((p) => p.teamId === u.teamId && !p.life?.careerOver)
    .sort((a, b) => b.scouting.current - a.scouting.current);
  return ours.length ? { kind: 'retire', rows: ours.map((p) => ({ id: p.id, chance: persuadeChance(p, next) })) } : null;
}

export function campDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const players = orgPlayers(s, u.teamId).filter((p) => p.status === 'active');
  return players.length ? { kind: 'camp', players: players.map((p) => p.id) } : null;
}

// ── Checking and applying ───────────────────────────────────────────────────────────────────────

const focusOptions = (p: Player) => ['balanced', ...FOCUS_KEYS[isPitcher(p) ? 'pitcher' : 'hitter']];

export function checkAnnual(s: LeagueState, d: Decision, input: AnnualInput): string | null {
  const u = s.user!;
  const next = nextSeason(s);
  switch (input.kind) {
    case 'military': {
      const dd = d as Extract<Decision, { kind: 'military' }>;
      if (Object.keys(input.orders).some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      const missing = dd.forced.filter((id) => !input.orders[id]);
      if (missing.length) return __i18n_k("league.userclub.checkAnnual.5323f9ae", { value: missing.map((id) => s.players[id]!.name).join(', ') });
      const social = dd.social ?? [];
      const wrong = Object.entries(input.orders).filter(([id, o]) => social.includes(id) !== (o === 'social'));
      if (wrong.length) return __i18n_k("league.userclub.checkAnnual.6092f8bd", { value: wrong.map(([id]) => s.players[id]!.name).join(', ') });
      return null;
    }
    case 'rookieBonus': {
      const dd = d as Extract<Decision, { kind: 'rookieBonus' }>;
      const ids = dd.picks.map((x) => x.id);
      if (Object.keys(input.offers).some((id) => !ids.includes(id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      if (Object.values(input.offers).some((x) => !Number.isFinite(x) || x < 0)) return __i18n_k("league.userclub.checkAnnual.f8e21e1a");
      const total = Object.values(input.offers).reduce((a, b) => a + b, 0);
      // V0.16: up to the slot a pick can always be paid, into the red if need be (the owner tops up an empty fund
      // after the season, at a cost in trust); only more than that needs the money.
      const slots = dd.picks.reduce((a, pk) => a + Math.min(input.offers[pk.id] ?? 0, pk.slot), 0);
      if (total > 0 && total > Math.max(0, u.fund) + slots) return __i18n_k("league.userclub.checkAnnual.610ce349", { value: Math.round(total / 1000) / 10 });
      return null;
    }
    case 'development': {
      const dd = d as Extract<Decision, { kind: 'development' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      if (input.ids.length > dd.max) return __i18n_k("league.userclub.checkAnnual.94d9c8a2", { max: dd.max });
      return null;
    }
    case 'posting': {
      const dd = d as Extract<Decision, { kind: 'posting' }>;
      const ids = postedIds(input);
      if (ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.d13f7582");
      if (ids.length > dd.max) return __i18n_k("league.userclub.text.763f08b5", { max: dd.max });
      return null;
    }
    case 'retire': {
      const dd = d as Extract<Decision, { kind: 'retire' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      return null;
    }
    case 'national': {
      const dd = d as Extract<Decision, { kind: 'national' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      return null;
    }
    case 'scandal':
      return ['release', 'extra', 'none', 'voluntary'].includes(input.answer) ? null : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    case 'dispute':
      return ['settle', 'fight'].includes(input.answer) ? null : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    case 'relocate': {
      const dd = d as Extract<Decision, { kind: 'relocate' }>;
      const ok = dd.stage === 'propose' ? ['accept', 'refuse'] : dd.temp ? ['temporary', 'drop'] : ['drop'];
      return ok.includes(input.answer) ? null : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    }
    case 'merger':
      return ['yes', 'no'].includes(input.vote) ? null : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    case 'meddle':
      return ['obey', 'refuse'].includes(input.answer) ? null : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    case 'broker':
      return checkBroker(s, d as Extract<Decision, { kind: 'broker' }>, input.answer);
    case 'returnee': {
      const dd = d as Extract<Decision, { kind: 'returnee' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      const cost = dd.rows.filter((r) => input.ids.includes(r.id)).reduce((a, r) => a + r.annual, 0);
      if (cost > 0 && projectedPayroll(s, u.teamId, next) + cost > u.payrollBudget) return __i18n_k("league.userclub.checkAnnual.84d90a10");
      return null;
    }
    case 'sponsor': {
      const dd = d as Extract<Decision, { kind: 'sponsor' }>;
      return dd.offers[input.index] ? null : __i18n_k("league.userclub.checkAnnual.c92ccea7");
    }
    case 'devFall':
    case 'devAbl': {
      const dd = d as Extract<Decision, { kind: 'devFall' | 'devAbl' }>;
      if (!input.ids.length) return null;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.98ce3a2b");
      return checkDev(s, input.kind === 'devFall' ? 'fall' : 'abl', input.ids);
    }
    case 'wrapUp':
      if (input.site === null) return null;
      return CAMP_IDS.includes(input.site) ? checkCamp(s, input.site) : __i18n_k("league.userclub.checkAnnual.db09d1ab");
    case 'staff': {
      const dd = d as Extract<Decision, { kind: 'staff' }>;
      let buyouts = 0;
      for (const [role, id] of Object.entries(input.hires)) {
        const row = dd.rows.find((r) => r.role === role);
        if (!row?.candidates.some((c) => c.id === id)) return __i18n_k("league.userclub.checkAnnual.909122bd");
        buyouts += row.buyout;
      }
      if (buyouts > 0 && buyouts > u.fund) return __i18n_k("league.userclub.checkAnnual.7f00cd30", { value: Math.round(buyouts / 10000) });
      return null;
    }
    case 'faRound': {
      const m = s.offseason?.fa;
      if (!m || m.closed) return __i18n_k("league.userclub.checkAnnual.8d3bfa05");
      return checkRound(s, m, input, next);
    }
    case 'faOptions': {
      const dd = d as Extract<Decision, { kind: 'faOptions' }>;
      if (input.keep.some((id) => !dd.rows.some((r) => r.id === id))) return __i18n_k("league.userclub.checkAnnual.15c2ac81");
      const cost = dd.rows.filter((r) => input.keep.includes(r.id)).reduce((a, r) => a + r.annual, 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, dd.rows.map((r) => r.id)) + cost > u.payrollBudget) return __i18n_k("league.userclub.checkAnnual.84d90a10");
      return null;
    }
    case 'postEntry':
      return checkEntry(s, u.teamId, input.ids, (d as Extract<Decision, { kind: 'postEntry' }>).from);
    case 'secondProtect': {
      const dd = d as Extract<Decision, { kind: 'secondProtect' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.ac069ce3");
      if (input.ids.length > dd.protect) return __i18n_k("league.userclub.checkAnnual.a472dff3", { protect: dd.protect });
      return null;
    }
    case 'secondPick': {
      const dd = d as Extract<Decision, { kind: 'secondPick' }>;
      if (input.id && !dd.candidates.includes(input.id)) return __i18n_k("league.userclub.checkAnnual.64427f12");
      if (input.id && dd.fee > u.fund) return __i18n_k("league.userclub.checkAnnual.2ffbf119");
      return null;
    }
    case 'foreignRenew': {
      const dd = d as Extract<Decision, { kind: 'foreignRenew' }>;
      if (input.keep.some((id) => !dd.rows.some((r) => r.id === id && !r.leaving))) return __i18n_k("league.userclub.checkAnnual.afdef777");
      for (const [id, o] of Object.entries(input.offers ?? {})) if (!(o.amount > 0) || ![1, 2].includes(o.years)) return __i18n_k("league.userclub.checkAnnual.c822f571", { value: s.players[id]?.name ?? '' });
      const cost = input.keep.reduce((a, id) => a + Math.round((input.offers?.[id]?.amount ?? dd.rows.find((r) => r.id === id)!.ask) * MANWON_PER_USD * 0.85), 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, dd.rows.map((r) => r.id)) + cost > u.payrollBudget) return __i18n_k("league.userclub.checkAnnual.84d90a10");
      return null;
    }
    case 'salaries': {
      const dd = d as Extract<Decision, { kind: 'salaries' }>;
      for (const [id, c] of Object.entries(input.choices)) {
        const row = dd.rows.find((x) => x.id === id);
        if (!row) return __i18n_k("league.userclub.checkAnnual.7dbfa2d5");
        if (c === 'extension' && !row.extension) return __i18n_k("league.userclub.checkAnnual.52e59465", { name: s.players[id]!.name });
      }
      return null;
    }
    case 'faProtect': {
      const dd = d as Extract<Decision, { kind: 'faProtect' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return __i18n_k("league.userclub.checkAnnual.ac069ce3");
      if (input.ids.length > dd.protect) return __i18n_k("league.userclub.checkAnnual.a472dff3", { protect: dd.protect });
      return null;
    }
    case 'faCompensation': {
      const dd = d as Extract<Decision, { kind: 'faCompensation' }>;
      if (input.player && !dd.list.includes(input.player)) return __i18n_k("league.userclub.checkAnnual.caf6e348");
      return null;
    }
    case 'camp': {
      const dd = d as Extract<Decision, { kind: 'camp' }>;
      for (const [id, plan] of Object.entries(input.plans)) {
        const p = s.players[id];
        if (!p || !dd.players.includes(id)) return __i18n_k("league.userclub.checkAnnual.60e00321");
        if (plan.focus && !focusOptions(p).includes(plan.focus)) return __i18n_k("league.userclub.checkAnnual.d8807b55", { name: p.name });
        if (plan.role && (!isPitcher(p) || !['SP', 'RP'].includes(plan.role))) return __i18n_k("league.userclub.checkAnnual.60a85eae", { name: p.name });
        if (plan.position && (isPitcher(p) || !POSITION_ROLE[plan.position])) return __i18n_k("league.userclub.checkAnnual.de99ed3b", { name: p.name });
      }
      return null;
    }
  }
}

/** Applies an annual decision. Returns a follow-up decision (rookies who countered) or null. */
export function resolveAnnual(s: LeagueState, d: Decision, input: AnnualInput): Decision | null {
  const u = s.user!;
  const next = nextSeason(s);
  const year = s.offseason?.year ?? s.year;
  switch (input.kind) {
    case 'military': {
      // 2.0.33 (the user's request): the 상무 results pop up, passed and failed together.
      const passed: PlayerId[] = [];
      const failed: PlayerId[] = [];
      // Those accepted first, then the ones turned down.
      const passLines: string[] = [];
      const failLines: string[] = [];
      for (const [id, order] of Object.entries(input.orders)) {
        const p = s.players[id]!;
        const forced = (d as Extract<Decision, { kind: 'military' }>).forced.includes(id);
        if (order === 'social') {
          enlistAs(s, p, next, 'social');
          note(u, year, __i18n_k("league.userclub.resolveAnnual.5893a680", { name: p.name, value: next + 1 }));
        } else if (order === 'army') {
          enlistAs(s, p, next, 'army');
          note(u, year, __i18n_k("league.userclub.resolveAnnual.5e5ea4a0", { name: p.name, value: next + 1 }));
        } else if (rng(`${s.seed}|sangmu|${year}|${id}`)() < sangmuChance(p, next)) {
          enlistAs(s, p, next, 'sangmu');
          passed.push(id);
          passLines.push(__i18n_k("league.userclub.resolveAnnual.91129d87", { name: p.name, value: next + 1 }));
          note(u, year, passLines.at(-1)!);
        } else if (forced) {
          enlistAs(s, p, next, 'army');
          failed.push(id);
          failLines.push(__i18n_k("league.userclub.resolveAnnual.c2744553", { name: p.name }));
          note(u, year, failLines.at(-1)!);
        } else {
          failed.push(id);
          failLines.push(__i18n_k("league.userclub.resolveAnnual.214af07f", { name: p.name }));
          note(u, year, failLines.at(-1)!);
        }
      }
      const lines = [...passLines, ...failLines];
      if (lines.length)
        addAlert(s, {
          id: `sangmu-${year}`,
          date: `${year}-12-10`,
          kind: 'military',
          title: !failed.length ? __i18n_k("league.userclub.text.670f25ac", { n: passed.length }) : !passed.length ? __i18n_k("league.userclub.text.836f3f8c", { n: failed.length }) : __i18n_k("league.userclub.text.f51c7577", { passed: passed.length, failed: failed.length }),
          lines,
          tone: !failed.length ? 'good' : !passed.length ? 'bad' : undefined,
          players: [...passed, ...failed],
        });
      return null;
    }
    case 'rookieBonus': {
      const dd = d as Extract<Decision, { kind: 'rookieBonus' }>;
      const counters: { id: PlayerId; slot: number; ask: number }[] = [];
      const refused: string[] = [];
      for (const pick of dd.picks) {
        const p = s.players[pick.id]!;
        const offer = input.offers[pick.id] ?? 0;
        const signs = dd.final
          ? offer >= pick.ask
          : offer > 0 &&
            (() => {
              const res = draftContracts.respond({ id: p.id, intent: p.amateur.intent ?? null }, offer / 100, pick.ask / 100, u.settings.difficulty as Difficulty, false, `${s.seed}|bonus|${year}`);
              if (res.result === 'counter') counters.push({ ...pick, ask: Math.round(res.counter! * 100) });
              return res.result === 'signed';
            })();
        if (signs) {
          const amount = dd.final ? pick.ask : offer;
          p.contract!.signingBonus = amount;
          u.fund -= amount;
          u.ledger.push({ year, label: __i18n_k("league.userclub.resolveAnnual.label.b640149f", { name: p.name }), amount: -amount });
        } else if (!counters.some((c) => c.id === p.id)) {
          const line = __i18n_k("league.userclub.resolveAnnual.709cbf07", { overallPick: p.origin.overallPick, name: p.name, value: p.amateur.intent === 'college' ? __i18n_k("league.userclub.resolveAnnual.2e03a59b") : p.amateur.intent === 'abroad' ? __i18n_k("league.userclub.resolveAnnual.c02cebf4") : __i18n_k("league.userclub.resolveAnnual.0d7dd114") });
          note(u, year, line);
          refused.push(line);
          // One who goes abroad may come back years later through the draft (returnees.ts); the others leave the game.
          if (p.amateur.intent === 'abroad') goAbroad(s, p, year);
          else {
            removeFromRoster(s, p);
            delete s.players[p.id];
          }
        }
      }
      // 2.0.27: a popup when a pick will not sign.
      if (refused.length) addAlert(s, { id: `rookie-refused-${year}-${dd.final ? 'final' : 'first'}`, date: `${year}-09-30`, kind: 'season', title: __i18n_k("league.userclub.text.034bd9ee", { n: refused.length }), lines: refused, tone: 'bad' });
      return counters.length ? { kind: 'rookieBonus', picks: counters, final: true } : null;
    }
    case 'development': {
      const draft = s.offseason?.draft;
      for (const id of input.ids) {
        const p = s.players[id]!;
        sign(s, p, u.teamId, developmentContract(u.teamId, next));
        if (draft) draft.pool = draft.pool.filter((x) => x !== id);
      }
      return null;
    }
    case 'faRound':
      resolveRound(s, s.offseason!.fa!, input);
      return null;
    case 'faOptions': {
      const dd = d as Extract<Decision, { kind: 'faOptions' }>;
      settleClubOptions(s, input.keep, dd.rows.map((r) => r.id), next);
      return null;
    }
    case 'salaries':
      settleSalaries(s, d as Extract<Decision, { kind: 'salaries' }>, input.choices);
      return null;
    case 'sponsor': {
      const dd = d as Extract<Decision, { kind: 'sponsor' }>;
      signSponsor(s, dd.offers[input.index]!, year);
      u.sponsorPending = false;
      // 2.0.32: the autumn's and winter's programmes come next.
      return devDecision(s);
    }
    case 'devFall':
    case 'devAbl':
      if (input.ids.length) sendDev(s, input.kind === 'devFall' ? 'fall' : 'abl', input.ids);
      return devDecision(s, input.kind);
    case 'wrapUp':
      if (input.site) holdCamp(s, input.site);
      return devDecision(s, 'wrapUp');
    case 'staff': {
      const dd = d as Extract<Decision, { kind: 'staff' }>;
      const club = s.clubs![u.teamId]!;
      u.staffSeen = true;
      for (const row of dd.rows) {
        const id = input.hires[row.role];
        const hire = id ? row.candidates.find((c) => c.id === id) : undefined;
        if (hire) {
          if (row.buyout) {
            u.fund -= row.buyout;
            u.ledger.push({ year, label: __i18n_k("league.userclub.resolveAnnual.label.2903e874", { value: STAFF_LABELS[row.role], name: row.current.name }), amount: -row.buyout });
            legendFired(s, u.teamId, row.current, `${year}-11-20`);
          }
          // A former player may meanwhile have gone to another club (1.4.0): then the club hires the post's next best.
          const gone = !!hire.playerId && employedAlumni(s).has(hire.playerId);
          const chosen = gone ? { ...hire, playerId: undefined, club: undefined, fame: undefined } : hire;
          // 1.8.0: the length the club chose, and a manager's signing bonus paid now (staffdeals.ts).
          const years = termYears(row.role, input.terms?.[row.role]);
          const bonus = signingBonus(row.role, chosen.salary, years);
          club.staff![row.role] = { ...chosen, id: `st-${u.teamId}-${row.role}-${year}`, until: year + years, since: year + 1, years, bonus, interim: undefined };
          if (bonus) {
            u.fund -= bonus;
            u.ledger.push({ year, label: __i18n_k("league.userclub.text.e19c3799", { role: STAFF_LABELS[row.role], name: hire.name }), amount: -bonus });
          }
          note(u, year, __i18n_k("league.userclub.resolveAnnual.4b2b440d", { value: STAFF_LABELS[row.role], name: hire.name, rating: hire.rating, money: money(hire.salary) }));
          alumnusHired(s, u.teamId, club.staff![row.role]!, `${year}-11-20`);
        } else if (row.expiring) {
          const m = club.staff![row.role]!;
          const years = termYears(row.role, input.terms?.[row.role], 2);
          m.until = year + years;
          m.salary = Math.round((m.salary * 1.05) / 1000) * 1000;
          m.years = years;
          m.bonus = signingBonus(row.role, m.salary, years);
          m.since ??= year;
          // An interim kept on loses the tag (대행 꼬리표를 뗀다).
          delete m.interim;
          if (m.bonus) {
            u.fund -= m.bonus;
            u.ledger.push({ year, label: __i18n_k("league.userclub.text.5aaee79b", { role: STAFF_LABELS[row.role], name: m.name }), amount: -m.bonus });
          }
          note(u, year, __i18n_k("league.userclub.resolveAnnual.15d746b1", { value: STAFF_LABELS[row.role], name: m.name, money: money(m.salary) }));
        }
      }
      // The same winter step: our players who want to retire come next.
      return retireDecision(s);
    }
    case 'dispute':
      resolveDispute(s, d as Extract<Decision, { kind: 'dispute' }>, input.answer, year);
      return null;
    // 2.0.37: a move proposed (a no from the board asks once more), a merger voted on.
    case 'relocate':
      return resolveRelocation(s, d as Extract<Decision, { kind: 'relocate' }>, input.answer, year);
    case 'merger':
      resolveMerger(s, d as Extract<Decision, { kind: 'merger' }>, input.vote, year);
      return null;
    case 'meddle':
      resolveMeddle(s, d as Extract<Decision, { kind: 'meddle' }>, input.answer);
      return null;
    case 'broker':
      resolveBroker(s, d as Extract<Decision, { kind: 'broker' }>, input.answer);
      return null;
    case 'scandal': {
      // The release needs the game not to be waiting on this decision any more.
      s.pending = null;
      resolveScandal(s, d as Extract<Decision, { kind: 'scandal' }>, input.answer, (id, how) => {
        if (canRelease(s, id)) return false;
        // 2.0.37: on the voluntary retired list instead of released (voluntary.ts).
        if (how === 'voluntary') placeVoluntary(s, s.players[id]!, 'scandal');
        else releasePlayer(s, id);
        return true;
      });
      return null;
    }
    case 'national': {
      resolveNational(s, d as Extract<Decision, { kind: 'national' }>, input.ids);
      // The step goes on: another event's squad, then the step's own decision.
      const o = s.offseason;
      const step = o ? OFFSEASON_STEPS[o.step] : null;
      if (o && step === 'international') return nextNationalDecision(s, novemberEvents(o.year)) ?? sponsorDecision(s, o.year) ?? devDecision(s);
      if (o && step === 'camp') return nextNationalDecision(s, marchEvents(o.year + 1)) ?? campDecision(s);
      return null;
    }
    case 'retire': {
      const dd = d as Extract<Decision, { kind: 'retire' }>;
      const o = s.offseason!;
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        if (!input.ids.includes(row.id)) note(u, year, __i18n_k("league.userclub.resolveAnnual.db1e3e89", { name: p.name, ageIn: ageIn(p, next) }));
        else if (rng(`${s.seed}|persuade|${year}|${row.id}`)() < row.chance) {
          (o.stay ??= []).push(row.id);
          note(u, year, __i18n_k("league.userclub.resolveAnnual.478cd424", { name: p.name }));
        } else note(u, year, __i18n_k("league.userclub.resolveAnnual.590ed0a6", { name: p.name }));
      }
      return null;
    }
    case 'posting': {
      const dd = d as Extract<Decision, { kind: 'posting' }>;
      const ids = postedIds(input);
      for (const id of dd.candidates) {
        const name = s.players[id]!.name;
        if (ids.includes(id)) note(u, year, postingNote(s, post(s, id, next), name));
        else note(u, year, __i18n_k("league.userclub.resolveAnnual.eb03e1bd", { name: name }));
      }
      // 2.0.37: those we kept: talked round or sulking (abroad.ts).
      postingPersuasion(s, dd.candidates, ids, (input.persuade ?? []).filter((id) => dd.candidates.includes(id)), next);
      return null;
    }
    case 'returnee': {
      const dd = d as Extract<Decision, { kind: 'returnee' }>;
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        if (input.ids.includes(row.id)) {
          signReturnee(s, p, u.teamId, row, next);
          note(u, year, __i18n_k("league.userclub.resolveAnnual.52e7d2b7", { name: p.name, abroad: row.abroad, years: row.years, money: money(row.annual) }));
        } else {
          note(u, year, __i18n_k("league.userclub.resolveAnnual.4611d034", { name: p.name }));
          releaseReturnee(s, p, row, next);
        }
      }
      // This winter's postings come next.
      return postingDecision(s, next);
    }
    case 'postEntry':
      applyEntry(s, u.teamId, input.ids, (d as Extract<Decision, { kind: 'postEntry' }>).round);
      return null;
    case 'secondProtect': {
      const sd = s.offseason?.second;
      if (sd) sd.protected[u.teamId] = input.ids;
      return null;
    }
    case 'secondPick': {
      const sd = s.offseason?.second;
      if (sd) makeSecondPick(s, sd, input.id);
      return null;
    }
    case 'foreignRenew': {
      const dd = d as Extract<Decision, { kind: 'foreignRenew' }>;
      const failed: string[] = [];
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        const offer = input.offers?.[row.id] ?? { amount: row.ask, years: 1 as const };
        // His ask for a year he always takes; less, or two years, as he sees it (1.3.0, foreigntalks.ts).
        const yes = input.keep.includes(row.id) && ((offer.amount >= row.ask && offer.years === 1) || renewAccepts(p, row.ask, offer.amount, offer.years, ageIn(p, next)));
        if (yes) {
          p.contract = foreignContract(u.teamId, next, splitContract(offer.amount, rng(`${s.seed}|foreign-renew|${year}|${row.id}`)), !!p.origin.asiaQuota, p.origin.asiaQuota ? asiaCapFor(p, u.teamId, next) : undefined);
          if (offer.years === 2) p.contract.salaries.push({ season: next + 1, amount: p.contract.salaries[0]!.amount });
          note(u, year, __i18n_k("league.userclub.resolveAnnual.a10572f6", { name: p.name, usd: usd(offer.amount), value: offer.years === 2 ? __i18n_k("league.userclub.resolveAnnual.d554ee3d") : '' }));
        } else if (input.keep.includes(row.id)) {
          const line = __i18n_k("league.userclub.resolveAnnual.723a0593", { name: p.name, usd: usd(offer.amount), value: offer.years === 2 ? __i18n_k("league.userclub.resolveAnnual.d554ee3d") : '', usd2: usd(row.ask) });
          note(u, year, line);
          failed.push(line);
          if (!toForeignPool(s, p, year)) leaveLeague(s, p, 'overseas');
        } else {
          note(u, year, __i18n_k("league.userclub.resolveAnnual.0b220cd8", { name: p.name, value: row.leaving ? __i18n_k("league.userclub.resolveAnnual.46795cbd") : __i18n_k("league.userclub.resolveAnnual.b0045732") }));
          // Not re-signed: other clubs may sign him (the market of KBO-experienced foreigners).
          if (row.leaving || !toForeignPool(s, p, year)) leaveLeague(s, p, 'overseas');
        }
      }
      // 2.0.27: a popup when a re-signing falls through (he will not come back to us from the market either).
      if (failed.length) addAlert(s, { id: `foreign-renew-failed-${year}`, date: `${year}-11-25`, kind: 'move', title: __i18n_k("league.userclub.text.6b8af682", { n: failed.length }), lines: [...failed, __i18n_k("league.userclub.text.874afdaa")], tone: 'bad' });
      // New signings for the open slots come next.
      return foreignSigningDecision(s, next);
    }
    case 'faProtect': {
      const item = s.offseason?.faQueue?.shift();
      if (item) aiCompensation(s, item, new Set(input.ids), next);
      return null;
    }
    case 'faCompensation': {
      const item = s.offseason?.faQueue?.shift();
      if (!item) return null;
      const dd = d as Extract<Decision, { kind: 'faCompensation' }>;
      const fa = s.players[item.fa]?.name ?? '';
      const amount = input.player ? dd.withPlayer : dd.cashOnly;
      if (input.player) {
        const p = s.players[input.player]!;
        const was = p.teamId;
        movePlayer(s, p, u.teamId);
        noteMove(s, p, 'compensation', was, u.teamId, __i18n_k("league.userclub.text.c238f04f", { name: fa }));
        note(u, year, __i18n_k("league.userclub.resolveAnnual.ce389c09", { fa: fa, name: p.name }));
      }
      u.fund += amount;
      u.ledger.push({ year, label: __i18n_k("league.userclub.resolveAnnual.label.69f4a3bb", { fa: fa, grade: item.grade, value: input.player ? __i18n_k("league.userclub.resolveAnnual.label.d1cdc38b") : '' }), amount });
      return null;
    }
    case 'camp': {
      for (const [id, plan] of Object.entries(input.plans)) {
        const p = s.players[id]!;
        if (plan.focus) p.plan = { ...p.plan, focus: plan.focus };
        if (plan.role && plan.role !== p.role) {
          p.role = plan.role;
          note(u, next, __i18n_k("league.userclub.resolveAnnual.c04ce522", { name: p.name, value: plan.role === 'SP' ? __i18n_k("league.userclub.resolveAnnual.a88271df") : __i18n_k("league.userclub.resolveAnnual.5b8607a3") }));
        }
        if (plan.position && plan.position !== p.position) {
          // A position he already lists needs no season to adapt; his old spot stays one he can play (V0.11).
          const known = (p.alt ?? []).includes(plan.position);
          note(u, next, __i18n_k("league.userclub.resolveAnnual.4801645e", { name: p.name, value: p.position ?? '', position: plan.position, value2: known ? '' : __i18n_k("league.userclub.resolveAnnual.7dfcc605") }));
          changePosition(p, plan.position);
          p.role = POSITION_ROLE[plan.position];
          p.plan = { focus: p.plan?.focus ?? 'balanced', ...(known ? {} : { adaptingIn: next }) };
        }
      }
      return null;
    }
  }
}

/** The scouts' and coaches' suggestion. */
export function autoAnnual(s: LeagueState, d: Decision): AnnualInput | null {
  const u = s.user!;
  const next = nextSeason(s);
  switch (d.kind) {
    case 'military': {
      const orders: Record<PlayerId, MilitaryOrder> = {};
      for (const id of d.candidates) {
        const p = s.players[id]!;
        const chance = sangmuChance(p, next);
        const regular = (p.career.at(-1)?.days ?? 0) >= 100 && !p.career.at(-1)?.level;
        if (d.social?.includes(id)) {
          // 4급: serve now if he must or is in a long rehab anyway.
          if (d.forced.includes(id) || (s.injuries[id]?.until ?? '') > `${next}-05-01`) orders[id] = 'social';
        } else if (d.forced.includes(id)) orders[id] = chance >= 0.25 ? 'sangmu' : 'army';
        else if (!regular && ageIn(p, next) >= 23 && chance >= 0.3) orders[id] = 'sangmu';
      }
      return { kind: 'military', orders };
    }
    case 'rookieBonus': {
      const offers: Record<PlayerId, number> = {};
      let left = u.fund;
      for (const pick of d.picks) {
        // The slot even with an empty fund (V0.16): a club short of money no longer loses its whole draft class.
        const amount = left >= pick.ask ? pick.ask : pick.slot;
        offers[pick.id] = amount;
        left -= amount;
      }
      return { kind: 'rookieBonus', offers };
    }
    case 'development': {
      const ids = [...d.candidates].sort((a, b) => futureValue(s.players[b]!) - futureValue(s.players[a]!)).slice(0, Math.min(d.max, O.development.signings));
      return { kind: 'development', ids };
    }
    case 'camp': {
      // The coaches' advice (V0.12): a player who no longer fits his spot moves down the spectrum.
      const plans: Record<PlayerId, CampPlan> = {};
      for (const id of d.players) {
        const to = positionMove(s.players[id]!);
        if (to) plans[id] = { position: to };
      }
      return { kind: 'camp', plans };
    }
    case 'national':
      return { kind: 'national', ids: autoNational(d) };
    case 'scandal':
      return { kind: 'scandal', answer: autoScandal(d) };
    case 'dispute':
      return { kind: 'dispute', answer: autoDispute() };
    // 2.0.37: the scouts keep the club where it is and vote against a merger.
    case 'relocate':
      return { kind: 'relocate', answer: (d as Extract<Decision, { kind: 'relocate' }>).stage === 'propose' ? 'refuse' : 'drop' };
    case 'merger':
      return { kind: 'merger', vote: 'no' };
    case 'meddle':
      return { kind: 'meddle', answer: autoMeddle(s, d) };
    case 'broker':
      return { kind: 'broker', answer: autoBroker() };
    case 'retire':
      // Ask the ones who can still help: a regular's grade, a fair chance to say yes.
      return { kind: 'retire', ids: d.rows.filter((r) => s.players[r.id]!.scouting.current >= 50 && r.chance >= 0.3).map((r) => r.id) };
    case 'faRound':
      return autoRound(s, s.offseason!.fa!, next);
    case 'faOptions': {
      // Keep him when he is still worth the money and the budget allows.
      const keep: PlayerId[] = [];
      for (const r of d.rows) {
        const p = s.players[r.id]!;
        const price = faPrice(p, next);
        if (keepValue(p, next) >= 45 && guaranteed(price) / price.years >= r.annual * 0.8 && checkAnnual(s, d, { kind: 'faOptions', keep: [...keep, r.id] }) === null) keep.push(r.id);
      }
      return { kind: 'faOptions', keep };
    }
    case 'faProtect':
      return { kind: 'faProtect', ids: d.candidates.slice(0, d.protect) };
    case 'salaries':
      return { kind: 'salaries', choices: Object.fromEntries(d.rows.map((r) => [r.id, 'merit' as SalaryChoice])) };
    case 'secondProtect':
      return { kind: 'secondProtect', ids: d.candidates.slice(0, d.protect) };
    case 'postEntry':
      return { kind: 'postEntry', ids: d.suggested };
    // 2.0.32: left to the scouts, nobody goes and the club stays home (the recommendation on the screen picks some).
    case 'devFall':
    case 'devAbl':
      return { kind: d.kind, ids: [] };
    case 'wrapUp':
      return { kind: 'wrapUp', site: null };
    case 'sponsor': {
      const best = d.offers.reduce((bi, o, i) => (o.annual > d.offers[bi]!.annual ? i : bi), 0);
      return { kind: 'sponsor', index: best };
    }
    case 'staff': {
      // Replace someone out of contract when a candidate is clearly better.
      const hires: Partial<Record<StaffRole, string>> = {};
      for (const row of d.rows) {
        const best = [...row.candidates].sort((a, b) => b.rating - a.rating)[0]!;
        if ((row.expiring || !u.staffSeen) && best.rating >= row.current.rating + 10 && row.buyout === 0) hires[row.role] = best.id;
      }
      return { kind: 'staff', hires };
    }
    case 'returnee': {
      // Bring back whoever the budget allows, best first.
      const ids: PlayerId[] = [];
      for (const r of [...d.rows].sort((a, b) => keepValue(s.players[b.id]!, next) - keepValue(s.players[a.id]!, next)))
        if (keepValue(s.players[r.id]!, next) >= 45 && checkAnnual(s, d, { kind: 'returnee', ids: [...ids, r.id] }) === null) ids.push(r.id);
      return { kind: 'returnee', ids };
    }
    case 'posting':
      // The scouts keep a player under 27 and let an older one chase his dream (and bring in the fee).
      // 2.0.37: and tries to talk the others round.
      {
        const id = d.candidates.find((x) => ageIn(s.players[x]!, next) >= 27) ?? null;
        return { kind: 'posting', id, persuade: d.candidates.filter((x) => x !== id) };
      }
    case 'secondPick': {
      const best = d.candidates[0];
      return { kind: 'secondPick', id: best && keepValue(s.players[best]!, next) >= 50 && d.fee <= u.fund ? best : null };
    }
    case 'foreignRenew': {
      const keep = d.rows
        .filter((r) => !r.leaving && r.war >= (isPitcher(s.players[r.id]!) ? O.foreign.keepWarPitcher : O.foreign.keepWarHitter))
        .sort((a, b) => b.war - a.war)
        .map((r) => r.id);
      // Within the budget and the foreign salary cap, keeping room for the new signings still to come (V0.7.8).
      const ok: PlayerId[] = [];
      const slots = foreignSlots(s, u.teamId, next).regular;
      for (const id of keep) {
        const trial = [...ok, id];
        const regular = trial.map((x) => s.players[x]!).filter((p) => !p.origin.asiaQuota && !slotExempt(s, p, next));
        const total = regular.reduce((a, p) => a + d.rows.find((r) => r.id === p.id)!.ask, 0);
        const reserve = Math.max(0, slots - regular.length) * O.foreign.newReserveUSD;
        if (checkAnnual(s, d, { kind: 'foreignRenew', keep: trial }) === null && total + reserve <= foreignCap(s, u.teamId, next, regular)) ok.push(id);
      }
      return { kind: 'foreignRenew', keep: ok };
    }
    case 'faCompensation': {
      const best = d.list[0];
      return { kind: 'faCompensation', player: best && keepValue(s.players[best]!, next) >= 50 ? best : null };
    }
    default:
      return null;
  }
}

export const isAnnual = (kind: Decision['kind']) =>
  ['military', 'rookieBonus', 'development', 'camp', 'faRound', 'faOptions', 'faProtect', 'faCompensation', 'salaries', 'secondProtect', 'secondPick', 'foreignRenew', 'posting', 'returnee', 'sponsor', 'staff', 'retire', 'national', 'scandal', 'dispute', 'meddle', 'broker', 'postEntry', 'devFall', 'devAbl', 'wrapUp', 'relocate', 'merger'].includes(kind);

// ── Salary talks ─────────────────────────────────────────────────────────────────────────────────

const lastWarOf = (p: Player, year: number) => p.career.find((c) => c.year === year && !c.level)?.war ?? 0;
/** Seasons to free agency (1.9.9: the latest the board set). */
const faSeasons = (p: Player) => faSeasonsFor(p, Infinity);

/** The user's players whose pay for next season is not set: merit figure, ask, arbitration and extension options. */
export function salariesDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const next = nextSeason(s);
  const T = TALKS;
  const rows: SalaryRow[] = [];
  for (const p of orgPlayers(s, u.teamId)) {
    if (isForeign(p) || p.contract?.kind === 'development' || p.contract?.salaries.some((x) => x.season === next)) continue;
    if (p.proSince >= next) continue; // rookies are on the minimum
    const prev = salaryIn(p, next - 1);
    const merit = renewSalary(p, next);
    const war = lastWarOf(p, next - 1);
    const ask = Math.max(prev, Math.round((merit * (1 + Math.min(T.ask.max, T.ask.base + T.ask.perWar * Math.max(0, war)))) / 100) * 100);
    // 1.7.0: the four-year deal of extensions.ts (any length can be offered from the player's screen).
    const four = extensionProblem(s, p.id) ? undefined : extensionOptions(s, p.id).find((x) => x.years === 4);
    rows.push({
      id: p.id,
      prev,
      merit,
      ask,
      arbitration: next - p.proSince >= KBO_2026.arbitration.minProYears,
      extension: four ? { annual: four.annual, years: four.years } : null,
    });
  }
  if (!rows.length) return null;
  return { kind: 'salaries', rows: rows.sort((a, b) => b.merit - a.merit) };
}

/** The figure a choice puts on the table for a row. */
export const salaryOffer = (row: SalaryRow, c: SalaryChoice) => (c === 'ask' ? row.ask : c === 'freeze' ? row.prev : c === 'extension' && row.extension ? row.extension.annual : row.merit);

function settleSalaries(s: LeagueState, d: Extract<Decision, { kind: 'salaries' }>, choices: Record<PlayerId, SalaryChoice>) {
  const u = s.user!;
  const next = nextSeason(s);
  const year = next - 1;
  const T = TALKS;
  for (const row of d.rows) {
    const p = s.players[row.id];
    if (!p || p.teamId !== u.teamId) continue;
    // 1.7.0: signed to a multi-year deal while the talks were open (extensions.ts).
    if (p.contract?.kind === 'multiYear' && p.contract.salaries.some((x) => x.season === next)) continue;
    const choice = choices[row.id] ?? 'merit';
    const r = rng(`${s.seed}|salary|${year}|${row.id}`);
    const easier = DIFFICULTY.salaryAccept[u.settings.difficulty];
    if (choice === 'extension' && row.extension) {
      if (r() < T.extension.accept + easier) {
        p.contract = { teamId: u.teamId, kind: 'multiYear', signedIn: year, signingBonus: 0, salaries: Array.from({ length: row.extension.years }, (_, i) => ({ season: next + i, amount: row.extension!.annual })) };
        note(u, year, __i18n_k("league.userclub.settleSalaries.0e9e90de", { name: p.name, years: row.extension.years, value: Math.round(row.extension.annual / 1000) / 10 }));
        continue;
      }
      note(u, year, __i18n_k("league.userclub.settleSalaries.20d4d62f", { name: p.name }));
      setSalary(p, next, row.merit);
      continue;
    }
    const offer = salaryOffer(row, choice);
    if (offer >= row.ask) {
      setSalary(p, next, offer);
      continue;
    }
    const accept = (choice === 'freeze' ? T.acceptFreeze : T.acceptMerit) + easier;
    if (r() < accept) {
      setSalary(p, next, offer);
      continue;
    }
    // No agreement: an eligible player may go to arbitration; the committee usually sides with the merit figure.
    if (row.arbitration && r() < T.arbitrationChance) {
      const playerWins = (row.ask - row.merit) / Math.max(1, row.merit) <= T.arbitrationWithin && offer < row.merit;
      const amount = playerWins ? row.ask : offer;
      setSalary(p, next, amount);
      note(u, year, __i18n_k("league.userclub.settleSalaries.bf05ad03", { name: p.name, value: playerWins ? __i18n_k("league.userclub.settleSalaries.c37450d6") : __i18n_k("league.userclub.settleSalaries.58756112"), money: money(amount) }));
      continue;
    }
    setSalary(p, next, offer);
    if (row.ask >= 10000) note(u, year, __i18n_k("league.userclub.settleSalaries.e7c156c0", { name: p.name, money: money(offer), money2: money(row.ask) }));
  }
}
export { focusOptions, POSITION_ROLE };
