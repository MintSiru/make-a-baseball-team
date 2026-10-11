import { k as __i18n_k } from '../i18n/index';
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
  if (!u || !p || p.teamId !== u.teamId || p.status !== 'active') return __i18n_k("league.entry.canMove.60e00321");
  if (s.phase !== 'regular') return __i18n_k("league.entry.canMove.095a6eb2");
  if ((u.entry ?? 'auto') !== 'manual') return __i18n_k("league.entry.canMove.9a853d04");
  if (s.abroad?.[id]) return __i18n_k("league.entry.canMove.3f64d426", { value: s.abroad[id] });
  const from = squadOf(s, id);
  if (from === to) return null;
  const date = today(s);
  const r = s.rosters[u.teamId]!;
  if (to === 'active') {
    if (!r.active.length && s.year < u.firstTeamYear) return __i18n_k("league.entry.canMove.81880ddf");
    if (isDevelopment(p)) return __i18n_k("league.entry.canMove.bc9d990b");
    if (offRoster(s, id)) return s.suspended?.[id] ? __i18n_k("league.entry.canMove.c30a1a7f") : s.away[id] ? __i18n_k("league.entry.canMove.603e30f7") : __i18n_k("league.entry.canMove.fc099ae5");
    if (r.active.length >= firstTeamSize(s, u.teamId)) return __i18n_k("league.entry.canMove.80107525", { firstTeamSize: firstTeamSize(s, u.teamId) });
    const back = s.demoted?.[id];
    if (back && date < addDays(back, REREGISTER_DAYS)) return __i18n_k("league.entry.canMove.a9a51986", { rEREGISTER_DAYS: REREGISTER_DAYS, addDays: addDays(back, REREGISTER_DAYS) });
  }
  if (from === 'active' && r.active.length <= MIN_FIRST_TEAM) return __i18n_k("league.entry.canMove.65a191aa", { mIN_FIRST_TEAM: MIN_FIRST_TEAM });
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
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.entry.canRegister.60e00321");
  if (!isDevelopment(p)) return __i18n_k("league.entry.canRegister.27805a63");
  if (s.phase !== 'regular' || today(s) < `${s.year}-${KBO_2026.development.registerFrom}`) return __i18n_k("league.entry.canRegister.b12e8868");
  if (registeredIds(s, u.teamId).length >= rosterLimit(s.year)) return __i18n_k("league.entry.canRegister.c85619fe", { rosterLimit: rosterLimit(s.year) });
  return null;
}

export function registerPlayer(s: LeagueState, id: PlayerId) {
  const problem = canRegister(s, id);
  if (problem) throw new Error(problem);
  const p = s.players[id]!;
  p.contract!.kind = 'standard';
  (s.user!.log ??= []).push({ year: s.year, text: __i18n_k("league.entry.registerPlayer.text.a3840eb9", { name: p.name, today: today(s) }) });
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
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.entry.canSetRole.60e00321");
  if (p.role !== 'SP' && p.role !== 'RP') return __i18n_k("league.entry.canSetRole.1199bedb");
  if ((u.entry ?? 'auto') !== 'manual') return __i18n_k("league.entry.canSetRole.7b291c84");
  if (p.role === role) return null;
  return null;
}

export function setRole(s: LeagueState, id: PlayerId, role: 'SP' | 'RP') {
  const problem = canSetRole(s, id, role);
  if (problem) throw new Error(problem);
  const p = s.players[id]!;
  if (p.role === role) return;
  p.role = role;
  (s.user!.log ??= []).push({ year: s.year, text: __i18n_k("league.entry.setRole.text.c04ce522", { name: p.name, value: role === 'SP' ? __i18n_k("league.entry.setRole.text.a88271df") : __i18n_k("league.entry.setRole.text.5b8607a3") }) });
}

// ── The lineup card (V0.8) ───────────────────────────────────────────────────────────────────────

const FIELD: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/** Checks the general manager's lineup card: his own hitters (a two-way player too), each once and each position
    once per list; his own pitchers in the rotation, five at most. */
export function checkLineupCard(s: LeagueState, card: LineupCard): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.entry.checkLineupCard.272add95");
  const ours = (id: PlayerId) => s.players[id]?.teamId === u.teamId;
  for (const [hand, list] of [
    [__i18n_k("league.entry.checkLineupCard.5fbba1d3"), card.R],
    [__i18n_k("league.entry.checkLineupCard.c03a5dae"), card.L],
  ] as const) {
    if (!Array.isArray(list) || list.length !== 9) return __i18n_k("league.entry.checkLineupCard.164488b8");
    const ids = new Set<PlayerId>(),
      spots = new Set<FieldPos>();
    for (const slot of list) {
      if (!slot) continue;
      const p = s.players[slot.id];
      if (!p || !ours(slot.id)) return __i18n_k("league.entry.checkLineupCard.2e480919", { hand: hand });
      if (isPitcher(p) && !p.twoWay) return __i18n_k("league.entry.checkLineupCard.d96bc9ae", { hand: hand, name: eunneun(p.name) });
      if (!FIELD.includes(slot.pos)) return __i18n_k("league.entry.checkLineupCard.0c39291f", { hand: hand });
      if (ids.has(slot.id)) return __i18n_k("league.entry.checkLineupCard.eee8e6bf", { hand: hand, name: iga(p.name) });
      if (spots.has(slot.pos)) return __i18n_k("league.entry.checkLineupCard.af4d6dc9", { hand: hand, pos: slot.pos });
      ids.add(slot.id);
      spots.add(slot.pos);
    }
  }
  if (card.rotation.length > 5) return __i18n_k("league.entry.checkLineupCard.133d2296");
  if (new Set(card.rotation).size !== card.rotation.length) return __i18n_k("league.entry.checkLineupCard.97c24fe3");
  for (const id of card.rotation) {
    const p = s.players[id];
    if (!p || !ours(id) || !isPitcher(p)) return __i18n_k("league.entry.checkLineupCard.18f06d81");
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

