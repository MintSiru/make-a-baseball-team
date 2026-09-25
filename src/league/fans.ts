/* Fans and attendance (V0.6, RULES.md §13). Every club has a fan base (`popularity`: how many would
   come to an ordinary home game at the league's average price in 2025, before the ballpark fills) and
   a mood (`interest`, −0.6 to +0.8) that follows results, stars, home-grown players and marketing.
   A home game draws popularity × the league's boom for that year × mood × day × month × opponent ×
   price, capped by the seats. Calibrated to 2025: 17,103 a game, Samsung 23,101 (96% full) down to
   the smaller markets around 11,000. */
import { rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { cityById } from '../club/cities';
import { ageIn, isForeign } from './players';
import type { GameScore } from './standings';
import { firstTeamIds, orgPlayers, type ClubState, type LeagueState } from './state';
import { FANS, PARENT } from './tuning';

/** Fan base per existing club (2025 demand at average price, game estimate from real attendance). */
const POPULARITY: Record<TeamId, number> = {
  samsung: 26_000,
  lg: 24_500,
  lotte: 23_500,
  doosan: 21_500,
  ssg: 18_500,
  hanwha: 20_500,
  kia: 17_500,
  kt: 14_000,
  kiwoom: 11_500,
  nc: 11_500,
};

/** League-wide attendance relative to 2025 (real per-game averages; 2020–21 treated as a normal year). */
const BOOM: Record<number, number> = {
  2015: 0.6, 2016: 0.68, 2017: 0.68, 2018: 0.66, 2019: 0.6, 2020: 0.6, 2021: 0.6, 2022: 0.55, 2023: 0.66, 2024: 0.87, 2025: 1,
};
export const boom = (year: number) => BOOM[year] ?? 1;

/** Average ticket price (만 원) for the league in `year`: 16,600원 in 2025 (2,046억 / 1,231만), +3% a year. */
export const leaguePrice = (year: number) => FANS.price2025 * (1 + FANS.priceGrowth) ** (year - 2025);

export function initialClubState(s: LeagueState, teamId: TeamId): ClubState {
  const team = s.teams.find((t) => t.id === teamId)!;
  let popularity = POPULARITY[teamId];
  if (popularity == null) {
    // A new club: its city's market, a little more loyalty for a citizen-owned club.
    const city = s.user?.teamId === teamId ? cityById(s.user.settings.cityId) : null;
    popularity = FANS.newClub.base + (city?.market ?? 50) * FANS.newClub.perMarket;
    if (team.parent.type === 'citizen') popularity *= 1.1;
  }
  const u = s.user?.teamId === teamId ? s.user : null;
  const sponsor =
    teamId === 'kiwoom'
      ? { name: '키움증권', annual: 1_100_000, until: 2028 }
      : u && team.parent.type === 'namingRights'
        ? { name: u.settings.parentName, annual: Math.round((PARENT.naming.base * (0.8 + (cityById(u.settings.cityId)?.market ?? 50) / 250)) / 1000) * 1000, until: u.firstTeamYear + 4 }
        : undefined;
  return {
    ...(sponsor ? { sponsor } : {}),
    popularity: Math.round(popularity),
    // A new club starts on a wave of curiosity.
    interest: team.kind === 'expansion' ? FANS.newClub.novelty : 0,
    price: 1,
    marketing: FANS.marketing.base,
    reports: [],
  };
}

export function clubState(s: LeagueState, teamId: TeamId): ClubState {
  const clubs = (s.clubs ??= {});
  return (clubs[teamId] ??= initialClubState(s, teamId));
}

const winPct = (s: LeagueState, teamId: TeamId) => {
  let w = 0,
    l = 0;
  for (const g of s.scores) {
    if (g.home !== teamId && g.away !== teamId) continue;
    const mine = g.home === teamId ? g.hs : g.as,
      theirs = g.home === teamId ? g.as : g.hs;
    if (mine > theirs) w++;
    else if (theirs > mine) l++;
  }
  return { pct: w + l ? w / (w + l) : 0.5, games: w + l };
};

const DAY_FACTOR = [1.3, 0.8, 0.82, 0.85, 0.95, 1.25, 1.35]; // Sunday … Saturday
const MONTH_FACTOR: Record<number, number> = { 3: 1.05, 4: 0.95, 5: 1.05, 6: 1.02, 7: 0.95, 8: 0.95, 9: 1.02, 10: 1.05 };

/** How many come to this regular-season game (the home club's ballpark). */
export function attendance(s: LeagueState, g: Pick<GameScore, 'id' | 'date' | 'home' | 'away'>): number {
  const home = clubState(s, g.home),
    away = clubState(s, g.away);
  const team = s.teams.find((t) => t.id === g.home)!;
  const { pct, games } = winPct(s, g.home);
  // This season's record counts more as it grows.
  const mood = home.interest + (pct - 0.5) * FANS.inSeasonWin * Math.min(1, games / 40);
  const r = rng(`${s.seed}|gate|${g.id}`);
  const day = DAY_FACTOR[new Date(`${g.date}T12:00:00Z`).getUTCDay()]!;
  const month = MONTH_FACTOR[Number(g.date.slice(5, 7))] ?? 1;
  const visitors = 1 + ((away.popularity - FANS.averagePopularity) / FANS.averagePopularity) * FANS.visitorWeight;
  const demand = home.popularity * boom(s.year) * Math.max(0.45, 1 + FANS.moodWeight * mood) * day * month * visitors * home.price ** -FANS.elasticity * (0.92 + r() * 0.16);
  return Math.round(Math.min(team.stadium.capacity, demand));
}

export interface GateLine {
  games: number;
  fans: number;
  sellouts: number;
  /** Ticket revenue (만 원). */
  revenue: number;
}

/** Records a home gate for the season totals. */
export function recordGate(s: LeagueState, home: TeamId, fans: number) {
  const gate = ((s.gate ??= {})[home] ??= { games: 0, fans: 0, sellouts: 0, revenue: 0 });
  const team = s.teams.find((t) => t.id === home)!;
  gate.games++;
  gate.fans += fans;
  if (fans >= team.stadium.capacity) gate.sellouts++;
  gate.revenue += Math.round(fans * leaguePrice(s.year) * clubState(s, home).price);
}

/** Players who make fans come: stars (last season's WAR) and home-grown favourites. */
function draw(s: LeagueState, teamId: TeamId, year: number) {
  const players = orgPlayers(s, teamId);
  const war = (p: Player) => p.career.find((c) => c.year === year && !c.level)?.war ?? 0;
  const stars = players.filter((p) => war(p) >= FANS.starWar).length;
  const homeGrown = players.filter((p) => !isForeign(p) && p.origin.draftYear && war(p) >= 1.5 && p.career.every((c) => c.teamId === teamId)).length;
  const young = players.filter((p) => ageIn(p, year) <= 24 && war(p) >= 2).length;
  return stars * FANS.perStar + homeGrown * FANS.perHomeGrown + young * FANS.perYoungStar;
}

/**
 * After the season: the mood moves toward what the year gave (record, postseason, stars, marketing),
 * the fan base grows or shrinks a little with it, and AI clubs reprice tickets from how full they were.
 */
export function seasonFans(s: LeagueState, year: number, table: { teamId: TeamId; pct: number; rank: number }[], champion: TeamId | null) {
  const ids = firstTeamIds(s, year);
  // What the year gave each club, measured against the league: the average club's mood stays put
  // (league-wide swings are the boom, not the clubs).
  const pull = ids.map((teamId) => {
    const row = table.find((x) => x.teamId === teamId);
    const playoff = row && row.rank <= 5 ? FANS.playoff : 0;
    const title = champion === teamId ? FANS.champion : 0;
    return ((row?.pct ?? 0.5) - 0.5) * FANS.seasonWin + playoff + title + draw(s, teamId, year);
  });
  const mean = pull.reduce((a, b) => a + b, 0) / Math.max(1, pull.length);
  ids.forEach((teamId, i) => {
    const c = clubState(s, teamId);
    const team = s.teams.find((t) => t.id === teamId)!;
    const marketing = ((c.marketing - FANS.marketing.base) / FANS.marketing.base) * FANS.marketing.effect;
    const target = pull[i]! - mean + marketing;
    c.interest = Math.max(FANS.interestMin, Math.min(FANS.interestMax, c.interest * FANS.memory + target));
    c.popularity = Math.round(Math.max(FANS.popularityMin, c.popularity * (1 + c.interest * FANS.growth)));
    // AI clubs: full ballparks raise prices, empty ones cut them.
    if (teamId !== s.user?.teamId) {
      const gate = s.gate?.[teamId];
      if (gate?.games) {
        const fill = gate.fans / gate.games / team.stadium.capacity;
        if (fill > 0.9) c.price = Math.min(FANS.priceMax, Math.round((c.price + 0.05) * 100) / 100);
        else if (fill < 0.55) c.price = Math.max(FANS.priceMin, Math.round((c.price - 0.05) * 100) / 100);
      }
    }
  });
}
