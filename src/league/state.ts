/* League state: everything the season loop reads and writes. Plain JSON, so a snapshot is just
   JSON.stringify(state). All randomness is derived from `seed` plus a purpose string. */
import type { BatTotals, PitTotals, Player, PlayerId, Team, TeamId } from '../model/types';
import type { ScheduledGame } from './schedule';
import type { GameScore, StandingRow } from './standings';

export type LeaguePhase = 'regular' | 'postseason' | 'offseason';

export interface ClubRoster {
  /** First-team (1군) registered players. */
  active: PlayerId[];
  /** Everyone else under contract who is not serving (퓨처스·육성). */
  futures: PlayerId[];
}

export interface ArmState {
  lastDate: string;
  lastPitches: number;
  /** Consecutive days pitched ending at lastDate. */
  streak: number;
}

export interface Injury {
  until: string; // back on this date
  days: number;
  /** On the injured list: registered days keep counting (RULES.md §7). */
  onList: boolean;
}

export interface SeasonLine {
  teamId: TeamId;
  days: number;
  /** Days lost to injury. */
  lost: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
}

export interface SeriesResult {
  round: 'wildcard' | 'semipo' | 'po' | 'ks';
  high: TeamId;
  low: TeamId;
  highWins: number;
  lowWins: number;
  winner: TeamId;
  games: GameScore[];
}

export interface SeasonSummary {
  year: number;
  table: StandingRow[];
  series: SeriesResult[];
  champion: TeamId | null;
  /** League totals for the balance checks and the record room. */
  totals: { bat: BatTotals; pit: PitTotals; games: number };
}

export interface LeagueState {
  sim: string;
  seed: string;
  year: number;
  phase: LeaguePhase;
  teams: Team[];
  players: Record<PlayerId, Player>;
  rosters: Record<TeamId, ClubRoster>;
  schedule: ScheduledGame[];
  /** Index of the next unplayed game in `schedule` (sorted by date). */
  next: number;
  scores: GameScore[];
  lines: Record<PlayerId, SeasonLine>;
  arms: Record<PlayerId, ArmState>;
  rotation: Record<TeamId, number>;
  injuries: Record<PlayerId, Injury>;
  /** Last date registered days were counted for. */
  countedThrough: string | null;
  postseason: SeriesResult[];
  history: SeasonSummary[];
  international: { year: number; name: string; medal: boolean; squad: PlayerId[] }[];
}

export const emptyBat = (): BatTotals => ({ g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, rbi: 0, sb: 0, cs: 0, sf: 0, sh: 0, gdp: 0 });
export const emptyPit = (): PitTotals => ({ g: 0, gs: 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, r: 0, er: 0, w: 0, l: 0, sv: 0, hld: 0, qs: 0, pitches: 0 });

export function addInto<T extends object>(into: T, from: Partial<T>): T {
  const acc = into as Record<string, number>;
  for (const [k, v] of Object.entries(from)) if (typeof v === 'number' && k in into) acc[k] = (acc[k] ?? 0) + v;
  return into;
}
