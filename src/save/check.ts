import { k as __i18n_k } from '../i18n/index';
/* What a league state needs before the screen can show it (1.4.1, from the 1.4 review): a save can be a well-formed
   file and still miss the league inside it (cut short, edited by hand, written by a broken build). Checked on every
   read — the autosave, a backup, a file — so a bad one is refused with a reason instead of breaking the page. */
import type { LeagueState } from '../league/state';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const PHASES = new Set(['regular', 'postseason', 'offseason']);

/** Why this cannot be played, or null when it can. */
export function stateProblem(raw: unknown): string | null {
  if (!isObj(raw)) return __i18n_k("save.check.stateProblem.9d5d2f50");
  const s = raw as Partial<LeagueState> & Record<string, unknown>;
  if (typeof s.seed !== 'string' || !s.seed) return __i18n_k("save.check.stateProblem.fe6731a4");
  if (!Number.isInteger(s.year)) return __i18n_k("save.check.stateProblem.7de6b214");
  if (!PHASES.has(String(s.phase))) return __i18n_k("save.check.stateProblem.9372592f");
  if (!Array.isArray(s.teams) || !s.teams.length || !s.teams.every((t) => isObj(t) && typeof t.id === 'string')) return __i18n_k("save.check.stateProblem.e5935da1");
  if (!isObj(s.players)) return __i18n_k("save.check.stateProblem.76a2ab8f");
  if (!isObj(s.rosters)) return __i18n_k("save.check.stateProblem.82b2a30f");
  for (const key of ['lines', 'arms', 'injuries'] as const) if (!isObj(s[key])) return __i18n_k("save.check.stateProblem.aeeeae2b", { key: key });
  for (const key of ['schedule', 'scores', 'history', 'postseason'] as const) if (!Array.isArray(s[key])) return __i18n_k("save.check.stateProblem.aeeeae2b", { key: key });
  if (!Number.isInteger(s.next)) return __i18n_k("save.check.stateProblem.9e22b910");
  const players = s.players as Record<string, unknown>;
  for (const t of s.teams) {
    const r = (s.rosters as Record<string, unknown>)[t.id];
    if (r === undefined) continue; // a club still being founded has no roster yet
    if (!isObj(r) || !['active', 'futures', 'third'].every((k) => Array.isArray(r[k]))) return __i18n_k("save.check.stateProblem.298586fb", { id: t.id });
    for (const k of ['active', 'futures', 'third'] as const) for (const id of r[k] as unknown[]) if (typeof id !== 'string' || !isObj(players[id])) return __i18n_k("save.check.stateProblem.9b0b8b65", { id: t.id });
  }
  if (s.user !== null) {
    if (!isObj(s.user) || typeof s.user.teamId !== 'string') return __i18n_k("save.check.stateProblem.51e45469");
    if (!s.teams.some((t) => t.id === s.user!.teamId)) return __i18n_k("save.check.stateProblem.98b05232");
    if (!Array.isArray(s.user.ledger) || !isObj(s.user.settings)) return __i18n_k("save.check.stateProblem.51e45469");
  }
  if (s.pending !== null && (!isObj(s.pending) || typeof s.pending.kind !== 'string')) return __i18n_k("save.check.stateProblem.b670d20d");
  if (s.offseason !== null && s.offseason !== undefined && !isObj(s.offseason)) return __i18n_k("save.check.stateProblem.41045df0");
  return null;
}
