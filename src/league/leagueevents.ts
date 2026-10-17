/* 1.9.7: the league's own timeline in a legacy game (리그 연표, Story): openings, foundings, new names, rule changes,
   firsts. Kept apart so any module can add to it without importing the legacy start's machinery. */
import type { LeagueState } from './state';

/** A line on the league's timeline (once per text and year); nothing outside a legacy game. */
export function leagueEvent(s: LeagueState, year: number, text: string) {
  if (!s.legacy) return;
  const events = (s.legacy.events ??= []);
  if (!events.some((e) => e.year === year && e.text === text)) events.push({ year, text });
}
