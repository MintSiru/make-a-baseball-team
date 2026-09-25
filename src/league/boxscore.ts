/* Box scores (V0.7). The engine's full box is compacted to arrays and kept for the user's games this
   season, every postseason game and the league's last three game days; play-by-play logs are kept for
   the user's last ten games. Both are display only and cleared when a new season starts. */
import type { GameOut, PlayEvent, TeamBox } from './engine/types';
import type { PlayerId, TeamId } from '../model/types';
import type { LeagueState } from './state';

/** id, position, AB, R, H, RBI, HR, BB, K, 2B, 3B, SB */
export type BatRow = [PlayerId, string, number, number, number, number, number, number, number, number, number, number];
/** id, outs, H, R, ER, BB, K, HR, pitches, decision ('W' | 'L' | 'S' | 'H' | '') */
export type PitRow = [PlayerId, number, number, number, number, number, number, number, number, string];

export interface StoredBox {
  id: string;
  date: string;
  home: TeamId;
  away: TeamId;
  innings: number;
  att?: number;
  /** Runs by inning: away, home. */
  line: [number[], number[]];
  /** Runs, hits, errors: away, home. */
  rhe: [[number, number, number], [number, number, number]];
  bat: [BatRow[], BatRow[]];
  pit: [PitRow[], PitRow[]];
}

const batRows = (b: TeamBox): BatRow[] => b.batting.map((l) => [l.id, l.pos, l.ab, l.r, l.h, l.rbi, l.hr, l.bb + l.hbp, l.k, l.d, l.t, l.sb]);
const pitRows = (b: TeamBox): PitRow[] =>
  b.pitching.map((l) => [l.id, l.outs, l.h, l.r, l.er, l.bb + l.hbp, l.k, l.hr, l.pitches, l.w ? 'W' : l.l ? 'L' : l.sv ? 'S' : l.hld ? 'H' : '']);

export function compactBox(out: GameOut, id: string, date: string, att?: number): StoredBox {
  return {
    id,
    date,
    home: out.home.teamId,
    away: out.away.teamId,
    innings: out.innings,
    ...(att ? { att } : {}),
    line: [out.away.lineScore, out.home.lineScore],
    rhe: [
      [out.away.runs, out.away.hits, out.away.errors],
      [out.home.runs, out.home.hits, out.home.errors],
    ],
    bat: [batRows(out.away), batRows(out.home)],
    pit: [pitRows(out.away), pitRows(out.home)],
  };
}

const KEEP_DAYS = 3;
const KEEP_LOGS = 10;

/** Keeps a finished game: the user's and postseason games all season, others for the last few game days. */
export function keepBox(s: LeagueState, box: StoredBox, log?: PlayEvent[]) {
  const boxes = (s.boxes ??= {});
  boxes[box.id] = box;
  const u = s.user?.teamId;
  const days = [...new Set(Object.values(boxes).map((b) => b.date))].sort().slice(-KEEP_DAYS);
  for (const [id, b] of Object.entries(boxes)) {
    const mine = u && (b.home === u || b.away === u);
    if (!mine && !id.includes('-wildcard-') && !id.includes('-semipo-') && !id.includes('-po-') && !id.includes('-ks-') && !days.includes(b.date)) delete boxes[id];
  }
  if (log) {
    const logs = (s.pbp ??= {});
    logs[box.id] = log;
    const ids = Object.keys(logs);
    for (const id of ids.slice(0, Math.max(0, ids.length - KEEP_LOGS))) delete logs[id];
  }
}

/** A game is the user's club's. */
export const isUserGame = (s: LeagueState, home: TeamId, away: TeamId) => !!s.user && (home === s.user.teamId || away === s.user.teamId);
