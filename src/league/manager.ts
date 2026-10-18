import { rulesFor } from '../rules/history';
import { asOther } from './twoway';
import { fieldingOf } from './fielding';
import { battingProfile } from './battedball';
import { k as __i18n_k } from '../i18n/index';
/* The AI manager of every club. Decisions use public scouting grades and this season's results only;
   the engine input it builds carries true ability, because the engine plays the actual players. */
import type { Player, PlayerId, TeamId } from '../model/types';
import type { Position } from '../model/position';
import { fitPenalty, positionGames } from './positions';
import { offRoster, sidelined } from './injuries';
import type { BatterIn, BenchIn, BullpenRole, FieldPos, Hand, PitcherIn, RelieverIn, TeamIn } from './engine/types';
import { hashUnit } from '../draftroom';
import { ageIn, batValue, currentValue, isForeign, isPitcher, keepValue, starterValue } from './players';
import { staffEdge, staffRating } from './staff';
import { hasBenefits, registeredIds, type LeagueState, type LineupSlot, type ManagerStyle } from './state';
import { EXPANSION_DEFAULTS, KBO_2026 } from '../rules/kbo2026';
import { pitchingLift, platoonFactor } from './pitches';
import { ENGINE, STAFF } from './tuning';
import { formOf } from './life';
import { adaptPenalty } from './adapt';
import { bigGameEdge } from './traits';
import { inWard, WARD } from './ward';
import { isKyopo, kyopoLimit } from './kyopo';
import { eraUsage, type EraUsage } from '../rules/history';

const STARTER_LIMIT = ENGINE.starterLimit;

// 1.9.4: from the year-by-year rules (rules/history.ts), the same 28 before 2026 and 29 from it for the game's years.
const baseFirstTeam = (year: number) => rulesFor(year).firstTeam.registered;
/** First-team registration size; an expansion club gets one more spot during its benefit seasons. */
export const firstTeamSize = (s: LeagueState, teamId: TeamId, year = s.year) => baseFirstTeam(year) + (hasBenefits(s, teamId, year) ? EXPANSION_DEFAULTS.extraFirstTeamSpots : 0);
/** Foreign slots: three plus the Asia quota from 2026, and one more for an expansion club during its benefit seasons. */
export const foreignSlots = (s: LeagueState, teamId: TeamId, year = s.year) => ({
  // 1.9.5: as many as the year's rules allow (none before 1998 in a league that plays history), one more for a new club.
  regular: rulesFor(year).foreign.hold + (rulesFor(year).foreign.hold && hasBenefits(s, teamId, year) ? EXPANSION_DEFAULTS.extraForeignPlayers : 0),
  asia: rulesFor(year).foreign.asia,
});

const handOf = (h: string): Hand => (h === '좌' ? 'L' : h === '양' ? 'S' : 'R');
const t = (p: Player, k: string) => (p.hidden.current as Record<string, number>)[k] ?? 30;

/** 2.0.3: range, hands and arm at a position, `off` lower for playing away from his own; a catcher's game-calling. */
function fieldParts(p: Player, off: number, pos: FieldPos) {
  const f = fieldingOf(p);
  return { range: f.range - off, hands: f.hands - off, arm: f.arm - off, ...(pos === 'C' && f.lead !== null ? { lead: f.lead } : {}), ...(pos === 'C' && f.frame !== null ? { frame: f.frame } : {}) };
}
const pub = (p: Player, k: string) => (p.scouting.tools as Record<string, number>)[k] ?? 30;

/** Can play today: not hurt (a knock included) and not with the national team. */
export const available = (s: LeagueState, id: PlayerId) => !sidelined(s, id);

type Prefer = (p: Player) => number;
const none: Prefer = () => 0;

/** Choose the first-team roster: 13–14 pitchers (5 starters), two catchers, the best of the rest. */
export function chooseActive(s: LeagueState, teamId: TeamId, opts?: { size?: number; pitchers?: number; from?: PlayerId[] }): PlayerId[] {
  const size = opts?.size ?? firstTeamSize(s, teamId);
  const pitchersWanted = opts?.pitchers ?? (size >= 29 ? 14 : 13);
  // Development players cannot be registered until they are converted (RULES.md §6). 1.9.0: a postseason entry
  // chooses from the players eligible for it (`from`, postentry.ts).
  const perf = (p: Player) => performanceNudge(s, p);
  const val = (p: Player) => currentValue(p) * 0.8 + keepValue(p, s.year) * 0.2 + perf(p) + (isForeign(p) ? 30 : 0);
  // 1.9.6: at most so many overseas Korean players on the first team (kyopo.ts), the best of them.
  const limit = kyopoLimit(s.year);
  const kyopo = new Set(
    limit === null
      ? []
      : (opts?.from ?? registeredIds(s, teamId))
          .map((id) => s.players[id]!)
          .filter(isKyopo)
          .sort((a, b) => val(b) - val(a))
          .slice(limit)
          .map((p) => p.id),
  );
  const pool = (opts?.from ?? registeredIds(s, teamId))
    .map((id) => s.players[id]!)
    .filter((p) => !offRoster(s, p.id) && p.status === 'active' && !kyopo.has(p.id));
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

// ── The lineup (V0.7.6) ──────────────────────────────────────────────────────────────────────────

/** How much a position's fielding counts in choosing who plays there: the middle of the field most. */
const DEF_WEIGHT: Record<Position, number> = { C: 0.6, SS: 0.55, CF: 0.4, '2B': 0.4, '3B': 0.25, RF: 0.2, LF: 0.15, '1B': 0.1 };
const SLOTS: FieldPos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
/** A position he cannot really play (the gap is 12 grade points or more). */
const MISFIT = 40;
/** Rest days in the regular season, in calendar days: the starting catcher sits one day in six (about one
    game in five or six; KBO starting catchers start 110–125 games), hitters from 34 one day in thirteen.
    The cycles share no factor with the week, so a rest day does not keep falling on the Monday off day. */
const REST = { catcher: 6, veteran: 13, veteranAge: 34 };

/**
 * Best assignment of players to lineup slots (Hungarian algorithm): `value[slot][player]`, each slot
 * gets a different player. Returns the player index for each slot, or -1.
 */
export function assign(value: number[][]): number[] {
  const n = value.length;
  const m = value[0]?.length ?? 0;
  if (m < n) {
    // Not enough players: pad with empty chairs nobody wants.
    return assign(value.map((row) => [...row, ...Array.from({ length: n - m }, () => -1e6)])).map((j) => (j >= m ? -1 : j));
  }
  const INF = 1e18;
  const u = new Array<number>(n + 1).fill(0),
    v = new Array<number>(m + 1).fill(0),
    p = new Array<number>(m + 1).fill(0),
    way = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(INF);
    const used = new Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF,
        j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = -value[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else minv[j]! -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }
  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j]! - 1] = j - 1;
  return out;
}

/** Whether he gets the day off: regulars rest now and then in the season (never two catchers at once). */
function restsToday(s: LeagueState, p: Player, date: string): boolean {
  const opening = s.schedule[0]?.date;
  if (!opening || date < opening) return false;
  const day = Math.round((Date.parse(date) - Date.parse(opening)) / 86400000);
  const every = p.position === 'C' ? REST.catcher : ageIn(p, s.year) >= REST.veteranAge ? REST.veteran : 0;
  if (!every) return false;
  return (day + Math.floor(hashUnit(`${p.id}-rest`) * every)) % every === 0;
}

export interface LineupOptions {
  /** A regular-season game on this date: regulars may get the day off. */
  date?: string;
  /** The manager's style: a small-ball manager sets a traditional order (table-setters, then power). */
  style?: string;
  /** The general manager's fixed spots (V0.8): index = batting order; a player who cannot play today is left to the manager.
      1.7.0: a spot without a position fixes the order only. */
  card?: (LineupSlot | null)[];
  /** 1.7.0: players fixed at a position only; the manager picks where they bat. */
  places?: { id: PlayerId; pos: FieldPos }[];
  /** Fixed players still get the manager's days off. */
  cardRest?: boolean;
}

/**
 * The manager's lineup: the nine players and positions worth the most together (hitting, plus fielding
 * weighted by position; the designated hitter only hits), then the batting order. The order follows
 * run-value studies: the three best hitters bat 1st, 2nd and 4th (the one who gets on base most leads
 * off, the most power bats 4th), the next two 3rd and 5th, the rest by quality. A small-ball manager
 * keeps the traditional order instead: on-base and speed at the top, power in the middle.
 */
/** A player whose spot in the order is fixed is in the lineup whatever his fit (1.7.0). */
const MUST_PLAY = 10_000;

export function lineupFor(s: LeagueState, ids: PlayerId[], prefer: Prefer = none, pitchersBat = false, vs?: 'L' | 'R', opts: LineupOptions = {}): BatterIn[] {
  // 2.0.12: a two-way pitcher bats too (his bat in place of his arm, twoway.ts).
  let hitters = ids
    .map((id) => s.players[id]!)
    .map((p) => (isPitcher(p) && p.twoWay ? asOther(p) : p))
    .filter((p) => !isPitcher(p) && available(s, p.id));
  const byId = new Map(hitters.map((p) => [p.id, p]));
  // The general manager's fixed spots, for the players who can play (and play once, at one position each). 1.7.0: a
  // spot may fix the order only (no position), and a player may be fixed at a position only (`places`).
  const fixed = new Map<number, LineupSlot>();
  const placed = new Map<PlayerId, FieldPos>();
  if (opts.card || opts.places) {
    const seen = new Set<string>();
    (opts.card ?? []).forEach((slot, i) => {
      if (!slot || i > 8 || seen.has(slot.id) || (slot.pos && seen.has(`@${slot.pos}`)) || !hitters.some((p) => p.id === slot.id)) return;
      seen.add(slot.id);
      if (slot.pos) seen.add(`@${slot.pos}`), placed.set(slot.id, slot.pos);
      fixed.set(i, slot);
    });
    const players = new Set([...fixed.values()].map((x) => x.id));
    for (const x of opts.places ?? []) {
      if (seen.has(x.id) || seen.has(`@${x.pos}`) || !hitters.some((p) => p.id === x.id) || players.size >= 9) continue;
      seen.add(x.id).add(`@${x.pos}`);
      players.add(x.id);
      placed.set(x.id, x.pos);
    }
  }
  const fixedIds = new Set([...[...fixed.values()].map((x) => x.id), ...placed.keys()]);
  if (opts.date) {
    // Days off: a resting catcher needs another catcher on the bench.
    const date = opts.date;
    const resting = new Set<PlayerId>();
    // The better players first: when two catchers' days off fall together, the regular gets his (1.1.0; before,
    // the backup rested and the regular, with no catcher left behind him, never did).
    for (const p of [...hitters].sort((a, b) => b.scouting.current - a.scouting.current || a.id.localeCompare(b.id))) {
      if (!restsToday(s, p, date) || (fixedIds.has(p.id) && opts.cardRest === false)) continue;
      if (p.position === 'C' && hitters.filter((q) => q.position === 'C' && q !== p && !resting.has(q.id)).length === 0) continue;
      resting.add(p.id);
    }
    if (hitters.length - resting.size >= 9) {
      hitters = hitters.filter((p) => !resting.has(p.id));
      for (const [i, slot] of fixed) if (resting.has(slot.id)) fixed.delete(i);
      for (const id of [...placed.keys()]) if (resting.has(id)) placed.delete(id);
    }
  }
  if (pitchersBat && hitters.length < 9) {
    const spare = ids.map((id) => s.players[id]!).filter((p) => isPitcher(p) && available(s, p.id)).sort((a, b) => a.scouting.current - b.scouting.current);
    hitters = [...hitters, ...spare.slice(0, 9 - hitters.length)];
  }
  const gameCache = new Map<PlayerId, Partial<Record<FieldPos, number>>>();
  const games = (p: Player) => gameCache.get(p.id) ?? (gameCache.set(p.id, positionGames(s, p)), gameCache.get(p.id)!);
  // A better manager reads his hitters beyond the scouting report (STAFF.managerInsight at 80).
  const insight = STAFF.managerInsight * Math.max(0, (staffEdge(staffRating(s, hitters[0]?.teamId, 'manager')) + 1) / 2);
  const scoreCache = new Map<PlayerId, number>();
  const hitScore = (p: Player) => {
    let v = scoreCache.get(p.id);
    if (v === undefined) {
      v = batValue(p.scouting.tools) * (1 - insight) + batValue(p.hidden.current) * insight + performanceNudge(s, p) + (isForeign(p) ? 4 : 0) + prefer(p) + platoonEdge(s, p, vs);
      scoreCache.set(p.id, v);
    }
    return v;
  };
  const fieldValue = (p: Player, pos: FieldPos) => {
    if (pos === 'DH') return hitScore(p);
    const cost = fitPenalty(p, pos, games(p));
    return hitScore(p) + DEF_WEIGHT[pos as Position] * (pub(p, 'defense') - cost - 45) - (cost >= 12 ? MISFIT : 0);
  };
  // The manager fills the positions nobody was fixed at with the players nobody placed; a player whose spot in the
  // order is fixed without a position plays, at the position the manager finds best for him.
  const takenPos = new Set(placed.values());
  const openPos = SLOTS.filter((pos) => !takenPos.has(pos));
  const free = hitters.filter((p) => !placed.has(p.id));
  const mustPlay = new Set([...fixed.values()].filter((x) => !placed.has(x.id)).map((x) => x.id));
  const pick = assign(openPos.map((pos) => free.map((p) => fieldValue(p, pos) + (mustPlay.has(p.id) ? MUST_PLAY : 0))));
  const slots = [
    ...[...placed].map(([id, pos]) => ({ p: byId.get(id) ?? s.players[id]!, pos })),
    ...openPos.map((pos, i) => ({ p: free[pick[i]!], pos })).filter((x): x is { p: Player; pos: FieldPos } => !!x.p),
  ];

  // Batting order.
  const onBase = (p: Player) => pub(p, 'contact') * 0.5 + pub(p, 'eye') * 0.4 + pub(p, 'speed') * 0.1;
  const power = (p: Player) => pub(p, 'power') * 0.65 + pub(p, 'contact') * 0.35;
  // Catchers seldom lead off: they are slow and worn by the time the game gets late.
  const speedy = (p: Player) => onBase(p) + (pub(p, 'speed') - 50) * 0.3 - (p.position === 'C' ? 15 : 0);
  const ranked = [...slots].sort((a, b) => hitScore(b.p) - hitScore(a.p));
  const takeBest = (from: typeof ranked, score: (p: Player) => number) => {
    const best = [...from].sort((a, b) => score(b.p) - score(a.p))[0]!;
    from.splice(from.indexOf(best), 1);
    return best;
  };
  // 1.6.0: a catcher leads off only when there is nobody else to (before, a strong catcher sometimes did).
  const takeLead = (from: typeof ranked) => {
    const others = from.filter((x) => x.p.position !== 'C');
    const best = [...(others.length ? others : from)].sort((a, b) => speedy(b.p) - speedy(a.p))[0]!;
    from.splice(from.indexOf(best), 1);
    return best;
  };
  let order: typeof ranked;
  // Short-handed (a futures squad hit by injuries): best first; the game needs nine and will not start.
  if (ranked.length < 9) order = ranked;
  else if (opts.style === 'smallBall') {
    const rest = [...ranked];
    const first = [takeLead(rest), takeBest(rest, onBase), takeBest(rest, (p) => power(p) + onBase(p) * 0.5), takeBest(rest, power), takeBest(rest, power)];
    order = [...first, ...rest];
  } else {
    const top = ranked.slice(0, 3),
      next = ranked.slice(3, 5),
      rest = ranked.slice(5);
    const lead = takeLead(top);
    const cleanup = takeBest(top, power);
    const fifth = takeBest(next, power);
    order = [lead, top[0]!, next[0]!, cleanup, fifth, ...rest];
  }
  // Fixed spots stay where the general manager put them; the manager's order fills the others.
  for (const [i, f] of [...fixed]) if (!order.some((x) => x.p.id === f.id)) fixed.delete(i);
  if (fixed.size && order.length >= 9) {
    const rest = order.filter((x) => ![...fixed.values()].some((f) => f.id === x.p.id));
    order = Array.from({ length: 9 }, (_, i) => {
      const f = fixed.get(i);
      return f ? order.find((x) => x.p.id === f.id)! : rest.shift()!;
    });
  }
  return order.map(({ p, pos }) => ({
    id: p.id,
    bats: handOf(p.bats),
    contact: t(p, 'contact'),
    power: t(p, 'power'),
    eye: t(p, 'eye'),
    speed: t(p, 'speed'),
    // A player who changed position this spring is still learning it (spring camp plan).
    defense: t(p, 'defense') - fitPenalty(p, pos, games(p)) - (p.plan?.adaptingIn === s.year ? ADAPTING_PENALTY : 0),
    pos,
    ...battingProfile(p),
    // 2.0.3 (fielding.ts): his fielding in parts, less the same penalty away from his positions.
    ...fieldParts(p, fitPenalty(p, pos, games(p)) + (p.plan?.adaptingIn === s.year ? ADAPTING_PENALTY : 0), pos),
  }));
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** 1.7.0: today's bench — the hitters not starting who can play (a regular resting today among them), with what each
    would field at every position. The engine sends them in late (engine/game.ts pinchHit, pinchRun, defensiveSub). */
export function benchFor(s: LeagueState, ids: PlayerId[], lineup: BatterIn[]): BenchIn[] {
  const starting = new Set(lineup.map((b) => b.id));
  return ids
    .map((id) => s.players[id]!)
    .filter((p) => !isPitcher(p) && !starting.has(p.id) && available(s, p.id))
    .map((p) => {
      const games = positionGames(s, p);
      const adapting = p.plan?.adaptingIn === s.year ? ADAPTING_PENALTY : 0;
      const defenseAt: Partial<Record<FieldPos, number>> = {};
      for (const pos of SLOTS) if (pos !== 'DH') defenseAt[pos] = t(p, 'defense') - fitPenalty(p, pos, games) - adapting;
      return { id: p.id, bats: handOf(p.bats), contact: t(p, 'contact'), power: t(p, 'power'), eye: t(p, 'eye'), speed: t(p, 'speed'), defense: t(p, 'defense'), pos: 'DH' as FieldPos, defenseAt, ...battingProfile(p), ...fieldParts(p, 0, 'C') };
    });
}

export function armIn(p: Player, pitchLimit: number): PitcherIn {
  return { id: p.id, throws: p.throws === '좌' ? 'L' : 'R', stuff: t(p, 'stuff'), command: t(p, 'command'), breaking: t(p, 'breaking'), stamina: t(p, 'stamina'), pitchLimit, platoon: platoonFactor(p), lift: pitchingLift(p) };
}

/** Pitchers set as starters come first: a reliever only starts when there are not five starters. */
const STARTER_ROLE_BONUS = 100;
const rotationScore = (p: Player, prefer: Prefer) => starterValue(p.scouting.tools) + (isForeign(p) ? 30 : 0) + (p.role === 'SP' ? STARTER_ROLE_BONUS : 0) + prefer(p);

/** The five-man rotation: starters (role SP) by public starter value; everyone else pitches from the bullpen.
    `order` (the user's club, V0.8): the general manager's starters first, in his order, while on the squad. */
export function rotationFor(s: LeagueState, ids: PlayerId[], prefer: Prefer = none, order: PlayerId[] = [], size = eraUsage(s.year)?.rotation ?? 5): Player[] {
  const pitchers = ids.map((id) => s.players[id]!).filter((p) => isPitcher(p));
  const mine = order.filter((id, i) => order.indexOf(id) === i && pitchers.some((p) => p.id === id)).slice(0, size);
  const rest = pitchers.filter((p) => !mine.includes(p.id)).sort((a, b) => rotationScore(b, prefer) - rotationScore(a, prefer) || a.id.localeCompare(b.id));
  return [...mine.map((id) => s.players[id]!), ...rest].slice(0, size);
}

/** The user's lineup card for a squad (the first team only; futures squads are the manager's). */
export const cardFor = (s: LeagueState, x: { teamId: TeamId; ids?: PlayerId[] }) => (x.teamId === s.user?.teamId && !x.ids ? s.user.lineup : undefined);

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
    // 1.9.8: a history game's four-man rotations went on four days' rest.
    if (available(s, p.id) && days >= (eraUsage(s.year)?.rest ?? 5)) {
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
  return { p: pick, limit: starterLimit(pick, date, rest, hook, eraUsage(s.year)) };
}

/** How many pitches the manager gives today's starter: stamina, rest, April, the hook. */
function starterLimit(p: Player, date: string, rest: number, hook: number, era: EraUsage | null = null): number {
  const stamina = t(p, 'stamina');
  const month = Number(date.slice(5, 7));
  // 1.9.8: the era's starters went longer, and four days' rest was rest enough (eraUsage).
  const short = rest < (era?.rest ?? 5);
  const limit = Math.round(STARTER_LIMIT.base + (era?.limitBonus ?? 0) + (stamina - 50) * STARTER_LIMIT.perStamina - (short ? 18 : 0) - (month <= 4 ? 5 : 0) + hook);
  return Math.max(55, Math.min(era?.limitMax ?? 118, limit));
}

/**
 * Our postseason plan for the next game (1.3.0): the starter the general manager chose, if he can pitch, and the
 * all-out plan (총력전) — the starter on a short leash, the other starters ready in the bullpen unless they pitched in
 * the last two days, and relievers who would normally rest available too.
 */
function postPlanFor(s: LeagueState, x: SquadSpec, ids: PlayerId[]) {
  if (s.phase !== 'postseason' || x.ids || x.teamId !== s.user?.teamId) return null;
  const plan = s.user.postPlan;
  if (!plan) return null;
  const chosen = plan.starter && ids.includes(plan.starter) && available(s, plan.starter) ? s.players[plan.starter]! : null;
  return { chosen, allOut: !!plan.allOut };
}

export const PEN_ROLE_LABELS: Record<BullpenRole, string> = { CL: __i18n_k("league.manager.pEN_ROLE_LABELS.cL.ed8464a3"), SU: __i18n_k("league.manager.pEN_ROLE_LABELS.sU.9d5322e3"), HL: __i18n_k("league.manager.pEN_ROLE_LABELS.hL.39429c7a"), MU: __i18n_k("league.manager.pEN_ROLE_LABELS.mU.138d4fd4"), LR: __i18n_k("league.manager.pEN_ROLE_LABELS.lR.e7ef4fdb"), LO: '원 포인트' };
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
export function bullpenFor(s: LeagueState, teamId: TeamId, ids: PlayerId[], date: string, exclude: Set<PlayerId>, prefer: Prefer = none, allOut = false): RelieverIn[] {
  // 2.0.12: a two-way hitter pitches in relief (his arm, twoway.ts).
  const pen = ids
    .map((id) => s.players[id]!)
    .map((p) => (!isPitcher(p) && p.twoWay ? asOther(p) : p))
    .filter((p) => isPitcher(p) && !exclude.has(p.id));
  const roles = penRoles(s, teamId, pen, prefer);
  const arms = pen.filter((p) => available(s, p.id));
  const rested = arms.filter((p) => {
    const a = s.arms[p.id];
    if (!a) return true;
    const days = daysBetween(a.lastDate, date);
    if (days <= 0) return false;
    // All out (our postseason plan): only a long outing yesterday rests him.
    if (allOut) return !(days === 1 && a.lastPitches >= 45);
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

/** The manager's leanings: his style (the batting order, the hook), and a youth-minded one gives young players a little more. */
export function managerLean(s: LeagueState, teamId: TeamId, base: Prefer = none): { style?: ManagerStyle; prefer: Prefer } {
  const style = s.clubs?.[teamId]?.staff?.manager?.style;
  return { style, prefer: style === 'youth' ? (p) => base(p) + (ageIn(p, s.year) <= 25 ? 3 : 0) : base };
}

/** Both clubs' engine inputs for one game: starters first, so each lineup can be set against the other starter. */
/** A hot or cold spell, a newborn or a loss (V0.10, the user's players only) moves his main tools today; so does
    his composure in a postseason game (1.1.0, every club). */
function withForm(s: LeagueState, date: string, team: TeamIn): TeamIn {
  const big = s.phase === 'postseason';
  // 1.8.0, scenario 부상병동: our players are worn out by the trainer's programme.
  const tired = inWard(s, team.teamId) ? WARD.fatigue : 0;
  const today = (p: Player) => formOf(p, date) - adaptPenalty(p, s.year) + (big ? bigGameEdge(p) : 0) - tired;
  for (const b of [...team.lineup, ...(team.bench ?? [])]) {
    const f = today(s.players[b.id]!);
    if (!f) continue;
    b.contact += f;
    b.power += f;
    b.eye += f;
  }
  for (const a of [team.starter, ...team.bullpen]) {
    const f = today(s.players[a.id]!);
    if (!f) continue;
    a.stuff += f;
    a.command += f;
  }
  return team;
}

export function matchInputs(s: LeagueState, date: string, home: SquadSpec, away: SquadSpec): { home: TeamIn | null; away: TeamIn | null } {
  const plan = (x: SquadSpec) => {
    const ids = x.ids ?? s.rosters[x.teamId]!.active;
    const { style, prefer } = managerLean(s, x.teamId, x.prefer);
    const card = cardFor(s, x);
    const rotation = rotationFor(s, ids, prefer, card?.rotation);
    const pp = postPlanFor(s, x, ids);
    const hook = (style === 'quickHook' ? ENGINE.hook.quickHook : style === 'patient' ? ENGINE.hook.patient : 0) + (pp?.allOut ? ENGINE.hook.allOut : 0);
    const rest = (p: Player) => (s.arms[p.id] ? daysBetween(s.arms[p.id]!.lastDate, date) : 99);
    const sp = pp?.chosen ? { p: pp.chosen, limit: starterLimit(pp.chosen, date, rest(pp.chosen), hook, eraUsage(s.year)) } : starterFor(s, x.rotationKey ?? x.teamId, date, rotation, hook);
    return { x, ids, prefer, rotation, style, card, sp, allOut: !!pp?.allOut, rest };
  };
  const h = plan(home),
    a = plan(away);
  const build = (me: typeof h, them: typeof h): TeamIn | null => {
    if (!me.sp) return null;
    const vs = them.sp ? (them.sp.p.throws === '좌' ? 'L' : 'R') : undefined;
    // A futures squad comes with its own list (pitchers bat when short of hitters); first-team
    // regular-season games give regulars their days off, futures games and October do not.
    const futures = !!me.x.ids;
    const lineup = lineupFor(s, me.ids, me.prefer, futures, vs, {
      date: !futures && s.phase === 'regular' ? date : undefined,
      style: me.style,
      ...(me.card ? { card: me.card[vs ?? 'R'], places: me.card.places?.[vs ?? 'R'], cardRest: me.card.rest } : {}),
    });
    if (lineup.length < 9) return null;
    const bench = benchFor(s, me.ids, lineup);
    // All out: only today's starter and the starters who pitched in the last two days stay out of the bullpen.
    // 1.9.8: so too in the eras when starters relieved between starts (eraUsage), the first team only.
    const era = eraUsage(s.year);
    const relieve = me.allOut || (!!era?.starterRelief && !futures);
    const exclude = new Set(relieve ? [me.sp.p.id, ...me.rotation.filter((p) => me.rest(p) <= 2).map((p) => p.id)] : [...me.rotation.map((p) => p.id), me.sp.p.id]);
    return withForm(s, date, {
      teamId: me.x.teamId,
      lineup,
      bench,
      starter: armIn(me.sp.p, Math.max(55, me.sp.limit - (inWard(s, me.x.teamId) ? WARD.pitchLimit : 0))),
      bullpen: bullpenFor(s, me.x.teamId, me.ids, date, exclude, me.prefer, me.allOut),
      fieldBonus: STAFF.fielding * staffEdge(staffRating(s, me.x.teamId, 'analytics')),
      ...(me.style === 'smallBall' ? { smallBall: true } : {}),
      ...(era && !futures ? { usage: { completeGame: era.completeGame, runsBeforeHook: era.runsBeforeHook, closerFrom: era.closerFrom, closerOuts: era.closerOuts, closerPitches: era.closerPitches } } : {}),
    });
  };
  return { home: build(h, a), away: build(a, h) };
}
