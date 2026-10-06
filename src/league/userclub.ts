/* The user's club every year (V0.4): the owner's yearly money, military service, its own free agents,
   rookie bonuses (Draft Room's negotiation), development signings and spring-camp plans.

   Founding-only decisions live in expansion.ts, which also routes every decision through
   checkDecision / resolveDecision / autoDecision. Money in 만 원. */
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
import {
  developmentContract,
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
import { aiCompensation, movePlayer, projectedPayroll } from './market';
import { autoRound, checkRound, faPrice, guaranteed, marketValue, resolveRound, settleClubOptions, type RoundInput } from './fa';
import { makeSecondPick } from './seconddraft';
import { baseSupport, evaluate, goalText, nextBudget, ownerEvents, signSponsor, sponsorDue, sponsorOffers, sponsorReview } from './parent';
import { clubState } from './fans';
import { iga } from './josa';
import { changePosition, positionMove } from './positions';
import { STAFF_LABELS, STAFF_ROLES, staffCandidates, staffOf } from './staff';
import { post, postingCandidates, postingNote } from './posting';
import { toForeignPool } from './foreignpool';
import { goAbroad, releaseReturnee, signReturnee } from './returnees';
import { ownerAlert } from './alerts';
import { splitContract } from './foreign';
import { KBO_2026, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { developmentIds, orgIds, orgPlayers, type Decision, type DraftState, type LeagueState, type SalaryRow, type StaffRole, type UserClub } from './state';
import { OFFSEASON as O, PARENT, TALKS, DIFFICULTY } from './tuning';
import { lifeWinter } from './life';
import { autoNational, marchEvents, nextNationalDecision, novemberEvents, resolveNational } from './national';
import { autoScandal, resolveScandal } from './scandals';
import { autoDispute, resolveDispute } from './dispute';
import { canRelease, releasePlayer } from './trade';

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
  | { kind: 'secondPick'; id: PlayerId | null }
  /** `offers`: a figure (US dollars a season) and years for any of them (1.3.0; his ask for one year when missing). */
  | { kind: 'foreignRenew'; keep: PlayerId[]; offers?: Record<PlayerId, { amount: number; years: 1 | 2 }> }
  | { kind: 'posting'; id: PlayerId | null }
  | { kind: 'returnee'; ids: PlayerId[] }
  | { kind: 'sponsor'; index: number }
  | { kind: 'staff'; hires: Partial<Record<StaffRole, string>> }
  /** Our players who want to retire: the ones the club asks to play on (V0.11). */
  | { kind: 'retire'; ids: PlayerId[] }
  /** Our players named for the national team: the ones the club asks to keep home (V0.12). */
  | { kind: 'national'; ids: PlayerId[] }
  /** The club's answer to a disciplined player (V0.12). */
  | { kind: 'scandal'; answer: 'release' | 'extra' | 'none' }
  /** Settle with the investor or fight (V0.12). */
  | { kind: 'dispute'; answer: 'settle' | 'fight' };

/** The club's answer to each player: his ask, the club's merit figure, last year's pay, or a multi-year deal. */
export type SalaryChoice = 'ask' | 'merit' | 'freeze' | 'extension';

/** 만 원 as "1억 7,500만" for club news. */
const money = (n: number) => {
  const eok = Math.floor(n / 10000),
    rest = n % 10000;
  return eok ? (rest ? `${eok}억 ${rest.toLocaleString('ko-KR')}만` : `${eok}억`) : `${rest.toLocaleString('ko-KR')}만`;
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
  const name = u.newStadiumName?.trim() || `${cityById(u.settings.cityId)?.name ?? ''} 신구장`;
  team.stadium = { ...team.stadium, name, capacity: plan.seats, size: u.settings.stadium === 'dome' ? 'dome' : plan.seats >= 20_000 ? 'large' : 'medium' };
  note(u, s.offseason.year, `${name} 개장 (${plan.seats.toLocaleString('ko-KR')}석), ${next} 시즌부터 홈구장`);
}

export const STADIUM_NAME_MAX = 20;
export function checkStadiumName(name: string): string | null {
  const n = name.trim();
  if (n.length < 2) return '구장 이름은 두 글자 이상이어야 합니다.';
  if (n.length > STADIUM_NAME_MAX) return `구장 이름은 ${STADIUM_NAME_MAX}자까지입니다.`;
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
  note(u, s.year, `홈구장 이름 변경: ${team.stadium.name} → ${n}`);
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
    u.ledger.push({ year, label: `외국인 옵션 · ${p.name} (${usd(opt)})`, amount: -amount });
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
    note(u, year, `모기업 평가: ${ev.lines.map((l) => `${l.label} ${l.ok ? '달성' : '미달'}`).join(' · ')} → 내년 예산 ${ev.change >= 0 ? '+' : ''}${Math.round(ev.change * 100)}%, 신뢰도 ${Math.round(ev.trust)}`);
    ownerAlert(s, year, ev);
  }
  if (year < 2027) return; // the founding fund covers the first winter
  const event = ownerEvents(s, year);
  const k = DIFFICULTY_MONEY[u.settings.difficulty];
  const b = nextBudget(
    { support: baseSupport(u.settings.parentType) * k, payroll: (budgetFor(u.settings).payrollBudget * salaryCapFor(next)) / salaryCapFor(2027) },
    u.budgetScale ?? 1,
    event,
  );
  u.support = b.support;
  // Free agents the owner paid for: their salary comes on top of the budget while they are under contract.
  u.payrollBudget = Math.max(b.payroll, payrollFloor(next, k)) + giftPayroll(u, next);
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
export function staffDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user!;
  const staff = staffOf(s, u.teamId);
  const first = !u.staffSeen;
  const rows = STAFF_ROLES.map((role) => {
    const current = staff[role];
    const expiring = current.until <= year;
    return { role, current, expiring, buyout: expiring ? 0 : (current.until - year) * current.salary, candidates: staffCandidates(s, role, year) };
  });
  if (!first && !rows.some((r) => r.expiring)) return null;
  return { kind: 'staff', rows };
}

export function sponsorDecision(s: LeagueState, year: number): Decision | null {
  const u = s.user!;
  if (!u.sponsorPending) return null;
  const sp = clubState(s, u.teamId).sponsor;
  const ended = sp && sp.until === year && (sp.missed ?? 0) > 0 ? `${iga(sp.name)} 목표(${goalText(sp.goal)})를 채우지 못한 것을 이유로 계약을 해지했습니다.` : undefined;
  return { kind: 'sponsor', offers: sponsorOffers(s, year), ...(ended ? { ended } : {}) };
}

/** Players who ask to be posted to the majors this winter (the club may post one). */
export function postingDecision(s: LeagueState, next: number): Decision | null {
  const u = s.user!;
  if (next <= u.firstTeamYear) return null;
  const candidates = postingCandidates(s, u.teamId, next).map((p) => p.id);
  return candidates.length ? { kind: 'posting', candidates, max: KBO_2026.posting.perClubPerWinter } : null;
}

/** Our players who have decided to retire this winter (V0.11): the club may ask them to play one more season. */
export function retireDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const o = s.offseason;
  if (!o) return null;
  const next = o.year + 1;
  const ours = retiring(s, o.year)
    .map((id) => s.players[id]!)
    .filter((p) => p.teamId === u.teamId)
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
      if (Object.keys(input.orders).some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      const missing = dd.forced.filter((id) => !input.orders[id]);
      if (missing.length) return `${missing.map((id) => s.players[id]!.name).join(', ')}: 만 28세 이상이라 올해 입대해야 합니다.`;
      const social = dd.social ?? [];
      const wrong = Object.entries(input.orders).filter(([id, o]) => social.includes(id) !== (o === 'social'));
      if (wrong.length) return `${wrong.map(([id]) => s.players[id]!.name).join(', ')}: 4급 판정 선수는 사회복무요원으로만, 다른 선수는 상무·현역으로만 입대합니다.`;
      return null;
    }
    case 'rookieBonus': {
      const dd = d as Extract<Decision, { kind: 'rookieBonus' }>;
      const ids = dd.picks.map((x) => x.id);
      if (Object.keys(input.offers).some((id) => !ids.includes(id))) return '명단에 없는 선수입니다.';
      if (Object.values(input.offers).some((x) => !Number.isFinite(x) || x < 0)) return '금액이 올바르지 않습니다.';
      const total = Object.values(input.offers).reduce((a, b) => a + b, 0);
      // V0.16: up to the slot a pick can always be paid, into the red if need be (the owner tops up an empty fund
      // after the season, at a cost in trust); only more than that needs the money.
      const slots = dd.picks.reduce((a, pk) => a + Math.min(input.offers[pk.id] ?? 0, pk.slot), 0);
      if (total > 0 && total > Math.max(0, u.fund) + slots) return `구단 자금이 부족합니다 (제시 합계 ${Math.round(total / 1000) / 10}억, 슬롯 금액을 넘는 몫은 자금 안에서).`;
      return null;
    }
    case 'development': {
      const dd = d as Extract<Decision, { kind: 'development' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      if (input.ids.length > dd.max) return `육성선수는 ${dd.max}명까지 더 계약할 수 있습니다.`;
      return null;
    }
    case 'posting': {
      const dd = d as Extract<Decision, { kind: 'posting' }>;
      if (input.id && !dd.candidates.includes(input.id)) return '포스팅할 수 없는 선수입니다.';
      return null;
    }
    case 'retire': {
      const dd = d as Extract<Decision, { kind: 'retire' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return '명단에 없는 선수입니다.';
      return null;
    }
    case 'national': {
      const dd = d as Extract<Decision, { kind: 'national' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return '명단에 없는 선수입니다.';
      return null;
    }
    case 'scandal':
      return ['release', 'extra', 'none'].includes(input.answer) ? null : '대응을 고르세요.';
    case 'dispute':
      return ['settle', 'fight'].includes(input.answer) ? null : '대응을 고르세요.';
    case 'returnee': {
      const dd = d as Extract<Decision, { kind: 'returnee' }>;
      if (input.ids.some((id) => !dd.rows.some((r) => r.id === id))) return '명단에 없는 선수입니다.';
      const cost = dd.rows.filter((r) => input.ids.includes(r.id)).reduce((a, r) => a + r.annual, 0);
      if (cost > 0 && projectedPayroll(s, u.teamId, next) + cost > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'sponsor': {
      const dd = d as Extract<Decision, { kind: 'sponsor' }>;
      return dd.offers[input.index] ? null : '제안을 고르세요.';
    }
    case 'staff': {
      const dd = d as Extract<Decision, { kind: 'staff' }>;
      let buyouts = 0;
      for (const [role, id] of Object.entries(input.hires)) {
        const row = dd.rows.find((r) => r.role === role);
        if (!row?.candidates.some((c) => c.id === id)) return '후보 명단에 없는 사람입니다.';
        buyouts += row.buyout;
      }
      if (buyouts > 0 && buyouts > u.fund) return `잔여 연봉(위약금) ${Math.round(buyouts / 10000)}억을 낼 자금이 없습니다.`;
      return null;
    }
    case 'faRound': {
      const m = s.offseason?.fa;
      if (!m || m.closed) return 'FA 시장이 열려 있지 않습니다.';
      return checkRound(s, m, input, next);
    }
    case 'faOptions': {
      const dd = d as Extract<Decision, { kind: 'faOptions' }>;
      if (input.keep.some((id) => !dd.rows.some((r) => r.id === id))) return '구단 옵션이 없는 선수입니다.';
      const cost = dd.rows.filter((r) => input.keep.includes(r.id)).reduce((a, r) => a + r.annual, 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, dd.rows.map((r) => r.id)) + cost > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'secondProtect': {
      const dd = d as Extract<Decision, { kind: 'secondProtect' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '보호할 수 없는 선수입니다.';
      if (input.ids.length > dd.protect) return `보호선수는 ${dd.protect}명까지입니다.`;
      return null;
    }
    case 'secondPick': {
      const dd = d as Extract<Decision, { kind: 'secondPick' }>;
      if (input.id && !dd.candidates.includes(input.id)) return '지명할 수 없는 선수입니다.';
      if (input.id && dd.fee > u.fund) return '구단 자금이 부족합니다.';
      return null;
    }
    case 'foreignRenew': {
      const dd = d as Extract<Decision, { kind: 'foreignRenew' }>;
      if (input.keep.some((id) => !dd.rows.some((r) => r.id === id && !r.leaving))) return '재계약할 수 없는 선수입니다.';
      for (const [id, o] of Object.entries(input.offers ?? {})) if (!(o.amount > 0) || ![1, 2].includes(o.years)) return `${s.players[id]?.name ?? ''}: 제안이 잘못됐습니다.`;
      const cost = input.keep.reduce((a, id) => a + Math.round((input.offers?.[id]?.amount ?? dd.rows.find((r) => r.id === id)!.ask) * MANWON_PER_USD * 0.85), 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, dd.rows.map((r) => r.id)) + cost > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'salaries': {
      const dd = d as Extract<Decision, { kind: 'salaries' }>;
      for (const [id, c] of Object.entries(input.choices)) {
        const row = dd.rows.find((x) => x.id === id);
        if (!row) return '연봉 협상 명단에 없는 선수입니다.';
        if (c === 'extension' && !row.extension) return `${s.players[id]!.name}: 다년계약을 제안할 수 없는 선수입니다.`;
      }
      return null;
    }
    case 'faProtect': {
      const dd = d as Extract<Decision, { kind: 'faProtect' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '보호할 수 없는 선수입니다.';
      if (input.ids.length > dd.protect) return `보호선수는 ${dd.protect}명까지입니다.`;
      return null;
    }
    case 'faCompensation': {
      const dd = d as Extract<Decision, { kind: 'faCompensation' }>;
      if (input.player && !dd.list.includes(input.player)) return '보상선수로 고를 수 없는 선수입니다.';
      return null;
    }
    case 'camp': {
      const dd = d as Extract<Decision, { kind: 'camp' }>;
      for (const [id, plan] of Object.entries(input.plans)) {
        const p = s.players[id];
        if (!p || !dd.players.includes(id)) return '우리 선수가 아닙니다.';
        if (plan.focus && !focusOptions(p).includes(plan.focus)) return `${p.name}: 고를 수 없는 훈련 방향입니다.`;
        if (plan.role && (!isPitcher(p) || !['SP', 'RP'].includes(plan.role))) return `${p.name}: 투수만 보직을 바꿀 수 있습니다.`;
        if (plan.position && (isPitcher(p) || !POSITION_ROLE[plan.position])) return `${p.name}: 야수만 포지션을 바꿀 수 있습니다.`;
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
      for (const [id, order] of Object.entries(input.orders)) {
        const p = s.players[id]!;
        const forced = (d as Extract<Decision, { kind: 'military' }>).forced.includes(id);
        if (order === 'social') {
          enlistAs(s, p, next, 'social');
          note(u, year, `${p.name} 사회복무요원 소집 (${next + 1}년 9월 소집해제)`);
        } else if (order === 'army') {
          enlistAs(s, p, next, 'army');
          note(u, year, `${p.name} 현역 입대 (${next + 1}년 6월 전역)`);
        } else if (rng(`${s.seed}|sangmu|${year}|${id}`)() < sangmuChance(p, next)) {
          enlistAs(s, p, next, 'sangmu');
          note(u, year, `${p.name} 상무 합격 (${next + 1}년 6월 전역, 퓨처스리그 상무에서 뜀)`);
        } else if (forced) {
          enlistAs(s, p, next, 'army');
          note(u, year, `${p.name} 상무 불합격, 현역 입대`);
        } else note(u, year, `${p.name} 상무 불합격, 한 해 더 뛴다`);
      }
      return null;
    }
    case 'rookieBonus': {
      const dd = d as Extract<Decision, { kind: 'rookieBonus' }>;
      const counters: { id: PlayerId; slot: number; ask: number }[] = [];
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
          u.ledger.push({ year, label: `신인 계약금 · ${p.name}`, amount: -amount });
        } else if (!counters.some((c) => c.id === p.id)) {
          note(u, year, `${p.origin.overallPick}순위 ${p.name} 계약 거부 (${p.amateur.intent === 'college' ? '대학 진학' : p.amateur.intent === 'abroad' ? '해외 진출' : '독립리그행'})`);
          // One who goes abroad may come back years later through the draft (returnees.ts); the others leave the game.
          if (p.amateur.intent === 'abroad') goAbroad(s, p, year);
          else {
            removeFromRoster(s, p);
            delete s.players[p.id];
          }
        }
      }
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
      return null;
    }
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
            u.ledger.push({ year, label: `${STAFF_LABELS[row.role]} ${row.current.name} 계약 해지 (잔여 연봉)`, amount: -row.buyout });
          }
          club.staff![row.role] = { ...hire, id: `st-${u.teamId}-${row.role}-${year}`, until: year + (row.role === 'manager' ? 3 : 2) };
          note(u, year, `${STAFF_LABELS[row.role]} ${hire.name} 선임 (등급 ${hire.rating}, 연 ${money(hire.salary)})`);
        } else if (row.expiring) {
          const m = club.staff![row.role]!;
          m.until = year + 2;
          m.salary = Math.round((m.salary * 1.05) / 1000) * 1000;
          note(u, year, `${STAFF_LABELS[row.role]} ${m.name} 재계약 (2년, 연 ${money(m.salary)})`);
        }
      }
      // The same winter step: our players who want to retire come next.
      return retireDecision(s);
    }
    case 'dispute':
      resolveDispute(s, d as Extract<Decision, { kind: 'dispute' }>, input.answer, year);
      return null;
    case 'scandal': {
      // The release needs the game not to be waiting on this decision any more.
      s.pending = null;
      resolveScandal(s, d as Extract<Decision, { kind: 'scandal' }>, input.answer, (id) => {
        if (canRelease(s, id)) return false;
        releasePlayer(s, id);
        return true;
      });
      return null;
    }
    case 'national': {
      resolveNational(s, d as Extract<Decision, { kind: 'national' }>, input.ids);
      // The step goes on: another event's squad, then the step's own decision.
      const o = s.offseason;
      const step = o ? OFFSEASON_STEPS[o.step] : null;
      if (o && step === 'international') return nextNationalDecision(s, novemberEvents(o.year)) ?? sponsorDecision(s, o.year);
      if (o && step === 'camp') return nextNationalDecision(s, marchEvents(o.year + 1)) ?? campDecision(s);
      return null;
    }
    case 'retire': {
      const dd = d as Extract<Decision, { kind: 'retire' }>;
      const o = s.offseason!;
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        if (!input.ids.includes(row.id)) note(u, year, `${p.name} 은퇴 (${ageIn(p, next)}세)`);
        else if (rng(`${s.seed}|persuade|${year}|${row.id}`)() < row.chance) {
          (o.stay ??= []).push(row.id);
          note(u, year, `${p.name} 설득 성공: 은퇴를 미루고 한 시즌 더 뛴다`);
        } else note(u, year, `${p.name} 설득 실패: 뜻대로 은퇴`);
      }
      return null;
    }
    case 'posting': {
      const dd = d as Extract<Decision, { kind: 'posting' }>;
      for (const id of dd.candidates) {
        const name = s.players[id]!.name;
        if (id === input.id) note(u, year, postingNote(s, post(s, id, next), name));
        else note(u, year, `${name}의 포스팅 요청을 받아들이지 않았습니다`);
      }
      return null;
    }
    case 'returnee': {
      const dd = d as Extract<Decision, { kind: 'returnee' }>;
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        if (input.ids.includes(row.id)) {
          signReturnee(s, p, u.teamId, row, next);
          note(u, year, `${p.name} ${row.abroad}년 만에 복귀 (${row.years}년, 연 ${money(row.annual)})`);
        } else {
          note(u, year, `${p.name}의 보류권을 풀어 줌`);
          releaseReturnee(s, p, row, next);
        }
      }
      // This winter's postings come next.
      return postingDecision(s, next);
    }
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
      for (const row of dd.rows) {
        const p = s.players[row.id]!;
        const offer = input.offers?.[row.id] ?? { amount: row.ask, years: 1 as const };
        // His ask for a year he always takes; less, or two years, as he sees it (1.3.0, foreigntalks.ts).
        const yes = input.keep.includes(row.id) && ((offer.amount >= row.ask && offer.years === 1) || renewAccepts(p, row.ask, offer.amount, offer.years, ageIn(p, next)));
        if (yes) {
          p.contract = foreignContract(u.teamId, next, splitContract(offer.amount, rng(`${s.seed}|foreign-renew|${year}|${row.id}`)), !!p.origin.asiaQuota, p.origin.asiaQuota ? asiaCapFor(p, u.teamId, next) : undefined);
          if (offer.years === 2) p.contract.salaries.push({ season: next + 1, amount: p.contract.salaries[0]!.amount });
          note(u, year, `외국인 ${p.name} 재계약 (${usd(offer.amount)}${offer.years === 2 ? ', 2년' : ''})`);
        } else if (input.keep.includes(row.id)) {
          note(u, year, `외국인 ${p.name} 재계약 협상 결렬 (제안 ${usd(offer.amount)}${offer.years === 2 ? ', 2년' : ''}, 요구 ${usd(row.ask)})`);
          if (!toForeignPool(s, p, year)) leaveLeague(s, p, 'overseas');
        } else {
          note(u, year, `외국인 ${p.name} ${row.leaving ? '해외 진출로 이별' : '재계약 안 함'}`);
          // Not re-signed: other clubs may sign him (the market of KBO-experienced foreigners).
          if (row.leaving || !toForeignPool(s, p, year)) leaveLeague(s, p, 'overseas');
        }
      }
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
        movePlayer(s, p, u.teamId);
        note(u, year, `FA ${fa} 보상선수로 ${p.name} 영입`);
      }
      u.fund += amount;
      u.ledger.push({ year, label: `FA ${fa} 보상금 (${item.grade}등급${input.player ? ', 보상선수 포함' : ''})`, amount });
      return null;
    }
    case 'camp': {
      for (const [id, plan] of Object.entries(input.plans)) {
        const p = s.players[id]!;
        if (plan.focus) p.plan = { ...p.plan, focus: plan.focus };
        if (plan.role && plan.role !== p.role) {
          p.role = plan.role;
          note(u, next, `${p.name} ${plan.role === 'SP' ? '선발' : '불펜'}으로 보직 변경`);
        }
        if (plan.position && plan.position !== p.position) {
          // A position he already lists needs no season to adapt; his old spot stays one he can play (V0.11).
          const known = (p.alt ?? []).includes(plan.position);
          note(u, next, `${p.name} 포지션 변경 ${p.position ?? ''} → ${plan.position}${known ? '' : ' (한 시즌 적응)'}`);
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
      return { kind: 'posting', id: d.candidates.find((id) => ageIn(s.players[id]!, next) >= 27) ?? null };
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
  ['military', 'rookieBonus', 'development', 'camp', 'faRound', 'faOptions', 'faProtect', 'faCompensation', 'salaries', 'secondProtect', 'secondPick', 'foreignRenew', 'posting', 'returnee', 'sponsor', 'staff', 'retire', 'national', 'scandal', 'dispute'].includes(kind);

// ── Salary talks ─────────────────────────────────────────────────────────────────────────────────

const lastWarOf = (p: Player, year: number) => p.career.find((c) => c.year === year && !c.level)?.war ?? 0;
const faSeasons = (p: Player) => (p.origin.entryCategory === 'college' ? KBO_2026.freeAgency.seasonsCollege : KBO_2026.freeAgency.seasonsHighSchool);

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
    const toFa = faSeasons(p) - p.service.creditedSeasons;
    const extensionOk =
      p.service.lastFreeAgencyAt === undefined && toFa > 0 && toFa <= T.extension.seasonsBefore && ageIn(p, next) <= T.extension.maxAge && keepValue(p, next) >= T.extension.minValue;
    const m = marketValue(p, next);
    rows.push({
      id: p.id,
      prev,
      merit,
      ask,
      arbitration: next - p.proSince >= KBO_2026.arbitration.minProYears,
      extension: extensionOk ? { annual: Math.max(merit, Math.round((m.annual * T.extension.share) / 1000) * 1000), years: T.extension.years } : null,
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
    const choice = choices[row.id] ?? 'merit';
    const r = rng(`${s.seed}|salary|${year}|${row.id}`);
    const easier = DIFFICULTY.salaryAccept[u.settings.difficulty];
    if (choice === 'extension' && row.extension) {
      if (r() < T.extension.accept + easier) {
        p.contract = { teamId: u.teamId, kind: 'multiYear', signedIn: year, signingBonus: 0, salaries: Array.from({ length: row.extension.years }, (_, i) => ({ season: next + i, amount: row.extension!.annual })) };
        note(u, year, `${p.name} 비FA 다년계약 ${row.extension.years}년 연 ${Math.round(row.extension.annual / 1000) / 10}억`);
        continue;
      }
      note(u, year, `${p.name} 다년계약 제안 거절, 고과대로 계약`);
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
      note(u, year, `${p.name} 연봉 중재 신청 → ${playerWins ? '선수' : '구단'} 승 (${money(amount)})`);
      continue;
    }
    setSalary(p, next, offer);
    if (row.ask >= 10000) note(u, year, `${p.name} 진통 끝에 ${money(offer)}에 도장 (요구 ${money(row.ask)})`);
  }
}
export { focusOptions, POSITION_ROLE };
