/* Foreign players with KBO experience on the market (V0.7.3). A foreign player whose club lets him go —
   released or replaced during the season, or not re-signed in the winter — and who is not leaving for a
   bigger league stays on the list through two winters. Any club may sign him: as an in-season
   replacement, or in the winter. By the KBO rule a foreign player who signs again after his release
   counts as a new signing, so the new-player cap applies (100만 달러, 아시아쿼터 20만 달러; RULES.md §5).
   His price follows his scouting grade and what he did in the KBO.

   Only in a game with the player's club: the generated history keeps the old way (released foreigners
   leave the league), so the golden master does not change. */
import { hashUnit } from '../draftroom';
import type { Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { usdTotal } from './contracts';
import { leaveLeague, removeFromRoster } from './offseason';
import { ageIn, isPitcher } from './players';
import type { ForeignPoolEntry, LeagueState } from './state';

const POOL = {
  maxAge: 35,
  winters: 2,
  floorUSD: 250_000,
  asiaFloorUSD: 50_000,
  /** AI clubs sign a player from the list when he had a real KBO season, this often (game assumption:
      a few re-hires a winter, as in the KBO). */
  aiWar: 2,
  aiChance: 0.3,
};

/** His last first-team season in the KBO. */
export const kboRecord = (p: Player): SeasonRecord | undefined => p.career.filter((c) => !c.level).at(-1);

/** Puts a foreign player his club let go on the market. False when he does not qualify (too old, no
    club, or a league without the player's club); the caller then lets him leave the league. */
export function toForeignPool(s: LeagueState, p: Player, year: number): boolean {
  const from = p.teamId;
  if (!s.user || !from || ageIn(p, year + 1) > POOL.maxAge) return false;
  const usd = usdTotal(p.contract);
  removeFromRoster(s, p);
  p.teamId = null;
  p.contract = null;
  p.status = 'freeAgent';
  delete s.injuries[p.id];
  delete s.away?.[p.id];
  s.foreignPool = [...(s.foreignPool ?? []).filter((e) => e.id !== p.id), { id: p.id, since: year, from, usd }];
  return true;
}

/** Players on the market now (not signed by anyone since). */
export function foreignPoolPlayers(s: LeagueState): Player[] {
  return (s.foreignPool ?? [])
    .map((e) => s.players[e.id])
    .filter((p): p is Player => !!p && p.status === 'freeAgent' && !p.teamId)
    .sort((a, b) => b.scouting.current - a.scouting.current);
}

export const poolEntry = (s: LeagueState, id: PlayerId): ForeignPoolEntry | undefined => s.foreignPool?.find((e) => e.id === id);

/** What he asks for a full season (US dollars): his grade, scaled by what he did in the KBO (a flop is
    cheap, a proven starter asks near the cap), under the new-player cap. */
export function foreignPoolAsk(s: LeagueState, p: Player): number {
  const asia = !!p.origin.asiaQuota;
  const war = kboRecord(p)?.war ?? 0;
  const form = war >= 4 ? 1.3 : war >= 2.5 ? 1.15 : war >= 1 ? 0.95 : war >= 0 ? 0.75 : 0.55;
  const jitter = 0.95 + hashUnit(`${p.id}-pool-ask-${poolEntry(s, p.id)?.since ?? 0}`) * 0.1;
  const round = (n: number) => Math.round(n / 10_000) * 10_000;
  if (asia) return round(Math.max(POOL.asiaFloorUSD, Math.min(KBO_2026.foreign.asiaQuotaCapUSD, (90_000 + (p.scouting.current - 45) * 5_000) * form * jitter)));
  return round(Math.max(POOL.floorUSD, Math.min(KBO_2026.foreign.newContractCapUSD, (450_000 + (p.scouting.current - 50) * 45_000) * form * jitter)));
}

/** Takes a player off the market once a club signs him. */
export function leavePool(s: LeagueState, id: PlayerId) {
  if (s.foreignPool) s.foreignPool = s.foreignPool.filter((e) => e.id !== id);
}

/** The best player on the market for an AI club's open spot, if it would rather have him than a new
    face: a proven KBO season (WAR 2 or better). */
export function poolChoice(s: LeagueState, kind: 'pitcher' | 'hitter' | null, asia: boolean): Player | null {
  return foreignPoolPlayers(s).find((p) => !!p.origin.asiaQuota === asia && (kind === null || isPitcher(p) === (kind === 'pitcher')) && (kboRecord(p)?.war ?? 0) >= POOL.aiWar) ?? null;
}

/** An AI club's roll to sign from the list (its own stream, apart from the season's). */
export const aiTakesKnown = (key: string) => hashUnit(`${key}-pool`) < POOL.aiChance;

/** At the end of the winter's foreign signings: players who have waited two winters (or grown too old) go home. */
export function expireForeignPool(s: LeagueState, year: number) {
  if (!s.foreignPool) return;
  for (const e of s.foreignPool) {
    const p = s.players[e.id];
    if (!p || p.status !== 'freeAgent' || p.teamId) continue;
    if (year - e.since >= POOL.winters - 1 || ageIn(p, year + 1) > POOL.maxAge) leaveLeague(s, p, 'overseas');
  }
  s.foreignPool = s.foreignPool.filter((e) => s.players[e.id]?.status === 'freeAgent' && !s.players[e.id]!.teamId);
}

/** "KBO 2027 한화 · 12승 8패 ERA 3.85 · WAR 2.4": his last KBO season, for candidate lists. */
export function kboLine(s: LeagueState, p: Player): string {
  const c = kboRecord(p);
  const from = poolEntry(s, p.id)?.from;
  const club = (id: TeamId | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';
  if (!c) return `KBO 경력 · ${club(from)} (1군 기록 없음)`;
  const line = isPitcher(p)
    ? c.pit
      ? `${c.pit.w}승 ${c.pit.l}패 ERA ${(c.pit.outs ? (27 * c.pit.er) / c.pit.outs : 0).toFixed(2)}`
      : ''
    : c.bat
      ? `타율 ${(c.bat.ab ? c.bat.h / c.bat.ab : 0).toFixed(3).replace(/^0/, '')} ${c.bat.hr}홈런`
      : '';
  return `KBO ${c.year} ${club(c.teamId)} · ${line} · WAR ${c.war.toFixed(1)}`;
}
