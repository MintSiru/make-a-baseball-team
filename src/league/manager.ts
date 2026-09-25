/* The AI manager of every club. Decisions use public scouting grades and this season's results only;
   the engine input it builds carries true ability, because the engine plays the actual players. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { outOfPosition, type Position } from '../model/position';
import type { BatterIn, FieldPos, Hand, PitcherIn, RelieverIn, TeamIn } from './engine/types';
import { batValue, currentValue, isForeign, isPitcher, keepValue, starterValue } from './players';
import type { LeagueState } from './state';
import { KBO_2026 } from '../rules/kbo2026';
import { ENGINE } from './tuning';

const STARTER_LIMIT = ENGINE.starterLimit;

export const firstTeamSize = (year: number) => (year >= 2026 ? KBO_2026.league.firstTeam.registered : 28);
export const foreignSlots = (year: number) => ({ regular: KBO_2026.foreign.regular, asia: year >= 2026 ? KBO_2026.foreign.asiaQuota : 0 });

const handOf = (h: string): Hand => (h === '좌' ? 'L' : h === '양' ? 'S' : 'R');
const t = (p: Player, k: string) => (p.hidden.current as Record<string, number>)[k] ?? 30;
const pub = (p: Player, k: string) => (p.scouting.tools as Record<string, number>)[k] ?? 30;

export const available = (s: LeagueState, id: PlayerId) => !s.injuries[id];

/** Choose the first-team roster: 13–14 pitchers (5 starters), two catchers, the best of the rest. */
export function chooseActive(s: LeagueState, teamId: TeamId): PlayerId[] {
  const size = firstTeamSize(s.year);
  const pitchersWanted = size >= 29 ? 14 : 13;
  const pool = [...s.rosters[teamId]!.active, ...s.rosters[teamId]!.futures].map((id) => s.players[id]!).filter((p) => available(s, p.id) && p.status === 'active');
  const perf = (p: Player) => performanceNudge(s, p);
  const val = (p: Player) => currentValue(p) * 0.8 + keepValue(p, s.year) * 0.2 + perf(p) + (isForeign(p) ? 30 : 0);
  const pitchers = pool.filter(isPitcher).sort((a, b) => val(b) - val(a));
  const hitters = pool.filter((p) => !isPitcher(p)).sort((a, b) => val(b) - val(a));
  const chosen: Player[] = [];
  const starters = [...pitchers].sort((a, b) => starterValue(b.scouting.tools) + (isForeign(b) ? 30 : 0) - (starterValue(a.scouting.tools) + (isForeign(a) ? 30 : 0))).slice(0, 5);
  chosen.push(...starters);
  for (const p of pitchers) if (chosen.length < pitchersWanted && !chosen.includes(p)) chosen.push(p);
  const catchers = hitters.filter((p) => p.position === 'C').slice(0, 2);
  chosen.push(...catchers);
  for (const p of hitters) if (chosen.length < size && !chosen.includes(p)) chosen.push(p);
  return chosen.map((p) => p.id);
}

/** Early-season results nudge the manager: a hot or cold start moves a player up or down the depth chart. */
function performanceNudge(s: LeagueState, p: Player): number {
  const line = s.lines[p.id];
  if (!line) return 0;
  if (line.bat && line.bat.pa >= 60) {
    const b = line.bat;
    const o = (b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf) + (b.h + b.d + 2 * b.t + 3 * b.hr) / Math.max(1, b.ab);
    return Math.max(-6, Math.min(6, (o - 0.72) * 30));
  }
  if (line.pit && line.pit.outs >= 45) {
    const e = (27 * line.pit.er) / line.pit.outs;
    return Math.max(-6, Math.min(6, (4.4 - e) * 1.5));
  }
  return 0;
}

const LINEUP_ORDER: Position[] = ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B'];

/** Fill the field positions, then the designated hitter, then set the batting order. */
export function lineupFor(s: LeagueState, teamId: TeamId): BatterIn[] {
  const hitters = s.rosters[teamId]!.active.map((id) => s.players[id]!).filter((p) => !isPitcher(p) && available(s, p.id));
  const used = new Set<PlayerId>();
  const slots: { p: Player; pos: FieldPos }[] = [];
  const hitScore = (p: Player) => batValue(p.scouting.tools) + performanceNudge(s, p) + (isForeign(p) ? 4 : 0);
  for (const pos of LINEUP_ORDER) {
    let best: Player | null = null,
      bestScore = -Infinity;
    for (const p of hitters) {
      if (used.has(p.id)) continue;
      const def = pub(p, 'defense') - outOfPosition(p.position, pos);
      const weight = pos === 'C' || pos === 'SS' ? 0.8 : pos === 'CF' || pos === '2B' ? 0.55 : 0.3;
      const score = hitScore(p) + weight * (def - 45) - (outOfPosition(p.position, pos) >= 12 ? 40 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      slots.push({ p: best, pos });
    }
  }
  const dh = hitters.filter((p) => !used.has(p.id)).sort((a, b) => hitScore(b) - hitScore(a))[0];
  if (dh) slots.push({ p: dh, pos: 'DH' });
  // Batting order: on-base and speed at the top, power in the middle.
  const obpScore = (p: Player) => pub(p, 'contact') * 0.5 + pub(p, 'eye') * 0.4 + pub(p, 'speed') * 0.25;
  const powerScore = (p: Player) => pub(p, 'power') * 0.6 + pub(p, 'contact') * 0.4;
  const rest = [...slots];
  const take = (score: (p: Player) => number) => {
    rest.sort((a, b) => score(b.p) - score(a.p));
    return rest.shift();
  };
  const order = [take(obpScore), take(obpScore), take((p) => powerScore(p) + obpScore(p) * 0.5), take(powerScore), take(powerScore)];
  rest.sort((a, b) => hitScore(b.p) - hitScore(a.p));
  const final = [...order, ...rest].filter((x): x is { p: Player; pos: FieldPos } => !!x);
  return final.map(({ p, pos }) => ({
    id: p.id,
    bats: handOf(p.bats),
    contact: t(p, 'contact'),
    power: t(p, 'power'),
    eye: t(p, 'eye'),
    speed: t(p, 'speed'),
    defense: t(p, 'defense') - outOfPosition(p.position, pos),
    pos,
  }));
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function armIn(p: Player, pitchLimit: number): PitcherIn {
  return { id: p.id, throws: p.throws === '좌' ? 'L' : 'R', stuff: t(p, 'stuff'), command: t(p, 'command'), breaking: t(p, 'breaking'), stamina: t(p, 'stamina'), pitchLimit };
}

/** The five-man rotation in order of public starter value. */
export function rotationFor(s: LeagueState, teamId: TeamId): Player[] {
  const pitchers = s.rosters[teamId]!.active.map((id) => s.players[id]!).filter((p) => isPitcher(p));
  return pitchers
    .sort((a, b) => starterValue(b.scouting.tools) + (isForeign(b) ? 30 : 0) - (starterValue(a.scouting.tools) + (isForeign(a) ? 30 : 0)))
    .slice(0, 5);
}

export function starterFor(s: LeagueState, teamId: TeamId, date: string, rotation: Player[]): { p: Player; limit: number } | null {
  if (!rotation.length) return null;
  const n = rotation.length;
  const start = s.rotation[teamId] ?? 0;
  let pick: Player | null = null,
    rest = 0;
  for (let i = 0; i < n; i++) {
    const p = rotation[(start + i) % n]!;
    const arm = s.arms[p.id];
    const days = arm ? daysBetween(arm.lastDate, date) : 99;
    if (available(s, p.id) && days >= 5) {
      pick = p;
      rest = days;
      s.rotation[teamId] = (start + i + 1) % n;
      break;
    }
  }
  if (!pick) {
    // Everyone is short on rest: take the most rested healthy starter.
    const healthy = rotation.filter((p) => available(s, p.id));
    if (!healthy.length) return null;
    pick = healthy.sort((a, b) => (s.arms[a.id]?.lastDate ?? '').localeCompare(s.arms[b.id]?.lastDate ?? ''))[0]!;
    rest = s.arms[pick.id] ? daysBetween(s.arms[pick.id]!.lastDate, date) : 99;
  }
  const stamina = t(pick, 'stamina');
  const month = Number(date.slice(5, 7));
  const limit = Math.round(STARTER_LIMIT.base + (stamina - 50) * STARTER_LIMIT.perStamina - (rest < 5 ? 18 : 0) - (month <= 4 ? 5 : 0));
  return { p: pick, limit: Math.max(55, Math.min(118, limit)) };
}

/** Relievers who can pitch today, with roles: closer, two setup men, long men, the rest middle relief. */
export function bullpenFor(s: LeagueState, teamId: TeamId, date: string, exclude: Set<PlayerId>): RelieverIn[] {
  const arms = s.rosters[teamId]!.active.map((id) => s.players[id]!).filter((p) => isPitcher(p) && !exclude.has(p.id) && available(s, p.id));
  const rested = arms.filter((p) => {
    const a = s.arms[p.id];
    if (!a) return true;
    const days = daysBetween(a.lastDate, date);
    if (days <= 0) return false;
    if (days === 1 && (a.lastPitches >= 30 || a.streak >= 2)) return false;
    if (days <= 2 && a.lastPitches >= 50) return false;
    return true;
  });
  const relief = (p: Player) => p.scouting.current + performanceNudge(s, p) + (p.role === 'RP' ? 2 : 0);
  const sorted = rested.sort((a, b) => relief(b) - relief(a));
  const out: RelieverIn[] = [];
  const longMen = [...sorted].sort((a, b) => pub(b, 'stamina') - pub(a, 'stamina')).slice(0, 2);
  sorted.forEach((p, i) => {
    const role = i === 0 ? 'CL' : i <= 2 ? 'SU' : longMen.includes(p) ? 'LR' : 'MR';
    out.push({ ...armIn(p, role === 'LR' ? 55 : 30), role });
  });
  return out;
}

export function teamInput(s: LeagueState, teamId: TeamId, date: string): TeamIn | null {
  const rotation = rotationFor(s, teamId);
  const sp = starterFor(s, teamId, date, rotation);
  if (!sp) return null;
  const lineup = lineupFor(s, teamId);
  if (lineup.length < 9) return null;
  const exclude = new Set(rotation.map((p) => p.id));
  return { teamId, lineup, starter: armIn(sp.p, sp.limit), bullpen: bullpenFor(s, teamId, date, exclude) };
}
