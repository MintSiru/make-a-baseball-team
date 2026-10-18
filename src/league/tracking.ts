/* 2.0.0 (the 2.0 plan's first stage, the user's request): how a pitcher throws, and what a tracking system would read
   off each of his pitches — the arm slot (오버핸드·스리쿼터·사이드암·언더핸드), and per pitch its speed, spin, spin
   axis and movement, with his release height and extension.

   The arm angle follows Statcast's measure: 90° straight over the top, 0° sidearm, below 0 the submariner's. 2.0.1
   (the user's ranges): 오버핸드 46~60°, 스리쿼터 21~45°, 사이드암 0~20°, 언더핸드 −1~−60°, drawn toward the middle
   of each so that few arms sit at an end. It is his own (seeded by id), the shares a game estimate for the KBO: sidearmers and submariners more often among the
   domestic arms than the foreign ones, and rarer than they were (RULES.md §9). A low slot costs velocity — a
   submariner throws 130 or so, a sidearmer a few km/h under the rest with wide spread, the odd one into the 150s — and
   widens the split against same-side hitters (the engine reads it through `platoonFactor`).

   Everything else here is what the reports show: the numbers come from his grades and his slot (a better 구위, a
   livelier fastball; a better breaking ball, more spin and break), so nothing in the engine changes with them. */
import { hashUnit, rng } from '../draftroom';
import type { Player } from '../model/types';
import { isForeign, isPitcher } from './players';
import { averageVelocity, fastballOf, pitchGrades, type PitchType } from './pitches';

export type ArmSlot = 'over' | 'three' | 'side' | 'under';

/** Each slot's range of arm angles (degrees) and its share among domestic and foreign pitchers. */
const SLOTS: Record<ArmSlot, { from: number; to: number; domestic: number; foreign: number }> = {
  over: { from: 46, to: 60, domestic: 0.22, foreign: 0.28 },
  three: { from: 21, to: 45, domestic: 0.6, foreign: 0.64 },
  side: { from: 0, to: 20, domestic: 0.13, foreign: 0.07 },
  under: { from: -60, to: -1, domestic: 0.05, foreign: 0.01 },
};
const ORDER: ArmSlot[] = ['over', 'three', 'side', 'under'];

/** A rough normal draw from three uniform ones (the same every time for the same key). */
const normalOf = (key: string) => (hashUnit(`${key}|a`) + hashUnit(`${key}|b`) + hashUnit(`${key}|c`) - 1.5) * 2;

/** His arm angle (degrees), or null for a position player. */
export function armAngle(p: Pick<Player, 'id' | 'role' | 'origin'>): number | null {
  if (!isPitcher(p as Player)) return null;
  const foreign = isForeign(p as Player);
  let u = hashUnit(`arm-slot|${p.id}`);
  let slot: ArmSlot = 'three';
  for (const s of ORDER) {
    const share = foreign ? SLOTS[s].foreign : SLOTS[s].domestic;
    if (u < share) {
      slot = s;
      break;
    }
    u -= share;
  }
  const { from, to } = SLOTS[slot];
  // The mean of two draws: most arms near the middle of the range, few at its ends.
  const mid = (hashUnit(`arm-angle|${p.id}`) + hashUnit(`arm-angle2|${p.id}`)) / 2;
  return Math.round(from + (to - from) * mid);
}

export const slotOf = (angle: number): ArmSlot => (angle >= SLOTS.over.from ? 'over' : angle >= SLOTS.three.from ? 'three' : angle >= SLOTS.side.from ? 'side' : 'under');

/** How much a low slot takes off (or adds to) his fastball, km/h: sidearmers spread wide, the odd one throwing hard. */
export function slotVelocity(p: Pick<Player, 'id' | 'role' | 'origin'>): number {
  const a = armAngle(p);
  if (a == null) return 0;
  switch (slotOf(a)) {
    case 'over':
      return 0.5;
    case 'three':
      return 0;
    case 'side':
      return -3 + 4 * normalOf(`side-velo|${p.id}`);
    case 'under':
      return -10 + 1.5 * normalOf(`under-velo|${p.id}`);
  }
}

/** The same-side split a slot brings: a submariner or sidearmer is hard on same-side hitters and easier for the others. */
export function slotPlatoon(p: Pick<Player, 'id' | 'role' | 'origin'>): number {
  const a = armAngle(p);
  if (a == null) return 1;
  return { over: 0.95, three: 1, side: 1.25, under: 1.35 }[slotOf(a)];
}

export interface PitchTrack {
  type: PitchType | 'FB';
  /** km/h on average. */
  velocity: number;
  /** Spin rate (rpm) and the spin axis as a clock from the catcher's view ("1:30"). */
  spin: number;
  axis: string;
  /** Induced vertical break and horizontal break (cm); horizontal positive to his arm side. */
  vertical: number;
  horizontal: number;
  usage: number;
}

export interface Tracking {
  angle: number;
  slot: ArmSlot;
  /** Release height and extension (m). */
  release: number;
  extension: number;
  pitches: PitchTrack[];
}

/** Each pitch's speed under his average fastball, base spin, and break (vertical, horizontal to the arm side) at a
    three-quarter slot. Game estimates after the major leagues' averages. */
const SHAPE: Record<PitchType | 'FB', { slower: number; spin: number; v: number; h: number; axis: number }> = {
  FB: { slower: 0, spin: 2250, v: 38, h: 20, axis: 0 },
  '2SFB': { slower: 1, spin: 2150, v: 22, h: 36, axis: 0.6 },
  SNK: { slower: 2, spin: 2100, v: 15, h: 38, axis: 0.8 },
  CUT: { slower: 5, spin: 2350, v: 22, h: -8, axis: -2 },
  SL: { slower: 11, spin: 2400, v: 5, h: -15, axis: -3.5 },
  SW: { slower: 14, spin: 2550, v: 2, h: -38, axis: -3 },
  SLV: { slower: 15, spin: 2450, v: -8, h: -25, axis: -4 },
  CB: { slower: 19, spin: 2550, v: -30, h: -15, axis: -5 },
  CH: { slower: 13, spin: 1750, v: 16, h: 36, axis: 0.5 },
  CIR: { slower: 13, spin: 1700, v: 12, h: 40, axis: 0.8 },
  SPL: { slower: 9, spin: 1350, v: 5, h: 22, axis: 0.5 },
  FRK: { slower: 11, spin: 1300, v: 2, h: 18, axis: 0.5 },
  KN: { slower: 30, spin: 250, v: 0, h: 0, axis: 0 },
  SCR: { slower: 15, spin: 1900, v: 5, h: 35, axis: 1.5 },
  PLM: { slower: 20, spin: 1100, v: 8, h: 20, axis: 0.5 },
  SH: { slower: 6, spin: 2100, v: 18, h: 30, axis: 1 },
};

/** 2.0.11: how far a grade point moves a pitch's break away from the fastball (a 70 breaks a fifth more than a 50),
    within bounds, and the spin it adds (or takes off a low-spin pitch). */
export const MOVE = { perGrade: 0.01, min: 0.6, max: 1.4, spin: 15 };

/** A spin axis (hours from 12 on a clock, from the catcher's view) as "H:MM". */
const clock = (h: number) => {
  const m = Math.round((((h % 12) + 12) % 12) * 60);
  const hh = Math.floor(m / 60) % 12 || 12;
  return `${hh}:${String(m % 60).padStart(2, '0')}`;
};

/** What a tracking system reads off him, or null for a position player (or no velocity on record). */
export function trackingOf(p: Player): Tracking | null {
  const angle = armAngle(p);
  const avg = averageVelocity(p);
  if (angle == null || avg == null) return null;
  const slot = slotOf(angle);
  const r = rng(`tracking|${p.id}`);
  const noise = (sd: number) => (r() + r() + r() - 1.5) * 2 * sd;
  const lefty = p.throws === '좌';
  const stuff = p.scouting.tools.stuff ?? 50;
  const height = (p.height || 183) / 100;
  // Lower slots: less ride on the fastball, more run; the breaking balls sweep more than they drop.
  const low = (60 - angle) / 45;
  // A right-hander's fastball axis: 12:30 over the top, 1:30 at three-quarters, 2:20 sidearm, 4:00 under.
  const fbAxis = 12.5 + (60 - angle) / 27;
  const track = (type: PitchType | 'FB', grade: number, usage: number): PitchTrack => {
    const s = SHAPE[type];
    const breaking = type !== 'FB' && type !== '2SFB' && type !== 'SNK' && type !== 'CUT';
    // 2.0.11 (the user's request): a better pitch moves further from his fastball — its grade (his 변화구 and how the
    // pitch has gone its own way, 2.0.6) stretches or shrinks its break away from the fastball's.
    const sep = type === 'FB' ? 1 : Math.max(MOVE.min, Math.min(MOVE.max, 1 + (grade - 50) * MOVE.perGrade));
    const sv = SHAPE.FB.v + (s.v - SHAPE.FB.v) * sep,
      sh = SHAPE.FB.h + (s.h - SHAPE.FB.h) * sep;
    const v = type === 'KN' ? noise(12) : sv + (type === 'FB' ? (stuff - 50) * 0.15 : 0) - (breaking ? low * 4 : low * 6) + noise(2.5);
    const h = type === 'KN' ? noise(12) : sh * (1 + (breaking && sh < 0 ? low * 0.35 : low * 0.25)) + noise(3);
    const axisH = fbAxis + s.axis + noise(0.2);
    return {
      type,
      velocity: Math.round(avg - s.slower + (grade - 50) * 0.05 + noise(1)),
      // Spin pitches gain spin with the grade; the low-spin ones (changeups, splitters, forkballs, palmballs) lose it.
      spin: Math.max(150, Math.round(s.spin + (grade - 50) * (s.spin >= SHAPE.FB.spin ? MOVE.spin : -MOVE.spin) + noise(80))),
      axis: clock(lefty ? 24 - axisH : axisH),
      vertical: Math.round(v),
      horizontal: Math.round(h),
      usage,
    };
  };
  const pitches = pitchGrades(p);
  const fbUsage = 1 - pitches.reduce((a, x) => a + x.usage, 0);
  const fb = fastballOf(p);
  return {
    angle,
    slot,
    release: Math.round(height * (0.7 + 0.32 * Math.sin((angle * Math.PI) / 180)) * 100) / 100,
    extension: Math.round((1.85 + (height - 1.83) * 1.2 + (stuff - 50) * 0.003 + noise(0.06)) * 100) / 100,
    pitches: [track(fb === '4SFB' ? 'FB' : fb, stuff, fbUsage), ...pitches.map((x) => track(x.type, x.grade, x.usage))],
  };
}
