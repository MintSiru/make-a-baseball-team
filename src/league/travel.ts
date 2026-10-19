/* 2.0.22 (the user's request): the road. A club that comes to a new city for a series plays its first game there
   tired by the trip: its hitters lose a little at the plate and its pitchers a little less, by the distance from the
   city of its last game (straight-line kilometres between the clubs' homes; an island adds its crossing: 울릉's
   ferry, 제주's flight). Seoul to Busan, about 325km, costs two grade points; the clubs of one city lose nothing.
   The regular season only; it can be turned off in the settings. */
import type { TeamId } from '../model/types';
import { cityById } from '../club/cities';
import type { BatterIn, TeamIn } from './engine/types';
import { clubIn } from './lineage';
import type { ScheduledGame } from './schedule';
import type { LeagueState } from './state';

export const TRAVEL = {
  /** Kilometres for one grade point, and the most a trip costs. */
  kmPerPoint: 150,
  max: 3,
  /** Pitchers lose this share of what the hitters lose. */
  pitchers: 0.5,
  /** An island's crossing, as kilometres more. */
  island: { 울릉: 300, 제주: 150 } as Record<string, number>,
};

/** The clubs' and candidate homes' places (latitude, longitude). */
const PLACES: Record<string, [number, number]> = {
  서울: [37.57, 126.98],
  인천: [37.46, 126.71],
  수원: [37.26, 127.03],
  부산: [35.18, 129.08],
  대구: [35.87, 128.6],
  광주: [35.16, 126.85],
  대전: [36.35, 127.38],
  창원: [35.23, 128.68],
  마산: [35.21, 128.57],
  울산: [35.54, 129.31],
  고양: [37.66, 126.83],
  청주: [36.64, 127.49],
  성남: [37.42, 127.13],
  전주: [35.82, 127.15],
  화성: [37.2, 126.83],
  천안: [36.81, 127.11],
  포항: [36.02, 129.34],
  제주: [33.5, 126.53],
  군산: [35.97, 126.74],
  춘천: [37.88, 127.73],
  용인: [37.24, 127.18],
  부천: [37.5, 126.78],
  평택: [36.99, 127.11],
  김해: [35.23, 128.89],
  세종: [36.48, 127.29],
  원주: [37.34, 127.92],
  진주: [35.18, 128.11],
  여수: [34.76, 127.66],
  경주: [35.86, 129.22],
  울릉: [37.48, 130.9],
  평양: [39.03, 125.75],
  함흥: [39.92, 127.54],
  청진: [41.8, 129.78],
  개성: [37.97, 126.55],
  남포: [38.74, 125.4],
  원산: [39.15, 127.44],
  신의주: [40.1, 124.4],
  사리원: [38.51, 125.76],
  성진: [40.67, 129.2],
};

/** A club's home city in `year`. */
export function homeCity(s: LeagueState, teamId: TeamId, year: number): string {
  if (teamId === s.user?.teamId) return cityById(s.user.settings.cityId)?.name ?? '';
  const era = clubIn(teamId, year);
  if (era?.city) return era.city;
  return (s.teams.find((t) => t.id === teamId)?.region ?? '').split('·')[0] ?? '';
}

/** Kilometres between two cities (0 when either place is unknown). */
export function kmBetween(a: string, b: string): number {
  if (a === b) return 0;
  const p = PLACES[a],
    q = PLACES[b];
  if (!p || !q) return 0;
  const rad = Math.PI / 180;
  const dLat = (q[0] - p[0]) * rad,
    dLon = (q[1] - p[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p[0] * rad) * Math.cos(q[0] * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h))) + (TRAVEL.island[a] ?? 0) + (TRAVEL.island[b] ?? 0);
}

/** For each game of the schedule: where each club played its game before (the host's id), once per schedule. */
const previous = new WeakMap<ScheduledGame[], Map<string, { home?: TeamId; away?: TeamId }>>();
function previousHosts(schedule: ScheduledGame[]) {
  let map = previous.get(schedule);
  if (map) return map;
  map = new Map();
  const last: Record<TeamId, TeamId> = {};
  for (const g of schedule) {
    map.set(g.id, { home: last[g.home], away: last[g.away] });
    last[g.home] = g.home;
    last[g.away] = g.home;
  }
  previous.set(schedule, map);
  return map;
}

/** The grade points each side loses to the trip into this game (regular season games only). */
export function travelCost(s: LeagueState, gameId: string, homeId: TeamId, awayId: TeamId): { home: number; away: number } {
  if (s.travelFatigue === false) return { home: 0, away: 0 };
  const before = previousHosts(s.schedule).get(gameId);
  if (!before) return { home: 0, away: 0 };
  const here = homeCity(s, homeId, s.year);
  const cost = (prevHost: TeamId | undefined) => {
    if (!prevHost || prevHost === homeId) return 0;
    const km = kmBetween(homeCity(s, prevHost, s.year), here);
    return Math.min(TRAVEL.max, Math.round((km / TRAVEL.kmPerPoint) * 10) / 10);
  };
  return { home: cost(before.home), away: cost(before.away) };
}

/** A side as tired as the trip made it. */
export function tired(team: TeamIn, points: number): TeamIn {
  if (!points) return team;
  const bat = <T extends BatterIn>(b: T): T => ({ ...b, contact: b.contact - points, power: b.power - points, eye: b.eye - points });
  const arm = <T extends TeamIn['starter']>(p: T): T => ({ ...p, stuff: p.stuff - points * TRAVEL.pitchers, command: p.command - points * TRAVEL.pitchers });
  return { ...team, lineup: team.lineup.map(bat), ...(team.bench ? { bench: team.bench.map(bat) } : {}), starter: arm(team.starter), bullpen: team.bullpen.map(arm) };
}
