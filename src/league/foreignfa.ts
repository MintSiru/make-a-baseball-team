/* 2.0.74 (the user's request: 「장기 근속 외국인의 FA 선언」, a game option, off unless turned on). The KBO gives a
   foreign player no free agency: his club re-signs him or lets him go. With the option on, a foreign player (not one
   of the Asia quota or a development foreigner) who has served as long as a home-grown high-school player must — the
   FA seasons, as the board sets them — may declare when his deal ends, and goes on the winter's free-agent market
   with the others. Every club may bid, his own too, but only a club with a foreign place open for next season (its
   regular places less the foreign players it has under contract for it). He signs in won like any free agent, his
   pay counted in dollars against the foreign salary cap; no compensation is owed for him, and he does not count
   against a club's outside signings. Declared once, he may declare again after the seasons a free agent needs to
   qualify again. Unsigned at the end, his club does not take him back: he joins the market of KBO-experienced
   foreigners (or goes home). */
import type { Contract, Player, PlayerId, TeamId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { MANWON_PER_USD } from './contracts';
import { isDevForeign } from './devforeign';
import { foreignSlots } from './manager';
import { faSeasonsNeeded } from './offseason';
import { isForeign } from './players';
import { orgPlayers, type LeagueState } from './state';

/** The option is on. */
export const foreignFaOn = (s: LeagueState) => !!s.foreignFa;

/** A regular foreign player (not the Asia quota, not a development foreigner). */
export const regularForeign = (p: Player) => isForeign(p) && !p.origin.asiaQuota && !isDevForeign(p);

/** He may declare this winter: the option on, his deal over, and the service. */
export function isForeignFreeAgent(s: LeagueState, p: Player, next: number): boolean {
  if (!foreignFaOn(s) || !regularForeign(p) || p.status !== 'active' || !p.teamId) return false;
  if (p.contract && p.contract.salaries.some((x) => x.season >= next)) return false;
  const need = faSeasonsNeeded(p, next);
  if (need === Infinity) return false;
  const sv = p.service;
  return sv.lastFreeAgencyAt === undefined ? sv.creditedSeasons >= need : sv.creditedSeasons - sv.lastFreeAgencyAt >= KBO_2026.freeAgency.seasonsToRequalify;
}

/** The foreign places a club has open for `next` (its regular places less those under contract for it). */
export function foreignRoomAt(s: LeagueState, teamId: TeamId, next: number, except?: PlayerId): number {
  const signed = orgPlayers(s, teamId).filter((p) => p.id !== except && regularForeign(p) && p.contract?.salaries.some((x) => x.season >= next)).length;
  return foreignSlots(s, teamId, next).regular - signed;
}

/** His free-agent deal, as a foreign contract: each season's money also in dollars, for the foreign salary cap. */
export function asForeignDeal(c: Contract, o: { bonus: number; annual: number; options: number; years: number }): Contract {
  const usd = (manwon: number) => Math.round(manwon / MANWON_PER_USD / 1000) * 1000;
  return { ...c, kind: 'foreign', usd: { bonus: usd(o.bonus / o.years), salary: usd(o.annual), options: usd(o.options / o.years) } };
}
