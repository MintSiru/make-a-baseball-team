import { k as __i18n_k } from '../i18n/index';
/* 2.0.30 (the user's request): 시범경기 — the spring games before opening day. Every first-team club plays ten games in
   the ten days that end four days before opening day: five opponents, two games each at one ballpark, nine innings and
   a tie after nine. They count for nothing: no standings, no season records, no injuries, no gate. Their own table,
   leaders and box scores are kept until the next spring, and the papers write up the end of them.

   They are played by the regular season's day loop (playDay) before its first date, and touch nothing it reads: the
   starters go round their own rotation key, the arms' rest kept for these days is cleared when they end. The league
   built before the game starts (createLeague's history) plays none. The KBO's 시범경기 began in 1983. */
import { rng } from '../draftroom';
import type { PlayerId, TeamId } from '../model/types';
import { simulateGame } from './engine/game';
import { compactBox, type StoredBox } from './boxscore';
import { parkFactor } from './clubs';
import { layoutOf } from './layout';
import { matchInputs } from './manager';
import { addNews } from './news';
import { startYear } from './era';
import { firstTeamIds, type LeagueState, type SeasonLine } from './state';
import { standings, type GameScore, type StandingRow } from './standings';

export const EXHIBITION = {
  /** Game days, two against each opponent. */
  days: 10,
  /** The last game this many days before opening day. */
  before: 4,
  /** The KBO's first 시범경기. */
  from: 1983,
  /** The leaders: at least this many plate appearances, or outs. */
  minPa: 20,
  minOuts: 24,
};

export interface ExhibitionGame {
  id: string;
  date: string;
  home: TeamId;
  away: TeamId;
}

export interface Exhibition {
  year: number;
  games: ExhibitionGame[];
  next: number;
  scores: GameScore[];
  lines: Record<PlayerId, SeasonLine>;
  boxes: Record<string, StoredBox>;
  done?: boolean;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** Season start: this spring's games, when the season is played rather than built as history. */
export function planExhibitions(s: LeagueState) {
  delete s.exhibition;
  const opening = s.schedule[0]?.date;
  if (!opening || s.year < EXHIBITION.from || (!s.historical && s.year < startYear())) return;
  const r = rng(`${s.seed}|exhibition|${s.year}`);
  const teams = firstTeamIds(s);
  // A random order, then the circle method: each round a new opponent for everyone (an odd one out rests).
  const order = [...teams];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (order.length % 2) order.push('');
  const n = order.length;
  const games: ExhibitionGame[] = [];
  const first = addDays(opening, -(EXHIBITION.before + EXHIBITION.days - 1));
  for (let round = 0; round < EXHIBITION.days / 2; round++) {
    const ring = [order[0]!, ...order.slice(1).map((_, i) => order[1 + ((i + round) % (n - 1))]!)];
    for (let k = 0; k < n / 2; k++) {
      const [a, b] = [ring[k]!, ring[n - 1 - k]!];
      if (!a || !b) continue;
      const [home, away] = (round + k) % 2 ? [a, b] : [b, a];
      for (let day = 0; day < 2; day++) {
        const date = addDays(first, round * 2 + day);
        games.push({ id: `${s.year}-ex-${round * 2 + day}-${k}`, date, home, away });
      }
    }
  }
  games.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  s.exhibition = { year: s.year, games, next: 0, scores: [], lines: {}, boxes: {} };
}

/** The next spring game's date, while there is one to play before opening day. */
export function exhibitionDate(s: LeagueState): string | null {
  const ex = s.exhibition;
  if (!ex || ex.done || ex.year !== s.year || s.next > 0) return null;
  return ex.games[ex.next]?.date ?? null;
}

/** Plays the next date's spring games (false when there are none left); after the last, the papers. */
export function playExhibitionDay(s: LeagueState, record: (box: import('./engine/types').TeamBox, date: string, lines: Record<PlayerId, SeasonLine>) => void): boolean {
  const date = exhibitionDate(s);
  const ex = s.exhibition;
  if (!date || !ex) return false;
  while (ex.next < ex.games.length && ex.games[ex.next]!.date === date) {
    const g = ex.games[ex.next++]!;
    const { home, away } = matchInputs(s, date, { teamId: g.home, rotationKey: `ex|${g.home}` }, { teamId: g.away, rotationKey: `ex|${g.away}` });
    if (!home || !away) continue;
    const host = s.teams.find((t) => t.id === g.home);
    const layout = host ? layoutOf(host) : undefined;
    const out = simulateGame({ gameId: g.id, home, away, maxInnings: 9, park: host?.stadium.park ?? parkFactor(g.home), balls: rng(`${s.seed}|balls|${g.id}`), ...(layout ? { layout } : {}) }, rng(`${s.seed}|game|${g.id}`));
    record(out.home, date, ex.lines);
    record(out.away, date, ex.lines);
    ex.scores.push({ id: g.id, date, home: g.home, away: g.away, hs: out.home.runs, as: out.away.runs });
    ex.boxes[g.id] = compactBox(out, g.id, date);
  }
  if (ex.next >= ex.games.length) finish(s);
  return true;
}

/** The spring is over: the regular season starts from rested arms and its own rotations; the papers write it up. */
function finish(s: LeagueState) {
  const ex = s.exhibition!;
  ex.done = true;
  s.arms = {};
  for (const key of Object.keys(s.rotation)) if (key.startsWith('ex|')) delete s.rotation[key];
  const table = exhibitionTable(s);
  const top = table[0];
  if (!top || !ex.scores.length) return;
  const short = (id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
  const leaders = exhibitionLeaders(s);
  const me = s.user?.teamId;
  const ours = me ? table.find((r) => r.teamId === me) : undefined;
  const date = ex.scores.at(-1)!.date;
  const lines = [
    __i18n_k("league.exhibition.text.68c6711d", { club: short(top.teamId), w: top.w, l: top.l, t: top.t }),
    ...(ours ? [__i18n_k("league.exhibition.text.acb2e2fb", { rank: ours.rank, w: ours.w, l: ours.l, t: ours.t })] : []),
    ...(leaders.avg[0] ? [__i18n_k("league.exhibition.text.225614ec", { name: leaders.avg[0].name, club: short(leaders.avg[0].teamId), value: leaders.avg[0].text })] : []),
    ...(leaders.hr[0] && leaders.hr[0].value > 0 ? [__i18n_k("league.exhibition.text.9155e5df", { name: leaders.hr[0].name, club: short(leaders.hr[0].teamId), value: leaders.hr[0].value })] : []),
    ...(leaders.era[0] ? [__i18n_k("league.exhibition.text.d269861d", { name: leaders.era[0].name, club: short(leaders.era[0].teamId), value: leaders.era[0].text })] : []),
  ];
  addNews(s, {
    id: `exhibition-${ex.year}`,
    date,
    kind: 'season',
    title: __i18n_k("league.exhibition.text.2ef67827", { year: ex.year, club: short(top.teamId) }),
    body: lines.join(' '),
    quotes: [],
    facts: { year: ex.year, first: short(top.teamId) },
    detail: lines,
    players: [leaders.avg[0]?.id, leaders.hr[0]?.id, leaders.era[0]?.id].filter((x): x is string => !!x),
    mine: !!ours,
  });
}

/** This spring's table (it counts for nothing). */
export function exhibitionTable(s: LeagueState): StandingRow[] {
  const ex = s.exhibition;
  if (!ex) return [];
  const teams = [...new Set(ex.games.flatMap((g) => [g.home, g.away]))].filter((id) => s.teams.some((t) => t.id === id));
  return standings(teams, ex.scores);
}

interface Leader {
  id: PlayerId;
  name: string;
  teamId: TeamId;
  value: number;
  text: string;
}

/** This spring's best: average and home runs (20 plate appearances or more), ERA (eight innings or more). */
export function exhibitionLeaders(s: LeagueState, n = 5): { avg: Leader[]; hr: Leader[]; era: Leader[] } {
  const ex = s.exhibition;
  if (!ex) return { avg: [], hr: [], era: [] };
  const rows = Object.entries(ex.lines).map(([id, line]) => ({ id, line, name: s.players[id]?.name ?? id }));
  const bats = rows.filter((x) => (x.line.bat?.pa ?? 0) >= EXHIBITION.minPa);
  const arms = rows.filter((x) => (x.line.pit?.outs ?? 0) >= EXHIBITION.minOuts);
  const avg = bats
    .map((x) => {
      const b = x.line.bat!;
      const v = b.ab ? b.h / b.ab : 0;
      return { id: x.id, name: x.name, teamId: x.line.teamId, value: v, text: v.toFixed(3).replace(/^0/, '') };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
  const hr = rows
    .filter((x) => x.line.bat)
    .map((x) => ({ id: x.id, name: x.name, teamId: x.line.teamId, value: x.line.bat!.hr, text: String(x.line.bat!.hr) }))
    .sort((a, b) => b.value - a.value || (ex.lines[b.id]!.bat!.rbi ?? 0) - (ex.lines[a.id]!.bat!.rbi ?? 0))
    .slice(0, n);
  const era = arms
    .map((x) => {
      const p = x.line.pit!;
      const v = (27 * p.er) / p.outs;
      return { id: x.id, name: x.name, teamId: x.line.teamId, value: v, text: v.toFixed(2) };
    })
    .sort((a, b) => a.value - b.value)
    .slice(0, n);
  return { avg, hr, era };
}

/** A spring game's box score, for the box score window. */
export const exhibitionBox = (s: LeagueState, id: string) => s.exhibition?.boxes[id];
