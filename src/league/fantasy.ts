/* 판타지 드래프트 (1.6.0, scenario 5): in the winter of 2027 every domestic player under contract leaves his club
   and the clubs draft the whole league again, this year's draft class with them, in a snake order drawn by lot.
   Players keep their contracts (the new club takes them over); the class signs rookie deals at the slot of their
   place among the class. Foreign players (signed one by one under their own cap) and players serving in the army
   stay where they are. That winter there is no free-agent market, no rookie draft, no special or second draft.

   The clubs pick from what anyone can see: the scouts' grades (keepValue), what the club lacks, age, and pay
   against the salary cap. Our club picks for itself, or hands its picks to the scouts (who pick the same way). */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { salaryCapFor } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { applyCombine } from './combine';
import { rookieContract, salaryIn, slotBonus } from './contracts';
import { addNews } from './news';
import { ageIn, draftClass, isForeign, isPitcher, keepValue } from './players';
import { FANTASY } from './scenarios';
import { orgIds, type LeagueState } from './state';

export interface FantasyDraft {
  year: number;
  /** The first round's order (the lottery); even rounds go the other way. */
  order: TeamId[];
  rounds: number;
  /** Picks made so far. */
  next: number;
  pool: PlayerId[];
  /** Where each pro played before (for the board). */
  from: Record<PlayerId, TeamId>;
  /** Class players chosen so far (their slot bonus follows this). */
  rookies: number;
  /** Our picks go to the scouts through this round. */
  autoUntil?: number;
  /** Every pick, in order. */
  picks: { teamId: TeamId; id: PlayerId }[];
}

export const isFantasyWinter = (s: LeagueState, year: number) => s.user?.settings.scenario === 'fantasy' && year === FANTASY.year;

/** The club picking at pick `i` (0-based). */
export function fantasyTeamAt(f: FantasyDraft, i: number): TeamId {
  const c = f.order.length;
  const round = Math.floor(i / c),
    k = i % c;
  return round % 2 === 0 ? f.order[k]! : f.order[c - 1 - k]!;
}
export const fantasyRound = (f: FantasyDraft, i = f.next) => Math.floor(i / f.order.length) + 1;

/** Clears every club and puts the league and the class on the board. */
export function openFantasy(s: LeagueState, year: number): FantasyDraft {
  const clubs = s.teams.filter((t) => s.rosters[t.id]).map((t) => t.id);
  const from: Record<PlayerId, TeamId> = {};
  const pros: Player[] = [];
  for (const teamId of clubs)
    for (const id of orgIds(s, teamId)) {
      const p = s.players[id]!;
      if (isForeign(p) || p.status !== 'active') continue;
      from[id] = teamId;
      pros.push(p);
    }
  for (const p of pros) {
    const r = s.rosters[p.teamId!]!;
    r.active = r.active.filter((id) => id !== p.id);
    r.futures = r.futures.filter((id) => id !== p.id);
    r.third = r.third.filter((id) => id !== p.id);
    p.teamId = null;
  }
  // The class: as many as a rookie draft takes, by the clubs' ranking after the combine.
  const size = clubs.length * FANTASY.classRounds;
  const rookies = applyCombine(s.seed, year, draftClass(s.seed, year))
    .sort((a, b) => a.amateur.draftRank - b.amateur.draftRank)
    .slice(0, size);
  for (const p of rookies) s.players[p.id] = p;
  const r = rng(`${s.seed}|fantasy|${year}`);
  const order = [...clubs];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const pool = [...pros.map((p) => p.id), ...rookies.map((p) => p.id)];
  return { year, order, rounds: Math.ceil(pool.length / clubs.length), next: 0, pool, from, rookies: 0, picks: [] };
}

/** How many of each kind a club wants on its whole roster. */
const TARGET: Record<string, number> = { SP: 13, RP: 15, C: 5, IF: 12, OF: 10 };
const kindOf = (p: Player) => (isPitcher(p) ? p.role : p.position === 'C' ? 'C' : ['LF', 'CF', 'RF'].includes(p.position ?? '') ? 'OF' : 'IF');

/** A club's pay next season for the players it has. */
const payOf = (s: LeagueState, teamId: TeamId, season: number) => orgIds(s, teamId).reduce((a, id) => a + salaryIn(s.players[id]!, season), 0);

/** How a club rates a player on the board: grade (young players' futures blended in), need, age, pay. */
export function fantasyScore(s: LeagueState, f: FantasyDraft, teamId: TeamId, p: Player, counts = kindCounts(s, teamId), pay = payOf(s, teamId, f.year + 1)): number {
  const next = f.year + 1;
  const kind = kindOf(p);
  const need = Math.max(-6, Math.min(4, ((TARGET[kind] ?? 10) - (counts[kind] ?? 0)) * 0.6));
  const age = ageIn(p, next);
  const old = age >= 33 ? (age - 32) * 1.2 : 0;
  const salary = salaryIn(p, next);
  const room = salaryCapFor(next) * FANTASY.capShare - pay;
  const over = Math.max(0, salary - Math.max(0, room)) / 10_000;
  return keepValue(p, next) + need - old - over * 1.5;
}

function kindCounts(s: LeagueState, teamId: TeamId) {
  const c: Record<string, number> = {};
  for (const id of orgIds(s, teamId)) {
    const p = s.players[id]!;
    if (isForeign(p)) continue;
    const k = kindOf(p);
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
}

/** The pick a club (or our scouts) makes. */
export function aiFantasyChoice(s: LeagueState, f: FantasyDraft, teamId: TeamId): Player | null {
  const r = rng(`${s.seed}|fantasy-pick|${f.year}|${f.next}`);
  const counts = kindCounts(s, teamId);
  const pay = payOf(s, teamId, f.year + 1);
  let best: Player | null = null,
    top = -Infinity;
  for (const id of f.pool) {
    const p = s.players[id]!;
    const v = fantasyScore(s, f, teamId, p, counts, pay) + (r() - 0.5) * 3;
    if (v > top) {
      top = v;
      best = p;
    }
  }
  return best;
}

export function makeFantasyPick(s: LeagueState, f: FantasyDraft, p: Player) {
  const teamId = fantasyTeamAt(f, f.next);
  const next = f.year + 1;
  f.pool = f.pool.filter((id) => id !== p.id);
  if (p.status === 'amateur') {
    f.rookies++;
    p.origin.overallPick = f.rookies;
    const bonus = slotBonus(f.rookies, f.order.length);
    p.contract = rookieContract(teamId, next, bonus);
    p.status = 'active';
    const u = s.user;
    if (u && teamId === u.teamId) {
      u.fund -= bonus;
      u.ledger.push({ year: f.year, label: `판타지 드래프트 신인 계약금 · ${p.name}`, amount: -bonus });
    }
  } else if (p.contract) p.contract.teamId = teamId;
  p.teamId = teamId;
  s.rosters[teamId]!.futures.push(p.id);
  f.picks.push({ teamId, id: p.id });
  f.next++;
}

/** AI picks until our club is on the clock (and has not handed the pick to the scouts) or the board is empty. */
export function runFantasy(s: LeagueState, f: FantasyDraft): 'wait' | 'done' {
  const me = s.user?.teamId;
  while (f.next < f.order.length * f.rounds && f.pool.length) {
    const teamId = fantasyTeamAt(f, f.next);
    if (teamId === me && !(f.autoUntil && fantasyRound(f) <= f.autoUntil)) {
      s.pending = { kind: 'fantasyPick', overall: f.next + 1, round: fantasyRound(f), rounds: f.rounds };
      return 'wait';
    }
    const p = aiFantasyChoice(s, f, teamId);
    if (!p) break;
    makeFantasyPick(s, f, p);
  }
  // Nobody is left over (the rounds cover the board), but just in case: the class goes home, pros are let go.
  for (const id of f.pool) if (s.players[id]?.status === 'amateur') delete s.players[id];
  f.pool = f.pool.filter((id) => s.players[id]);
  closeFantasy(s, f);
  return 'done';
}

function closeFantasy(s: LeagueState, f: FantasyDraft) {
  const u = s.user;
  if (!u) return;
  const ours = f.picks.filter((x) => x.teamId === u.teamId).slice(0, 5);
  const names = ours.map((x, i) => `${i + 1}R ${s.players[x.id]?.name ?? ''}`);
  const date = `${f.year}-11-25`;
  addAlert(s, { id: `fantasy-${f.year}`, date, kind: 'achievement', title: '판타지 드래프트 종료', lines: [`${f.rounds}라운드, ${f.picks.length}명이 새 구단을 찾았습니다.`, `우리 구단 상위 지명: ${names.join(' · ')}`, `${FANTASY.seasons[0]}~${FANTASY.seasons.at(-1)} 세 시즌의 성적으로 점수를 매깁니다.`], tone: 'good' });
  const first = f.picks.slice(0, f.order.length).map((x) => `${s.teams.find((t) => t.id === x.teamId)?.short ?? x.teamId} ${s.players[x.id]?.name ?? ''}`);
  addNews(s, { id: `fantasy-${f.year}`, date, kind: 'move', title: '판타지 드래프트, 리그가 새로 짜였다', body: `1라운드 지명: ${first.join(', ')}.`, quotes: [], facts: { 라운드: f.rounds, 지명: f.picks.length }, players: f.picks.slice(0, f.order.length).map((x) => x.id), mine: false });
}

/** Our board: the best left by our scouts' order, with where each played. */
export function fantasyBoard(s: LeagueState, f: FantasyDraft, limit = 200) {
  const me = s.user!.teamId;
  const counts = kindCounts(s, me);
  const pay = payOf(s, me, f.year + 1);
  return f.pool
    .map((id) => s.players[id]!)
    .map((p) => ({ p, score: fantasyScore(s, f, me, p, counts, pay), from: f.from[p.id] ?? null, kind: kindOf(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const fantasyKinds = (s: LeagueState) => kindCounts(s, s.user!.teamId);
export const fantasyPay = (s: LeagueState, f: FantasyDraft) => payOf(s, s.user!.teamId, f.year + 1);
