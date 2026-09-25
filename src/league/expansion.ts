/* The user's expansion club: founding in summer 2026, the first drafts, the special draft from the
   other clubs, free agents, foreign players and the step up to the first team.

   Rules follow the NC (2011–13) and KT (2013–15) precedents where known (docs/RULES.md §8) and the
   game assumptions in RULES.md §9. Money is in 만 원 (10,000 = 1억). */
import { generateDraftPool, rng } from '../draftroom';
import { cityById } from '../club/cities';
import type { ParentCompanyType } from '../club/types';
import { fromDraftProspect } from '../model/player';
import type { Player, PlayerId, Team, TeamId } from '../model/types';
import { EXPANSION_DEFAULTS, minimumSalaryFor } from '../rules/kbo2026';
import { foreignContract, freeAgentContract, renewSalary, salaryIn } from './contracts';
import { splitContract } from './foreign';
import { marketDecision, projectedPayroll as marketPayroll } from './market';
import { foreignSlots } from './manager';
import {
  advanceOffseason,
  aiDraftChoice,
  developmentContract,
  foreignOn,
  freeAgentsFor,
  makePick,
  removeFromRoster,
  foreignLeaves,
  foreignRenewalAsk,
  lastRecord,
  rosterLimit,
  setOffseasonHooks,
  sign,
  signFreeAgent,
  standardSlots,
  type OffseasonStep,
} from './offseason';
import { ageIn, isForeign, isPitcher, keepValue, makeForeign } from './players';
import { OFFSEASON } from './tuning';
import {
  autoAnnual,
  campDecision,
  checkAnnual,
  developmentDecision,
  isAnnual,
  militaryDecision,
  resolveAnnual,
  rookieBonusDecision,
  salariesDecision,
  yearlyGrant,
  type AnnualInput,
} from './userclub';
import { developmentIds, emptyRoster, firstTeamIds, orgIds, registeredIds, type Decision, type DraftSlot, type ExpansionSettings, type LeagueState, type UserClub } from './state';

export const EXPANSION_ID = 'new';
export const FOUNDING_DATE = '2026-07-01';

// ── Money and difficulty ─────────────────────────────────────────────────────────────────────────

/** Game assumptions until the finance system (V0.6): what each kind of owner puts in. 만 원. */
const PARENT_MONEY: Record<ParentCompanyType, { fund: number; payroll: number; developmentFund: number }> = {
  conglomerate: { fund: 3_200_000, payroll: 1_100_000, developmentFund: 1_000_000 },
  midsize: { fund: 2_300_000, payroll: 850_000, developmentFund: 400_000 },
  namingRights: { fund: 1_700_000, payroll: 700_000, developmentFund: 200_000 },
  citizen: { fund: 1_400_000, payroll: 550_000, developmentFund: 200_000 },
};
const DIFFICULTY_MONEY = { easy: 1.1, normal: 1, hard: 0.9 } as const;

export const STADIUM_PLANS = {
  existing: { label: '연고지 구장 그대로 사용', seats: null as number | null, opens: null as number | null },
  newMedium: { label: '중형 신축 (1만 5천 석)', seats: 15_000, opens: 2029 },
  newLarge: { label: '대형 신축 (2만 2천 석)', seats: 22_000, opens: 2030 },
  dome: { label: '돔구장 신축 (2만 석)', seats: 20_000, opens: 2031 },
} as const;

export function budgetFor(settings: ExpansionSettings) {
  const m = PARENT_MONEY[settings.parentType];
  const city = cityById(settings.cityId)!;
  const k = DIFFICULTY_MONEY[settings.difficulty];
  const marketAdj = (city.market - 60) * 400; // ±0.4억 per market point
  const stadiumAdj = settings.stadium === 'existing' ? 0 : 50_000;
  return {
    fund: Math.round(m.fund * k),
    payrollBudget: Math.round((m.payroll + marketAdj + stadiumAdj) * k),
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
  return Math.max(1, Math.min(5, Math.round(1 + (money * 0.5 + market * 0.3 + park * 0.2 + base) * 5)));
}

const user = (s: LeagueState): UserClub => {
  if (!s.user) throw new Error('no user club');
  return s.user;
};
const spend = (s: LeagueState, label: string, amount: number) => {
  const u = user(s);
  u.fund -= amount;
  u.ledger.push({ year: s.year, label, amount: -amount });
};

// ── Founding ─────────────────────────────────────────────────────────────────────────────────────

export function foundClub(s: LeagueState, settings: ExpansionSettings) {
  if (s.user) throw new Error('a club is already founded');
  const city = cityById(settings.cityId);
  if (!city) throw new Error(`unknown city ${settings.cityId}`);
  const firstTeamYear = settings.promotion === 'immediate' ? 2027 : 2028;
  const plan = STADIUM_PLANS[settings.stadium];
  const team: Team = {
    id: EXPANSION_ID,
    name: settings.name.trim(),
    short: settings.short.trim(),
    color: settings.color,
    region: city.name,
    kind: 'expansion',
    founded: 2026,
    firstTeamFrom: firstTeamYear,
    benefitsUntil: firstTeamYear + EXPANSION_DEFAULTS.benefitSeasons - 1,
    parent: { type: settings.parentType, name: settings.parentName.trim() },
    stadium: { name: city.stadium.name, size: city.stadium.seats < 10_000 ? 'small' : 'medium', capacity: city.stadium.seats, ownership: 'municipalLease' },
  };
  s.teams.push(team);
  s.rosters[EXPANSION_ID] = emptyRoster();
  const b = budgetFor(settings);
  s.user = { teamId: EXPANSION_ID, settings, fund: b.fund, payrollBudget: b.payrollBudget, firstTeamYear, ledger: [] };
  spend(s, 'KBO 가입금', b.entryFee);
  spend(s, '야구발전기금', b.developmentFund);
  s.user.ledger.push({ year: s.year, label: `가입 예치금 ${b.deposit / 10000}억 (KBO 보관, 지출 아님)`, amount: 0 });
  if (plan.opens) s.user.ledger.push({ year: s.year, label: `${plan.label} ${plan.opens}년 개장 예정 (지자체 건설)`, amount: 0 });
  s.pending = { kind: 'tryout', candidates: tryoutPool(s).map((p) => p.id), max: 20 };
}

/** Independent-league players, overseas returnees and recently released pros for the founding tryout. */
function tryoutPool(s: LeagueState): Player[] {
  const seed = `${s.seed}|tryout|2026`;
  const pool = generateDraftPool(seed)
    .players.filter((p) => ['독립구단', '해외독립 복귀', '마이너 복귀', '대졸'].includes(p.pathway) && p.age >= 21)
    .map((p) => fromDraftProspect(p, 2026, seed))
    .map((p) => ({ ...p, id: `t2026-${p.origin.sourceId}` }))
    .sort((a, b) => keepValue(b, 2027) - keepValue(a, 2027))
    .slice(0, 25);
  for (const p of pool) s.players[p.id] = p;
  const released = Object.values(s.players)
    .filter((p) => p.status === 'retired' && p.career.length && (p.career.at(-1)?.year ?? 0) >= 2025 && ageIn(p, 2027) <= 33)
    .sort((a, b) => keepValue(b, 2027) - keepValue(a, 2027))
    .slice(0, 15);
  return [...released, ...pool];
}

// ── Offseason hooks ──────────────────────────────────────────────────────────────────────────────

const inFoundingPeriod = (s: LeagueState, next: number) => !!s.user && next <= s.user.firstTeamYear;

/** Draft order before the club reaches the first team: priority picks, first in every round, extra picks after round two. */
function draftSlots(s: LeagueState, draftYear: number, order: TeamId[]): DraftSlot[] {
  const u = s.user;
  if (!u || order.includes(u.teamId) || draftYear + 1 > u.firstTeamYear) return standardSlots(order);
  const firstDraft = draftYear === 2026;
  const slots: DraftSlot[] = [];
  if (firstDraft) for (let i = 0; i < EXPANSION_DEFAULTS.rookiePriorityPicks; i++) slots.push({ teamId: u.teamId, label: '우선지명' });
  const rounds = standardSlots(order).length / order.length;
  for (let round = 1; round <= rounds; round++) {
    slots.push({ teamId: u.teamId, label: `${round}R` });
    for (const teamId of order) slots.push({ teamId, label: `${round}R` });
    if (firstDraft && round === 2) for (let i = 0; i < EXPANSION_DEFAULTS.extraPicksAfterRound2; i++) slots.push({ teamId: u.teamId, label: '특별지명' });
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
    case 'renew':
      return salariesDecision(s);
    case 'camp':
      return campDecision(s);
    case 'freeAgency': {
      if (!entering) return marketDecision(s, next);
      const candidates = freeAgentsFor(s, next).filter((p) => p.teamId !== u.teamId);
      return candidates.length ? { kind: 'freeAgents', candidates: candidates.map((p) => p.id), max: EXPANSION_DEFAULTS.freeAgentSigns } : null;
    }
    case 'special':
      if (!entering) return null;
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

/** New foreign signings for the open slots, or null when every slot is filled. */
export function foreignSigningDecision(s: LeagueState, next: number): Decision | null {
  const u = user(s);
  const slots = foreignSlots(s, u.teamId, next);
  const have = foreignOn(s, u.teamId);
  const regular = slots.regular - have.filter((p) => !p.origin.asiaQuota).length;
  const asia = slots.asia - have.filter((p) => p.origin.asiaQuota).length;
  if (regular <= 0 && asia <= 0) return null;
  return { kind: 'foreign', candidates: foreignCandidates(s, next).map((p) => p.id), regular, asia };
}

setOffseasonHooks({ begin: yearlyGrant, draftSlots, decide, rookies: rookieBonusDecision, development: developmentDecision });

// ── Resolving decisions ──────────────────────────────────────────────────────────────────────────

export type DecisionInput =
  | { kind: 'tryout'; ids: PlayerId[] }
  | { kind: 'draftPick'; id: PlayerId | null } // null: let the scouts pick
  | { kind: 'freeAgents'; ids: PlayerId[] }
  | { kind: 'specialDraft'; picks: Record<TeamId, PlayerId> }
  | { kind: 'released'; ids: PlayerId[] }
  | { kind: 'foreign'; ids: PlayerId[] }
  | { kind: 'roster'; ids: PlayerId[]; develop?: PlayerId[] }
  | AnnualInput;

const isAnnualInput = (input: DecisionInput): input is AnnualInput => isAnnual(input.kind);
const nextSeasonOf = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year + 1);

/** Next season's payroll, counting the renewal estimate for players whose salary is not set yet. */
export const projectedPayroll = (s: LeagueState, teamId: TeamId, season: number) => marketPayroll(s, teamId, season);

/** Checks a decision against the rules and the budget. Returns a message for the player, or null when it is fine. */
export function checkDecision(s: LeagueState, input: DecisionInput): string | null {
  const d = s.pending;
  const u = user(s);
  if (!d || d.kind !== input.kind) return '지금 내릴 결정이 아닙니다.';
  if (isAnnualInput(input)) return checkAnnual(s, d, input);
  const next = nextSeasonOf(s);
  const payrollAfter = (ids: PlayerId[]) => projectedPayroll(s, u.teamId, next) + ids.reduce((a, id) => a + (salaryIn(s.players[id]!, next) || renewSalary(s.players[id]!, next)), 0);
  switch (input.kind) {
    case 'tryout':
    case 'released': {
      const dd = d as Extract<Decision, { kind: 'tryout' | 'released' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      if (input.ids.length > dd.max) return `최대 ${dd.max}명까지 계약할 수 있습니다.`;
      return null;
    }
    case 'draftPick': {
      const draft = s.offseason?.draft;
      if (!draft) return '드래프트 중이 아닙니다.';
      if (input.id && !draft.pool.includes(input.id)) return '이미 지명됐거나 명단에 없는 선수입니다.';
      return null;
    }
    case 'freeAgents': {
      const dd = d as Extract<Decision, { kind: 'freeAgents' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      if (input.ids.length > dd.max) return `신생구단 특례로 최대 ${dd.max}명까지 영입할 수 있습니다.`;
      const cost = input.ids.reduce((a, id) => a + faAsk(s, s.players[id]!, next), 0);
      if (cost > 0 && projectedPayroll(s, u.teamId, next) + cost > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'specialDraft': {
      const dd = d as Extract<Decision, { kind: 'specialDraft' }>;
      for (const [teamId, id] of Object.entries(input.picks)) if (!dd.lists[teamId]?.includes(id)) return '보호선수이거나 명단에 없는 선수입니다.';
      const cost = Object.keys(input.picks).length * dd.fee;
      if (cost > u.fund) return `창단 자금이 부족합니다 (필요 ${cost / 10000}억).`;
      if (cost > 0 && payrollAfter(Object.values(input.picks)) > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'roster': {
      const dd = d as Extract<Decision, { kind: 'roster' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '우리 선수단에 없는 선수입니다.';
      if (input.ids.length < dd.release) return `소속선수 한도 ${dd.limit}명을 맞추려면 ${dd.release}명을 정리해야 합니다.`;
      const develop = input.develop ?? [];
      if (develop.some((id) => !input.ids.includes(id))) return '육성 전환은 정리할 선수 중에서 고릅니다.';
      if (developmentIds(s, u.teamId).length + develop.length > OFFSEASON.development.cap) return `육성선수는 ${OFFSEASON.development.cap}명까지입니다.`;
      return null;
    }
    case 'foreign': {
      const dd = d as Extract<Decision, { kind: 'foreign' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      const picked = input.ids.map((id) => s.players[id]!);
      if (picked.filter((p) => !p.origin.asiaQuota).length > dd.regular) return `외국인 선수는 ${dd.regular}명까지 더 계약할 수 있습니다.`;
      if (picked.filter((p) => p.origin.asiaQuota).length > dd.asia) return `아시아쿼터는 ${dd.asia}명까지입니다.`;
      if (input.ids.length && payrollAfter(input.ids) > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
  }
}

/** What a free agent asks for per season (the same pricing as the AI market). */
export const faAsk = (_s: LeagueState, p: Player, next: number) => freeAgentContract(p, EXPANSION_ID, next).salaries[0]!.amount;

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
        p.proSince = Math.max(p.proSince, 2027);
        sign(s, p, u.teamId, { teamId: u.teamId, kind: 'standard', signedIn: 2026, signingBonus: 0, salaries: [{ season: 2027, amount: p.career.length ? renewSalary(p, 2027) : minimumSalaryFor(2027) }] });
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
    case 'freeAgents':
      for (const id of input.ids) {
        const p = s.players[id]!;
        signFreeAgent(s, p, u.teamId, next);
        u.ledger.push({ year: s.offseason!.year, label: `FA 영입 · ${p.name} (보상 없음, 신생구단 특례)`, amount: 0 });
      }
      break;
    case 'specialDraft': {
      const fee = (d as Extract<Decision, { kind: 'specialDraft' }>).fee;
      for (const [teamId, id] of Object.entries(input.picks)) {
        const p = s.players[id]!;
        removeFromRoster(s, p);
        p.teamId = u.teamId;
        if (p.contract) p.contract.teamId = u.teamId;
        s.rosters[u.teamId]!.futures.push(p.id);
        spend(s, `특별지명 보상금 · ${s.teams.find((t) => t.id === teamId)?.short} ${p.name}`, fee);
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
      for (const id of input.ids) {
        const p = s.players[id]!;
        sign(s, p, u.teamId, p.contract);
      }
      for (const id of (d as Extract<Decision, { kind: 'foreign' }>).candidates) if (!input.ids.includes(id)) delete s.players[id];
      break;
    }
  }
  s.pending = null;
  if (s.offseason) advanceOffseason(s);
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
    case 'released':
      return { kind: 'released', ids: best(d.candidates, Math.min(d.max, 5)) };
    case 'freeAgents': {
      const ids: PlayerId[] = [];
      for (const id of best(d.candidates, d.candidates.length)) {
        if (ids.length >= d.max) break;
        if (checkDecision(s, { kind: 'freeAgents', ids: [...ids, id] }) === null) ids.push(id);
      }
      return { kind: 'freeAgents', ids };
    }
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
      for (const id of wanted) if (checkDecision(s, { kind: 'foreign', ids: [...ids, id] }) === null) ids.push(id);
      return { kind: 'foreign', ids };
    }
    default:
      return null;
  }
}
