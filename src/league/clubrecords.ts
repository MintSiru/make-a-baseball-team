/* 2.0.5 (the 2.0 plan's sixth stage, the user's request): our club's all-time records on one page — its seasons year
   by year (the table, the postseason, the manager and the captain, the crowds), its career and single-season leaders
   (what a man did for this club only), its retired numbers and its men in the hall of fame.

   Each season's manager (every club's) and the user's captain are kept with the season's summary from 2.0.5; the
   seasons before show none. */
import { sameClub } from './clubnames';
import type { PlayerId, TeamId } from '../model/types';
import { retiredNumbersView } from './legacy';
import { roundName } from './postseason';
import { currentStandings } from './season';
import { sidesOf } from './twelve';
import type { LeagueState, SeasonSummary } from './state';
import { recordRoom } from './views';

/** The managers in charge at the season's end, and the user's captain. */
export function seasonStaff(s: LeagueState): NonNullable<SeasonSummary['staff']> {
  const out: NonNullable<SeasonSummary['staff']> = {};
  for (const t of s.teams) {
    const manager = s.clubs?.[t.id]?.staff?.manager?.name;
    const captain = s.user?.teamId === t.id ? (s.user.captains?.captain ?? undefined) : undefined;
    if (manager || captain) out[t.id] = { ...(manager ? { manager } : {}), ...(captain ? { captain } : {}) };
  }
  return out;
}

export interface ClubYear {
  year: number;
  /** Not finished yet (this season, from today's table). */
  current: boolean;
  rank: number;
  /** Clubs in his table (his league's when there were two). */
  of: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  /** 'champion', the round he went out in, or null (no postseason). */
  post: { won: boolean; round: string } | null;
  manager: string | null;
  captain: { id: PlayerId; name: string } | null;
  /** Average home crowd. */
  crowd: number | null;
}

function rankIn(h: Pick<SeasonSummary, 'table' | 'leagues'>, teamId: TeamId) {
  const side = h.leagues?.[teamId];
  const table = side ? h.table.filter((r) => h.leagues![r.teamId] === side) : h.table;
  return { rank: table.findIndex((r) => r.teamId === teamId) + 1, of: table.length };
}

/** The club's first-team seasons, the latest first. */
export function clubYears(s: LeagueState, teamId: TeamId): ClubYear[] {
  const crowd = (year: number) => {
    const r = s.clubs?.[teamId]?.reports.find((x) => x.year === year);
    return r?.homeGames ? Math.round(r.fans / r.homeGames) : null;
  };
  const out: ClubYear[] = [];
  for (const h of s.history) {
    const row = h.table.find((r) => r.teamId === teamId);
    if (!row) continue;
    const mine = h.series.filter((x) => x.high === teamId || x.low === teamId);
    const last = mine.at(-1);
    const staff = h.staff?.[teamId];
    const cap = staff?.captain;
    out.push({
      year: h.year,
      current: false,
      ...rankIn(h, teamId),
      w: row.w,
      l: row.l,
      t: row.t,
      pct: row.pct,
      post: last ? { won: h.champion === teamId, round: roundName(s, last.round) } : null,
      manager: staff?.manager ?? null,
      captain: cap ? { id: cap, name: s.players[cap]?.name ?? '?' } : null,
      crowd: crowd(h.year),
    });
  }
  // This season while it is being played.
  if (!s.history.some((h) => h.year === s.year) && s.scores.length) {
    const table = currentStandings(s);
    const row = table.find((r) => r.teamId === teamId);
    if (row) {
      const gate = s.gate?.[teamId];
      const cap = s.user?.teamId === teamId ? s.user.captains?.captain : null;
      out.push({
        year: s.year,
        current: true,
        ...rankIn({ table, leagues: sidesOf(s) }, teamId),
        w: row.w,
        l: row.l,
        t: row.t,
        pct: row.pct,
        post: null,
        manager: s.clubs?.[teamId]?.staff?.manager?.name ?? null,
        captain: cap ? { id: cap, name: s.players[cap]?.name ?? '?' } : null,
        crowd: gate?.games ? Math.round(gate.fans / gate.games) : null,
      });
    }
  }
  return out.reverse();
}

/** The club's whole page. */
export function clubRecords(s: LeagueState, teamId: TeamId) {
  const years = clubYears(s, teamId);
  const done = years.filter((y) => !y.current);
  const sum = (k: 'w' | 'l' | 't') => done.reduce((a, y) => a + y[k], 0);
  const w = sum('w'),
    l = sum('l'),
    t = sum('t');
  return {
    years,
    totals: {
      seasons: done.length,
      w,
      l,
      t,
      pct: w + l ? w / (w + l) : 0,
      titles: done.filter((y) => y.post?.won).length,
      postseasons: done.filter((y) => y.post).length,
      firsts: done.filter((y) => y.rank === 1).length,
    },
    room: recordRoom(s, teamId),
    retired: retiredNumbersView(s).filter((r) => r.teamId === teamId),
    // 2.0.55: those who played for the club as it is now (a merged club's old players are the old club's).
    hall: (s.hallOfFame ?? []).filter((h) => h.teams.includes(teamId) && (s.players[h.id]?.career ?? []).some((c) => !c.level && c.teamId === teamId && sameClub(s, teamId, c.year))),
  };
}
