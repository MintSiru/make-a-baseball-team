/* 2.0.11 (the user's request): the national team's games, so every player called up has his own line for the event.
   The result of an event is still drawn as before (national.ts); its games are then played with the game engine to
   fit it — more games the further the team went, stronger opponents later on — against made-up sides of the
   tournament's strength. The squad's lines are kept on the event; the games themselves are not (nor any other
   club's records, rest days or results), and they draw from their own random stream, so nothing else moves. */
import { rng } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { simulateGame } from './engine/game';
import type { BatterIn, FieldPos, PitcherIn, RelieverIn, TeamBox, TeamIn } from './engine/types';
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
  strength: { wbc: [58, 72], premier12: [55, 68], olympics: [56, 69], asianGames: [48, 62], apbc: [50, 60] } as Record<EventKind, [number, number]>,
  spread: 7,
  starterLimit: 80,
  relieverLimit: 30,
  rotation: 4,
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

/** Plays the event's games for its drawn finish and keeps each player's line on the entry. */
export function playNationalGames(s: LeagueState, e: InternationalEvent, entry: NationalEntry) {
  if (!entry.finish || entry.lines) return;
  const squad = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p);
  const n = (e.kind === 'apbc' ? NATIONAL_GAMES.short : NATIONAL_GAMES.games)[entry.finish];
  const [from, to] = NATIONAL_GAMES.strength[e.kind];
  const r = rng(`${s.seed}|national-games|${e.id}`);
  const lines: Record<PlayerId, NationalLine> = {};
  let played = 0;
  for (let g = 0; g < n; g++) {
    const strength = from + ((to - from) * g) / Math.max(1, n - 1);
    const them = opponent(`${e.id}-g${g}`, strength, r);
    const us = korea(s, squad, g, them.starter.throws);
    if (!us) break;
    const home = g % 2 === 0;
    const out = simulateGame({ gameId: `${e.id}-g${g}`, home: home ? us : them, away: home ? them : us, maxInnings: null, park: 1, ghostFrom: 10 }, r);
    add(lines, home ? out.home : out.away);
    played++;
  }
  if (played) {
    entry.lines = lines;
    entry.games = played;
  }
}

/** His lines for the national team, event by event (oldest first). */
export function nationalLinesOf(s: LeagueState, id: PlayerId) {
  return s.international.filter((x) => x.lines?.[id]).map((x) => ({ id: x.id, year: x.year, name: x.name, kind: x.kind, finish: x.finish, line: x.lines![id]! }));
}
