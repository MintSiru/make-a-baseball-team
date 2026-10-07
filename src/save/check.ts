/* What a league state needs before the screen can show it (1.4.1, from the 1.4 review): a save can be a well-formed
   file and still miss the league inside it (cut short, edited by hand, written by a broken build). Checked on every
   read — the autosave, a backup, a file — so a bad one is refused with a reason instead of breaking the page. */
import type { LeagueState } from '../league/state';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const PHASES = new Set(['regular', 'postseason', 'offseason']);

/** Why this cannot be played, or null when it can. */
export function stateProblem(raw: unknown): string | null {
  if (!isObj(raw)) return '리그 상태가 없습니다.';
  const s = raw as Partial<LeagueState> & Record<string, unknown>;
  if (typeof s.seed !== 'string' || !s.seed) return '시드가 없습니다.';
  if (!Number.isInteger(s.year)) return '시즌 연도가 없습니다.';
  if (!PHASES.has(String(s.phase))) return '진행 단계가 없습니다.';
  if (!Array.isArray(s.teams) || !s.teams.length || !s.teams.every((t) => isObj(t) && typeof t.id === 'string')) return '구단 목록이 없습니다.';
  if (!isObj(s.players)) return '선수 명단이 없습니다.';
  if (!isObj(s.rosters)) return '구단별 선수단이 없습니다.';
  for (const key of ['lines', 'arms', 'injuries'] as const) if (!isObj(s[key])) return `시즌 기록(${key})이 없습니다.`;
  for (const key of ['schedule', 'scores', 'history', 'postseason'] as const) if (!Array.isArray(s[key])) return `시즌 기록(${key})이 없습니다.`;
  if (!Number.isInteger(s.next)) return '다음 경기 위치가 없습니다.';
  const players = s.players as Record<string, unknown>;
  for (const t of s.teams) {
    const r = (s.rosters as Record<string, unknown>)[t.id];
    if (r === undefined) continue; // a club still being founded has no roster yet
    if (!isObj(r) || !['active', 'futures', 'third'].every((k) => Array.isArray(r[k]))) return `${t.id} 선수단이 손상되었습니다.`;
    for (const k of ['active', 'futures', 'third'] as const) for (const id of r[k] as unknown[]) if (typeof id !== 'string' || !isObj(players[id])) return `${t.id} 선수단에 없는 선수가 있습니다.`;
  }
  if (s.user !== null) {
    if (!isObj(s.user) || typeof s.user.teamId !== 'string') return '우리 구단 정보가 손상되었습니다.';
    if (!s.teams.some((t) => t.id === s.user!.teamId)) return '우리 구단이 리그에 없습니다.';
    if (!Array.isArray(s.user.ledger) || !isObj(s.user.settings)) return '우리 구단 정보가 손상되었습니다.';
  }
  if (s.pending !== null && (!isObj(s.pending) || typeof s.pending.kind !== 'string')) return '기다리는 결정이 손상되었습니다.';
  if (s.offseason !== null && s.offseason !== undefined && !isObj(s.offseason)) return '오프시즌 정보가 손상되었습니다.';
  return null;
}
