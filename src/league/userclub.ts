/* The user's club every year (V0.4): the owner's yearly money, military service, its own free agents,
   rookie bonuses (Draft Room's negotiation), development signings and spring-camp plans.

   Founding-only decisions live in expansion.ts, which also routes every decision through
   checkDecision / resolveDecision / autoDecision. Money in 만 원. */
import { draftContracts, rng, type Difficulty, type Role, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import type { Position } from '../model/position';
import { freeAgentContract, MANWON_PER_USD, renewSalary, salaryIn, slotBonus } from './contracts';
import { usd } from './foreign';
import { cityById } from '../club/cities';
import { budgetFor, STADIUM_PLANS } from './expansion';
import {
  developmentContract,
  setSalary,
  enlistAs,
  freeAgentsFor,
  removeFromRoster,
  sangmuChance,
  sign,
  signFreeAgent,
} from './offseason';
import { ageIn, futureValue, isForeign, isPitcher, keepValue } from './players';
import { aiCompensation, marketValue, movePlayer, type FaOffer } from './market';
import { KBO_2026, minimumSalaryFor, salaryCapFor } from '../rules/kbo2026';
import { developmentIds, orgIds, orgPlayers, type Decision, type DraftState, type LeagueState, type SalaryRow, type UserClub } from './state';
import { OFFSEASON as O, TALKS } from './tuning';

/** What the owner puts in every winter for signing bonuses and other one-off costs (game assumption, until V0.6). */
export const YEARLY_GRANT = { conglomerate: 200_000, midsize: 150_000, namingRights: 120_000, citizen: 100_000 } as const;
const DIFFICULTY_MONEY = { easy: 1.1, normal: 1, hard: 0.9 } as const;

export const FOCUS_KEYS: Record<'pitcher' | 'hitter', ToolKey[]> = {
  pitcher: ['stuff', 'command', 'breaking', 'stamina'],
  hitter: ['contact', 'power', 'eye', 'speed', 'defense'],
};
const POSITION_ROLE: Record<Position, Role> = { C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', LF: 'OF', CF: 'OF', RF: 'OF' };

export type MilitaryOrder = 'sangmu' | 'army';
export interface CampPlan {
  focus?: string;
  role?: 'SP' | 'RP';
  position?: Position;
}

export type AnnualInput =
  | { kind: 'military'; orders: Record<PlayerId, MilitaryOrder> }
  | { kind: 'ownFreeAgents'; ids: PlayerId[] }
  | { kind: 'rookieBonus'; offers: Record<PlayerId, number> }
  | { kind: 'development'; ids: PlayerId[] }
  | { kind: 'camp'; plans: Record<PlayerId, CampPlan> }
  | { kind: 'faMarket'; offers: Record<PlayerId, FaOffer> }
  | { kind: 'faProtect'; ids: PlayerId[] }
  | { kind: 'faCompensation'; player: PlayerId | null }
  | { kind: 'salaries'; choices: Record<PlayerId, SalaryChoice> };

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

export function yearlyGrant(s: LeagueState) {
  openNewStadium(s);
  payForeignOptions(s);
  const u = s.user;
  if (!u || !s.offseason || s.offseason.year < 2027) return; // the founding fund covers the first winter
  const amount = Math.round(YEARLY_GRANT[u.settings.parentType] * DIFFICULTY_MONEY[u.settings.difficulty]);
  u.fund += amount;
  u.ledger.push({ year: s.offseason.year, label: '모기업 지원금 (계약금·영입비)', amount });
  // The payroll budget grows with the league's salary cap (salaries rise every year).
  const next = s.offseason.year + 1;
  u.payrollBudget = Math.round((budgetFor(u.settings).payrollBudget * salaryCapFor(next)) / salaryCapFor(2027) / 1000) * 1000;
}

/** Next season's payroll without some players (whose deals are being decided), renewal estimates included. */
export function payrollWithout(s: LeagueState, teamId: string, season: number, without: PlayerId[] = []) {
  return orgIds(s, teamId)
    .filter((id) => !without.includes(id))
    .reduce((sum, id) => {
      const p = s.players[id]!;
      return sum + (salaryIn(p, season) || (isForeign(p) ? 0 : renewSalary(p, season)));
    }, 0);
}

// ── Decisions raised during the offseason ────────────────────────────────────────────────────────

export function militaryDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const next = nextSeason(s);
  const M = O.military;
  const candidates = orgPlayers(s, u.teamId).filter((p) => !isForeign(p) && p.status === 'active' && p.service.military === 'pending' && ageIn(p, next) >= M.minAge);
  if (!candidates.length) return null;
  const byAge = candidates.sort((a, b) => ageIn(b, next) - ageIn(a, next) || b.scouting.current - a.scouting.current);
  return { kind: 'military', candidates: byAge.map((p) => p.id), forced: byAge.filter((p) => ageIn(p, next) >= M.mustAge).map((p) => p.id) };
}

export function ownFreeAgentsDecision(s: LeagueState): Decision | null {
  const u = s.user!;
  const candidates = freeAgentsFor(s, nextSeason(s)).filter((p) => p.teamId === u.teamId);
  return candidates.length ? { kind: 'ownFreeAgents', candidates: candidates.map((p) => p.id) } : null;
}

/** What a free agent asks for per season (the same pricing as the AI market). */
export const faAsk = (p: Player, next: number) => freeAgentContract(p, p.teamId ?? '', next).salaries[0]!.amount;

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
      return null;
    }
    case 'ownFreeAgents': {
      const dd = d as Extract<Decision, { kind: 'ownFreeAgents' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      const cost = input.ids.reduce((a, id) => a + faAsk(s.players[id]!, next), 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, dd.candidates) + cost > u.payrollBudget) return '연봉 예산을 넘습니다.';
      return null;
    }
    case 'rookieBonus': {
      const dd = d as Extract<Decision, { kind: 'rookieBonus' }>;
      const ids = dd.picks.map((x) => x.id);
      if (Object.keys(input.offers).some((id) => !ids.includes(id))) return '명단에 없는 선수입니다.';
      if (Object.values(input.offers).some((x) => !Number.isFinite(x) || x < 0)) return '금액이 올바르지 않습니다.';
      const total = Object.values(input.offers).reduce((a, b) => a + b, 0);
      if (total > u.fund) return `구단 자금이 부족합니다 (제시 합계 ${Math.round(total / 1000) / 10}억).`;
      return null;
    }
    case 'development': {
      const dd = d as Extract<Decision, { kind: 'development' }>;
      if (input.ids.some((id) => !dd.candidates.includes(id))) return '명단에 없는 선수입니다.';
      if (input.ids.length > dd.max) return `육성선수는 ${dd.max}명까지 더 계약할 수 있습니다.`;
      return null;
    }
    case 'faMarket': {
      const dd = d as Extract<Decision, { kind: 'faMarket' }>;
      const ids = Object.keys(input.offers);
      if (ids.some((id) => !dd.candidates.includes(id))) return 'FA 명단에 없는 선수입니다.';
      const outside = ids.filter((id) => s.players[id]!.teamId !== u.teamId);
      if (outside.length > dd.limit) return `다른 구단 FA는 올겨울 ${dd.limit}명까지 영입할 수 있습니다.`;
      for (const [id, o] of Object.entries(input.offers)) {
        if (!Number.isInteger(o.years) || o.years < 1 || o.years > 6) return `${s.players[id]!.name}: 계약 기간은 1~6년입니다.`;
        if (o.annual < minimumSalaryFor(next)) return `${s.players[id]!.name}: 최저연봉보다 적습니다.`;
      }
      const own = dd.candidates.filter((id) => s.players[id]!.teamId === u.teamId);
      const cost = Object.values(input.offers).reduce((a, o) => a + o.annual, 0);
      if (cost > 0 && payrollWithout(s, u.teamId, next, own) + cost > u.payrollBudget) return '제시액을 모두 합치면 연봉 예산을 넘습니다.';
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
        if (order === 'army') {
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
    case 'ownFreeAgents': {
      const dd = d as Extract<Decision, { kind: 'ownFreeAgents' }>;
      for (const id of dd.candidates) {
        const p = s.players[id]!;
        if (input.ids.includes(id)) {
          signFreeAgent(s, p, u.teamId, next);
          note(u, year, `FA ${p.name} 재계약 (${p.contract!.salaries.length}년)`);
        } else note(u, year, `FA ${p.name} 시장으로`);
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
          removeFromRoster(s, p);
          delete s.players[p.id];
          note(u, year, `${p.origin.overallPick}순위 ${p.name} 계약 거부 (${p.amateur.intent === 'college' ? '대학 진학' : p.amateur.intent === 'abroad' ? '해외 진출' : '독립리그행'})`);
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
    case 'faMarket':
      if (s.offseason) s.offseason.faOffers = input.offers;
      return null;
    case 'salaries':
      settleSalaries(s, d as Extract<Decision, { kind: 'salaries' }>, input.choices);
      return null;
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
          note(u, next, `${p.name} 포지션 변경 ${p.position ?? ''} → ${plan.position} (한 시즌 적응)`);
          p.position = plan.position;
          p.role = POSITION_ROLE[plan.position];
          p.plan = { focus: p.plan?.focus ?? 'balanced', adaptingIn: next };
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
        if (d.forced.includes(id)) orders[id] = chance >= 0.25 ? 'sangmu' : 'army';
        else if (!regular && ageIn(p, next) >= 23 && chance >= 0.3) orders[id] = 'sangmu';
      }
      return { kind: 'military', orders };
    }
    case 'ownFreeAgents': {
      const ids: PlayerId[] = [];
      for (const id of [...d.candidates].sort((a, b) => keepValue(s.players[b]!, next) - keepValue(s.players[a]!, next)))
        if (ageIn(s.players[id]!, next) <= 34 && checkAnnual(s, d, { kind: 'ownFreeAgents', ids: [...ids, id] }) === null) ids.push(id);
      return { kind: 'ownFreeAgents', ids };
    }
    case 'rookieBonus': {
      const offers: Record<PlayerId, number> = {};
      let left = u.fund;
      for (const pick of d.picks) {
        const amount = left >= pick.ask ? pick.ask : left >= pick.slot ? pick.slot : 0;
        offers[pick.id] = amount;
        left -= amount;
      }
      return { kind: 'rookieBonus', offers };
    }
    case 'development': {
      const ids = [...d.candidates].sort((a, b) => futureValue(s.players[b]!) - futureValue(s.players[a]!)).slice(0, Math.min(d.max, O.development.signings));
      return { kind: 'development', ids };
    }
    case 'camp':
      return { kind: 'camp', plans: {} };
    case 'faMarket': {
      // Keep our own free agents who are worth it and not too old, as far as the budget goes.
      const offers: Record<PlayerId, FaOffer> = {};
      const own = d.candidates.map((id) => s.players[id]!).filter((p) => p.teamId === u.teamId);
      for (const p of own.sort((a, b) => keepValue(b, next) - keepValue(a, next))) {
        if (ageIn(p, next) > 34 || keepValue(p, next) < 48) continue;
        const trial = { ...offers, [p.id]: marketValue(p, next) };
        if (checkAnnual(s, d, { kind: 'faMarket', offers: trial }) === null) Object.assign(offers, { [p.id]: trial[p.id] });
      }
      return { kind: 'faMarket', offers };
    }
    case 'faProtect':
      return { kind: 'faProtect', ids: d.candidates.slice(0, d.protect) };
    case 'salaries':
      return { kind: 'salaries', choices: Object.fromEntries(d.rows.map((r) => [r.id, 'merit' as SalaryChoice])) };
    case 'faCompensation': {
      const best = d.list[0];
      return { kind: 'faCompensation', player: best && keepValue(s.players[best]!, next) >= 50 ? best : null };
    }
    default:
      return null;
  }
}

export const isAnnual = (kind: Decision['kind']) =>
  ['military', 'ownFreeAgents', 'rookieBonus', 'development', 'camp', 'faMarket', 'faProtect', 'faCompensation', 'salaries'].includes(kind);

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
    if (choice === 'extension' && row.extension) {
      if (r() < T.extension.accept) {
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
    const accept = choice === 'freeze' ? T.acceptFreeze : T.acceptMerit;
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
    note(u, year, `${p.name} 진통 끝에 ${money(offer)}에 도장 (요구 ${money(row.ask)})`);
  }
}
export { focusOptions, POSITION_ROLE };
