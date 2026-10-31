import { k as __i18n_k } from '../i18n/index';
/* 2.0.11 (the user's request): the national team's games, so every player called up has his own line for the event.
   The result of an event is still drawn as before (national.ts); its games are then played with the game engine to
   fit it — more games the further the team went, stronger opponents later on — against made-up sides of the
   tournament's strength. The squad's lines are kept on the event; the games themselves are not (nor any other
   club's records, rest days or results), and they draw from their own random stream, so nothing else moves.

   2.0.16 (the user's request): the games can be watched. Each has a date in the event's window, a stage and a named
   opponent (a country of the event, the stronger later on, with its players' names), and the decisive games fit the
   drawn finish (a champion wins its semi-final and final). The box scores of the last few events and the
   play-by-play of the latest are kept on the entry. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { compactBox, type StoredBox } from './boxscore';
import { simulateGame } from './engine/game';
import type { BatterIn, FieldPos, PitcherIn, PlayEvent, RelieverIn, TeamBox, TeamIn } from './engine/types';
import { foreignName, type NamePool } from './foreign';
import type { EventKind, Finish, InternationalEvent } from './international';
import { armIn, lineupFor } from './manager';
import { isPitcher } from './players';
import { addInto, emptyBat, emptyPit, type LeagueState, type NationalEntry } from './state';

const KOREA = 'KOR';

export const NATIONAL_GAMES = {
  /** Games played for each finish (the APBC is a short event). */
  games: { first: 3, second: 5, fourth: 7, third: 7, runnerUp: 8, champion: 8 } as Record<Finish, number>,
  short: { first: 2, second: 3, fourth: 3, third: 4, runnerUp: 4, champion: 4 } as Record<Finish, number>,
  /** Opponents' strength (20–80) in the first game and the last, by event; each player varies around it. */
  strength: { wbc: [58, 72], premier12: [55, 68], olympics: [56, 69], asianGames: [48, 62], apbc: [50, 60], worldCup: [50, 64] } as Record<EventKind, [number, number]>,
  spread: 7,
  starterLimit: 80,
  relieverLimit: 30,
  rotation: 4,
  /** Box scores are kept for this many of the latest events, play-by-play for the latest only. */
  keepBoxes: 3,
  /** Tries for a decisive game to come out as the finish says (2.0.39, the user's report: 12 left one event in
      fifty with a lost semi-final under a title — 100 leave none in thousands; most fit in a few). */
  tries: 100,
};

export type NationalStage = 'group' | 'second' | 'semi' | 'final' | 'bronze';
export const STAGE_LABEL: Record<NationalStage, string> = { group: __i18n_k("league.nationalgames.text.10f073b3"), second: __i18n_k("league.nationalgames.text.7aa520d5"), semi: __i18n_k("league.nationalgames.text.1d0103f0"), final: __i18n_k("league.nationalgames.text.adf4229b"), bronze: __i18n_k("league.nationalgames.text.16a01ff2") };

export interface NationalGame {
  /** The box score's id, and the opponent's team id in it. */
  id: string;
  date: string;
  stage: NationalStage;
  opp: string;
  home: boolean;
  us: number;
  them: number;
}

export interface NationalWatch {
  games: NationalGame[];
  boxes?: StoredBox[];
  logs?: Record<string, PlayEvent[]>;
  /** The opponents' players' names. */
  names?: Record<string, string>;
}

/** The countries each event meets, the weakest first, and the names their players go by. */
const FIELD: Record<EventKind, [string, NamePool][]> = {
  wbc: [
    [__i18n_k("league.nationalgames.text.41ede1bc"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.04f7cc4b"), 'west'],
    [__i18n_k("league.nationalgames.text.5db69ec1"), 'west'],
    [__i18n_k("league.nationalgames.text.815ebdbe"), 'west'],
    [__i18n_k("league.nationalgames.text.7a5ca87b"), 'dutch'],
    [__i18n_k("league.nationalgames.text.b0447764"), 'latin'],
    [__i18n_k("league.nationalgames.text.b0e06d09"), 'latin'],
    [__i18n_k("league.nationalgames.text.c95139a2"), 'latin'],
    [__i18n_k("league.nationalgames.text.82b9030e"), 'latin'],
    [__i18n_k("league.nationalgames.text.fa1579e0"), 'latin'],
    [__i18n_k("league.nationalgames.text.8a9d64bd"), 'west'],
    [__i18n_k("league.nationalgames.text.d7a6e266"), 'japan'],
  ],
  premier12: [
    [__i18n_k("league.nationalgames.text.5db69ec1"), 'west'],
    [__i18n_k("league.nationalgames.text.55045089"), 'west'],
    [__i18n_k("league.nationalgames.text.b0447764"), 'latin'],
    [__i18n_k("league.nationalgames.text.7a5ca87b"), 'dutch'],
    [__i18n_k("league.nationalgames.text.6be27bc7"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.b0e06d09"), 'latin'],
    [__i18n_k("league.nationalgames.text.c95139a2"), 'latin'],
    [__i18n_k("league.nationalgames.text.8a9d64bd"), 'west'],
    [__i18n_k("league.nationalgames.text.d7a6e266"), 'japan'],
  ],
  olympics: [
    [__i18n_k("league.nationalgames.text.c71f3eeb"), 'west'],
    [__i18n_k("league.nationalgames.text.815ebdbe"), 'west'],
    [__i18n_k("league.nationalgames.text.fa1579e0"), 'latin'],
    [__i18n_k("league.nationalgames.text.b0e06d09"), 'latin'],
    [__i18n_k("league.nationalgames.text.8a9d64bd"), 'west'],
    [__i18n_k("league.nationalgames.text.d7a6e266"), 'japan'],
  ],
  asianGames: [
    [__i18n_k("league.nationalgames.text.411bda9a"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.41ede1bc"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.6be27bc7"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.d7a6e266"), 'japan'],
  ],
  apbc: [
    [__i18n_k("league.nationalgames.text.5db69ec1"), 'west'],
    [__i18n_k("league.nationalgames.text.6be27bc7"), 'taiwan'],
    [__i18n_k("league.nationalgames.text.d7a6e266"), 'japan'],
  ],
  // 2.0.65: the amateurs' world championship (1982) has no games played; its field for the type's sake.
  get worldCup() {
    return FIELD.olympics;
  },
};

export type NationalLine = { bat: ReturnType<typeof emptyBat> | null; pit: ReturnType<typeof emptyPit> | null };

const POS: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

/** A made-up side of `strength` for one game. */
function opponent(id: string, strength: number, r: () => number): TeamIn {
  const v = () => Math.max(25, Math.min(80, strength + (r() + r() + r() - 1.5) * 2 * NATIONAL_GAMES.spread));
  const lineup: BatterIn[] = POS.map((pos, i) => ({ id: `${id}-b${i}`, bats: r() < 0.3 ? 'L' : 'R', contact: v(), power: v(), eye: v(), speed: v(), defense: v(), pos }));
  const arm = (n: string, limit: number): PitcherIn => ({
    id: `${id}-${n}`,
    throws: r() < 0.3 ? 'L' : 'R',
    stuff: v(),
    command: v(),
    breaking: v(),
    stamina: limit > 50 ? v() : 40,
    pitchLimit: limit,
  });
  const bullpen: RelieverIn[] = Array.from({ length: 6 }, (_, i) => ({ ...arm(`r${i}`, NATIONAL_GAMES.relieverLimit), role: i === 0 ? 'CL' : 'MU' }));
  return { teamId: id, lineup, starter: arm('sp', NATIONAL_GAMES.starterLimit), bullpen };
}

/** The squad for one game: its hitters in the manager's order and the starter's turn. */
function korea(s: LeagueState, squad: Player[], game: number, vs: 'L' | 'R'): TeamIn | null {
  // The squad is away from its clubs while it plays: here it is available. A squad short of nine healthy hitters
  // plays its knocked ones too.
  const hitters = squad.filter((p) => !isPitcher(p)).map((p) => p.id);
  const healthy = { ...s, away: {}, abroad: {}, suspended: {} } as LeagueState;
  let lineup = lineupFor(healthy, hitters, undefined, false, vs);
  if (lineup.length < 9) lineup = lineupFor({ ...healthy, injuries: {} }, hitters, undefined, false, vs);
  if (lineup.length < 9) return null;
  const fit = squad.filter((p) => isPitcher(p) && !s.injuries[p.id]);
  const arms = (fit.length >= 5 ? fit : squad.filter(isPitcher)).sort((a, b) => b.scouting.current - a.scouting.current || a.id.localeCompare(b.id));
  const starters = arms.filter((p) => p.role === 'SP').slice(0, NATIONAL_GAMES.rotation);
  const sp = starters.length ? starters[game % starters.length]! : arms[0];
  if (!sp) return null;
  const pen = arms.filter((p) => p !== sp && !starters.includes(p));
  const bullpen: RelieverIn[] = (pen.length ? pen : arms.filter((p) => p !== sp)).map((p, i) => ({ ...armIn(p, NATIONAL_GAMES.relieverLimit), role: i === 0 ? 'CL' : 'MU' }));
  return { teamId: KOREA, lineup, starter: armIn(sp, NATIONAL_GAMES.starterLimit), bullpen };
}

function add(lines: Record<PlayerId, NationalLine>, box: TeamBox) {
  for (const b of box.batting) {
    const line = (lines[b.id] ??= { bat: null, pit: null });
    const bat = (line.bat ??= emptyBat());
    const { id: _id, pos: _pos, split: _split, sub, bip: _bip, fld: _fld, spray: _spray, hrSeq: _hrSeq, ...counts } = b;
    addInto(bat, counts);
    if (b.pa > 0 || sub) bat.g++;
  }
  for (const p of box.pitching) {
    const line = (lines[p.id] ??= { bat: null, pit: null });
    const pit = (line.pit ??= emptyPit());
    const { id: _id, split: _split, bip: _bip, ...counts } = p;
    addInto(pit, counts);
    pit.g++;
  }
}

/** The stage of each game for a finish: the knock-out games last, a second round after the first three. */
function stagesFor(n: number, finish: Finish): NationalStage[] {
  const out: NationalStage[] = Array.from({ length: n }, () => 'group');
  if (finish === 'champion' || finish === 'runnerUp' || finish === 'third' || finish === 'fourth') {
    out[n - 1] = finish === 'third' || finish === 'fourth' ? 'bronze' : 'final';
    if (n >= 2) out[n - 2] = 'semi';
  }
  for (let i = 3; i < n; i++) if (out[i] === 'group') out[i] = 'second';
  return out;
}

/** What a decisive game must come to (true: Korea wins); null for any other. */
function wantFor(i: number, n: number, finish: Finish): boolean | null {
  const last = i === n - 1,
    semi = i === n - 2 && n >= 2;
  switch (finish) {
    case 'champion':
      return last || semi ? true : null;
    case 'runnerUp':
      return last ? false : semi ? true : null;
    case 'third':
      return last ? true : semi ? false : null;
    case 'fourth':
      return last || semi ? false : null;
    default:
      return last ? false : null;
  }
}

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** Plays the event's games for its drawn finish and keeps each player's line on the entry, and the games. */
export function playNationalGames(s: LeagueState, e: InternationalEvent, entry: NationalEntry) {
  if (!entry.finish || entry.lines) return;
  const squad = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p);
  const n = (e.kind === 'apbc' ? NATIONAL_GAMES.short : NATIONAL_GAMES.games)[entry.finish];
  const [from, to] = NATIONAL_GAMES.strength[e.kind];
  const field = FIELD[e.kind];
  const stages = stagesFor(n, entry.finish);
  const span = Math.max(0, Math.round((Date.parse(e.dates.to) - Date.parse(e.dates.from)) / 86400000));
  const lines: Record<PlayerId, NationalLine> = {};
  const watch: NationalWatch = { games: [], boxes: [], logs: {}, names: {} };
  let last = -1;
  for (let g = 0; g < n; g++) {
    const id = `${e.id}-g${g}`;
    const r = rng(`${s.seed}|national-games|${e.id}|${g}`);
    const strength = from + ((to - from) * g) / Math.max(1, n - 1);
    // The opponent: by the stage's strength, a step either way, not the same side twice running (but a final may be
    // a rematch).
    let at = Math.round((g / Math.max(1, n - 1)) * (field.length - 1) + (r() - 0.5) * 2.4);
    at = Math.max(0, Math.min(field.length - 1, at));
    if (at === last && stages[g] !== 'final') at = at > 0 ? at - 1 : Math.min(field.length - 1, at + 1);
    last = at;
    const [country, pool] = field[at]!;
    const them = opponent(id, strength, r);
    for (const b of them.lineup) watch.names![b.id] = foreignName(pool, r);
    for (const p of [them.starter, ...them.bullpen]) watch.names![p.id] = foreignName(pool, r);
    const us = korea(s, squad, g, them.starter.throws);
    if (!us) break;
    const home = g % 2 === 0;
    const want = wantFor(g, n, entry.finish);
    let out!: ReturnType<typeof simulateGame>;
    let log: PlayEvent[] = [];
    for (let t = 0; t < NATIONAL_GAMES.tries; t++) {
      log = [];
      out = simulateGame({ gameId: id, home: home ? us : them, away: home ? them : us, maxInnings: null, park: 1, ghostFrom: 10 }, rng(`${s.seed}|national-games|${e.id}|${g}|${t}`), log);
      const won = (home ? out.home.runs > out.away.runs : out.away.runs > out.home.runs);
      if (want === null || won === want) break;
    }
    add(lines, home ? out.home : out.away);
    const date = addDays(e.dates.from, n > 1 ? Math.round((g * span) / (n - 1)) : 0);
    watch.games.push({ id, date, stage: stages[g]!, opp: country, home, us: home ? out.home.runs : out.away.runs, them: home ? out.away.runs : out.home.runs });
    watch.boxes!.push(compactBox(out, id, date));
    watch.logs![id] = log;
  }
  if (watch.games.length) {
    entry.lines = lines;
    entry.games = watch.games.length;
    entry.watch = watch;
    pruneWatch(s, entry);
  }
}

/** Only the latest events keep their box scores, and only the latest its play-by-play. */
function pruneWatch(s: LeagueState, latest: NationalEntry) {
  const kept = s.international.filter((x) => x.watch?.boxes).slice(-NATIONAL_GAMES.keepBoxes);
  for (const x of s.international) {
    if (!x.watch || x === latest) continue;
    delete x.watch.logs;
    if (!kept.includes(x)) {
      delete x.watch.boxes;
      delete x.watch.names;
    }
  }
}

const watchOf = (s: LeagueState, id: string) => s.international.find((x) => x.watch?.games.some((g) => g.id === id));

/** A national game's box score, play-by-play and names (for the box score screen). */
export const nationalBox = (s: LeagueState, id: string) => watchOf(s, id)?.watch?.boxes?.find((b) => b.id === id);
export const nationalLog = (s: LeagueState, id: string) => watchOf(s, id)?.watch?.logs?.[id];
export function nationalName(s: LeagueState, id: string): string | undefined {
  const game = id.replace(/-(b\d+|sp|r\d+)$/, '');
  return watchOf(s, game)?.watch?.names?.[id];
}
/** 'KOR' and an opponent (its id is the game's). */
export function nationalTeamName(s: LeagueState, teamId: string): string | undefined {
  if (teamId === KOREA) return __i18n_k("league.nationalgames.text.4f12e899");
  return watchOf(s, teamId)?.watch?.games.find((g) => g.id === teamId)?.opp;
}

/** An event's games for the screen (newest event first elsewhere): each with whether its box and relay are kept. */
export function nationalGamesOf(s: LeagueState, eventId: string) {
  const x = s.international.find((e) => e.id === eventId);
  if (!x?.watch) return null;
  const w = x.watch;
  return w.games.map((g) => ({ ...g, stageText: STAGE_LABEL[g.stage], result: g.us > g.them ? '승' : '패', box: !!w.boxes?.some((b) => b.id === g.id), pbp: !!w.logs?.[g.id] }));
}

/** His lines for the national team, event by event (oldest first). */
export function nationalLinesOf(s: LeagueState, id: PlayerId) {
  return s.international.filter((x) => x.lines?.[id]).map((x) => ({ id: x.id, year: x.year, name: x.name, kind: x.kind, finish: x.finish, line: x.lines![id]! }));
}
