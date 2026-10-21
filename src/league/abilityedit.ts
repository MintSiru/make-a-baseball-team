import { k as __i18n_k } from '../i18n/index';
/* 2.0.35 (the user's request): the ability editor — what the 2.0.9 editor leaves alone. Off unless the general manager
   turns it on in the settings (it shows what the scouts cannot see): a player's true current and potential grades, his
   hidden character (growth type, 천재성 … 논쟁성, injury proneness), how he hits the ball in the air and where
   (타구 성향), a pitcher's fastball, top velocity and pitches with their grades and shares, and a fielder's parts
   (레인지 · 판단 · 송구, a catcher's 리드 · 프레이밍).

   Only what was changed is written. A grade becomes his true ability and the scouts' report reads it as it is (no
   observer's error), so the screens show what was set. The tendencies, the pitches and the fielding parts, which are
   otherwise drawn from his id, are kept as his own (`Player.custom`) and read wherever those draws are. Nothing here
   draws from the simulation's random streams. */
import { overall, toGrade, type Tools } from '../draftroom';
import type { GrowthType, Player, PlayerId, Traits } from '../model/types';
import { battingProfile } from './battedball';
import { fieldingOf } from './fielding';
import { fastballOf, PITCH_LABELS, pitchingLift, repertoire, topVelocity, type FastballType, type PitchType } from './pitches';
import { isPitcher } from './players';
import type { LeagueState } from './state';
import { clutchOf, GROWTH_ORDER, temperOf, TRAIT_KEYS, traitsOf, type TraitKey } from './traits';
import { slotVelocity } from './tracking';

export const ABILITY = { grade: { min: 20, max: 80 }, trait: { min: 1, max: 99 }, step: { min: -2, max: 2 }, velocity: { min: 110, max: 163 }, pitches: { min: 1, max: 6 }, usage: { min: 1, max: 60, total: 75 } };

/** Injury proneness on the reports' 1–99 scale (reports.ts) and back. */
const injuryScale = (risk: number) => Math.max(1, Math.min(99, Math.round(((risk - 0.05) / 0.12) * 100)));
const riskOf = (v: number) => 0.05 + (v / 100) * 0.12;

export type FieldPart = 'range' | 'hands' | 'arm' | 'lead' | 'frame';

export interface EditPitch {
  type: PitchType;
  /** True grade, 20–80. */
  grade: number;
  /** Share of all his pitches, %. */
  usage: number;
}

export interface AbilityEdit {
  current: Partial<Record<keyof Tools, number>>;
  potential: Partial<Record<keyof Tools, number>>;
  growth: GrowthType;
  traits: Record<TraitKey, number>;
  injury: number;
  /** Hitters: −2 extreme pull … 2 extreme opposite field. Null for a pitcher. */
  pull: number | null;
  /** −2 extreme ground ball … 2 extreme fly ball (a pitcher's: the balls hit off him). */
  lift: number;
  /** Pitchers only (null for a hitter). */
  velocity: number | null;
  fastball: FastballType | null;
  pitches: EditPitch[] | null;
  /** Hitters only; `lead` and `frame` a catcher's. */
  field: Partial<Record<FieldPart, number>> | null;
}

const devOf = (p: Player, type: PitchType) => p.pitchDev?.[type] ?? (type === 'KC' ? (p.pitchDev?.CB ?? 0) : 0);

/** What the editor starts from: his abilities as they truly are. */
export function abilityOf(p: Player): AbilityEdit {
  const pitcher = isPitcher(p);
  const round = (t: Tools) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v as number)])) as AbilityEdit['current'];
  const tr = traitsOf(p);
  const traits = Object.fromEntries(TRAIT_KEYS.map((k) => [k, Math.round((tr as unknown as Record<string, number | undefined>)[k] ?? 50)])) as Record<TraitKey, number>;
  // 2.0.28's clutch and temper are drawn when a player from before has none (traits.ts): the editor shows those.
  traits.clutch = Math.round(clutchOf(p));
  traits.temper = Math.round(temperOf(p));
  const breaking = p.hidden.current.breaking;
  const f = pitcher ? null : fieldingOf(p);
  return {
    current: round(p.hidden.current),
    potential: round(p.hidden.potential),
    growth: tr.growth,
    traits,
    injury: injuryScale(p.hidden.injuryRisk),
    pull: pitcher ? null : battingProfile(p).pull,
    lift: pitcher ? pitchingLift(p) : battingProfile(p).lift,
    velocity: pitcher ? topVelocity(p) : null,
    fastball: pitcher ? fastballOf(p) : null,
    pitches:
      pitcher && breaking != null
        ? repertoire(p).map((x) => ({ type: x.type, grade: clampGrade(breaking + x.offset + devOf(p, x.type)), usage: Math.round(x.usage * 100) }))
        : null,
    field: f ? { range: f.range, hands: f.hands, arm: f.arm, ...(f.lead != null ? { lead: f.lead } : {}), ...(f.frame != null ? { frame: f.frame } : {}) } : null,
  };
}

const clampGrade = (x: number) => Math.max(ABILITY.grade.min, Math.min(ABILITY.grade.max, Math.round(x)));

const whole = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Why this edit cannot be made (null if it can). */
export function checkAbilityEdit(s: LeagueState, id: PlayerId, e: AbilityEdit): string | null {
  if (!s.abilityEditor) return __i18n_k("league.abilityedit.text.d649383a");
  const p = s.players[id];
  if (!p) return __i18n_k("league.abilityedit.text.9128299f");
  const base = abilityOf(p);
  const G = ABILITY.grade;
  for (const side of ['current', 'potential'] as const)
    for (const k of Object.keys(base[side]) as (keyof Tools)[]) if (!whole(e[side][k], G.min, G.max)) return __i18n_k("league.abilityedit.text.867da635", { min: G.min, max: G.max });
  if (!GROWTH_ORDER.includes(e.growth)) return __i18n_k("league.abilityedit.text.146cce65");
  for (const k of TRAIT_KEYS) if (!whole(e.traits[k], ABILITY.trait.min, ABILITY.trait.max)) return __i18n_k("league.abilityedit.text.4c0fb637", { min: ABILITY.trait.min, max: ABILITY.trait.max });
  if (!whole(e.injury, ABILITY.trait.min, ABILITY.trait.max)) return __i18n_k("league.abilityedit.text.4c0fb637", { min: ABILITY.trait.min, max: ABILITY.trait.max });
  const S = ABILITY.step;
  if (!whole(e.lift, S.min, S.max) || (base.pull != null && !whole(e.pull, S.min, S.max))) return __i18n_k("league.abilityedit.text.8662f771");
  if (base.field)
    for (const k of Object.keys(base.field) as FieldPart[]) if (!whole(e.field?.[k], G.min, G.max)) return __i18n_k("league.abilityedit.text.d2da62e9", { min: G.min, max: G.max });
  if (base.velocity != null && !whole(e.velocity, ABILITY.velocity.min, ABILITY.velocity.max)) return __i18n_k("league.abilityedit.text.9f795422", { min: ABILITY.velocity.min, max: ABILITY.velocity.max });
  if (base.fastball && !(['4SFB', '2SFB', 'CUT'] as const).includes(e.fastball!)) return __i18n_k("league.abilityedit.text.a6185f5c");
  if (base.pitches) {
    const list = e.pitches ?? [];
    const P = ABILITY.pitches,
      U = ABILITY.usage;
    if (list.length < P.min || list.length > P.max) return __i18n_k("league.abilityedit.text.09cb55a8", { min: P.min, max: P.max });
    if (list.some((x) => !(x.type in PITCH_LABELS))) return __i18n_k("league.abilityedit.text.aa9d31fa");
    if (new Set(list.map((x) => x.type)).size !== list.length) return __i18n_k("league.abilityedit.text.5a91cf1f");
    if (e.fastball !== '4SFB' && list.some((x) => x.type === e.fastball)) return __i18n_k("league.abilityedit.text.6cbc8567");
    if (list.some((x) => !whole(x.grade, G.min, G.max))) return __i18n_k("league.abilityedit.text.2666a04e", { min: G.min, max: G.max });
    if (list.some((x) => !whole(x.usage, U.min, U.max))) return __i18n_k("league.abilityedit.text.4ea35609", { min: U.min, max: U.max });
    if (list.reduce((a, x) => a + x.usage, 0) > U.total) return __i18n_k("league.abilityedit.text.8cf6f04a", { n: U.total });
  }
  return null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Makes the edit (nothing if it cannot be made); only what differs from his abilities now is written. */
export function editAbility(s: LeagueState, id: PlayerId, e: AbilityEdit) {
  if (checkAbilityEdit(s, id, e)) return;
  const p = s.players[id]!;
  const base = abilityOf(p);
  let changed = false;
  // Grades: the true ability, and the scouts' report reading it as it is.
  let tools = false;
  for (const side of ['current', 'potential'] as const)
    for (const k of Object.keys(base[side]) as (keyof Tools)[])
      if (e[side][k] !== base[side][k]) {
        p.hidden[side][k] = e[side][k]!;
        tools = true;
      }
  if (tools) {
    rescoutExactly(p, s.offseason?.year ?? s.year);
    changed = true;
  }
  // Character.
  const tr: Traits = { ...traitsOf(p) };
  let character = false;
  if (e.growth !== base.growth) {
    tr.growth = e.growth;
    character = true;
  }
  for (const k of TRAIT_KEYS)
    if (e.traits[k] !== base.traits[k]) {
      (tr as unknown as Record<string, number>)[k] = e.traits[k];
      character = true;
    }
  if (character) {
    // Clutch and temper drawn for a player from before are kept as drawn (so that they do not move again).
    tr.clutch ??= clutchOf(p);
    tr.temper ??= temperOf(p);
    p.hidden.traits = tr;
    changed = true;
  }
  if (e.injury !== base.injury) {
    p.hidden.injuryRisk = riskOf(e.injury);
    changed = true;
  }
  const custom = { ...(p.custom ?? {}) };
  if (base.pull != null && e.pull !== base.pull) custom.pull = e.pull!;
  if (e.lift !== base.lift) {
    if (base.pull != null) custom.lift = e.lift;
    else custom.pitchLift = e.lift;
  }
  if (base.fastball && e.fastball !== base.fastball) custom.fastball = e.fastball!;
  if (base.pitches && !same(e.pitches, base.pitches)) {
    const breaking = p.hidden.current.breaking!;
    custom.pitches = e.pitches!.map((x) => ({ type: x.type, offset: x.grade - breaking, usage: x.usage / 100 }));
    // The pitches as set: their own courses start again, and a learned pitch is one of them now.
    delete p.pitchDev;
    delete p.learned;
  }
  if (base.field && !same(e.field, base.field)) custom.field = { ...e.field };
  if (!same(custom, p.custom ?? {})) {
    p.custom = custom;
    changed = true;
  }
  if (base.velocity != null && e.velocity !== base.velocity) {
    // Top velocity: today's reading against his 구위 now (pitches.ts topVelocity), less what his arm slot takes off.
    p.velocityStuff = p.hidden.current.stuff;
    p.velocity = e.velocity! - slotVelocity(p);
    changed = true;
  }
  if (changed) s.abilityEdits = (s.abilityEdits ?? 0) + 1;
}

/** The scouts' report reading his true grades as they are (no observer's error). */
function rescoutExactly(p: Player, season: number) {
  const now: Tools = {},
    future: Tools = {};
  for (const [k, v] of Object.entries(p.hidden.current) as [keyof Tools, number][]) {
    now[k] = toGrade(v);
    future[k] = toGrade(Math.max(v, p.hidden.potential[k] ?? v));
  }
  const current = toGrade(overall(now, p.role));
  const fv = Math.max(current, toGrade(overall(future, p.role)));
  Object.assign(p.scouting, { season, tools: now, futureTools: future, current, futureValue: fv, floor: current, ceiling: fv, base: fv });
  delete p.scouting.moved;
}
