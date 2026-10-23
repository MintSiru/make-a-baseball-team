import { k as __i18n_k } from '../i18n/index';
/* 2.0.42 (the user's request: 아시아 시리즈, 기본 설정 오프): after the Korean Series, before the winter's business, the
   champions of four leagues meet — the KBO's, NPB's, the CPBL's and the ABL's (the real Asia Series of 2005–2008,
   2011–2013 had Japan, Korea, Taiwan and China or Australia). Each plays the other three once; the top two meet in
   a final.

   The KBO champion plays with its own players through the game engine; the other three are made-up sides of their
   league's strength (as the national team's opponents are, nationalgames.ts), with their players' names. When the
   NPB champion has a player who went there from the KBO, he plays for it — and if he faces his old club, or ours,
   it is news. Games between the other three are drawn by strength. Nothing is kept on the players' records and no
   one tires: the games only make the tournament's story, on their own random stream. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { compactBox, type StoredBox } from './boxscore';
import { simulateGame } from './engine/game';
import type { BatterIn, RelieverIn, TeamIn } from './engine/types';
import { clubState } from './fans';
import { foreignName, type NamePool } from './foreign';
import { wagwa } from './josa';
import { armIn, benchFor, lineupFor } from './manager';
import { NPB_CLUBS } from './mlb';
import { addNews } from './news';
import { isPitcher } from './players';
import type { LeagueState } from './state';

export const ASIA = {
  /** Each side's strength (20–80) and how much its players vary. */
  strength: { npb: 63, cpbl: 50, abl: 46 } as Record<Foreign, number>,
  spread: 7,
  starterLimit: 95,
  relieverLimit: 30,
  /** The champion's fans when it wins it (interest). */
  winBuzz: 0.04,
  /** The days it is played on (month-day, the first game). */
  from: '11-10',
};

type Foreign = 'npb' | 'cpbl' | 'abl';
const FOREIGN: Foreign[] = ['npb', 'cpbl', 'abl'];

const CPBL_CLUBS = [__i18n_k("league.asiaseries.text.fe91f4df"), __i18n_k("league.asiaseries.text.c1e4f408"), __i18n_k("league.asiaseries.text.232ef393"), __i18n_k("league.asiaseries.text.3400139e"), __i18n_k("league.asiaseries.text.ada53981"), __i18n_k("league.asiaseries.text.37a15244")];
const ABL_CLUBS = [__i18n_k("league.asiaseries.text.24268cd4"), __i18n_k("league.asiaseries.text.233d5ec0"), __i18n_k("league.asiaseries.text.a1f2248b"), __i18n_k("league.asiaseries.text.3d1614e2"), __i18n_k("league.asiaseries.text.b9e98834"), __i18n_k("league.asiaseries.text.ec82d49e")];
const POOL: Record<Foreign, NamePool> = { npb: 'japan', cpbl: 'taiwan', abl: 'west' };
export const LEAGUE_LABEL: Record<Foreign | 'kbo', string> = { kbo: 'KBO', npb: 'NPB', cpbl: 'CPBL', abl: 'ABL' };

export interface AsiaGame {
  id: string;
  date: string;
  stage: 'round' | 'final';
  /** The sides by league ('kbo' is the Korean champion), the runs. */
  home: Foreign | 'kbo';
  away: Foreign | 'kbo';
  hs: number;
  as: number;
}

export interface AsiaSeries {
  year: number;
  kbo: TeamId;
  clubs: Record<Foreign, string>;
  games: AsiaGame[];
  winner: Foreign | 'kbo';
  /** Players from the KBO with the NPB champion. */
  exKbo?: PlayerId[];
  boxes?: StoredBox[];
  names?: Record<string, string>;
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const pickClub = (list: string[], key: string) => list[Math.floor(hashUnit(key) * list.length)]!;

/** The players of the KBO with an NPB club now (from the KBO, still there). */
export function exKboWith(s: LeagueState, club: string): Player[] {
  return Object.values(s.players).filter((p) => p.status === 'overseas' && p.mlb?.league === 'npb' && p.mlb.back === undefined && p.mlb.ended === undefined && (p.mlb.seasons.at(-1)?.club ?? p.mlb.club) === club);
}

/** A made-up side of a league for one game, with the KBO's old players in it. */
function side(s: LeagueState, id: string, strength: number, r: () => number, ex: Player[]): TeamIn {
  const v = () => Math.max(25, Math.min(80, strength + (r() + r() + r() - 1.5) * 2 * ASIA.spread));
  const pos = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;
  const lineup: BatterIn[] = pos.map((p, i) => ({ id: `${id}-b${i}`, bats: r() < 0.3 ? 'L' : 'R', contact: v(), power: v(), eye: v(), speed: v(), defense: v(), pos: p }));
  const arm = (n: string, limit: number) => ({ id: `${id}-${n}`, throws: (r() < 0.3 ? 'L' : 'R') as 'L' | 'R', stuff: v(), command: v(), breaking: v(), stamina: limit > 50 ? v() : 40, pitchLimit: limit });
  let starter = arm('sp', ASIA.starterLimit);
  const bullpen: RelieverIn[] = Array.from({ length: 6 }, (_, i) => ({ ...arm(`r${i}`, ASIA.relieverLimit), role: i === 0 ? 'CL' : 'MU' }));
  // The KBO's old players: a hitter takes his position's place (or DH), a pitcher starts.
  for (const p of ex) {
    if (isPitcher(p)) starter = armIn(p, ASIA.starterLimit);
    else {
      // He bats as the designated hitter (his own bat; the made-up side keeps its gloves).
      const b = benchFor({ ...s, away: {}, abroad: {}, suspended: {}, injuries: {} } as LeagueState, [p.id], [])[0];
      if (!b) continue;
      const { defenseAt: _d, ...bat } = b;
      lineup[8] = { ...bat, pos: 'DH' };
    }
  }
  return { teamId: id, lineup, starter, bullpen };
}

/** The KBO champion's side for one game: its first team's hitters and its starter by turn. */
function kboSide(s: LeagueState, teamId: TeamId, game: number, vs: 'L' | 'R'): TeamIn | null {
  const ids = s.rosters[teamId]?.active ?? [];
  const squad = ids.map((id) => s.players[id]).filter((p): p is Player => !!p);
  const healthy = { ...s, away: {}, abroad: {}, suspended: {} } as LeagueState;
  let lineup = lineupFor(healthy, squad.filter((p) => !isPitcher(p)).map((p) => p.id), undefined, false, vs);
  if (lineup.length < 9) lineup = lineupFor({ ...healthy, injuries: {} }, squad.filter((p) => !isPitcher(p)).map((p) => p.id), undefined, false, vs);
  if (lineup.length < 9) return null;
  const arms = squad.filter(isPitcher).sort((a, b) => b.scouting.current - a.scouting.current || a.id.localeCompare(b.id));
  const starters = arms.filter((p) => p.role === 'SP').slice(0, 4);
  const sp = starters.length ? starters[game % starters.length]! : arms[0];
  if (!sp) return null;
  const pen = arms.filter((p) => p !== sp && !starters.includes(p));
  return { teamId: 'KBO', lineup, starter: armIn(sp, ASIA.starterLimit), bullpen: pen.map((p, i) => ({ ...armIn(p, ASIA.relieverLimit), role: i === 0 ? 'CL' : 'MU' })) };
}

/** Plays the year's Asia Series (when the league plays it), with the KBO champion `kbo`. */
export function playAsiaSeries(s: LeagueState, year: number, kbo: TeamId | null): AsiaSeries | null {
  if (!s.asiaSeries || !kbo || !s.rosters[kbo] || (s.asia ?? []).some((x) => x.year === year)) return null;
  const key = `${s.seed}|asia|${year}`;
  const clubs: Record<Foreign, string> = { npb: pickClub(NPB_CLUBS, `${key}|npb`), cpbl: pickClub(CPBL_CLUBS, `${key}|cpbl`), abl: pickClub(ABL_CLUBS, `${key}|abl`) };
  const ex = exKboWith(s, clubs.npb);
  const out: AsiaSeries = { year, kbo, clubs, games: [], winner: 'kbo', boxes: [], names: {}, ...(ex.length ? { exKbo: ex.map((p) => p.id) } : {}) };
  const wins: Record<Foreign | 'kbo', number> = { kbo: 0, npb: 0, cpbl: 0, abl: 0 };
  const runs: Record<Foreign | 'kbo', number> = { kbo: 0, npb: 0, cpbl: 0, abl: 0 };
  const start = `${year}-${ASIA.from}`;
  let kboGames = 0;
  const play = (home: Foreign | 'kbo', away: Foreign | 'kbo', stage: AsiaGame['stage'], day: number) => {
    const id = `asia-${year}-${out.games.length}`;
    const r = rng(`${key}|game|${out.games.length}`);
    const date = addDays(start, day);
    let hs: number, as: number;
    if (home === 'kbo' || away === 'kbo') {
      const them = home === 'kbo' ? away : home;
      const opp = side(s, `${them.toUpperCase()}`, ASIA.strength[them as Foreign], r, them === 'npb' ? ex : []);
      for (const b of opp.lineup) if (!s.players[b.id]) out.names![b.id] = foreignName(POOL[them as Foreign], r);
      for (const p of [opp.starter, ...opp.bullpen]) if (!s.players[p.id]) out.names![p.id] = foreignName(POOL[them as Foreign], r);
      const us = kboSide(s, kbo, kboGames++, opp.starter.throws);
      if (!us) return null;
      const g = simulateGame({ gameId: id, home: home === 'kbo' ? us : opp, away: home === 'kbo' ? opp : us, maxInnings: null, park: 1, ghostFrom: 10 }, rng(`${key}|sim|${out.games.length}`), []);
      hs = g.home.runs;
      as = g.away.runs;
      out.boxes!.push(compactBox(g, id, date));
    } else {
      // Two of the others: drawn by strength.
      const edge = (ASIA.strength[home] - ASIA.strength[away]) * 0.025;
      const homeWins = r() < 0.5 + edge;
      const lose = Math.floor(r() * 5);
      [hs, as] = homeWins ? [lose + 1 + Math.floor(r() * 4), lose] : [lose, lose + 1 + Math.floor(r() * 4)];
    }
    out.games.push({ id, date, stage, home, away, hs, as });
    wins[hs > as ? home : away]++;
    runs[home] += hs - as;
    runs[away] += as - hs;
    return hs > as ? home : away;
  };
  // Each plays each once (three days), then the final.
  const order: [Foreign | 'kbo', Foreign | 'kbo'][] = [
    ['kbo', 'cpbl'],
    ['npb', 'abl'],
    ['abl', 'kbo'],
    ['cpbl', 'npb'],
    ['kbo', 'npb'],
    ['cpbl', 'abl'],
  ];
  for (const [i, [h, a]] of order.entries()) if (play(h, a, 'round', Math.floor(i / 2)) === null) return null;
  const table = (['kbo', ...FOREIGN] as const).slice().sort((a, b) => wins[b] - wins[a] || runs[b] - runs[a] || (a === 'kbo' ? -1 : 0));
  const winner = play(table[0]!, table[1]!, 'final', 4);
  if (winner === null) return null;
  out.winner = winner;
  (s.asia ??= []).push(out);
  // Only the latest keeps its box scores and names.
  for (const x of s.asia) if (x !== out) delete x.boxes, delete x.names;
  asiaNews(s, out);
  return out;
}

const sideName = (s: LeagueState, x: AsiaSeries, k: Foreign | 'kbo') => (k === 'kbo' ? (s.teams.find((t) => t.id === x.kbo)?.name ?? 'KBO') : x.clubs[k]);

function asiaNews(s: LeagueState, x: AsiaSeries) {
  const me = s.user?.teamId;
  const club = sideName(s, x, 'kbo');
  const final = x.games.at(-1)!;
  const champ = sideName(s, x, x.winner);
  const lines = [
    __i18n_k("league.asiaseries.text.172f1b6e", { home: sideName(s, x, final.home), hs: final.hs, as: final.as, away: sideName(s, x, final.away) }),
    ...x.games.filter((g) => g.stage === 'round' && (g.home === 'kbo' || g.away === 'kbo')).map((g) => __i18n_k("league.asiaseries.text.e4dfe604", { home: sideName(s, x, g.home), hs: g.hs, as: g.as, away: sideName(s, x, g.away) })),
  ];
  const title = x.winner === 'kbo' ? __i18n_k("league.asiaseries.text.4042c19f", { club }) : __i18n_k("league.asiaseries.text.f474bab0", { year: x.year, champ, league: LEAGUE_LABEL[x.winner] });
  addNews(s, { id: `asia-${x.year}`, date: final.date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: {}, players: [], mine: x.kbo === me });
  if (x.kbo === me) {
    addAlert(s, { id: `asia-${x.year}`, date: final.date, kind: 'season', title, lines, tone: x.winner === 'kbo' ? 'good' : undefined });
    if (x.winner === 'kbo') clubState(s, me).interest += ASIA.winBuzz;
  }
  // The KBO's old players with the NPB champion.
  for (const id of x.exKbo ?? []) {
    const p = s.players[id];
    if (!p) continue;
    const kboClubs = p.career.filter((c) => !c.level && c.teamId).map((c) => c.teamId!);
    const old = kboClubs.at(-1);
    const vsOld = old === x.kbo;
    const ours = !!me && kboClubs.includes(me);
    const text = vsOld
      ? __i18n_k("league.asiaseries.text.8881747f", { name: p.name, npb: x.clubs.npb, club: wagwa(s.teams.find((t) => t.id === old)?.name ?? '') })
      : __i18n_k("league.asiaseries.text.7fc56064", { name: p.name, npb: x.clubs.npb });
    addNews(s, { id: `asia-ex-${x.year}-${id}`, date: x.games[0]!.date, kind: 'interview', title: text, body: text, quotes: [], facts: { 선수: p.name }, players: [id], mine: ours });
    if (ours) addAlert(s, { id: `asia-ex-${x.year}-${id}`, date: x.games[0]!.date, kind: 'season', title: vsOld ? __i18n_k("league.asiaseries.text.24f93e00", { name: p.name }) : __i18n_k("league.asiaseries.text.2589c839", { name: p.name }), lines: [text], players: [id] });
  }
}
