import { k as __i18n_k } from '../i18n/index';
/* Fans and attendance (V0.6, RULES.md §13). Every club has a fan base (`popularity`: how many would
   come to an ordinary home game at the league's average price in 2025, before the ballpark fills) and
   a mood (`interest`, −0.6 to +0.8) that follows results, stars, home-grown players and marketing.
   A home game draws popularity × the league's boom for that year × mood × day × month × opponent ×
   price, capped by the seats. Calibrated to 2025: 17,103 a game, Samsung 23,101 (96% full) down to
   the smaller markets around 11,000. */
import { conditionCrowd } from './conditions';
import { internationalCrowd } from './international';
import { scenarioOf } from './scenarios';
import { playsHistory, ruleYear, startYear } from './era';
import { rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { cityById } from '../club/cities';
import { ageIn, isForeign } from './players';
import type { GameScore } from './standings';
import { firstTeamIds, orgPlayers, type ClubState, type LeagueState } from './state';
import { BALLPARK, FANS, FINANCE, PARENT, PLAYER_RIVALS, RIVAL } from './tuning';
import { isRivalry } from './twelve';
import { premiumShare, scoreboardDemand } from './facilities';

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
/** 1.9.6, a league that plays history: the per-game average of each season before 2015 against 2025's 17,101 (KBO
    yearly totals over the games played: 5,995 in 1982, 10,728 at the 1995 peak, 4,382 in 2004, 13,451 in 2012;
    RULES.md S110). Money stays in today's terms; the parents covered the gap, as they did. */
const HISTORIC_BOOM: Record<number, number> = {
  1982: 0.35, 1983: 0.44, 1984: 0.43, 1985: 0.38, 1986: 0.35, 1987: 0.39, 1988: 0.38, 1989: 0.4, 1990: 0.44, 1991: 0.46, 1992: 0.51, 1993: 0.52, 1994: 0.52, 1995: 0.63, 1996: 0.52, 1997: 0.45, 1998: 0.31,
  1999: 0.36, 2000: 0.28, 2001: 0.33, 2002: 0.26, 2003: 0.3, 2004: 0.26, 2005: 0.39, 2006: 0.35, 2007: 0.48, 2008: 0.61, 2009: 0.65, 2010: 0.65, 2011: 0.75, 2012: 0.79, 2013: 0.65, 2014: 0.66,
};
/** The league's attendance boom in `year`: a history game reads its own calendar (today's level from 2026). */
export const boom = (year: number) => (playsHistory() ? (HISTORIC_BOOM[year] ?? BOOM[year] ?? 1) : (BOOM[ruleYear(year)] ?? 1));

/** Average ticket price (만 원) for the league in `year`: 16,600원 in 2025 (2,046억 / 1,231만), +3% a year up to
    2026. After that the game keeps money in today's terms (V0.16): salaries never inflated, so rising prices
    alone made every club richer each year (docs/BALANCE.md). */
export const leaguePrice = (year: number) => FANS.price2025 * (1 + FANS.priceGrowth) ** (Math.min(ruleYear(year), FANS.priceUntil) - 2025);

export function initialClubState(s: LeagueState, teamId: TeamId): ClubState {
  const team = s.teams.find((t) => t.id === teamId)!;
  let popularity = POPULARITY[teamId];
  if (popularity == null) {
    // A new club: its city's market, a little more loyalty for a citizen-owned club.
    const north = s.unified?.clubs.find((c) => c.teamId === teamId);
    const city = s.user?.teamId === teamId ? cityById(s.user.settings.cityId) : s.twelve?.teamId === teamId ? cityById(s.twelve.cityId) : north ? cityById(north.cityId) : null;
    popularity = FANS.newClub.base + (city?.market ?? 50) * FANS.newClub.perMarket;
    if (team.parent.type === 'citizen') popularity *= 1.1;
  }
  const u = s.user?.teamId === teamId ? s.user : null;
  const sponsor =
    teamId === 'kiwoom'
      ? { name: __i18n_k("league.fans.sponsor.name.44ede046"), annual: 1_100_000, until: startYear() + 2 }
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
/** 2.0.36 (rivals.ts): whether rival players meet in this game (each club carries one of a rivalry). */
export function rivalsMeet(s: LeagueState, home: TeamId, away: TeamId): boolean {
  return (s.playerRivals?.list ?? []).some((x) => {
    const ta = s.players[x.a]?.teamId,
      tb = s.players[x.b]?.teamId;
    return (ta === home && tb === away) || (ta === away && tb === home);
  });
}

export function attendance(s: LeagueState, g: Pick<GameScore, 'id' | 'date' | 'home' | 'away'>): number {
  const home = clubState(s, g.home),
    away = clubState(s, g.away);
  const team = s.teams.find((t) => t.id === g.home)!;
  const { pct, games } = winPct(s, g.home);
  // This season's record counts more as it grows.
  const mood = home.interest + (pct - 0.5) * FANS.inSeasonWin * Math.min(1, games / 40);
  const r = rng(`${s.seed}|gate|${g.id}`);
  const day = DAY_FACTOR[new Date(`${g.date}T12:00:00Z`).getUTCDay()]!;
  // 2.0.25: a dome keeps the summer's rain and heat out (BALLPARK.domeGate, tuning.ts).
  const domed = s.teams.find((t) => t.id === g.home)?.stadium.size === 'dome';
  const month = domed ? Math.max(1, MONTH_FACTOR[Number(g.date.slice(5, 7))] ?? 1) * BALLPARK.domeGate : (MONTH_FACTOR[Number(g.date.slice(5, 7))] ?? 1);
  const visitors = 1 + ((away.popularity - FANS.averagePopularity) / FANS.averagePopularity) * FANS.visitorWeight;
  // The rivalry (V0.9) draws more.
  // 2.0.36: rival players meeting draw a few more (rivals.ts).
  const rivalry = (isRivalry(s, g.home, g.away) ? RIVAL.rivalry.gate : 1) * (rivalsMeet(s, g.home, g.away) ? PLAYER_RIVALS.crowd : 1);
  // The user's new scoreboard (V0.10).
  const venue = 1 + scoreboardDemand(s, g.home);
  // 1.6.0, scenario 불인기 종목: the whole league's crowds are down.
  const demand = home.popularity * boom(s.year) * (scenarioOf(s)?.crowd ?? 1) * conditionCrowd(s) * internationalCrowd(s.international ?? [], g.date) * Math.max(0.45, 1 + FANS.moodWeight * mood) * day * month * visitors * rivalry * venue * home.price ** -FANS.elasticity * (0.92 + r() * 0.16);
  // Season-ticket holders come whatever the record (V0.12, the user's club).
  const holders = g.home === s.user?.teamId && home.seasonTickets?.year === s.year ? home.seasonTickets.sold * FINANCE.seasonTickets.show : 0;
  return Math.round(Math.min(team.stadium.capacity, Math.max(demand, holders)));
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
  // Premium seats (V0.10, the user's club) earn more per fan; season-ticket holders paid at opening (V0.12).
  const c = clubState(s, home);
  const holders = home === s.user?.teamId && c.seasonTickets?.year === s.year ? Math.min(fans, Math.round(c.seasonTickets.sold * FINANCE.seasonTickets.show)) : 0;
  gate.revenue += Math.round((fans - holders) * leaguePrice(s.year) * c.price * (1 + premiumShare(s, home)));
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
    // In the postseason: the five seeds, or with two leagues the clubs that played a series (V0.9).
    const playoff = row && (s.postseason.length ? s.postseason.some((x) => x.high === teamId || x.low === teamId) : row.rank <= 5) ? FANS.playoff : 0;
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
