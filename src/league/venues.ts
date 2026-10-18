/* 2.0.15 (the user's request): where he played — at home and on the road, and at each club's ballpark — and the
   park-adjusted rates (wRC+, ERA-, FIP-).

   Each first-team regular-season game adds his line to his season's venues (home or road, and the ballpark by its
   home club); at the season's close they join his career's. Only the counts a split needs are kept: a hitter's
   plate appearances, at-bats, hits, total bases, home runs, walks, hit-by-pitches, strikeouts and sacrifice flies;
   a pitcher's batters faced, outs, earned runs, hits, home runs, walks and strikeouts.

   A player's park factor is his home ballpark's half and a neutral park's half (he plays half his games away). */
import type { TeamId } from '../model/types';
import type { TeamBox } from './engine/types';
import { emptySplit, type Split } from './engine/types';
import { parkIn } from './lineage';
import type { LeagueState } from './state';

export interface VenuePit {
  bf: number;
  outs: number;
  er: number;
  h: number;
  hr: number;
  bb: number;
  k: number;
}
export interface VenueLine {
  bat?: Split;
  pit?: VenuePit;
}
export interface Venues {
  home: VenueLine;
  away: VenueLine;
  /** By the ballpark's home club. */
  parks: Record<TeamId, VenueLine>;
}

export const emptyVenues = (): Venues => ({ home: {}, away: {}, parks: {} });
const emptyPit = (): VenuePit => ({ bf: 0, outs: 0, er: 0, h: 0, hr: 0, bb: 0, k: 0 });

function addLine(into: VenueLine, from: VenueLine) {
  if (from.bat) {
    const b = (into.bat ??= emptySplit());
    for (const k of Object.keys(b) as (keyof Split)[]) b[k] += from.bat[k];
  }
  if (from.pit) {
    const p = (into.pit ??= emptyPit());
    for (const k of Object.keys(p) as (keyof VenuePit)[]) p[k] += from.pit[k];
  }
}

/** Adds one venue set into another (a season into a career). */
export function addVenues(into: Venues, from: Venues) {
  addLine(into.home, from.home);
  addLine(into.away, from.away);
  for (const [park, line] of Object.entries(from.parks)) addLine((into.parks[park] ??= {}), line);
}

/** One side's box score into its players' season venues (`home`: the side played at home; `park`: whose park). */
export function recordVenues(lines: LeagueState['lines'], box: TeamBox, home: boolean, park: TeamId) {
  const one = (id: string, x: VenueLine) => {
    const line = lines[id];
    if (!line) return;
    const v = (line.venues ??= emptyVenues());
    addLine(home ? v.home : v.away, x);
    addLine((v.parks[park] ??= {}), x);
  };
  for (const b of box.batting) {
    if (!b.pa) continue;
    one(b.id, { bat: { pa: b.pa, ab: b.ab, h: b.h, tb: b.h + b.d + 2 * b.t + 3 * b.hr, hr: b.hr, bb: b.bb, hbp: b.hbp, k: b.k, sf: b.sf } });
  }
  for (const p of box.pitching) one(p.id, { pit: { bf: p.bf, outs: p.outs, er: p.er, h: p.h, hr: p.hr, bb: p.bb, k: p.k } });
}

/** A club's ballpark factor in a season (a league that plays history: the park it had that year). */
export function parkFactorIn(s: LeagueState, teamId: TeamId, year: number): number {
  const then = s.historical ? parkIn(teamId, year) : null;
  return then?.factor ?? s.teams.find((t) => t.id === teamId)?.stadium.park ?? 1;
}

/** A player's park factor for a season with this club: half at home, half on the road (neutral). */
export const playerPark = (s: LeagueState, teamId: TeamId, year: number) => (parkFactorIn(s, teamId, year) + 1) / 2;

/** A ballpark's name for the splits (its home club's park). */
export const parkName = (s: LeagueState, teamId: TeamId) => s.teams.find((t) => t.id === teamId)?.stadium.name ?? teamId;
