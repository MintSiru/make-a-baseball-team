import { k as __i18n_k } from '../i18n/index';
/* 1.9.5: the postseason of a league that plays history (the 1982 legacy start; RULES.md §14), drawn by the year's
   rules (rules/history.ts):
   - 1982–1985 (halves, halvesBest): the first half's winner against the second half's in the Korean Series. A club
     that wins both halves meets the best of the rest in 1982–1984 (a game assumption) and is the champion without a
     series in 1985 (Samsung); in 1985 the best on the whole season goes straight to the final (1.9.8).
   - 1986–1988 (halvesTickets): the first two of each half get a place each; a club with two goes straight to the
     final, the others play the playoff (four different clubs: each half's winner against the other half's second).
   - 1989–1992, 2001–2014 (four) and 1993–1998 (fourWithin3): a ladder of the top four — the 3rd and 4th, the winner
     against the 2nd, then against the 1st; 1993–1998 without the first round when the 4th is more than three games
     behind the 3rd.
   - 1999–2000 (twoLeagues): each league's top two across, a league's 3rd with a better record than the other league's
     2nd plays it first (the rule postseason.ts kept for a two-league bracket with no style).
   Series lengths are the year's. 2015 on is today's postseason. */
import { rulesFor } from '../rules/history';
import { addDays, live, result, type Bracket, type LiveSeries } from './postseason';
import { standings, type StandingRow } from './standings';
import { firstTeamIds, type LeagueState, type SeriesResult } from './state';
import { isTiebreaker } from './tiebreak';
import { unlock } from './milestones';
import { leagueTables, sidesOf } from './twelve';
import type { TeamId } from '../model/types';

/** Home games of the higher seed, game by game, in a best-of-`n`. */
const homesOf = (n: number): boolean[] => (n <= 3 ? [true, true, false].slice(0, n) : n === 5 ? [true, true, false, false, true] : Array.from({ length: n }, (_, i) => i < 2 || i >= n - 2));
const toWin = (n: number) => Math.ceil(n / 2);

/** The two halves' tables (the schedule split at its middle game day; tiebreakers left out). */
export function halfTables(s: LeagueState): [StandingRow[], StandingRow[]] {
  const games = s.schedule.filter((g) => !isTiebreaker(g.id));
  const mid = games[Math.floor(games.length / 2)]?.date ?? `${s.year}-07-01`;
  const ids = firstTeamIds(s);
  const played = s.scores.filter((g) => !isTiebreaker(g.id));
  return [standings(ids, played.filter((g) => g.date < mid)), standings(ids, played.filter((g) => g.date >= mid))];
}

/** Lengths of this year's rounds (best of n). */
function lengths(year: number): Record<SeriesResult['round'], number> {
  const x = rulesFor(year).series;
  return { wildcard: x.wildCard ?? 2, semipo: x.semi ?? 3, po: x.playoff ?? 5, ks: x.final };
}

/** Draws the year's postseason (2015 on is postseason.ts's own). */
export function drawHistoric(s: LeagueState, date: string): Bracket {
  const year = s.year;
  const r = rulesFor(year);
  const len = lengths(year);
  const needs = { semipo: toWin(len.semipo), po: toWin(len.po), ks: toWin(len.ks) };
  const table = standings(firstTeamIds(s), s.scores);
  const rank = (id: TeamId) => table.find((x) => x.teamId === id)?.rank ?? 99;
  const series = (round: SeriesResult['round'], a: TeamId, b: TeamId, on: string) => {
    const [high, low] = rank(a) <= rank(b) ? [a, b] : [b, a];
    return live(round, high, low, toWin(len[round]), homesOf(len[round]), on);
  };
  const base = { year, mode: 'one' as const, needs, done: false };
  switch (r.postseason) {
    case 'halves':
    case 'halvesBest':
    case 'halvesTickets': {
      const [first, second] = halfTables(s);
      // 1.9.7: our club first in both halves (a legacy achievement).
      if (s.user && first[0]?.teamId === s.user.teamId && second[0]?.teamId === s.user.teamId) unlock(s, 'halves', year, String(year));
      if (r.postseason !== 'halvesTickets') {
        const a = first[0]!.teamId,
          b = second[0]!.teamId;
        if (a === b) {
          // 1.9.8: 1982–1984, both halves to one club: the Korean Series against the best of the rest on the whole
          // season (game assumption, RULES.md §14). 1985: the champion without one (삼성).
          const rest = table.find((x) => x.teamId !== a)?.teamId;
          if (r.postseason === 'halves' && rest) return { ...base, style: 'halves', stage: 1, live: [series('ks', a, rest, date)], seeds: [a, rest] };
          s.postseason.push({ round: 'ks', high: a, low: a, highWins: 0, lowWins: 0, winner: a, games: [] });
          return { ...base, style: 'halves', stage: 1, live: [], seeds: [a], done: true };
        }
        // 1.9.8: 1985, the best on the whole season goes straight to the final: when it won neither half, the two half
        // winners play off for the other place.
        const best = table[0]!.teamId;
        if (r.postseason === 'halvesBest' && best !== a && best !== b) return { ...base, style: 'halves', stage: 0, live: [series('po', a, b, date)], seeds: [best] };
        return { ...base, style: 'halves', stage: 1, live: [series('ks', a, b, date)], seeds: [a, b] };
      }
      const tickets = [first[0]!, first[1]!, second[0]!, second[1]!].map((x) => x.teamId);
      const count = (id: TeamId) => tickets.filter((x) => x === id).length;
      const clubs = [...new Set(tickets)];
      const direct = clubs.filter((id) => count(id) >= 2);
      if (direct.length >= 2) return { ...base, style: 'halves', stage: 1, live: [series('ks', direct[0]!, direct[1]!, date)], seeds: direct };
      if (direct.length === 1) {
        const rest = clubs.filter((id) => id !== direct[0]);
        return { ...base, style: 'halves', stage: 0, live: [series('po', rest[0]!, rest[1]!, date)], seeds: direct };
      }
      return { ...base, style: 'halves', stage: 0, live: [series('po', tickets[0]!, tickets[3]!, date), series('po', tickets[2]!, tickets[1]!, date)], seeds: [] };
    }
    case 'four':
    case 'fourWithin3': {
      let seeds = table.slice(0, 4).map((x) => x.teamId);
      const [third, fourth] = [table[2], table[3]];
      if (r.postseason === 'fourWithin3' && third && fourth && (third.w - fourth.w + (fourth.l - third.l)) / 2 > 3) seeds = seeds.slice(0, 3);
      const rounds = ladderRounds(seeds.length);
      const k = seeds.length;
      return { ...base, style: 'ladder', stage: 0, live: [series(rounds[0]!, seeds[k - 2]!, seeds[k - 1]!, date)], seeds };
    }
    case 'twoLeagues':
    default: {
      const sides = sidesOf(s)!;
      const t = leagueTables(table, sides);
      const [d, m] = [t.dream, t.magic];
      const seeds = [d[0]!, d[1]!, d[2]!, m[0]!, m[1]!, m[2]!].map((x) => x.teamId);
      const semis: LiveSeries[] = [];
      if (d[2] && m[1] && d[2].pct > m[1].pct) semis.push(live('semipo', d[2].teamId, m[1].teamId, needs.semipo, homesOf(len.semipo), date));
      if (m[2] && d[1] && m[2].pct > d[1].pct) semis.push(live('semipo', m[2].teamId, d[1].teamId, needs.semipo, homesOf(len.semipo), date));
      const two = { year, mode: 'two' as const, needs: { ...needs, po: 4 }, done: false, seeds };
      if (semis.length) return { ...two, stage: 0, live: semis };
      // No semi-playoff: straight to the two playoffs (each league's winner against the other league's 2nd).
      return { ...two, stage: 1, live: [live('po', seeds[0]!, seeds[4]!, 4, homesOf(7), date), live('po', seeds[3]!, seeds[1]!, 4, homesOf(7), date)] };
    }
  }
}

/** 1.9.7: who goes on to the postseason this year, for the standings page (null: the page's own note). */
export function postseasonNote(year: number): string | null {
  switch (rulesFor(year).postseason) {
    case 'halvesBest':
      return __i18n_k("league.historic.text.dbe29b06");
    case 'halves':
      return __i18n_k("league.historic.text.7f40b938");
    case 'halvesTickets':
      return __i18n_k("league.historic.text.0d17b1f6");
    case 'four':
      return __i18n_k("league.historic.text.c2b723cf");
    case 'fourWithin3':
      return __i18n_k("league.historic.text.ddca07d3");
    default:
      return null;
  }
}

const ladderRounds = (k: number): SeriesResult['round'][] => (k >= 4 ? ['semipo', 'po', 'ks'] : k === 3 ? ['po', 'ks'] : ['ks']);

/** The next round of a historic bracket once a round is over, or null when the final is done. */
export function historicNext(s: LeagueState, b: Bracket, ended: LiveSeries[], end: string): LiveSeries[] | null {
  const len = lengths(b.year);
  const table = standings(firstTeamIds(s), s.scores);
  const rank = (id: TeamId) => table.find((x) => x.teamId === id)?.rank ?? 99;
  if (b.style === 'halves') {
    if (b.stage >= 1) return null;
    const [x, y] = [...b.seeds, ...ended.map((z) => result(z).winner)] as [TeamId, TeamId];
    const [high, low] = rank(x) <= rank(y) ? [x, y] : [y, x];
    return [live('ks', high, low, toWin(len.ks), homesOf(len.ks), addDays(end, 2))];
  }
  const k = b.seeds.length;
  const rounds = ladderRounds(k);
  if (b.stage >= rounds.length - 1) return null;
  const next = rounds[b.stage + 1]!;
  return [live(next, b.seeds[k - 3 - b.stage]!, result(ended[0]!).winner, toWin(len[next]), homesOf(len[next]), addDays(end, next === 'ks' ? 2 : 1))];
}
