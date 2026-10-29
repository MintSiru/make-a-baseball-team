/* 2.0.52 (the user's request): a club's season by its players — the best nine (the one who started most at each
   position), the starting rotation and the bullpen — for every season it played, this one included (its lines so far).
   Display only. 2.0.59 (the user's report: 6선발로 돌려도 5선발까지만 보임): a sixth starter too — this season with the
   six-man rotation on, or any season he started as a regular (15 games or more). */
import type { BatTotals, PitTotals, PlayerId, TeamId } from '../model/types';
import type { FieldPos } from './engine/types';
import { rotationSize } from './manager';
import type { LeagueState } from './state';

export const SQUAD_POSITIONS: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
/** How many starters and relievers the tables show; a sixth starter with this many starts or more. */
export const SQUAD = { rotation: 5, sixth: 15, bullpen: 8 };

export interface SquadLine {
  id: PlayerId;
  name: string;
  bat: BatTotals | null;
  pit: PitTotals | null;
  /** NaN for the season in progress (WAR comes when it is over). */
  war: number;
}
export interface SquadHitter extends SquadLine {
  pos: FieldPos;
  starts: number;
}
export type BullpenRole = 'closer' | 'setup' | 'relief';
export interface SquadPitcher extends SquadLine {
  role?: BullpenRole;
}

/** Every first-team line the club had in `year`: the archived seasons, and this season's lines while it is played. */
function linesOf(s: LeagueState, teamId: TeamId, year: number): SquadLine[] {
  const out: SquadLine[] = [];
  for (const p of Object.values(s.players)) {
    const c = p.career.find((x) => x.year === year && x.teamId === teamId && !x.level);
    if (c) {
      out.push({ id: p.id, name: p.name, bat: c.bat, pit: c.pit, war: c.war });
      continue;
    }
    if (year !== s.year || p.career.some((x) => x.year === year && !x.level)) continue;
    const l = s.lines[p.id];
    if (l && l.teamId === teamId && (l.bat || l.pit)) out.push({ id: p.id, name: p.name, bat: l.bat, pit: l.pit, war: NaN });
  }
  return out;
}

/** The seasons the club has lines for, latest first. */
export function squadYears(s: LeagueState, teamId: TeamId): number[] {
  const years = new Set<number>();
  for (const p of Object.values(s.players)) for (const c of p.career) if (c.teamId === teamId && !c.level) years.add(c.year);
  if (Object.values(s.lines).some((l) => l.teamId === teamId && (l.bat?.g || l.pit?.g))) years.add(s.year);
  return [...years].sort((a, b) => b - a);
}

/** The club's season by its players. */
export function clubSquad(s: LeagueState, teamId: TeamId, year: number) {
  const lines = linesOf(s, teamId, year);
  // The best nine: the most starts at a position take it first, one position a player.
  const starts = lines
    .flatMap((l) => SQUAD_POSITIONS.map((pos) => ({ l, pos, n: l.bat?.posG?.[pos] ?? 0 })))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || (b.l.bat?.pa ?? 0) - (a.l.bat?.pa ?? 0) || a.l.id.localeCompare(b.l.id));
  const nine = new Map<FieldPos, SquadHitter>();
  const taken = new Set<PlayerId>();
  for (const x of starts) {
    if (nine.has(x.pos) || taken.has(x.l.id)) continue;
    nine.set(x.pos, { ...x.l, pos: x.pos, starts: x.n });
    taken.add(x.l.id);
  }
  // The rotation: the most starts; the bullpen: the rest by relief games, the closer (most saves) and the setup men
  // (holds) first.
  const pitchers = lines.filter((l) => (l.pit?.g ?? 0) > 0);
  const starters = pitchers.filter((l) => l.pit!.gs > 0).sort((a, b) => b.pit!.gs - a.pit!.gs || b.pit!.outs - a.pit!.outs || a.id.localeCompare(b.id));
  const six = (year === s.year && rotationSize(s) >= 6) || (starters[SQUAD.rotation]?.pit!.gs ?? 0) >= SQUAD.sixth;
  const rotation: SquadPitcher[] = starters.slice(0, SQUAD.rotation + (six ? 1 : 0));
  const relief = (l: SquadLine) => l.pit!.g - l.pit!.gs;
  const pen = pitchers.filter((l) => !rotation.some((r) => r.id === l.id) && relief(l) > 0);
  const closer = [...pen].sort((a, b) => b.pit!.sv - a.pit!.sv || relief(b) - relief(a))[0];
  const hasCloser = !!closer && closer.pit!.sv > 0;
  const setup = pen
    .filter((l) => !(hasCloser && l.id === closer.id) && l.pit!.hld > 0)
    .sort((a, b) => b.pit!.hld - a.pit!.hld || relief(b) - relief(a))
    .slice(0, 3);
  const rest = pen.filter((l) => !(hasCloser && l.id === closer.id) && !setup.includes(l)).sort((a, b) => relief(b) - relief(a) || b.pit!.outs - a.pit!.outs);
  const bullpen: SquadPitcher[] = [
    ...(hasCloser ? [{ ...closer, role: 'closer' as const }] : []),
    ...setup.map((l) => ({ ...l, role: 'setup' as const })),
    ...rest.map((l) => ({ ...l, role: 'relief' as const })),
  ].slice(0, SQUAD.bullpen);
  return { year, current: lines.some((l) => !Number.isFinite(l.war)), nine: SQUAD_POSITIONS.map((pos) => nine.get(pos) ?? null), rotation, bullpen };
}
