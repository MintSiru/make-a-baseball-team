/* Salaries until the real market arrives in V0.5: rookie deals by draft slot, yearly raises from WAR,
   and free-agent contracts priced from recent WAR. Amounts in 만 원. Calibrated to the 2026 salary
   facts in docs/CALIBRATION.md §2 (average of non-rookie domestic players about 1억 7,500만 원). */
import type { Contract, Player, TeamId } from '../model/types';
import { minimumSalaryFor } from '../rules/kbo2026';
import { ageIn } from './players';
import { SALARY } from './tuning';

/** Won per US dollar, in 만 원 (1 USD ≈ 1,400 KRW; game assumption). */
export const MANWON_PER_USD = 0.14;

/** Signing bonus by overall pick (Draft Room's slot values: 1st pick 4.5억 down to 3,500만 in late rounds). */
export function slotBonus(overall: number, clubs: number): number {
  const round = Math.ceil(overall / clubs),
    i = (overall - 1) % clubs;
  if (round === 1) return 450 * 100 - 25 * 100 * i;
  if (round === 2) return 15000 - 300 * i;
  if (round === 3) return 11000 - 200 * i;
  const later = [8500, 7500, 6500, 5500, 5000, 4500, 4000, 3500];
  return later[Math.min(round - 4, later.length - 1)]!;
}

export function rookieContract(teamId: TeamId, season: number, bonus: number, development = false): Contract {
  return { teamId, kind: development ? 'development' : 'rookie', signedIn: season - 1, signingBonus: bonus, salaries: [{ season, amount: minimumSalaryFor(season) }] };
}

export const salaryIn = (p: Player, season: number) => p.contract?.salaries.find((x) => x.season === season)?.amount ?? 0;

const recentWar = (p: Player, n: number) => {
  const recs = p.career.filter((r) => !r.level).slice(-n);
  if (!recs.length) return 0;
  const weights = recs.map((_, i) => i + 1);
  return recs.reduce((s, r, i) => s + r.war * weights[i]!, 0) / weights.reduce((a, b) => a + b, 0);
};

/** Next season's salary for a player not under a multi-year deal. */
export function renewSalary(p: Player, season: number): number {
  const prev = salaryIn(p, season - 1) || minimumSalaryFor(season);
  const war = recentWar(p, 2);
  const target = minimumSalaryFor(season) + Math.max(0, war) ** 1.5 * SALARY.raisePerWar + Math.min(p.service.creditedSeasons, 8) * SALARY.perServiceYear;
  const next = prev * 0.45 + target * 0.55;
  const capped = Math.max(prev * 0.7, Math.min(prev * 2.8, next));
  return Math.max(minimumSalaryFor(season), Math.round(capped / 100) * 100);
}

/** A free-agent deal: yearly value from recent WAR, length from age. */
export function freeAgentContract(p: Player, teamId: TeamId, season: number): Contract {
  const war = Math.max(0, recentWar(p, 3));
  const age = ageIn(p, season);
  const years = age <= 31 ? 4 : age <= 33 ? 3 : age <= 35 ? 2 : 1;
  const yearly = Math.min(SALARY.freeAgentMax, Math.max(minimumSalaryFor(season) * 2, 4000 + war ** 1.5 * SALARY.freeAgentPerWar));
  const amount = Math.round(yearly / 1000) * 1000;
  return { teamId, kind: 'freeAgent', signedIn: season - 1, signingBonus: 0, salaries: Array.from({ length: years }, (_, i) => ({ season: season + i, amount })) };
}

/** Foreign contracts are one year; new signings are capped at 100만 달러, Asia quota at 20만 달러 (RULES.md §5). */
export function foreignContract(teamId: TeamId, season: number, usd: number, asia: boolean): Contract {
  const cap = asia ? 200_000 : 1_800_000;
  const amount = Math.round(Math.min(cap, usd) * MANWON_PER_USD);
  return { teamId, kind: asia ? 'asiaQuota' : 'foreign', signedIn: season - 1, signingBonus: 0, salaries: [{ season, amount }] };
}

/** Salary for a veteran who enters the league through the pre-history bootstrap (no earlier records). */
export function estimatedSalary(p: Player, season: number): number {
  const cur = p.scouting.current,
    seasons = p.service.creditedSeasons;
  const min = minimumSalaryFor(season);
  if (seasons >= 8 && cur >= 55) return Math.round((min + ((cur - 50) / 10) ** 2 * SALARY.veteranStar) / 1000) * 1000;
  return Math.round((min + Math.max(0, (cur - 44) / 10) ** 2 * 7000 * Math.min(1, seasons / 5)) / 100) * 100;
}
