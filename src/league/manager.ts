/* The AI manager of every club. Decisions use public scouting grades and this season's results only;
   the engine input it builds carries true ability, because the engine plays the actual players. */
import type { Player, PlayerId, TeamId } from '../model/types';
import type { Position } from '../model/position';
import { fitPenalty, positionGames } from './positions';
import type { BatterIn, BullpenRole, FieldPos, Hand, PitcherIn, RelieverIn, TeamIn } from './engine/types';
import { ageIn, batValue, currentValue, isForeign, isPitcher, keepValue, starterValue } from './players';
import { staffEdge, staffRating } from './staff';
import { hasBenefits, registeredIds, type LeagueState } from './state';
import { EXPANSION_DEFAULTS, KBO_2026 } from '../rules/kbo2026';
import { platoonFactor } from './pitches';
import { ENGINE, STAFF } from './tuning';

const STARTER_LIMIT = ENGINE.starterLimit;

const baseFirstTeam = (year: number) => (year >= 2026 ? KBO_2026.league.firstTeam.registered : 28);
/** First-team registration size; an expansion club gets one more spot during its benefit seasons. */
export const firstTeamSize = (s: LeagueState, teamId: TeamId, year = s.year) => baseFirstTeam(year) + (hasBenefits(s, teamId, year) ? EXPANSION_DEFAULTS.extraFirstTeamSpots : 0);
/** Foreign slots: three plus the Asia quota from 2026, and one more for an expansion club during its benefit seasons. */
export const foreignSlots = (s: LeagueState, teamId: TeamId, year = s.year) => ({
  regular: KBO_2026.foreign.regular + (hasBenefits(s, teamId, year) ? EXPANSION_DEFAULTS.extraForeignPlayers : 0),
  asia: year >= 2026 ? KBO_2026.foreign.asiaQuota : 0,
});

const handOf = (h: string): Hand => (h === '좌' ? 'L' : h === '양' ? 'S' : 'R');
const t = (p: Player, k: string) => (p.hidden.current as Record<string, number>)[k] ?? 30;
const pub = (p: Player, k: string) => (p.scouting.tools as Record<string, number>)[k] ?? 30;

export const available = (s: LeagueState, id: PlayerId) => !s.injuries[id] && !s.away?.[id];

type Prefer = (p: Player) => number;
const none: Prefer = () => 0;

/** Choose the first-team roster: 13–14 pitchers (5 starters), two catchers, the best of the rest. */
export function chooseActive(s: LeagueState, teamId: TeamId): PlayerId[] {
  const size = firstTeamSize(s, teamId);
  const pitchersWanted = size >= 29 ? 14 : 13;
  // Development players cannot be registered until they are converted (RULES.md §6).
  const pool = registeredIds(s, teamId)
    .map((id) => s.players[id]!)
    .filter((p) => available(s, p.id) && p.status === 'active');
  const perf = (p: Player) => performanceNudge(s, p);
  const val = (p: Player) => currentValue(p) * 0.8 + keepValue(p, s.year) * 0.2 + perf(p) + (isForeign(p) ? 30 : 0);
  const pitchers = pool.filter(isPitcher).sort((a, b) => val(b) - val(a));
  const hitters = pool.filter((p) => !isPitcher(p)).sort((a, b) => val(b) - val(a));
  const chosen: Player[] = [];
  const starters = [...pitchers].sort((a, b) => rotationScore(b, none) - rotationScore(a, none)).slice(0, 5);
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

const ADAPTING_PENALTY = 5;
const LINEUP_ORDER: Position[] = ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B'];

/** Fill the field positions, then the designated hitter, then set the batting order. */
/**
 * Platoon: against a left-hander (vs 'L') right-handed hitters get a small edge, and the other way round.
 * A player the general manager marked as a platoon half starts only against his side.
 */
export function platoonEdge(s: LeagueState, p: Player, vs: 'L' | 'R' | undefined): number {
  if (!vs) return 0;
  const half = p.teamId === s.user?.teamId ? s.user.platoon?.[p.id] : undefined;
  if (half) return half === vs ? ENGINE.platoonLineup.half : -ENGINE.platoonLineup.half;
  // Analytics sharpens the platoon picks.
  const edge = ENGINE.platoonLineup.edge * (1 + 0.5 * staffEdge(staffRating(s, p.teamId, 'analytics')));
  if (p.bats === '양') return edge / 2;
  const opposite = (p.bats === '좌') !== (vs === 'L');
  return opposite ? edge : -edge;
}

export function lineupFor(s: LeagueState, ids: PlayerId[], prefer: Prefer = none, pitchersBat = false, vs?: 'L' | 'R'): BatterIn[] {
  let hitters = ids.map((id) => s.players[id]!).filter((p) => !isPitcher(p) && available(s, p.id));
  if (pitchersBat && hitters.length < 9) {
    const spare = ids.map((id) => s.players[id]!).filter((p) => isPitcher(p) && available(s, p.id)).sort((a, b) => a.scouting.current - b.scouting.current);
    hitters = [...hitters, ...spare.slice(0, 9 - hitters.length)];
  }
  const used = new Set<PlayerId>();
  const slots: { p: Player; pos: FieldPos }[] = [];
  const gameCache = new Map<PlayerId, Partial<Record<FieldPos, number>>>();
  const games = (p: Player) => gameCache.get(p.id) ?? (gameCache.set(p.id, positionGames(s, p)), gameCache.get(p.id)!);
  // A better manager reads his hitters beyond the scouting report (STAFF.managerInsight at 80).
  const insight = STAFF.managerInsight * Math.max(0, (staffEdge(staffRating(s, hitters[0]?.teamId, 'manager')) + 1) / 2);
  const hitScore = (p: Player) =>
    batValue(p.scouting.tools) * (1 - insight) + batValue(p.hidden.current) * insight + performanceNudge(s, p) + (isForeign(p) ? 4 : 0) + prefer(p) + platoonEdge(s, p, vs);
  for (const pos of LINEUP_ORDER) {
    let best: Player | null = null,
      bestScore = -Infinity;
    for (const p of hitters) {
      if (used.has(p.id)) continue;
      const cost = fitPenalty(p, pos, games(p));
      const def = pub(p, 'defense') - cost;
      const weight = pos === 'C' || pos === 'SS' ? 0.8 : pos === 'CF' || pos === '2B' ? 0.55 : 0.3;
      const score = hitScore(p) + weight * (def - 45) - (cost >= 12 ? 40 : 0);
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
    // A player who changed position this spring is still learning it (spring camp plan).
    defense: t(p, 'defense') - fitPenalty(p, pos, games(p)) - (p.plan?.adaptingIn === s.year ? ADAPTING_PENALTY : 0),
    pos,
  }));
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function armIn(p: Player, pitchLimit: number): PitcherIn {
  return { id: p.id, throws: p.throws === '좌' ? 'L' : 'R', stuff: t(p, 'stuff'), command: t(p, 'command'), breaking: t(p, 'breaking'), stamina: t(p, 'stamina'), pitchLimit, platoon: platoonFactor(p) };
}

/** Pitchers set as starters come first: a reliever only starts when there are not five starters. */
const STARTER_ROLE_BONUS = 100;
const rotationScore = (p: Player, prefer: Prefer) => starterValue(p.scouting.tools) + (isForeign(p) ? 30 : 0) + (p.role === 'SP' ? STARTER_ROLE_BONUS : 0) + prefer(p);

/** The five-man rotation: starters (role SP) by public starter value; everyone else pitches from the bullpen. */
export function rotationFor(s: LeagueState, ids: PlayerId[], prefer: Prefer = none): Player[] {
  const pitchers = ids.map((id) => s.players[id]!).filter((p) => isPitcher(p));
  return pitchers.sort((a, b) => rotationScore(b, prefer) - rotationScore(a, prefer) || a.id.localeCompare(b.id)).slice(0, 5);
}

export function starterFor(s: LeagueState, key: string, date: string, rotation: Player[], hook = 0): { p: Player; limit: number } | null {
  if (!rotation.length) return null;
  const n = rotation.length;
  const start = s.rotation[key] ?? 0;
  let pick: Player | null = null,
    rest = 0;
  for (let i = 0; i < n; i++) {
    const p = rotation[(start + i) % n]!;
    const arm = s.arms[p.id];
    const days = arm ? daysBetween(arm.lastDate, date) : 99;
    if (available(s, p.id) && days >= 5) {
      pick = p;
      rest = days;
      s.rotation[key] = (start + i + 1) % n;
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
  const limit = Math.round(STARTER_LIMIT.base + (stamina - 50) * STARTER_LIMIT.perStamina - (rest < 5 ? 18 : 0) - (month <= 4 ? 5 : 0) + hook);
  return { p: pick, limit: Math.max(55, Math.min(118, limit)) };
}

export const PEN_ROLE_LABELS: Record<BullpenRole, string> = { CL: '마무리', SU: '셋업맨', HL: '필승조', MU: '추격조', LR: '롱릴리프', LO: '원 포인트' };
export const PEN_ROLES: BullpenRole[] = ['CL', 'SU', 'HL', 'MU', 'LR', 'LO'];

/**
 * The bullpen depth chart: the best reliever closes, the next sets up, two more hold leads (필승조), the
 * best remaining lefty with a same-side pitch faces lefties, the most durable arms go long and the rest
 * pitch when behind (추격조). The general manager's own assignments come first for the user's club.
 */
export function penRoles(s: LeagueState, teamId: TeamId, relievers: Player[], prefer: Prefer = none): Record<PlayerId, BullpenRole> {
  const own = teamId === s.user?.teamId ? (s.user.penRoles ?? {}) : {};
  const relief = (p: Player) => p.scouting.current + performanceNudge(s, p) + (p.role === 'RP' ? 2 : 0) + prefer(p);
  const out: Record<PlayerId, BullpenRole> = {};
  const free = relievers.filter((p) => {
    const set = own[p.id];
    if (set) out[p.id] = set;
    return !set;
  });
  const sorted = [...free].sort((a, b) => relief(b) - relief(a) || a.id.localeCompare(b.id));
  const taken = new Set(Object.values(out));
  const give = (role: BullpenRole, p: Player | undefined) => {
    if (!p) return;
    out[p.id] = role;
    sorted.splice(sorted.indexOf(p), 1);
  };
  if (!taken.has('CL')) give('CL', sorted[0]);
  if (!taken.has('SU')) give('SU', sorted[0]);
  const holds = Object.values(out).filter((r) => r === 'HL').length;
  for (let i = holds; i < 2; i++) give('HL', sorted[0]);
  if (!taken.has('LO') && sorted.length >= 3) give('LO', sorted.find((p) => p.throws === '좌' && platoonFactor(p) >= 1));
  if (!taken.has('LR')) give('LR', [...sorted].sort((a, b) => pub(b, 'stamina') - pub(a, 'stamina'))[0]);
  for (const p of sorted) out[p.id] = 'MU';
  return out;
}

/** Relievers who can pitch today, with their bullpen roles. */
export function bullpenFor(s: LeagueState, teamId: TeamId, ids: PlayerId[], date: string, exclude: Set<PlayerId>, prefer: Prefer = none): RelieverIn[] {
  const pen = ids.map((id) => s.players[id]!).filter((p) => isPitcher(p) && !exclude.has(p.id));
  const roles = penRoles(s, teamId, pen, prefer);
  const arms = pen.filter((p) => available(s, p.id));
  const rested = arms.filter((p) => {
    const a = s.arms[p.id];
    if (!a) return true;
    const days = daysBetween(a.lastDate, date);
    if (days <= 0) return false;
    if (days === 1 && (a.lastPitches >= 30 || a.streak >= 2)) return false;
    if (days <= 2 && a.lastPitches >= 50) return false;
    return true;
  });
  const relief = (p: Player) => p.scouting.current + performanceNudge(s, p) + (p.role === 'RP' ? 2 : 0) + prefer(p);
  const sorted = rested.sort((a, b) => relief(b) - relief(a));
  return sorted.map((p) => {
    const role = roles[p.id] ?? 'MU';
    return { ...armIn(p, role === 'LR' ? 55 : 30), role };
  });
}

/**
 * The engine input for one game. `ids` is the squad (the first team by default, or a futures squad);
 * `prefer` adds to every selection score (futures games favour prospects).
 */
export interface SquadSpec {
  teamId: TeamId;
  ids?: PlayerId[];
  rotationKey?: string;
  prefer?: Prefer;
}

/** Both clubs' engine inputs for one game: starters first, so each lineup can be set against the other starter. */
export function matchInputs(s: LeagueState, date: string, home: SquadSpec, away: SquadSpec): { home: TeamIn | null; away: TeamIn | null } {
  const plan = (x: SquadSpec) => {
    const ids = x.ids ?? s.rosters[x.teamId]!.active;
    const style = s.clubs?.[x.teamId]?.staff?.manager?.style;
    // A youth-minded manager gives young players a little more.
    const base = x.prefer ?? none;
    const prefer: Prefer = style === 'youth' ? (p) => base(p) + (ageIn(p, s.year) <= 25 ? 3 : 0) : base;
    const rotation = rotationFor(s, ids, prefer);
    const hook = style === 'quickHook' ? ENGINE.hook.quickHook : style === 'patient' ? ENGINE.hook.patient : 0;
    return { x, ids, prefer, rotation, style, sp: starterFor(s, x.rotationKey ?? x.teamId, date, rotation, hook) };
  };
  const h = plan(home),
    a = plan(away);
  const build = (me: typeof h, them: typeof h): TeamIn | null => {
    if (!me.sp) return null;
    const vs = them.sp ? (them.sp.p.throws === '좌' ? 'L' : 'R') : undefined;
    const lineup = lineupFor(s, me.ids, me.prefer, me.prefer !== none, vs);
    if (lineup.length < 9) return null;
    const exclude = new Set(me.rotation.map((p) => p.id));
    return {
      teamId: me.x.teamId,
      lineup,
      starter: armIn(me.sp.p, me.sp.limit),
      bullpen: bullpenFor(s, me.x.teamId, me.ids, date, exclude, me.prefer),
      fieldBonus: STAFF.fielding * staffEdge(staffRating(s, me.x.teamId, 'analytics')),
      ...(me.style === 'smallBall' ? { smallBall: true } : {}),
    };
  };
  return { home: build(h, a), away: build(a, h) };
}
