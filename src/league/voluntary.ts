import { k as __i18n_k } from '../i18n/index';
/* 2.0.37 (the user's request): the voluntary retired list (임의탈퇴; 임의해지 since 2022, KBO 규약 제31조). A club may
   put a player of its own on it — for a scandal, or when he will not play for it — instead of releasing him: he
   leaves the roster and the payroll and cannot play for anyone, but the club keeps his rights. From a year after it
   was announced, the club may take him back (on 70% of what he was paid, the minimum at least); no other club may
   sign him while he is on it. A player who left for another sport (othersport.ts) is held the same way, but comes
   back on his own. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { minimumSalaryFor } from '../rules/kbo2026';
import { salaryIn } from './contracts';
import { today } from './entry';
import { eulreul, iga } from './josa';
import { note } from './life';
import { noteMove } from './moves';
import { addNews } from './news';
import { removeFromRoster, sign } from './offseason';
import { isForeign } from './players';
import type { LeagueState } from './state';

export const VOLUNTARY = { days: 365, keep: 0.7 };

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const shortOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '';
/** The day it is in the game, in season or out of it. */
const dayOf = (s: LeagueState) => (s.offseason ? `${s.offseason.year}-12-01` : today(s));
/** The season a contract signed now is for. */
const seasonOf = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.phase === 'regular' ? s.year : s.year + 1);

/** Why our club cannot put him on the list, or null. */
export function canVoluntary(s: LeagueState, id: PlayerId): string | null {
  const u = s.user;
  const p = s.players[id];
  if (!u || !p || p.teamId !== u.teamId || p.status !== 'active') return __i18n_k("league.voluntary.text.ebc63783");
  if (isForeign(p)) return __i18n_k("league.voluntary.text.f5a96743");
  if (s.pending) return __i18n_k("league.voluntary.text.55e22a98");
  return null;
}

/** Off the roster and the payroll, his rights kept. */
export function placeVoluntary(s: LeagueState, p: Player, why: 'club' | 'scandal', date = dayOf(s)) {
  const teamId = p.teamId!;
  const salary = salaryIn(p, seasonOf(s)) || salaryIn(p, s.year) || minimumSalaryFor(seasonOf(s));
  noteMove(s, p, 'retire', teamId, null, __i18n_k("league.voluntary.text.88338b66"), date);
  removeFromRoster(s, p);
  p.status = 'retired';
  p.teamId = null;
  p.contract = null;
  delete s.injuries[p.id];
  delete s.away?.[p.id];
  delete s.discipline?.[p.id];
  (s.voluntary ??= {})[p.id] = { teamId, since: date, why, salary };
  const club = shortOf(s, teamId);
  const title = __i18n_k("league.voluntary.text.f06e02f4", { club, name: p.name });
  const body = why === 'scandal' ? __i18n_k("league.voluntary.text.be26c663", { club: iga(club), name: eulreul(p.name), club2: club }) : __i18n_k("league.voluntary.text.cef24f8b", { club: iga(club), name: eulreul(p.name), club2: club });
  note(p, date, title, 'bad');
  addNews(s, { id: `voluntary-${p.id}-${date}`, date, kind: 'move', title, body, quotes: [], facts: { player: p.name, club }, players: [p.id], ...(teamId === s.user?.teamId ? { mine: true } : {}) });
  if (s.user && teamId === s.user.teamId) (s.user.log ??= []).push({ year: s.year, text: title });
}

/** The day our club may take him back. */
export const backFrom = (s: LeagueState, id: PlayerId) => (s.voluntary?.[id] ? addDays(s.voluntary[id]!.since, VOLUNTARY.days) : null);

/** Why our club cannot take him back now, or null. */
export function canReinstate(s: LeagueState, id: PlayerId): string | null {
  const v = s.voluntary?.[id];
  if (!v || v.teamId !== s.user?.teamId) return __i18n_k("league.voluntary.text.60895c27");
  if (s.pending) return __i18n_k("league.voluntary.text.55e22a98");
  if (dayOf(s) < backFrom(s, id)!) return __i18n_k("league.voluntary.text.2792d4e9", { date: backFrom(s, id)! });
  return null;
}

/** Back on the roster (the futures squad), on 70% of his old salary. */
export function reinstate(s: LeagueState, id: PlayerId) {
  const v = s.voluntary![id]!;
  const p = s.players[id]!;
  delete s.voluntary![id];
  const season = seasonOf(s);
  const amount = Math.max(minimumSalaryFor(season), Math.round((v.salary * VOLUNTARY.keep) / 100) * 100);
  sign(s, p, v.teamId, { teamId: v.teamId, kind: 'standard', signedIn: season - 1, signingBonus: 0, salaries: [{ season, amount }] });
  const date = dayOf(s);
  noteMove(s, p, 'returnee', null, v.teamId, __i18n_k("league.voluntary.text.10d788d8"), date);
  const club = shortOf(s, v.teamId);
  const title = __i18n_k("league.voluntary.text.a0d2f5e4", { club, name: p.name });
  note(p, date, title, 'good');
  addNews(s, { id: `voluntary-back-${p.id}-${date}`, date, kind: 'move', title, body: __i18n_k("league.voluntary.text.0aa7f05e", { club: iga(club), name: eulreul(p.name) }), quotes: [], facts: { player: p.name, club }, players: [p.id], ...(v.teamId === s.user?.teamId ? { mine: true } : {}) });
}

/** Our club's players held on the list or away at another sport, for the contracts screen. */
export function heldPlayers(s: LeagueState): { id: PlayerId; kind: 'voluntary' | 'sport'; since: string; back: string | null }[] {
  const me = s.user?.teamId;
  const out: { id: PlayerId; kind: 'voluntary' | 'sport'; since: string; back: string | null }[] = [];
  for (const [id, v] of Object.entries(s.voluntary ?? {})) if (v.teamId === me) out.push({ id, kind: 'voluntary', since: v.since, back: backFrom(s, id) });
  for (const [id, a] of Object.entries(s.otherSport ?? {})) if (a.teamId === me) out.push({ id, kind: 'sport', since: `${a.since}-11-20`, back: null });
  return out;
}
