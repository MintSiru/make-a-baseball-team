/* 2.0.4 (the 2.0 plan's fifth stage, the user's request): head-to-head records — a batter against each pitcher, and
   a club against each other club.

   The engine keeps each first-team plate appearance under its batter and pitcher (engine/game.ts TeamBox.vs: PA, AB,
   H, total bases, HR, BB+HBP, K); the season's pile up here and go into the all-time book when the season closes.
   The book is pruned as players leave the game, so it holds the meetings of men still playing (a save stays small).
   Clubs' head-to-head comes from the season's scores, and each season's is kept with the season's summary. */
import type { PlayerId, TeamId } from '../model/types';
import type { GameScore } from './standings';
import type { LeagueState } from './state';

/** PA, AB, H, total bases, HR, BB+HBP, K. */
export type Meeting = number[];

const add = (into: Meeting, x: Meeting) => {
  for (let i = 0; i < 7; i++) into[i] = (into[i] ?? 0) + (x[i] ?? 0);
  return into;
};

/** A game's meetings into this season's book. */
export function addMeetings(s: LeagueState, vs: Record<string, Meeting>) {
  const book = (s.matchups ??= {});
  for (const [key, x] of Object.entries(vs)) add((book[key] ??= [0, 0, 0, 0, 0, 0, 0]), x);
}

/** The season's book into the all-time one; the meetings of a man who has left the game are dropped. */
export function closeMeetings(s: LeagueState) {
  const all = (s.matchupsAll ??= {});
  for (const [key, x] of Object.entries(s.matchups ?? {})) add((all[key] ??= [0, 0, 0, 0, 0, 0, 0]), x);
  delete s.matchups;
  const playing = (id: string) => {
    const p = s.players[id];
    return !!p && p.status !== 'retired';
  };
  for (const key of Object.keys(all)) {
    const [b, p] = key.split('|') as [string, string];
    if (!playing(b) || !playing(p)) delete all[key];
  }
}

export interface MeetingRow {
  opponent: PlayerId;
  season: Meeting | null;
  career: Meeting;
}

/** A player's meetings, against pitchers (a hitter's) or hitters (a pitcher's), most plate appearances first. */
export function meetingsOf(s: LeagueState, id: PlayerId, asPitcher: boolean): MeetingRow[] {
  const rows = new Map<PlayerId, MeetingRow>();
  const take = (book: Record<string, Meeting> | undefined, season: boolean) => {
    for (const [key, x] of Object.entries(book ?? {})) {
      const [b, p] = key.split('|') as [string, string];
      const mine = asPitcher ? p : b;
      if (mine !== id) continue;
      const opp = asPitcher ? b : p;
      const row = rows.get(opp) ?? { opponent: opp, season: null, career: [0, 0, 0, 0, 0, 0, 0] };
      add(row.career, x);
      if (season) row.season = [...x];
      rows.set(opp, row);
    }
  };
  take(s.matchupsAll, false);
  take(s.matchups, true);
  return [...rows.values()].sort((a, b) => (b.career[0] ?? 0) - (a.career[0] ?? 0));
}

/** Rates of a meeting: average, on-base and slugging. */
export function meetingRates(m: Meeting) {
  const [pa = 0, ab = 0, h = 0, tb = 0, , bb = 0] = m;
  return { avg: ab ? h / ab : 0, obp: pa ? (h + bb) / pa : 0, slg: ab ? tb / ab : 0 };
}

/** Each club's wins, losses and ties against each other in these games. */
export type HeadToHead = Record<TeamId, Record<TeamId, [number, number, number]>>;

export function headToHead(games: GameScore[]): HeadToHead {
  const out: HeadToHead = {};
  const cell = (a: TeamId, b: TeamId) => ((out[a] ??= {})[b] ??= [0, 0, 0]);
  for (const g of games) {
    const h = cell(g.home, g.away),
      a = cell(g.away, g.home);
    if (g.hs > g.as) {
      h[0]++;
      a[1]++;
    } else if (g.hs < g.as) {
      h[1]++;
      a[0]++;
    } else {
      h[2]++;
      a[2]++;
    }
  }
  return out;
}

/** Every season's head-to-head added up (the seasons kept since 2.0.4) with this one's. */
export function headToHeadAll(s: LeagueState): HeadToHead {
  const out: HeadToHead = {};
  const fold = (x: HeadToHead | undefined) => {
    for (const [a, row] of Object.entries(x ?? {}))
      for (const [b, [w, l, t]] of Object.entries(row)) {
        const c = ((out[a] ??= {})[b] ??= [0, 0, 0]);
        c[0] += w;
        c[1] += l;
        c[2] += t;
      }
  };
  for (const h of s.history) fold(h.h2h);
  if (!s.history.some((h) => h.year === s.year)) fold(headToHead(s.scores));
  return out;
}
