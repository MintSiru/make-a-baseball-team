/* The competitive balance tax (경쟁균형세, RULES.md §3): each club's top-40 pay after the season is
   measured against the cap. Over it: 30% of the excess the first season, 50% the second in a row,
   100% from the third plus the next draft's first-round pick nine places later. From 2027 there is a
   floor too; the game has a club under it pay the shortfall (game assumption). Only the user's club
   pays money (clubs' finances come in V0.6); the pick penalty applies to everyone. */
import type { TeamId } from '../model/types';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { salaryIn } from './contracts';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';

const C = KBO_2026.salaryCap;

export function capFloorFor(year: number): number | null {
  if (year < C.floor.from) return null;
  return Math.round(C.floor.amount * (1 + C.floor.growth) ** (year - C.floor.from));
}

/** A club's top-40 total for `year` (its players and soldiers under contract that season). */
export function capTotal(s: LeagueState, teamId: TeamId, year: number) {
  const soldiers = Object.values(s.players).filter((p) => p.teamId === teamId && p.status === 'military');
  const pay = [...orgPlayers(s, teamId), ...soldiers].map((p) => salaryIn(p, year)).sort((a, b) => b - a);
  return pay.slice(0, C.topPlayers).reduce((a, b) => a + b, 0);
}

export interface CapRecord {
  year: number;
  total: number;
  cap: number;
  over: number;
  /** Consecutive seasons over the cap, this one included. */
  streak: number;
  levy: number;
}

/** Measures every club after the season and applies the sanctions. */
export function settleCap(s: LeagueState, year: number) {
  if (year < C.from) return;
  const cap = salaryCapFor(year);
  const floor = capFloorFor(year);
  for (const teamId of firstTeamIds(s, year)) {
    const total = capTotal(s, teamId, year);
    const past = s.cap?.[teamId] ?? [];
    const prev = past.find((r) => r.year === year - 1);
    const over = Math.max(0, total - cap);
    const streak = over > 0 ? (prev && prev.over > 0 ? prev.streak + 1 : 1) : 0;
    let levy = over > 0 ? Math.round(over * C.levies[Math.min(streak, C.levies.length) - 1]!) : 0;
    const short = floor !== null ? Math.max(0, floor - total) : 0;
    levy += short;
    ((s.cap ??= {})[teamId] ??= []).push({ year, total, cap, over, streak, levy });
    if (streak >= C.pickDropFrom) ((s.pickDrop ??= {})[year + 1] ??= []).push(teamId);
    const u = s.user;
    if (u && teamId === u.teamId && levy > 0) {
      u.fund -= levy;
      u.ledger.push({ year, label: over > 0 ? `경쟁균형세 (상한 초과 ${streak}년째)` : '샐러리캡 하한 미달분', amount: -levy });
      (u.log ??= []).push({
        year,
        text: over > 0 ? `상위 40명 연봉이 상한을 넘어 경쟁균형세를 냈습니다${streak >= C.pickDropFrom ? ' (다음 드래프트 1라운드 9순위 하락)' : ''}` : '상위 40명 연봉이 하한에 못 미쳐 부족분을 냈습니다',
      });
    }
  }
}

/** A club's first-round pick drops nine places when it was over the cap three seasons running. */
export function applyPickDrop<T extends { teamId: TeamId }>(s: LeagueState, draftYear: number, slots: T[]): T[] {
  const drop = s.pickDrop?.[draftYear];
  if (!drop?.length) return slots;
  const out = [...slots];
  for (const teamId of drop) {
    const i = out.findIndex((x) => x.teamId === teamId);
    if (i < 0) continue;
    const [slot] = out.splice(i, 1);
    out.splice(Math.min(out.length, i + C.pickDrop), 0, slot!);
  }
  return out;
}
