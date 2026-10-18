import { k as __i18n_k } from '../i18n/index';
/* 2.0.12 (the user's request): two-way players (투타 겸업) who really pitch and hit, and pitchers who become hitters
   and hitters who become pitchers (투타 전향).

   Every player has the other side's talent (Draft Room's `alt`: a pitcher's bat, a hitter's arm). A Draft Room
   two-way prospect brings his into the league; anyone else's is drawn the same way (Draft Room's altSide) the first
   time it is needed, from its own stream. It grows each winter toward its potential, faster for a two-way player,
   and fades past thirty.

   A two-way pitcher may bat (the manager takes him as a hitter when he is among the nine best, mostly as the
   designated hitter); a two-way hitter may pitch in relief. The general manager starts or stops two-way play for
   our players and turns a young pitcher into a hitter or a hitter into a pitcher over the winter; the other clubs
   drop two-way play when one side falls well behind, and now and then turn a young player around. */
import { HITTING_TOOLS, hashUnit, overall, PITCHING_TOOLS, rng, toGrade, TUNING, type Role, type Tools } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { altPositions, assignPosition } from '../model/position';
import { ageIn, isForeign, isPitcher } from './players';
import type { LeagueState } from './state';

export interface OtherSide {
  role: Role;
  /** Hidden (continuous) and the scouts' (20–80). */
  current: Tools;
  potential: Tools;
  tools: Tools;
  /** His velocity as a pitcher (the hitter's other side). */
  velocity: number | null;
}

export const TWO_WAY = {
  /** Share of the gap to potential closed each winter, two-way or not, until 27. */
  grow: { twoWay: 0.3, other: 0.12 },
  /** Points lost a winter on every tool past this age. */
  fadeFrom: 31,
  fade: 1,
  /** The oldest a player may turn around (the end of the coming season), and the youngest the other clubs try. */
  switchMaxAge: 26,
  aiSwitch: { maxAge: 24, margin: 6, chance: 0.4 },
  /** A two-way player whose other side's grade is this far below his main one drops it (the other clubs). */
  dropGap: 15,
  /** The other side's grade a player needs to start two-way play. */
  startMin: 40,
};

const keysFor = (role: Role) => (role === 'SP' || role === 'RP' ? PITCHING_TOOLS : HITTING_TOOLS);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Draft Room's altSide (prospects.js) for a player already in the league: his other side, from his own stream. */
function drawOther(p: Player): OtherSide {
  const A = TUNING.altTalent;
  const r = rng(`${p.id}|other-side`);
  const normal = () => (r() + r() + r() + r() + r() + r() - 3) * 1.41;
  const pitcher = isPitcher(p);
  const role: Role = pitcher ? (r() < 0.6 ? 'OF' : 'IF') : p.twoWay && r() < 0.5 ? 'SP' : 'RP';
  const upside = overall(p.hidden.potential, p.role);
  const centre = p.twoWay ? upside - (A.twoWay.below[0] + r() * A.twoWay.below[1]) : A.base[0] + r() * A.base[1] + Math.max(0, upside - 45) * A.athleticism;
  const gap = 5 + r() * 6;
  const current: Tools = {},
    potential: Tools = {},
    tools: Tools = {};
  for (const k of keysFor(role)) {
    potential[k] = clamp(centre + normal() * 4, 20, 80);
    current[k] = Math.min(potential[k]!, clamp(potential[k]! - gap * (k === 'speed' ? 0.4 : 1), 20, 80));
    tools[k] = toGrade(current[k]! + normal() * 3);
  }
  const V = TUNING.generation.velocity;
  const velocity = role === 'SP' || role === 'RP' ? Math.round(clamp(V.base + (current.stuff! - V.pivot) * V.perStuff, V.min, V.max)) : null;
  return { role, current, potential, tools, velocity };
}

/** His other side (drawn and kept the first time). */
export function otherSide(p: Player): OtherSide {
  return (p.other ??= drawOther(p));
}

/** His other side without keeping it (the screens). */
export const peekOther = (p: Player): OtherSide => p.other ?? drawOther(p);

/** The other side's overall grade (public). */
export const otherGrade = (p: Player) => toGrade(overall(peekOther(p).tools, peekOther(p).role));

/** He as a hitter (a two-way pitcher's bat) or a pitcher (a two-way hitter's arm), for the manager and the engine:
    the same player, his other side's tools in place of his own. */
export function asOther(p: Player): Player {
  const o = otherSide(p);
  const pos = isPitcher(p) ? (assignPosition(o.role, o.tools, hashUnit(p.id)) ?? 'LF') : null;
  return {
    ...p,
    role: o.role,
    position: pos,
    alt: pos ? [] : undefined,
    velocity: o.velocity,
    hidden: { ...p.hidden, current: o.current, potential: o.potential },
    scouting: { ...p.scouting, tools: o.tools, futureTools: o.tools, current: toGrade(overall(o.tools, o.role)) },
  };
}

/** Our players' choices and the other clubs' habits are checked against this. */
export function checkSwitch(s: LeagueState, id: PlayerId, what: 'convert' | 'twoWayOn' | 'twoWayOff'): string | null {
  const p = s.players[id];
  const u = s.user;
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k('league.twoway.text.fe6eb5c8');
  if (isForeign(p)) return __i18n_k('league.twoway.text.3103a4aa');
  const year = s.offseason ? s.offseason.year + 1 : s.year;
  if (what === 'twoWayOff') return p.twoWay ? null : __i18n_k('league.twoway.text.f9155936');
  if (ageIn(p, year) > TWO_WAY.switchMaxAge) return __i18n_k('league.twoway.text.6f001bef', { n: TWO_WAY.switchMaxAge });
  if (what === 'convert') return s.offseason ? null : __i18n_k('league.twoway.text.131d00ab');
  if (p.twoWay) return __i18n_k('league.twoway.text.b5ebbc35');
  return otherGrade(p) >= TWO_WAY.startMin ? null : __i18n_k('league.twoway.text.a30f03ed', { n: TWO_WAY.startMin });
}

/** Turns him around: his other side becomes his main one (and the old main his other). */
export function convert(p: Player, year: number) {
  const o = otherSide(p);
  const was: OtherSide = { role: p.role, current: p.hidden.current, potential: p.hidden.potential, tools: p.scouting.tools, velocity: p.velocity };
  p.role = o.role;
  p.hidden = { ...p.hidden, current: o.current, potential: o.potential };
  const future: Tools = Object.fromEntries(Object.entries(o.potential).map(([k, v]) => [k, toGrade(v!)]));
  p.scouting = { ...p.scouting, tools: o.tools, futureTools: future, current: toGrade(overall(o.tools, o.role)), futureValue: toGrade(overall(future, o.role)) };
  p.velocity = o.velocity;
  if (isPitcher(p)) {
    p.position = null;
    p.alt = [];
  } else {
    p.position = assignPosition(p.role, future, hashUnit(p.id)) ?? 'LF';
    p.alt = altPositions(p.position, future, rng(`${p.id}|switch-alt|${year}`));
  }
  p.other = was;
  p.twoWay = false;
  (p.switched ??= []).push({ year, to: isPitcher(p) ? 'pitcher' : 'hitter' });
}

/** The general manager's choice for one of our players. */
export function switchPlayer(s: LeagueState, id: PlayerId, what: 'convert' | 'twoWayOn' | 'twoWayOff') {
  if (checkSwitch(s, id, what)) return;
  const p = s.players[id]!;
  if (what === 'convert') convert(p, s.offseason?.year ?? s.year);
  else {
    p.twoWay = what === 'twoWayOn';
    if (p.twoWay) otherSide(p);
  }
}

/** The winter: the other side grows or fades; the other clubs drop two-way play that does not pay and now and then
    turn a young player around. */
export function twoWayWinter(s: LeagueState, year: number) {
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || !p.other) continue;
    const age = ageIn(p, year + 1);
    const o = p.other;
    for (const k of Object.keys(o.potential) as (keyof Tools)[]) {
      const cur = o.current[k] ?? 20,
        pot = o.potential[k] ?? cur;
      const next = age <= 27 ? cur + (pot - cur) * (p.twoWay ? TWO_WAY.grow.twoWay : TWO_WAY.grow.other) : age >= TWO_WAY.fadeFrom ? cur - TWO_WAY.fade : cur;
      o.current[k] = clamp(next, 20, 80);
      o.tools[k] = toGrade(o.current[k]!);
    }
  }
  const me = s.user?.teamId;
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || !p.teamId || p.teamId === me || isForeign(p)) continue;
    if (p.twoWay && otherGrade(p) < p.scouting.current - TWO_WAY.dropGap) p.twoWay = false;
    const A = TWO_WAY.aiSwitch;
    if (p.twoWay || ageIn(p, year + 1) > A.maxAge || !p.other) continue;
    const r = rng(`${s.seed}|switch|${year}|${p.id}`);
    if (toGrade(overall(p.other.potential, p.other.role)) >= p.scouting.futureValue + A.margin && r() < A.chance) convert(p, year);
  }
}
