/* KBO postseason (RULES.md §1): wild card (4th vs 5th, 4th starts one win up and advances on a tie),
   semi-playoff (3rd, best of five), playoff (2nd, best of five), Korean Series (1st, best of seven).
   Postseason games play until decided (game assumption; stats stay out of season totals). */
import type { TeamId } from '../model/types';
import { playGame, currentStandings } from './season';
import type { LeagueState, SeriesResult } from './state';
import { leaguePrice } from './fans';
import { FANS } from './tuning';
import { compactBox, isUserGame, keepBox } from './boxscore';
import { gameMoments } from './milestones';
import { gameNews } from './news';
import type { PlayEvent } from './engine/types';
import type { StandingRow } from './standings';
import { leagueTables, twoLeagues } from './twelve';

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

function series(s: LeagueState, round: SeriesResult['round'], high: TeamId, low: TeamId, need: number, homes: boolean[], start: string, headStart = 0): { result: SeriesResult; end: string } {
  let hw = headStart,
    lw = 0,
    date = start;
  const games: SeriesResult['games'] = [];
  for (let i = 0; hw < need && lw < need && i < homes.length + 3; i++) {
    const highHome = homes[Math.min(i, homes.length - 1)]!;
    const [home, away] = highHome ? [high, low] : [low, high];
    const id = `${s.year}-${round}-${i + 1}`;
    const log: PlayEvent[] | undefined = isUserGame(s, home, away) ? [] : undefined;
    const out = playGame(s, home, away, id, date, null, log);
    if (out) {
      for (const box of [out.home, out.away])
        for (const p of box.pitching) {
          const arm = s.arms[p.id];
          const streak = arm && Date.parse(date) - Date.parse(arm.lastDate) === 86400000 ? arm.streak + 1 : 1;
          s.arms[p.id] = { lastDate: date, lastPitches: p.pitches, streak };
        }
      // Postseason games sell out; the ticket money goes to the league's pool (RULES.md §13).
      const seats = s.teams.find((t) => t.id === home)!.stadium.capacity;
      const att = Math.round(seats * (0.97 + (i % 3) * 0.01));
      s.postseasonGate = (s.postseasonGate ?? 0) + Math.round(att * leaguePrice(s.year) * FANS.postseasonPrice);
      games.push({ id, date, home, away, hs: out.home.runs, as: out.away.runs, att });
      const box = compactBox(out, id, date, att);
      keepBox(s, box, log);
      if (log) {
        gameMoments(s, box);
        gameNews(s, box, log);
      }
      const highRuns = highHome ? out.home.runs : out.away.runs,
        lowRuns = highHome ? out.away.runs : out.home.runs;
      if (highRuns > lowRuns) hw++;
      else if (lowRuns > highRuns) lw++;
      else if (round === 'wildcard') hw = need; // a tie sends the 4th seed through
    }
    date = addDays(date, i === 1 || i === 4 ? 2 : 1); // travel days after games 2 and 5
  }
  return { result: { round, high, low, highWins: hw, lowWins: lw, winner: hw >= need ? high : low, games }, end: date };
}

/**
 * Two leagues (V0.9, the 1999–2000 드림·매직리그): each league's winner meets the other league's runner-up, best of
 * seven. A league's third place with a better record than the other league's runner-up first plays it for that
 * spot, best of three (2000: 삼성, 드림 3위, over 롯데, 매직 2위), and the winner meets its own league's winner. The
 * two playoff winners play the Korean Series, the better record at home.
 */
function playTwoLeagues(s: LeagueState) {
  const t = leagueTables(currentStandings(s), s.twelve!.leagues!);
  const [d, m] = [t.dream, t.magic];
  if (d.length < 3 || m.length < 3) return;
  const last = s.schedule[s.schedule.length - 1]?.date ?? `${s.year}-10-01`;
  const start = addDays(last, 3);
  const three = [true, true, false];
  const seven = [true, true, false, false, false, true, true];
  const pct = (id: TeamId) => [...d, ...m].find((r) => r.teamId === id)!.pct;
  // The spot against a league's winner: the other league's runner-up, unless this league's third beat its record.
  let end = start;
  const spot = (second: StandingRow, third: StandingRow): TeamId => {
    if (third.pct <= second.pct) return second.teamId;
    const x = series(s, 'semipo', third.teamId, second.teamId, 2, three, start);
    s.postseason.push(x.result);
    if (x.end > end) end = x.end;
    return x.result.winner;
  };
  const vsDream = spot(m[1]!, d[2]!);
  const vsMagic = spot(d[1]!, m[2]!);
  const poStart = end === start ? start : addDays(end, 1);
  const a = series(s, 'po', d[0]!.teamId, vsDream, 4, seven, poStart);
  const b = series(s, 'po', m[0]!.teamId, vsMagic, 4, seven, poStart);
  s.postseason.push(a.result, b.result);
  const [x, y] = [a.result.winner, b.result.winner];
  const [high, low] = pct(x) >= pct(y) ? [x, y] : [y, x];
  const ks = series(s, 'ks', high, low, 4, seven, addDays(a.end > b.end ? a.end : b.end, 2));
  s.postseason.push(ks.result);
}

export function playPostseason(s: LeagueState) {
  s.phase = 'postseason';
  if (twoLeagues(s)) return playTwoLeagues(s);
  const seeds = currentStandings(s)
    .slice(0, 5)
    .map((r) => r.teamId);
  if (seeds.length < 5) return;
  const last = s.schedule[s.schedule.length - 1]?.date ?? `${s.year}-10-01`;
  let date = addDays(last, 3);
  const five = [true, true, false, false, true];
  const seven = [true, true, false, false, false, true, true];
  const wc = series(s, 'wildcard', seeds[3]!, seeds[4]!, 2, [true, true], date, 1);
  s.postseason.push(wc.result);
  const semi = series(s, 'semipo', seeds[2]!, wc.result.winner, 3, five, addDays(wc.end, 1));
  s.postseason.push(semi.result);
  const po = series(s, 'po', seeds[1]!, semi.result.winner, 3, five, addDays(semi.end, 1));
  s.postseason.push(po.result);
  date = addDays(po.end, 2);
  const ks = series(s, 'ks', seeds[0]!, po.result.winner, 4, seven, date);
  s.postseason.push(ks.result);
}

export const champion = (s: LeagueState): TeamId | null => s.postseason.find((x) => x.round === 'ks')?.winner ?? null;
