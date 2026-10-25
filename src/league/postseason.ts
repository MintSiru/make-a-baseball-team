import { k as __i18n_k } from '../i18n/index';
/* KBO postseason (RULES.md §1): wild card (4th vs 5th, 4th starts one win up and advances on a tie),
   semi-playoff (3rd, best of five), playoff (2nd, best of five), Korean Series (1st, best of seven).
   Postseason games play until decided (game assumption; stats stay out of season totals — since 1.4.0 they are kept
   as each player's postseason line).

   1.3.0: the postseason goes game day by game day (startPostseason, postseasonDay, postseasonRound) so the user can
   watch each game and choose our starter and an all-out plan before it (manager.ts); playPostseason plays it all
   through, with the same results as before. */
import type { PlayerId, TeamId } from '../model/types';
import { playGame, currentStandings, record } from './season';
import { firstTeamIds, type LeagueState, type SeriesResult } from './state';
import { clubState, leaguePrice } from './fans';
import { POSTSEASON_GATE } from './tuning';
import { compactBox, isUserGame, keepBox } from './boxscore';
import { gameMoments } from './milestones';
import { addNews, gameNews } from './news';
import { addAlert } from './alerts';
import { eunneun, iga, wagwa } from './josa';
import type { PlayEvent, TeamBox } from './engine/types';
import { leagueTables, playoffsOf, sidesOf } from './twelve';
import { stopsOf } from './stops';
import { openEntries, postseasonUpkeep, restoreFirstTeams, settleOurEntry } from './postentry';
import { drawHistoric, historicNext } from './historic';
import { rulesFor } from '../rules/history';
import { boardValue } from './era';

export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

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
  /** 2.0.41: each player's part in the series so far (seriesMvp), by club. */
  parts?: Record<TeamId, Record<PlayerId, number>>;
  /** 2.0.41: each player's series line (for the MVP's article). */
  lines?: Record<PlayerId, { ab: number; h: number; hr: number; rbi: number; outs: number; er: number; k: number; w: number; sv: number }>;
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
  /** 1.8.0: two leagues the NPB way (클라이맥스 시리즈): each league's 2nd v 3rd, then its winner with a win in hand.
      1.8.1, 'cross' (the two-league default since): each league's top three, a wild card for a league's 4th with a
      better record than the other league's 3rd, then cross-league semi-playoffs and playoffs (seeds 6 and 7 are the
      two 4ths). A two-league bracket with no style is the 1999–2000 rule it replaced, kept for a postseason under way. */
  style?: 'npb' | 'cross' | 'ladder' | 'halves';
  /** 1.9.5 (a league that plays history): wins needed in each round, when they are not today's. */
  needs?: Partial<Record<SeriesResult['round'], number>>;
}

const five = [true, true, false, false, true];
const seven = [true, true, false, false, false, true, true];
const three = [true, true, false];
/** 1.8.0, NPB: every game of a Climax Series stage at the higher seed's park. */
const allHome = (n: number) => Array<boolean>(n).fill(true);

export const live = (round: SeriesResult['round'], high: TeamId, low: TeamId, need: number, homes: boolean[], date: string, headStart = 0): LiveSeries => ({ round, high, low, need, homes, date, i: 0, hw: headStart, lw: 0, games: [] });
const over = (x: LiveSeries) => x.hw >= x.need || x.lw >= x.need || x.i >= x.homes.length + 3;
export function result(x: LiveSeries): SeriesResult {
  const winner = x.hw >= x.need ? x.high : x.low;
  const mvp = seriesMvp(x, winner);
  return { round: x.round, high: x.high, low: x.low, highWins: x.hw, lowWins: x.lw, winner, games: x.games, ...(mvp ? { mvp } : {}) };
}

/** 2.0.41 (the user's request: 한국시리즈 MVP, and the wild card's, the semi-playoff's and the playoff's): a player's
    part in a game — a hitter's hits, extra bases, runs driven in and scored, walks and steals; a pitcher's innings,
    strikeouts, wins and saves, less the runs and runners he gave up. */
export const MVP_WEIGHTS = {
  bat: { h: 1, d: 0.5, t: 1, hr: 1.5, rbi: 0.8, r: 0.5, bb: 0.4, sb: 0.3, k: -0.1 },
  pit: { inning: 0.6, k: 0.15, er: -0.8, baserunner: -0.15, w: 1.5, sv: 1.2, hld: 0.5 },
};
function addParts(x: LiveSeries, box: TeamBox) {
  const B = MVP_WEIGHTS.bat,
    P = MVP_WEIGHTS.pit;
  const team = ((x.parts ??= {})[box.teamId] ??= {});
  const line = (id: PlayerId) => ((x.lines ??= {})[id] ??= { ab: 0, h: 0, hr: 0, rbi: 0, outs: 0, er: 0, k: 0, w: 0, sv: 0 });
  for (const b of box.batting) {
    team[b.id] = (team[b.id] ?? 0) + b.h * B.h + b.d * B.d + b.t * B.t + b.hr * B.hr + b.rbi * B.rbi + b.r * B.r + (b.bb + b.hbp) * B.bb + b.sb * B.sb + b.k * B.k;
    const l = line(b.id);
    l.ab += b.ab;
    l.h += b.h;
    l.hr += b.hr;
    l.rbi += b.rbi;
  }
  for (const p of box.pitching) {
    team[p.id] = (team[p.id] ?? 0) + (p.outs / 3) * P.inning + p.k * P.k + p.er * P.er + (p.h + p.bb + p.hbp) * P.baserunner + p.w * P.w + p.sv * P.sv + p.hld * P.hld;
    const l = line(p.id);
    l.outs += p.outs;
    l.er += p.er;
    l.k += p.k;
    l.w += p.w;
    l.sv += p.sv;
  }
}
/** The winners' best part in the series (the first listed on a tie). */
function seriesMvp(x: LiveSeries, winner: TeamId): PlayerId | null {
  let best: PlayerId | null = null,
    top = -Infinity;
  for (const [id, v] of Object.entries(x.parts?.[winner] ?? {})) if (v > top) [best, top] = [id, v];
  return best;
}

/** 1.8.4: a postseason ticket at `home`'s park in `round` (만 원, on average): its regular price times the round's factor. */
export const postseasonTicket = (s: LeagueState, home: TeamId, round: SeriesResult['round']) => leaguePrice(s.year) * clubState(s, home).price * POSTSEASON_GATE.price[round];

/** One game of a series on its date. */
function playSeriesGame(s: LeagueState, x: LiveSeries) {
  const i = x.i;
  // 2.0.41 (the user's report: a first-place club opened the Korean Series with its 4th starter): a series starts its
  // clubs' rotations over from the top, the ace first if he is rested (starterFor takes the next rested one if not).
  if (i === 0) for (const t of [x.high, x.low]) s.rotation[t] = 0;
  const highHome = x.homes[Math.min(i, x.homes.length - 1)]!;
  const [home, away] = highHome ? [x.high, x.low] : [x.low, x.high];
  // 1.7.0: with two leagues, two series of a round run side by side; the higher seed tells their games apart (both
  // were `${year}-po-1`…, so one series' box scores replaced the other's).
  const id = s.bracket?.mode === 'two' && x.round !== 'ks' ? `${s.year}-${x.round}-${x.high}-${i + 1}` : `${s.year}-${x.round}-${i + 1}`;
  const date = x.date;
  const log: PlayEvent[] | undefined = isUserGame(s, home, away) ? [] : undefined;
  const out = playGame(s, home, away, id, date, null, log);
  if (out) {
    // 1.4.0: the players' postseason lines (and the arms' use, as before).
    s.postLines ??= {};
    record(s, out.home, date, s.postLines);
    record(s, out.away, date, s.postLines);
    // Postseason games sell out; the ticket money goes to the league's pool (RULES.md §13).
    const seats = s.teams.find((t) => t.id === home)!.stadium.capacity;
    const att = Math.round(seats * (0.97 + (i % 3) * 0.01));
    // 1.8.4: the home club's price raised for the round; the money is split game by game (finance.ts).
    const gate = Math.round(att * postseasonTicket(s, home, x.round));
    s.postseasonGate = (s.postseasonGate ?? 0) + gate;
    x.games.push({ id, date, home, away, hs: out.home.runs, as: out.away.runs, att, gate });
    addParts(x, out.home);
    addParts(x, out.away);
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
    else if (x.round === 'wildcard' && s.bracket?.mode !== 'two') x.hw = x.need; // a tie sends the 4th seed through
  }
  x.date = addDays(date, i === 1 || i === 4 ? 2 : 1); // travel days after games 2 and 5
  x.i++;
  // Our postseason plan was for that game.
  if (s.user?.postPlan && (home === s.user.teamId || away === s.user.teamId)) delete s.user.postPlan.starter;
}

/** The next round's series once a round is over, or null when the Korean Series is done. */
function nextRound(s: LeagueState, b: Bracket, ended: LiveSeries[]): LiveSeries[] | null {
  const end = ended.reduce((m, x) => (x.date > m ? x.date : m), '');
  // 1.9.5, a league that plays history (historic.ts): the ladder of the top four (or three), and the split season's.
  if (b.style === 'ladder' || b.style === 'halves') return historicNext(s, b, ended, end);
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
  // 1.8.0, NPB: each league's final stage (its winner a win up, best of six at home), then the final.
  if (b.style === 'npb') {
    if (b.stage === 0) {
      const w = (high: TeamId) => result(ended.find((x) => x.high === high)!).winner;
      const start = addDays(end, 1);
      return [live('po', d1!, w(d2!), 4, allHome(6), start, 1), live('po', m1!, w(m2!), 4, allHome(6), start, 1)];
    }
    if (b.stage === 1) {
      const pct = (id: TeamId) => currentStandings(s).find((r) => r.teamId === id)!.pct;
      const [x, y] = ended.map((z) => result(z).winner) as [TeamId, TeamId];
      const [high, low] = pct(x) >= pct(y) ? [x, y] : [y, x];
      return [live('ks', high, low, 4, seven, addDays(end, 2))];
    }
    return null;
  }
  // 1.8.1, cross: the wild cards, the cross-league semi-playoffs (each 2nd v the other league's 3rd, or the wild card
  // that took its place), the playoffs (each league winner v the other league's 2nd side), then the final.
  if (b.style === 'cross') {
    const start = ended.length ? addDays(end, 1) : b.live[0]?.date ?? '';
    if (b.stage === 0) {
      // A wild card series is the 4th (high, the better record) against the other league's 3rd.
      const third = (id: TeamId) => {
        const wc = ended.find((x) => x.round === 'wildcard' && x.low === id);
        return wc ? result(wc).winner : id;
      };
      return [live('semipo', d2!, third(m3!), 3, five, start), live('semipo', m2!, third(d3!), 3, five, start)];
    }
    if (b.stage === 1) {
      const w = (high: TeamId) => result(ended.find((x) => x.high === high)!).winner;
      return [live('po', d1!, w(m2!), 3, five, start), live('po', m1!, w(d2!), 3, five, start)];
    }
    if (b.stage === 2) {
      const pct = (id: TeamId) => currentStandings(s).find((r) => r.teamId === id)!.pct;
      const [x, y] = ended.map((z) => result(z).winner) as [TeamId, TeamId];
      const [high, low] = pct(x) >= pct(y) ? [x, y] : [y, x];
      return [live('ks', high, low, 4, seven, addDays(end, 2))];
    }
    return null;
  }
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

/** Draws the bracket at the end of the regular season (no game played yet). 1.9.0: the clubs of the first round hand
    in their entries (ours through a decision with `stops`). */
export function startPostseason(s: LeagueState, stops = false) {
  if (s.bracket?.year === s.year) return;
  drawBracket(s);
  if (s.bracket && !s.bracket.done) openEntries(s, s.bracket.live, stops);
}

function drawBracket(s: LeagueState) {
  s.phase = 'postseason';
  const last = s.schedule[s.schedule.length - 1]?.date ?? `${s.year}-10-01`;
  const date = addDays(last, 3);
  // 1.9.5: a league that plays history draws its year's postseason (historic.ts); 2015 on, today's.
  // 1.9.9: a board's four-club postseason is drawn the same way.
  if ((s.historical || boardValue('postseason', s.year) !== undefined) && rulesFor(s.year).postseason !== 'five') return void (s.bracket = drawHistoric(s, date));
  const sides = sidesOf(s);
  if (sides) {
    const t = leagueTables(currentStandings(s), sides);
    const [d, m] = [t.dream, t.magic];
    if (d.length < 3 || m.length < 3) return void (s.bracket = { year: s.year, mode: 'two', stage: 2, live: [], seeds: [], done: true });
    const seeds = [d[0]!, d[1]!, d[2]!, m[0]!, m[1]!, m[2]!].map((r) => r.teamId);
    // 1.8.0, NPB (클라이맥스 시리즈): each league's 2nd and 3rd, best of three, every game at the 2nd's park.
    if (playoffsOf(s) === 'npb') {
      s.bracket = { year: s.year, mode: 'two', style: 'npb', stage: 0, seeds, done: false, live: [live('semipo', seeds[1]!, seeds[2]!, 2, allHome(3), date), live('semipo', seeds[4]!, seeds[5]!, 2, allHome(3), date)] };
      return;
    }
    // 1.8.1 (the 1.8 feedback): each league's top three; a league's 4th with a better record than the other league's
    // 3rd plays it for the place first, best of three (two games at the 4th's park).
    const fourth = [d[3], m[3]];
    const wild: LiveSeries[] = [];
    if (d[3] && d[3].pct > m[2]!.pct) wild.push(live('wildcard', d[3].teamId, m[2]!.teamId, 2, three, date));
    if (m[3] && m[3].pct > d[2]!.pct) wild.push(live('wildcard', m[3].teamId, d[2]!.teamId, 2, three, date));
    const b: Bracket = { year: s.year, mode: 'two', style: 'cross', stage: 0, live: wild, seeds: [...seeds, ...fourth.map((r) => r?.teamId ?? '')], done: false };
    s.bracket = b;
    if (!wild.length) {
      // No wild card: straight to the semi-playoffs on the first date.
      b.live = nextRound(s, b, [])!;
      for (const x of b.live) x.date = date;
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

/** Plays the postseason's next game day (every series with a game that day). Returns false when it is over.
    1.9.0: nothing is played while our entry is still to be handed in; with `stops` the next round's entry is ours to
    choose. */
export function postseasonDay(s: LeagueState, stops = false): boolean {
  const b = s.bracket;
  if (!b || b.done) return false;
  if (s.pending) return true;
  const playing = b.live.filter((x) => !over(x));
  if (playing.length) {
    const date = playing.reduce((m, x) => (x.date < m ? x.date : m), playing[0]!.date);
    // 2.0.47: the day's returns (an injury healed, a stay in the futures over) before its games.
    postseasonUpkeep(s, date);
    for (const x of playing) if (x.date === date) playSeriesGame(s, x);
  }
  if (b.live.every(over)) {
    s.postseason.push(...b.live.map(result));
    seriesNews(s, b.live);
    const next = nextRound(s, b, b.live);
    if (next) {
      b.stage++;
      b.live = next;
      openEntries(s, next, stops);
    } else {
      b.done = true;
      restoreFirstTeams(s);
    }
  }
  return !b.done;
}

/** 1.7.1: our series' game on the next postseason day, or null (not ours, or we are out). */
export function ourNextGame(s: LeagueState): { round: LiveSeries['round']; game: number; opp: TeamId; home: boolean } | null {
  const u = s.user;
  const b = s.bracket;
  if (!u || !b || b.done) return null;
  const playing = b.live.filter((x) => !over(x));
  if (!playing.length) return null;
  const date = playing.reduce((m, x) => (x.date < m ? x.date : m), playing[0]!.date);
  const x = playing.find((y) => y.date === date && (y.high === u.teamId || y.low === u.teamId));
  if (!x) return null;
  const highHome = x.homes[Math.min(x.i, x.homes.length - 1)]!;
  return { round: x.round, game: x.i + 1, opp: x.high === u.teamId ? x.low : x.high, home: highHome === (x.high === u.teamId) };
}

/** 1.7.1: our latest game's box score (the one just played, to watch it). */
export function lastOurGame(s: LeagueState): string | null {
  const me = s.user?.teamId;
  if (!me) return null;
  let best: { id: string; date: string } | null = null;
  for (const [id, b] of Object.entries(s.boxes ?? {})) if ((b.home === me || b.away === me) && (!best || b.date >= best.date)) best = { id, date: b.date };
  return best?.id ?? null;
}

/** 1.7.1: a run of postseason days stops before our game (the 'bigGame' stop), so it can be watched live or skipped. */
const stopsBefore = (s: LeagueState, stops: boolean) => stops && stopsOf(s).includes('bigGame') && !!ourNextGame(s);

/** To the end of the round being played (with `stops`, only up to our next game). */
export function postseasonRound(s: LeagueState, stops = false) {
  const b = s.bracket;
  if (!b) return;
  const stage = b.stage;
  while (!b.done && b.stage === stage && !s.pending && !stopsBefore(s, stops) && postseasonDay(s, stops));
}

/** The whole postseason, or what is left of it (with `stops`, only up to our next game). */
export function playPostseason(s: LeagueState, stops = false) {
  startPostseason(s, stops);
  // Played through: an entry of ours still open stands as the scouts suggested it.
  if (!stops) settleOurEntry(s);
  while (!s.pending && !stopsBefore(s, stops) && postseasonDay(s, stops));
}

export const ROUND_NAME: Record<SeriesResult['round'], string> = { wildcard: __i18n_k("league.postseason.rOUND_NAME.wildcard.82702aa7"), semipo: __i18n_k("league.postseason.rOUND_NAME.semipo.42e1bde5"), po: __i18n_k("league.postseason.rOUND_NAME.po.4651993c"), ks: __i18n_k("league.postseason.rOUND_NAME.ks.3c8e7785") };

/** Our club's series, won or lost: an article and an alert. */
function seriesNews(s: LeagueState, ended: LiveSeries[]) {
  // 2.0.41: each series' MVP in the news (ours a pop-up too).
  for (const x of ended) mvpNews(s, x);
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
    const title = won ? (x.round === 'ks' ? __i18n_k("league.postseason.seriesNews.title.b6fdb4de", { me: me }) : __i18n_k("league.postseason.seriesNews.title.139f69be", { me: me, opp: opp, value: roundName(s, x.round) })) : __i18n_k("league.postseason.seriesNews.title.0fa2ef1e", { me: me, value: roundName(s, x.round), opp: opp });
    addNews(s, {
      id: `series-${s.year}-${x.round}-${u.teamId}`,
      date,
      kind: 'game',
      title,
      body: __i18n_k("league.postseason.seriesNews.body.25f549e9", { value: won ? iga(me) : eunneun(me), value2: roundName(s, x.round), opp: wagwa(opp), mine: mine, theirs: theirs, value3: won ? (x.round === 'ks' ? __i18n_k("league.postseason.seriesNews.body.43c2d684") : __i18n_k("league.postseason.seriesNews.body.c371e40b")) : __i18n_k("league.postseason.seriesNews.body.797dcb00") }),
      quotes: [],
      facts: { round: roundName(s, x.round), club: me, opponent: opp, wins: mine, losses: theirs },
      players: [],
      mine: true,
    });
  }
}
/** 2.0.41: a series' MVP: an article, and for one of ours a pop-up. */
function mvpNews(s: LeagueState, x: LiveSeries) {
  const r = result(x);
  const p = r.mvp ? s.players[r.mvp] : undefined;
  if (!p) return;
  const club = s.teams.find((t) => t.id === r.winner)?.short ?? '';
  const round = roundName(s, x.round);
  const line = seriesLine(x, p.id);
  const title = __i18n_k("league.postseason.text.0034f194", { round, name: p.name, club });
  const body = __i18n_k("league.postseason.text.5f6ff67d", { round, club, name: iga(p.name), line });
  const date = x.games.at(-1)?.date ?? x.date;
  const id = `series-mvp-${s.year}-${x.round}-${x.high}`;
  const ours = p.teamId === s.user?.teamId;
  addNews(s, { id, date, kind: 'game', title, body, quotes: [], facts: { round, player: p.name, club }, players: [p.id], ...(ours ? { mine: true } : {}) });
  if (ours) addAlert(s, { id, date, kind: 'award', title, lines: [body], tone: 'good', players: [p.id] });
}

/** His series in a line: a pitcher's innings, earned runs and strikeouts; a hitter's hits and home runs. */
function seriesLine(x: LiveSeries, id: PlayerId): string {
  const l = x.lines?.[id];
  if (!l) return '';
  if (l.outs >= 3 && l.ab === 0) return __i18n_k("league.postseason.text.121462b5", { ip: `${Math.floor(l.outs / 3)}${l.outs % 3 ? `.${l.outs % 3}` : ''}`, er: l.er, k: l.k, w: l.w, sv: l.sv });
  return __i18n_k("league.postseason.text.ee6e6eea", { ab: l.ab, h: l.h, hr: l.hr, rbi: l.rbi });
}

export const champion = (s: LeagueState): TeamId | null => s.postseason.find((x) => x.round === 'ks')?.winner ?? null;

// ── For the screen ───────────────────────────────────────────────────────────────────────────────

export const ROUND_LABEL = ROUND_NAME;
/** 1.8.0: the NPB-style rounds' names. */
export const NPB_ROUND_NAME: Record<SeriesResult['round'], string> = { wildcard: ROUND_NAME.wildcard, semipo: __i18n_k("league.postseason.text.8f08356a"), po: __i18n_k("league.postseason.text.d3013cf2"), ks: ROUND_NAME.ks };
/** A round's name in this postseason's format. */
export const roundName = (s: LeagueState, round: SeriesResult['round']) => (s.bracket?.year === s.year && s.bracket.style === 'npb' ? NPB_ROUND_NAME : ROUND_NAME)[round];

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

// ── The bracket at a glance (1.4.0) ──────────────────────────────────────────────────────────────

const ROUNDS: SeriesResult['round'][] = ['wildcard', 'semipo', 'po', 'ks'];

/** Wins a round's series needs in this postseason's format. */
function needOf(b: Bracket | null, round: SeriesResult['round']): number {
  const own = b?.needs?.[round];
  if (own) return own;
  if (round === 'ks') return 4;
  if (round === 'wildcard') return 2;
  if (b?.mode !== 'two' || b.style === 'cross') return 3;
  return round === 'po' ? 4 : 2;
}

export interface BracketSide {
  teamId: TeamId | null;
  /** "3위", "드림 1위", or who will fill it ("와일드카드 승자"). */
  label: string;
}

export interface BracketSeries {
  round: SeriesResult['round'];
  high: BracketSide;
  low: BracketSide;
  hw: number;
  lw: number;
  need: number;
  /** Each game from the higher seed's side: won, lost, tied, and the score that way round. */
  games: { id: string; date: string; mark: 'w' | 'l' | 't'; score: string }[];
  state: 'done' | 'live' | 'waiting';
  winner: TeamId | null;
  /** The next game's date and number while it is live. */
  next: { date: string; game: number } | null;
}

export interface BracketRound {
  round: SeriesResult['round'];
  label: string;
  state: 'done' | 'live' | 'waiting';
  series: BracketSeries[];
}

export interface BracketView {
  year: number;
  rounds: BracketRound[];
  champion: TeamId | null;
  /** Our club this postseason, in a phrase (null in a spectator league). */
  ours: string | null;
}

/** The whole postseason as a bracket: rounds played, the one being played, and the ones to come with who waits there. */
export function bracketView(s: LeagueState): BracketView | null {
  const b = s.bracket?.year === s.year ? s.bracket : null;
  if (!b && !s.postseason.length) return null;
  const done = s.postseason;
  const liveNow = b && !b.done ? b.live : [];
  const seedLabel = (id: TeamId | undefined, fallback: string): BracketSide => {
    if (!id || !b) return { teamId: id ?? null, label: fallback };
    const i = b.seeds.indexOf(id);
    if (i < 0) return { teamId: id, label: fallback };
    // Two leagues: seeds 0–2 dream, 3–5 magic; 1.8.1, cross: 6 and 7 the two 4ths.
    return { teamId: id, label: b.mode === 'one' ? __i18n_k("league.postseason.seedLabel.label.290bdca7", { value: i + 1 }) : __i18n_k("league.postseason.seedLabel.label.04d70338", { value: i < 3 || i === 6 ? __i18n_k("league.postseason.seedLabel.label.c2c3ed38") : __i18n_k("league.postseason.seedLabel.label.c01e9ae7"), value2: i >= 6 ? 4 : (i % 3) + 1 }) };
  };
  const marks = (high: TeamId, games: SeriesResult['games']) =>
    games.map((g) => {
      const [mine, theirs] = g.home === high ? [g.hs, g.as] : [g.as, g.hs];
      return { id: g.id, date: g.date, mark: (mine > theirs ? 'w' : mine < theirs ? 'l' : 't') as 'w' | 'l' | 't', score: `${mine}-${theirs}` };
    });
  const fromResult = (x: SeriesResult): BracketSeries => ({
    round: x.round,
    high: seedLabel(x.high, ''),
    low: seedLabel(x.low, ''),
    hw: x.highWins,
    lw: x.lowWins,
    need: needOf(b, x.round),
    games: marks(x.high, x.games),
    state: 'done',
    winner: x.winner,
    next: null,
  });
  const fromLive = (x: LiveSeries): BracketSeries =>
    over(x)
      ? fromResult(result(x))
      : { round: x.round, high: seedLabel(x.high, ''), low: seedLabel(x.low, ''), hw: x.hw, lw: x.lw, need: x.need, games: marks(x.high, x.games), state: 'live', winner: null, next: { date: x.date, game: x.i + 1 } };
  const waiting = (round: SeriesResult['round'], high: BracketSide, low: BracketSide, need: number): BracketSeries => ({ round, high, low, hw: 0, lw: 0, need, games: [], state: 'waiting', winner: null, next: null });
  const winnerOf = (round: SeriesResult['round'], test: (x: SeriesResult) => boolean = () => true) => done.find((x) => x.round === round && test(x))?.winner;
  const rounds: BracketRound[] = [];
  for (const round of ROUNDS) {
    const played = [...done.filter((x) => x.round === round).map(fromResult), ...liveNow.filter((x) => x.round === round).map(fromLive)];
    let series = played;
    // 1.9.5: a historic bracket shows the rounds as they are played (historic.ts).
    if (!series.length && b && b.style !== 'ladder' && b.style !== 'halves') {
      const [s0, s1, s2, s3, s4, s5] = b.seeds;
      if (b.mode === 'one') {
        if (round === 'wildcard') series = [waiting(round, seedLabel(s3, __i18n_k("league.postseason.bracketView.49a435d8")), seedLabel(s4, __i18n_k("league.postseason.bracketView.c8c0358f")), 2)];
        if (round === 'semipo') series = [waiting(round, seedLabel(s2, __i18n_k("league.postseason.bracketView.7948ecf9")), winnerOf('wildcard') ? seedLabel(winnerOf('wildcard'), '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.cb698be3") }, 3)];
        if (round === 'po') series = [waiting(round, seedLabel(s1, __i18n_k("league.postseason.bracketView.442411ad")), winnerOf('semipo') ? seedLabel(winnerOf('semipo'), '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.de953763") }, 3)];
        if (round === 'ks') series = [waiting(round, seedLabel(s0, '1위'), winnerOf('po') ? seedLabel(winnerOf('po'), '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.05a7144b") }, 4)];
      } else {
        // Two leagues: the spots are played (or not) at the start; then each league winner's playoff, then the final.
        // 1.8.0, NPB: each league's winner waits for its 2nd-v-3rd winner, with a win in hand.
        // 1.8.1, cross: each 2nd against the other league's 3rd (or the wild card that took its place), then each
        // league winner against the semi-playoff of the other league's 2nd.
        if (b.style === 'cross' && round === 'semipo') {
          const third = (id: TeamId | undefined) => {
            const wc = [...done, ...liveNow.map(result)].find((x) => x.round === 'wildcard' && x.low === id);
            if (!wc) return seedLabel(id, '');
            const doneWc = done.find((x) => x.round === 'wildcard' && x.low === id);
            return doneWc ? seedLabel(doneWc.winner, '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.cb698be3") };
          };
          series = [waiting(round, seedLabel(s1, __i18n_k("league.postseason.bracketView.d77a90d7")), third(s5), 3), waiting(round, seedLabel(s4, __i18n_k("league.postseason.bracketView.846e9986")), third(s2), 3)];
        } else if (b.style === 'cross' && round === 'po') {
          const semi = (high: TeamId | undefined) => {
            const w = winnerOf('semipo', (x) => x.high === high);
            return w ? seedLabel(w, '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.de953763") };
          };
          series = [waiting(round, seedLabel(s0, __i18n_k("league.postseason.bracketView.d77a90d7")), semi(s4), 3), waiting(round, seedLabel(s3, __i18n_k("league.postseason.bracketView.846e9986")), semi(s1), 3)];
        } else if (round === 'po' && b.style === 'npb') {
          const fs = (high: TeamId | undefined) => {
            const w = winnerOf('semipo', (x) => x.high === high);
            return w ? seedLabel(w, '') : { teamId: null, label: __i18n_k("league.postseason.text.84870a1e") };
          };
          series = [waiting(round, seedLabel(s0, __i18n_k("league.postseason.bracketView.d77a90d7")), fs(s1), 4), waiting(round, seedLabel(s3, __i18n_k("league.postseason.bracketView.846e9986")), fs(s4), 4)];
        } else if (round === 'po') {
          const spot = (third: TeamId | undefined, second: TeamId | undefined) => {
            const w = winnerOf('semipo', (x) => x.high === third && x.low === second);
            return w ? seedLabel(w, '') : seedLabel(second, '');
          };
          series = [waiting(round, seedLabel(s0, __i18n_k("league.postseason.bracketView.d77a90d7")), spot(s2, s4), 4), waiting(round, seedLabel(s3, __i18n_k("league.postseason.bracketView.846e9986")), spot(s5, s1), 4)];
        }
        if (round === 'ks') {
          const po = done.filter((x) => x.round === 'po').map((x) => x.winner);
          series = [waiting(round, po[0] ? seedLabel(po[0], '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.05a7144b") }, po[1] ? seedLabel(po[1], '') : { teamId: null, label: __i18n_k("league.postseason.bracketView.label.05a7144b") }, 4)];
        }
      }
    }
    if (!series.length) continue;
    const state = series.every((x) => x.state === 'done') ? 'done' : series.some((x) => x.state !== 'waiting') ? 'live' : 'waiting';
    rounds.push({ round, label: roundName(s, round), state, series });
  }
  const champ = champion(s);
  // Our club only once it plays in the first team (a futures year has no postseason to miss).
  const ours = s.user && firstTeamIds(s).includes(s.user.teamId) ? oursIn(s, rounds, s.user.teamId, b) : null;
  return { year: s.year, rounds, champion: champ, ours };
}

/** Our club's postseason in a phrase. */
function oursIn(s: LeagueState, rounds: BracketRound[], me: TeamId, b: Bracket | null): string {
  const all = rounds.flatMap((r) => r.series);
  const mine = all.filter((x) => x.high.teamId === me || x.low.teamId === me);
  if (!mine.length && !(b?.seeds.slice(0, 6).includes(me) ?? false)) return '포스트시즌 진출 실패';
  const live = mine.find((x) => x.state === 'live');
  if (live) {
    const [w, l] = live.high.teamId === me ? [live.hw, live.lw] : [live.lw, live.hw];
    return __i18n_k("league.postseason.oursIn.d11bb1fd", { value: roundName(s, live.round), w: w, l: l, value2: live.next ? __i18n_k("league.postseason.oursIn.c28dacbf", { game: live.next.game }) : '' });
  }
  const lost = mine.find((x) => x.state === 'done' && x.winner !== me);
  if (lost) return lost.round === 'ks' ? __i18n_k("league.postseason.oursIn.d3bd9b4b") : __i18n_k("league.postseason.oursIn.80e2ba84", { value: roundName(s, lost.round) });
  if (mine.some((x) => x.round === 'ks' && x.winner === me)) return __i18n_k("league.postseason.oursIn.0b104a90");
  const wait = mine.find((x) => x.state === 'waiting');
  return wait ? __i18n_k("league.postseason.oursIn.3272023b", { value: roundName(s, wait.round) }) : __i18n_k("league.postseason.oursIn.e0961d9f");
}

/** The status bar's line while the postseason is on: the round, how far along, and our club. */
export function postseasonStatus(s: LeagueState): string | null {
  const v = bracketView(s);
  const b = s.bracket;
  if (!v || !b || b.done) return null;
  const i = v.rounds.findIndex((r) => r.state === 'live');
  const round = v.rounds[i];
  if (!round) return null;
  const next = round.series.find((x) => x.next)?.next;
  const when = next ? __i18n_k("league.postseason.postseasonStatus.when.b9f4fecb", { number: Number(next.date.slice(5, 7)), number2: Number(next.date.slice(8)) }) : '';
  const ours = v.ours && v.ours !== '포스트시즌 진출 실패' ? __i18n_k("league.postseason.postseasonStatus.ours.43c1fc21", { ours: v.ours }) : '';
  return __i18n_k("league.postseason.postseasonStatus.8d7f8c8e", { year: s.year, label: round.label, value: i + 1, length: v.rounds.length, ours: ours, when: when });
}
