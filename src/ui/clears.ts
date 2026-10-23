/* 2.0.42 (the user's request: 시나리오를 깼으면 새 게임 화면에 표시): the scenarios this browser has cleared, and the best
   medal of each. Kept in the browser's own storage, not in any save, so a new game shows them. */
import { MEDALS, type Medal, type ScenarioId } from '../league/scenarios';
import type { LeagueState } from '../league/state';

const KEY = 'kbo-scenario-clears';
/** A clear with no medal (a fantasy draft below grade B). */
export type Clear = Medal | 'clear';
const RANK: Clear[] = [...MEDALS, 'clear'];

export function readClears(): Partial<Record<ScenarioId, Clear>> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Clear>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => RANK.includes(v))) as Partial<Record<ScenarioId, Clear>>;
  } catch {
    return {};
  }
}

/** Remembers a won scenario of this league, keeping the better medal. */
export function noteClear(league: LeagueState | null) {
  const u = league?.user;
  const id = u?.settings.scenario;
  if (!u || !id || u.scenario?.status !== 'won') return;
  const now: Clear = u.scenario.medal ?? 'clear';
  const all = readClears();
  const before = all[id];
  if (before && RANK.indexOf(before) <= RANK.indexOf(now)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: now }));
  } catch {
    // Storage off: nothing to remember.
  }
}

export const CLEAR_MARK: Record<Clear, string> = { gold: '🥇', silver: '🥈', bronze: '🥉', clear: '✔' };
