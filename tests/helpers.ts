/* Test helpers (V0.12): the season can stop for a decision (a national-team call-up, a disciplined player), so a
   test that plays to the end of the regular season answers those the scouts' way and goes on. */
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import type { LeagueState } from '../src/league/state';

/** Plays to the end of the regular season, answering in-season decisions the scouts' way. */
export function endRegular(s: LeagueState) {
  for (let i = 0; i < 100; i++) {
    apply(s, { kind: 'regularEnd' });
    if (s.phase !== 'regular' || regularOver(s) || !s.pending) return;
    apply(s, { kind: 'decide', input: autoDecision(s)! });
  }
}

/** Plays `n` game days, answering in-season decisions the scouts' way. */
export function playDays(s: LeagueState, n: number) {
  const start = s.next;
  for (let i = 0; i < 100 && s.phase === 'regular' && s.next < start + n && !regularOver(s); i++) {
    apply(s, { kind: 'days', days: start + n - s.next });
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
  }
}
