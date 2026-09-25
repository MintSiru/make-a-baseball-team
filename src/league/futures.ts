/* The futures league (퓨처스리그) and the split of each club below the first team.

   From 2026 every club's futures squad plays, and so does 상무, fielded by the players serving there.
   The simulated history before 2026 has no futures games (it only builds the league), so growth then
   does not depend on playing time. Players who are neither on the first team nor in the futures squad
   are in the third squad (잔류군): injured players rehab there and the rest train (RULES.md §6). */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { futuresGamesFor } from '../rules/kbo2026';
import { ageIn, currentValue, futureValue, isPitcher, keepValue } from './players';
import { roundRobin, type ScheduledGame } from './schedule';
import { firstTeamIds, type FuturesSeason, type LeagueState } from './state';
import { FUTURES } from './tuning';

export const SANGMU = 'sangmu';
export const FUTURES_FROM = 2026;

/** A season's futures league: every club plus 상무, three-game series on the first team's game days. */
export function makeFuturesLeague(s: LeagueState): FuturesSeason | null {
  if (s.year < FUTURES_FROM) return null;
  const teams = [...s.teams.map((t) => t.id).filter((id) => s.rosters[id]), SANGMU];
  const r = rng(`${s.seed}|futures-schedule|${s.year}`);
  for (let i = teams.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [teams[i], teams[j]] = [teams[j]!, teams[i]!];
  }
  const target = futuresGamesFor(s.year);
  const dates = [...new Set(s.schedule.map((g) => g.date))];
  const rounds = roundRobin(teams.length);
  const played: Record<TeamId, number> = Object.fromEntries(teams.map((t) => [t, 0]));
  const schedule: ScheduledGame[] = [];
  for (let i = 0; 3 * i < dates.length; i++) {
    const round = rounds[i % rounds.length]!;
    const cycle = Math.floor(i / rounds.length);
    for (let day = 0; day < 3 && 3 * i + day < dates.length; day++) {
      const date = dates[3 * i + day]!;
      round.forEach(([a, b], k) => {
        const [x, y] = [teams[a]!, teams[b]!];
        if (played[x]! >= target || played[y]! >= target) return;
        played[x]!++;
        played[y]!++;
        const home = (cycle + k) % 2 === 0;
        schedule.push({ id: `${s.year}-F${String(schedule.length + 1).padStart(4, '0')}`, date, home: home ? x : y, away: home ? y : x });
      });
    }
  }
  return { teams, schedule, next: 0, scores: [], lines: {}, training: {} };
}

/** Who can play a futures game today for `teamId`. */
export function futuresSquad(s: LeagueState, teamId: TeamId): PlayerId[] {
  const healthy = (id: PlayerId) => s.players[id]?.status === 'active' && !s.injuries[id] && !s.away[id];
  if (teamId === SANGMU)
    return Object.values(s.players)
      .filter((p) => p.status === 'military' && p.service.route === 'sangmu' && !s.injuries[p.id])
      .map((p) => p.id);
  const r = s.rosters[teamId]!;
  // A club not yet in the first team plays everyone it has in the futures league.
  const ids = firstTeamIds(s).includes(teamId) ? r.futures : [...r.active, ...r.futures];
  return ids.filter(healthy);
}

/** In futures games clubs give playing time to prospects: young players with room to grow move up. */
export function futuresPreference(s: LeagueState): (p: Player) => number {
  return (p) => {
    const age = ageIn(p, s.year);
    return age <= FUTURES.youthAge ? Math.max(0, futureValue(p) - currentValue(p)) * FUTURES.youthWeight : 0;
  };
}

const priority = (s: LeagueState, p: Player) => keepValue(p, s.year) + futuresPreference(s)(p);

/**
 * The AI's split below the first team: injured players rehab in the third squad; of the healthy ones,
 * the club keeps a futures squad of about 16 pitchers and 16 hitters (three catchers) by playing
 * priority, and the rest train in the third squad.
 */
export function assignSquads(s: LeagueState, teamId: TeamId) {
  const r = s.rosters[teamId]!;
  const rest = [...r.futures, ...r.third].map((id) => s.players[id]!);
  const hurt = rest.filter((p) => s.injuries[p.id]);
  const healthy = rest.filter((p) => !s.injuries[p.id]).sort((a, b) => priority(s, b) - priority(s, a) || a.id.localeCompare(b.id));
  const pitchers = healthy.filter(isPitcher).slice(0, FUTURES.squad.pitchers);
  const catchers = healthy.filter((p) => p.position === 'C').slice(0, FUTURES.squad.catchers);
  const hitters = healthy.filter((p) => !isPitcher(p) && !catchers.includes(p)).slice(0, FUTURES.squad.hitters - catchers.length);
  const chosen = new Set([...pitchers, ...catchers, ...hitters].map((p) => p.id));
  r.futures = healthy.filter((p) => chosen.has(p.id)).map((p) => p.id);
  r.third = [...healthy.filter((p) => !chosen.has(p.id)), ...hurt].map((p) => p.id);
}
