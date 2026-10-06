/* KBO postseason (RULES.md §1): wild card (4th vs 5th, 4th starts one win up and advances on a tie),
   semi-playoff (3rd, best of five), playoff (2nd, best of five), Korean Series (1st, best of seven).
   Postseason games play until decided (game assumption; stats stay out of season totals).

   1.3.0: the postseason goes game day by game day (startPostseason, postseasonDay, postseasonRound) so the user can
   watch each game and choose our starter and an all-out plan before it (manager.ts); playPostseason plays it all
   through, with the same results as before. */
import type { TeamId } from '../model/types';
import { playGame, currentStandings } from './season';
import type { LeagueState, SeriesResult } from './state';
import { leaguePrice } from './fans';
import { FANS } from './tuning';
import { compactBox, isUserGame, keepBox } from './boxscore';
import { gameMoments } from './milestones';
import { addNews, gameNews } from './news';
import { eunneun, iga, wagwa } from './josa';
import type { PlayEvent } from './engine/types';
import { leagueTables, twoLeagues } from './twelve';

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** A series being played (1.3.0: the postseason goes game day by game day, so the user can watch and decide). */
export interface LiveSeries {
  round: SeriesResult['round'];
  high: TeamId;
  low: TeamId;
  need: number;
  /** Whether the higher seed is at home, game by game. */
  homes: boolean[];
  /** The next game's date and number (0-based), and the wins so far. */
  date: string;
  i: number;
  hw: number;
  lw: number;
  games: SeriesResult['games'];
}

/** The bracket: the series of the round being played, and how the next round is drawn. */
export interface Bracket {
  year: number;
  mode: 'one' | 'two';
  stage: number;
  live: LiveSeries[];
  /** Single league: the five seeds; two leagues: the league tables' top three each. */
  seeds: TeamId[];
  done: boolean;
}

const five = [true, true, false, false, true];
const seven = [true, true, false, false, false, true, true];
const three = [true, true, false];

const live = (round: SeriesResult['round'], high: TeamId, low: TeamId, need: number, homes: boolean[], date: string, headStart = 0): LiveSeries => ({ round, high, low, need, homes, date, i: 0, hw: headStart, lw: 0, games: [] });
const over = (x: LiveSeries) => x.hw >= x.need || x.lw >= x.need || x.i >= x.homes.length + 3;
const result = (x: LiveSeries): SeriesResult => ({ round: x.round, high: x.high, low: x.low, highWins: x.hw, lowWins: x.lw, winner: x.hw >= x.need ? x.high : x.low, games: x.games });

/** One game of a series on its date. */
function playSeriesGame(s: LeagueState, x: LiveSeries) {
  const i = x.i;
  const highHome = x.homes[Math.min(i, x.homes.length - 1)]!;
  const [home, away] = highHome ? [x.high, x.low] : [x.low, x.high];
  const id = `${s.year}-${x.round}-${i + 1}`;
  const date = x.date;
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
    x.games.push({ id, date, home, away, hs: out.home.runs, as: out.away.runs, att });
    const box = compactBox(out, id, date, att);
    keepBox(s, box, log);
    if (log) {
      gameMoments(s, box);
      gameNews(s, box, log);
    }
    const highRuns = highHome ? out.home.runs : out.away.runs,
      lowRuns = highHome ? out.away.runs : out.home.runs;
    if (highRuns > lowRuns) x.hw++;
    else if (lowRuns > highRuns) x.lw++;
    else if (x.round === 'wildcard') x.hw = x.need; // a tie sends the 4th seed through
  }
  x.date = addDays(date, i === 1 || i === 4 ? 2 : 1); // travel days after games 2 and 5
  x.i++;
  // Our postseason plan was for that game.
  if (s.user?.postPlan && (home === s.user.teamId || away === s.user.teamId)) delete s.user.postPlan.starter;
}

/** The next round's series once a round is over, or null when the Korean Series is done. */
function nextRound(s: LeagueState, b: Bracket, ended: LiveSeries[]): LiveSeries[] | null {
  const end = ended.reduce((m, x) => (x.date > m ? x.date : m), '');
  if (b.mode === 'one') {
    const winner = result(ended[0]!).winner;
    const [first, second, third] = b.seeds;
    if (b.stage === 0) return [live('semipo', third!, winner, 3, five, addDays(end, 1))];
    if (b.stage === 1) return [live('po', second!, winner, 3, five, addDays(end, 1))];
    if (b.stage === 2) return [live('ks', first!, winner, 4, seven, addDays(end, 2))];
    return null;
  }
  // Two leagues: the spots against each league's winner, then the two playoffs, then the Korean Series.
  const [d1, d2, d3, m1, m2, m3] = b.seeds;
  if (b.stage === 0) {
    const won = (low: TeamId, high: TeamId) => ended.find((x) => x.high === high && x.low === low);
    const vsDream = won(m2!, d3!) ? result(won(m2!, d3!)!).winner : m2!;
    const vsMagic = won(d2!, m3!) ? result(won(d2!, m3!)!).winner : d2!;
    const start = ended.length ? addDays(end, 1) : b.live.length ? b.live[0]!.date : '';
    return [live('po', d1!, vsDream, 4, seven, start), live('po', m1!, vsMagic, 4, seven, start)];
  }
  if (b.stage === 1) {
    const pct = (id: TeamId) => currentStandings(s).find((r) => r.teamId === id)!.pct;
    const [x, y] = ended.map((z) => result(z).winner) as [TeamId, TeamId];
    const [high, low] = pct(x) >= pct(y) ? [x, y] : [y, x];
    return [live('ks', high, low, 4, seven, addDays(end, 2))];
  }
  return null;
}

/** Draws the bracket at the end of the regular season (no game played yet). */
export function startPostseason(s: LeagueState) {
  if (s.bracket?.year === s.year) return;
  s.phase = 'postseason';
  const last = s.schedule[s.schedule.length - 1]?.date ?? `${s.year}-10-01`;
  const date = addDays(last, 3);
  if (twoLeagues(s)) {
    const t = leagueTables(currentStandings(s), s.twelve!.leagues!);
    const [d, m] = [t.dream, t.magic];
    if (d.length < 3 || m.length < 3) return void (s.bracket = { year: s.year, mode: 'two', stage: 2, live: [], seeds: [], done: true });
    const seeds = [d[0]!, d[1]!, d[2]!, m[0]!, m[1]!, m[2]!].map((r) => r.teamId);
    // A league's third with a better record than the other league's runner-up plays it first, best of three.
    const first: LiveSeries[] = [];
    if (d[2]!.pct > m[1]!.pct) first.push(live('semipo', d[2]!.teamId, m[1]!.teamId, 2, three, date));
    if (m[2]!.pct > d[1]!.pct) first.push(live('semipo', m[2]!.teamId, d[1]!.teamId, 2, three, date));
    const b: Bracket = { year: s.year, mode: 'two', stage: 0, live: first, seeds, done: false };
    s.bracket = b;
    if (!first.length) {
      // Nobody plays for the spots: straight to the two playoffs, on the first date.
      b.live = [live('po', seeds[0]!, seeds[4]!, 4, seven, date), live('po', seeds[3]!, seeds[1]!, 4, seven, date)];
      b.stage = 1;
    }
    return;
  }
  const seeds = currentStandings(s)
    .slice(0, 5)
    .map((r) => r.teamId);
  if (seeds.length < 5) return void (s.bracket = { year: s.year, mode: 'one', stage: 3, live: [], seeds, done: true });
  s.bracket = { year: s.year, mode: 'one', stage: 0, live: [live('wildcard', seeds[3]!, seeds[4]!, 2, [true, true], date, 1)], seeds, done: false };
}

/** Plays the postseason's next game day (every series with a game that day). Returns false when it is over. */
export function postseasonDay(s: LeagueState): boolean {
  const b = s.bracket;
  if (!b || b.done) return false;
  const playing = b.live.filter((x) => !over(x));
  if (playing.length) {
    const date = playing.reduce((m, x) => (x.date < m ? x.date : m), playing[0]!.date);
    for (const x of playing) if (x.date === date) playSeriesGame(s, x);
  }
  if (b.live.every(over)) {
    s.postseason.push(...b.live.map(result));
    seriesNews(s, b.live);
    const next = nextRound(s, b, b.live);
    if (next) {
      b.stage++;
      b.live = next;
    } else b.done = true;
  }
  return !b.done;
}

/** To the end of the round being played. */
export function postseasonRound(s: LeagueState) {
  const b = s.bracket;
  if (!b) return;
  const stage = b.stage;
  while (!b.done && b.stage === stage && postseasonDay(s));
}

/** The whole postseason (or what is left of it). */
export function playPostseason(s: LeagueState) {
  startPostseason(s);
  while (postseasonDay(s));
}

const ROUND_NAME: Record<SeriesResult['round'], string> = { wildcard: '와일드카드 결정전', semipo: '준플레이오프', po: '플레이오프', ks: '한국시리즈' };

/** Our club's series, won or lost: an article and an alert. */
function seriesNews(s: LeagueState, ended: LiveSeries[]) {
  const u = s.user;
  if (!u) return;
  for (const x of ended) {
    if (x.high !== u.teamId && x.low !== u.teamId) continue;
    const r = result(x);
    const won = r.winner === u.teamId;
    const me = s.teams.find((t) => t.id === u.teamId)!.short;
    const opp = s.teams.find((t) => t.id === (x.high === u.teamId ? x.low : x.high))!.short;
    const [mine, theirs] = x.high === u.teamId ? [x.hw, x.lw] : [x.lw, x.hw];
    const date = x.games.at(-1)?.date ?? x.date;
    const title = won ? (x.round === 'ks' ? `${me}, 한국시리즈 우승!` : `${me}, ${opp} 꺾고 ${ROUND_NAME[x.round]} 통과`) : `${me}, ${ROUND_NAME[x.round]}에서 ${opp}에 패해 탈락`;
    addNews(s, {
      id: `series-${s.year}-${x.round}-${u.teamId}`,
      date,
      kind: 'game',
      title,
      body: `${won ? iga(me) : eunneun(me)} ${ROUND_NAME[x.round]}에서 ${wagwa(opp)} 맞붙어 ${mine}승 ${theirs}패로 ${won ? (x.round === 'ks' ? '정상에 올랐다.' : '다음 무대로 간다.') : '시즌을 마쳤다.'}`,
      quotes: [],
      facts: { round: ROUND_NAME[x.round], club: me, opponent: opp, wins: mine, losses: theirs },
      players: [],
      mine: true,
    });
  }
}
export const champion = (s: LeagueState): TeamId | null => s.postseason.find((x) => x.round === 'ks')?.winner ?? null;

// ── For the screen ───────────────────────────────────────────────────────────────────────────────

export const ROUND_LABEL = ROUND_NAME;

/** The series being played now, and our club's next game with the arms it could start. */
export function postseasonView(s: LeagueState) {
  const b = s.bracket?.year === s.year && !s.bracket.done ? s.bracket : null;
  const live = (b?.live ?? []).map((x) => ({ ...x, over: over(x) }));
  const u = s.user;
  const ours = u ? live.find((x) => !x.over && (x.high === u.teamId || x.low === u.teamId)) : undefined;
  let next: { date: string; opponent: TeamId; home: boolean; game: number; wins: number; losses: number; arms: { id: string; name: string; rest: number; role: string }[] } | null = null;
  if (ours && u) {
    const highHome = ours.homes[Math.min(ours.i, ours.homes.length - 1)]!;
    const home = (ours.high === u.teamId) === highHome;
    const days = (id: string) => (s.arms[id] ? Math.round((Date.parse(ours.date) - Date.parse(s.arms[id]!.lastDate)) / 86400000) : 99);
    const arms = s.rosters[u.teamId]!.active
      .map((id) => s.players[id]!)
      .filter((p) => (p.role === 'SP' || p.role === 'RP') && !s.injuries[p.id])
      .map((p) => ({ id: p.id, name: p.name, rest: days(p.id), role: p.role }))
      .sort((a, c) => Number(c.role === 'SP') - Number(a.role === 'SP') || c.rest - a.rest);
    next = {
      date: ours.date,
      opponent: ours.high === u.teamId ? ours.low : ours.high,
      home,
      game: ours.i + 1,
      wins: ours.high === u.teamId ? ours.hw : ours.lw,
      losses: ours.high === u.teamId ? ours.lw : ours.hw,
      arms,
    };
  }
  return { live, done: !b, next, plan: u?.postPlan ?? {} };
}
