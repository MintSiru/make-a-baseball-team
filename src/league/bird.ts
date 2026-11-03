import { k as __i18n_k } from '../i18n/index';
/* The Larry Bird rule (래리 버드 룰), a board rule in force from the start (the board or the general manager may drop it).
   2.0.69 brought it in the NBA's way (a club re-signing its own free agent went over the cap, the deal counting half).
   2.0.73 (the user's request: 「KBO판 래리버드룰」) makes it the KBO's own: every winter, once the free agents have
   signed and the salaries are set, each club names one player who has been on its books seven seasons or more (on
   the first team or the farm), and his pay counts half against next season's salary cap (the competitive balance
   tax). The name may be changed until spring camp ends; then it stands for the season. A player traded away counts
   in full at his new club, and his old one does not name another. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { capPay } from './contracts';
import { boardValue } from './era';
import { eok } from './fa';
import { isForeign } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';

export const BIRD = { seasons: 7, share: 0.5 };

/** The rule stands in `season` (on unless the board, or the general manager, took it away). */
export const birdRuleOn = (season?: number) => (boardValue('birdRule', season) ?? 1) === 1;

/** Seasons he has been on the club's books up to `through` (a first-team or a futures line that year). */
export function seasonsWith(p: Player, teamId: TeamId | null | undefined, through = Infinity): number {
  if (!teamId) return 0;
  return new Set(p.career.filter((c) => c.teamId === teamId && c.year <= through).map((c) => c.year)).size;
}

/** He may be named by his club for `season`: seven seasons or more with it, under contract for the season (a foreign
    player, outside the cap anyway, is not). */
export function birdEligible(s: LeagueState, p: Player, teamId: TeamId, season: number): boolean {
  if (p.teamId !== teamId || isForeign(p) || (p.status !== 'active' && p.status !== 'military')) return false;
  return seasonsWith(p, teamId, season - 1) >= BIRD.seasons && capPay(p, season) > 0;
}

/** A club's candidates for `season`, the highest pay first. */
export function birdCandidates(s: LeagueState, teamId: TeamId, season: number): Player[] {
  const soldiers = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military');
  return [...orgPlayers(s, teamId), ...soldiers].filter((p) => birdEligible(s, p, teamId, season)).sort((a, b) => capPay(b, season) - capPay(a, season) || a.id.localeCompare(b.id));
}

/** The player a club named for `season` (undefined when none). */
export const birdPick = (s: LeagueState, teamId: TeamId, season: number): PlayerId | undefined => s.birdPicks?.[season]?.[teamId];

/** The window to name or change the player for `season`: from the salaries set (after the free agents) to the end of
    spring camp. */
export function birdOpen(s: LeagueState, season: number): boolean {
  const o = s.offseason;
  return !!o && o.year + 1 === season && birdRuleOn(season) && !!s.birdPicks?.[season];
}

/** The season whose pick the screens show: next season's over the winter, this one otherwise. */
export const birdSeason = (s: LeagueState) => (s.offseason ? s.offseason.year + 1 : s.year);

/** He is his club's named player for the season the screens show. */
export const isBirdPick = (s: LeagueState, p: { id: PlayerId; teamId: TeamId | null }) => !!p.teamId && birdRuleOn(birdSeason(s)) && birdPick(s, p.teamId, birdSeason(s)) === p.id;

/** The share of his pay in `season` that counts against the salary cap. */
export function birdShare(s: LeagueState, p: Player, season: number): number {
  if (!p.teamId || !birdRuleOn(season)) return 1;
  return birdPick(s, p.teamId, season) === p.id ? BIRD.share : 1;
}

/** What naming him saves against the cap in `season`. */
export const birdSaving = (p: Player, season: number) => Math.round(capPay(p, season) * (1 - BIRD.share));

/** Every club names its player for `season` (the best saving), ours too as a first choice we may change. Run once the
    free agents have signed and the salaries are set. */
export function nameBirds(s: LeagueState, season: number) {
  if (!birdRuleOn(season)) return;
  const picks = ((s.birdPicks ??= {})[season] ??= {});
  for (const teamId of firstTeamIds(s, season)) {
    const best = birdCandidates(s, teamId, season)[0];
    if (best) picks[teamId] = best.id;
    else delete picks[teamId];
  }
  const me = s.user?.teamId;
  if (!me) return;
  const id = picks[me];
  const p = id ? s.players[id] : undefined;
  addAlert(s, {
    id: `bird-${season}`,
    date: `${season - 1}-12-15`,
    kind: 'fa',
    title: __i18n_k("league.bird.text.955b4cc0", { season }),
    lines: p
      ? [__i18n_k("league.bird.text.921b37b5", { name: p.name, n: seasonsWith(p, me, season - 1), saving: eok(birdSaving(p, season)) }), __i18n_k("league.bird.text.4e7a393c")]
      : [__i18n_k("league.bird.text.c81be5bd", { seasons: BIRD.seasons })],
    ...(p ? { players: [p.id] } : {}),
  });
}

/** Ours, changed while the window is open. */
export function setBirdPick(s: LeagueState, id: PlayerId | null) {
  const u = s.user;
  const o = s.offseason;
  if (!u || !o) return;
  const season = o.year + 1;
  if (!birdOpen(s, season)) return;
  const picks = s.birdPicks![season]!;
  if (id === null) {
    delete picks[u.teamId];
    return;
  }
  const p = s.players[id];
  if (p && birdEligible(s, p, u.teamId, season)) picks[u.teamId] = id;
}

/** Spring camp ends: a club whose player left it over the winter names another (ours too, when we named none). */
export function settleBirds(s: LeagueState, season: number) {
  if (!birdRuleOn(season)) return;
  const picks = ((s.birdPicks ??= {})[season] ??= {});
  for (const teamId of firstTeamIds(s, season)) {
    const id = picks[teamId];
    const p = id ? s.players[id] : undefined;
    if (p && birdEligible(s, p, teamId, season)) continue;
    const best = birdCandidates(s, teamId, season)[0];
    if (best) picks[teamId] = best.id;
    else delete picks[teamId];
  }
}

/** 2.0.73: a save from before — the old re-signing flag is gone; the season still to be settled gets its players. */
export function migrateBirds(s: LeagueState, renewStep: number) {
  for (const p of Object.values(s.players)) {
    const fa = p.contract?.fa as { bird?: true } | undefined;
    if (fa?.bird) delete fa.bird;
  }
  if (s.birdPicks) return;
  s.birdPicks = {};
  const o = s.offseason;
  if (!o) settleBirds(s, s.year);
  else if (o.step > renewStep) settleBirds(s, o.year + 1);
}
