/* First-team registration by the general manager (콜업·말소), squad moves below the first team, and
   registering development players. In 'auto' mode the manager keeps doing all of it; in 'manual' mode
   the user's moves stand and the manager only replaces players who get hurt or leave for the
   national team. KBO rules: a player sent down cannot be registered again for ten days; a development
   player can be registered from May 1, inside the 68-player limit (RULES.md §6). */
import type { PlayerId } from '../model/types';
import type { FieldPos } from './engine/types';
import { isPitcher } from './players';
import { eunneun, iga } from './josa';
import { KBO_2026 } from '../rules/kbo2026';
import { firstTeamSize } from './manager';
import { offRoster } from './injuries';
import { rosterLimit } from './offseason';
import { isDevelopment, moveTo, registeredIds, squadOf, type LeagueState, type LineupCard, type Squad } from './state';

export const REREGISTER_DAYS = 10;
/** The fewest players the general manager may leave on the first team (game assumption). */
export const MIN_FIRST_TEAM = 26;

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** Today in the league calendar: the next game day during the season. */
export const today = (s: LeagueState) => s.schedule[s.next]?.date ?? s.schedule.at(-1)?.date ?? `${s.year}-10-01`;

export function canMove(s: LeagueState, id: PlayerId, to: Squad): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId || p.status !== 'active') return '우리 선수가 아닙니다.';
  if (s.phase !== 'regular') return '정규시즌 중에만 선수단을 옮길 수 있습니다.';
  if ((u.entry ?? 'auto') !== 'manual') return '직접 관리로 바꾸면 선수를 옮길 수 있습니다.';
  const from = squadOf(s, id);
  if (from === to) return null;
  const date = today(s);
  const r = s.rosters[u.teamId]!;
  if (to === 'active') {
    if (!r.active.length && s.year < u.firstTeamYear) return '아직 1군에 들어가지 않았습니다.';
    if (isDevelopment(p)) return '육성선수는 정식선수로 등록한 뒤에 1군에 올릴 수 있습니다.';
    if (offRoster(s, id)) return '부상이거나 대표팀에 가 있습니다.';
    if (r.active.length >= firstTeamSize(s, u.teamId)) return `1군 엔트리 ${firstTeamSize(s, u.teamId)}명이 찼습니다. 먼저 한 명을 말소하세요.`;
    const back = s.demoted?.[id];
    if (back && date < addDays(back, REREGISTER_DAYS)) return `말소 후 ${REREGISTER_DAYS}일이 지나야 다시 등록할 수 있습니다 (${addDays(back, REREGISTER_DAYS)}부터).`;
  }
  if (from === 'active' && r.active.length <= MIN_FIRST_TEAM) return `1군은 최소 ${MIN_FIRST_TEAM}명을 두세요.`;
  return null;
}

export function movePlayer(s: LeagueState, id: PlayerId, to: Squad) {
  const problem = canMove(s, id, to);
  if (problem) throw new Error(problem);
  if (squadOf(s, id) === 'active' && to !== 'active') (s.demoted ??= {})[id] = today(s);
  moveTo(s, id, to);
}

export function canRegister(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return '우리 선수가 아닙니다.';
  if (!isDevelopment(p)) return '이미 정식선수입니다.';
  if (s.phase !== 'regular' || today(s) < `${s.year}-${KBO_2026.development.registerFrom}`) return '육성선수는 5월 1일부터 정식선수로 등록할 수 있습니다.';
  if (registeredIds(s, u.teamId).length >= rosterLimit(s.year)) return `소속선수 ${rosterLimit(s.year)}명이 찼습니다.`;
  return null;
}

export function registerPlayer(s: LeagueState, id: PlayerId) {
  const problem = canRegister(s, id);
  if (problem) throw new Error(problem);
  const p = s.players[id]!;
  p.contract!.kind = 'standard';
  (s.user!.log ??= []).push({ year: s.year, text: `${p.name} 정식선수 등록 (${today(s)})` });
}

/** The general manager's first team in manual mode: players who cannot play are replaced by the best available. */
export function manualReplacements(s: LeagueState, pick: (candidates: PlayerId[]) => PlayerId | undefined) {
  const u = s.user!;
  const r = s.rosters[u.teamId]!;
  const size = firstTeamSize(s, u.teamId);
  for (const id of r.active.filter((x) => offRoster(s, x))) moveTo(s, id, 'futures');
  while (r.active.length < Math.min(size, MIN_FIRST_TEAM)) {
    const candidates = [...r.futures, ...r.third].filter((x) => !offRoster(s, x) && !isDevelopment(s.players[x]!));
    const next = pick(candidates);
    if (!next) break;
    moveTo(s, next, 'active');
  }
}

/** Starter or reliever, any time in manual mode (the rotation takes starters first). */
export function canSetRole(s: LeagueState, id: PlayerId, role: 'SP' | 'RP'): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId) return '우리 선수가 아닙니다.';
  if (p.role !== 'SP' && p.role !== 'RP') return '투수만 보직을 바꿀 수 있습니다.';
  if ((u.entry ?? 'auto') !== 'manual') return '직접 관리로 바꾸면 보직을 바꿀 수 있습니다.';
  if (p.role === role) return null;
  return null;
}

export function setRole(s: LeagueState, id: PlayerId, role: 'SP' | 'RP') {
  const problem = canSetRole(s, id, role);
  if (problem) throw new Error(problem);
  const p = s.players[id]!;
  if (p.role === role) return;
  p.role = role;
  (s.user!.log ??= []).push({ year: s.year, text: `${p.name} ${role === 'SP' ? '선발' : '불펜'}으로 보직 변경` });
}

// ── The lineup card (V0.8) ───────────────────────────────────────────────────────────────────────

const FIELD: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/** Checks the general manager's lineup card: his own hitters (a two-way player too), each once and each position
    once per list; his own pitchers in the rotation, five at most. */
export function checkLineupCard(s: LeagueState, card: LineupCard): string | null {
  const u = s.user;
  if (!u) return '구단이 없습니다.';
  const ours = (id: PlayerId) => s.players[id]?.teamId === u.teamId;
  for (const [hand, list] of [
    ['우완', card.R],
    ['좌완', card.L],
  ] as const) {
    if (!Array.isArray(list) || list.length !== 9) return '타순은 1~9번 아홉 자리입니다.';
    const ids = new Set<PlayerId>(),
      spots = new Set<FieldPos>();
    for (const slot of list) {
      if (!slot) continue;
      const p = s.players[slot.id];
      if (!p || !ours(slot.id)) return `상대 ${hand} 라인업: 우리 선수가 아닙니다.`;
      if (isPitcher(p) && !p.twoWay) return `상대 ${hand} 라인업: ${eunneun(p.name)} 투수입니다.`;
      if (!FIELD.includes(slot.pos)) return `상대 ${hand} 라인업: 알 수 없는 수비 위치입니다.`;
      if (ids.has(slot.id)) return `상대 ${hand} 라인업: ${iga(p.name)} 두 번 들어 있습니다.`;
      if (spots.has(slot.pos)) return `상대 ${hand} 라인업: ${slot.pos} 자리에 두 명이 있습니다.`;
      ids.add(slot.id);
      spots.add(slot.pos);
    }
  }
  if (card.rotation.length > 5) return '선발 로테이션은 5명까지입니다.';
  if (new Set(card.rotation).size !== card.rotation.length) return '선발 로테이션에 같은 투수가 두 번 있습니다.';
  for (const id of card.rotation) {
    const p = s.players[id];
    if (!p || !ours(id) || !isPitcher(p)) return '선발 로테이션에는 우리 투수만 넣을 수 있습니다.';
  }
  return null;
}

/** Sets (or, with null, clears) the general manager's lineup card. */
export function setLineupCard(s: LeagueState, card: LineupCard | null) {
  const u = s.user;
  if (!u) return;
  if (!card) {
    delete u.lineup;
    return;
  }
  const problem = checkLineupCard(s, card);
  if (problem) throw new Error(problem);
  u.lineup = { R: card.R.map((x) => (x ? { id: x.id, pos: x.pos } : null)), L: card.L.map((x) => (x ? { id: x.id, pos: x.pos } : null)), rotation: [...card.rotation], rest: card.rest !== false };
}

