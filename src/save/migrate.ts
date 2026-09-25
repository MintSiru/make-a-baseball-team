/* Carrying a snapshot from an older simulation version into this one. A save holds the whole league
   state, so an older game can go on under the current rules: fields added since are filled in, and
   everything simulated from here follows the new rules (the history already played stays as it was).
   Versions without a league snapshot (0.1) cannot be carried over. */
import { SIM_VERSION } from '../core/version';
import type { LeagueState } from '../league/state';
import { batsFor } from '../model/player';

/** Simulation versions whose snapshots this build can carry forward. */
export const MIGRATABLE = ['0.2', '0.3', '0.4', '0.4.1', '0.5'];

type Loose = Record<string, unknown>;

export function migrateState(raw: unknown, from: string): LeagueState {
  const s = raw as LeagueState & Loose;
  // 0.2 → 0.3: the user's club, decisions, the staged offseason and the futures year.
  s.user ??= null;
  s.pending ??= null;
  s.offseason ??= null;
  s.futures ??= null;
  // 0.3 → 0.4: the third squad, national-team absences, the futures league shape.
  for (const r of Object.values(s.rosters)) (r as unknown as Loose).third ??= [];
  s.away ??= {};
  if (s.futures) {
    const f = s.futures as unknown as Loose & { schedule: { home: string; away: string }[] };
    f.teams ??= [...new Set(f.schedule.flatMap((g) => [g.home, g.away]))];
    f.training ??= {};
  }
  // A draft in progress: bonuses were paid at the pick before 0.4, so no negotiation afterwards.
  const d = s.offseason?.draft as (Loose & { bonusDone?: boolean; userDevelopmentDone?: boolean }) | null | undefined;
  if (d && from !== SIM_VERSION && ['0.2', '0.3'].includes(from)) {
    d.bonusDone = true;
    d.userDevelopmentDone = true;
  }
  // 0.5 added the second draft after 'special' (step 7): later offseason steps move one on.
  if (s.offseason && ['0.2', '0.3', '0.4', '0.4.1'].includes(from) && s.offseason.step >= 8) s.offseason.step += 1;
  // 0.5.1 added posting before free agency (step 4).
  if (s.offseason && MIGRATABLE.includes(from) && s.offseason.step >= 4) s.offseason.step += 1;
  // 0.5.1: left-handed throwers bat left as in the league (좌투우타 became rare).
  for (const p of Object.values(s.players)) p.bats = batsFor(p.id, p.throws, p.bats);
  s.sim = SIM_VERSION;
  return s;
}
