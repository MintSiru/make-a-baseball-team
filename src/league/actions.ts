/* What the player can do, as state transitions. The UI and the worker both call these. */
import { closeSeason, advanceOffseason, beginOffseason } from './offseason';
import { playPostseason } from './postseason';
import { playDay, startSeason } from './season';
import type { PlayerId, TeamId } from '../model/types';
import { makeTrade, releasePlayer, replaceForeign, signFromPool } from './trade';
import { movePlayer, registerPlayer, setRole } from './entry';
import type { BullpenRole } from './engine/types';
import { ensureNumbers } from './numbers';
import { renameStadium } from './userclub';
import type { ExpansionSettings, LeagueState, Squad } from './state';
import { foundClub, FOUNDING_DATE, resolveDecision, type DecisionInput } from './expansion';

export type Action =
  | { kind: 'days'; days: number }
  | { kind: 'regularEnd' }
  | { kind: 'postseason' }
  | { kind: 'nextSeason' }
  | { kind: 'toFounding' }
  | { kind: 'found'; settings: ExpansionSettings }
  | { kind: 'decide'; input: DecisionInput }
  // The general manager's roster (V0.4)
  | { kind: 'entryMode'; mode: 'auto' | 'manual' }
  | { kind: 'move'; id: PlayerId; to: Squad }
  | { kind: 'register'; id: PlayerId }
  | { kind: 'setRole'; id: PlayerId; role: 'SP' | 'RP' }
  | { kind: 'penRole'; id: PlayerId; role: BullpenRole | null }
  | { kind: 'platoon'; id: PlayerId; side: 'L' | 'R' | null }
  | { kind: 'renameStadium'; name: string; which: 'current' | 'new' }
  // The market (V0.5)
  | { kind: 'trade'; teamId: TeamId; give: PlayerId[]; get: PlayerId[] }
  | { kind: 'release'; id: PlayerId }
  | { kind: 'signPool'; id: PlayerId }
  | { kind: 'foreignSwap'; out: PlayerId; in: string };

export const regularOver = (s: LeagueState) => s.phase === 'regular' && s.next >= s.schedule.length;

/** Starts the new year once the offseason has nothing left to ask. */
function finishOffseason(s: LeagueState) {
  if (s.phase === 'offseason' && !s.offseason && !s.pending) startSeason(s);
}

export function apply(s: LeagueState, action: Action): LeagueState {
  if (s.pending && action.kind !== 'decide') return s; // the game waits for a decision
  switch (action.kind) {
    case 'days':
      for (let i = 0; i < action.days && playDay(s); i++);
      break;
    case 'regularEnd':
      while (playDay(s));
      break;
    case 'toFounding':
      while (s.year === 2026 && (nextDate(s) ?? '9999') < FOUNDING_DATE && playDay(s));
      break;
    case 'found':
      foundClub(s, action.settings);
      break;
    case 'postseason':
      if (regularOver(s)) playPostseason(s);
      break;
    case 'nextSeason':
      if (s.phase === 'postseason') {
        closeSeason(s);
        beginOffseason(s);
        advanceOffseason(s);
        finishOffseason(s);
      }
      break;
    case 'decide':
      resolveDecision(s, action.input);
      finishOffseason(s);
      break;
    case 'entryMode':
      if (s.user) s.user.entry = action.mode;
      break;
    case 'move':
      movePlayer(s, action.id, action.to);
      break;
    case 'register':
      registerPlayer(s, action.id);
      break;
    case 'penRole':
    case 'platoon': {
      const u = s.user;
      if (!u || s.players[action.id]?.teamId !== u.teamId) break;
      const map = action.kind === 'penRole' ? (u.penRoles ??= {}) : (u.platoon ??= {});
      const value = action.kind === 'penRole' ? action.role : action.side;
      if (value) (map as Record<string, string>)[action.id] = value;
      else delete map[action.id];
      break;
    }
    case 'setRole':
      setRole(s, action.id, action.role);
      break;
    case 'renameStadium':
      renameStadium(s, action.name, action.which);
      break;
    case 'trade':
      makeTrade(s, action.teamId, action.give, action.get);
      break;
    case 'release':
      releasePlayer(s, action.id);
      break;
    case 'signPool':
      signFromPool(s, action.id);
      break;
    case 'foreignSwap':
      if (s.user) replaceForeign(s, s.user.teamId, action.out, action.in);
      break;
  }
  // Anyone who joined a club (or became a registered player) gets his number.
  ensureNumbers(s);
  return s;
}

/** The date of the next game day, or null once the regular season is done. */
export const nextDate = (s: LeagueState) => s.schedule[s.next]?.date ?? null;
