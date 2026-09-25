/* What the spectator can do, as pure state transitions. The UI and the worker both call these. */
import { closeSeason, runOffseason } from './offseason';
import { playPostseason } from './postseason';
import { playDay, startSeason } from './season';
import type { LeagueState } from './state';

export type Action = { kind: 'days'; days: number } | { kind: 'regularEnd' } | { kind: 'postseason' } | { kind: 'nextSeason' };

export const regularOver = (s: LeagueState) => s.phase === 'regular' && s.next >= s.schedule.length;

export function apply(s: LeagueState, action: Action): LeagueState {
  switch (action.kind) {
    case 'days':
      for (let i = 0; i < action.days && playDay(s); i++);
      break;
    case 'regularEnd':
      while (playDay(s));
      break;
    case 'postseason':
      if (regularOver(s)) playPostseason(s);
      break;
    case 'nextSeason':
      if (s.phase === 'postseason') {
        closeSeason(s);
        runOffseason(s);
        startSeason(s);
      }
      break;
  }
  return s;
}

/** The date of the next game day, or null once the regular season is done. */
export const nextDate = (s: LeagueState) => s.schedule[s.next]?.date ?? null;
