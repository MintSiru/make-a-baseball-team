import { k as __i18n_k } from '../i18n/index';
/* The relay a pitch at a time (1.7.0, from the 1.6 feedback: 1구씩 실시간 문자 중계, with an old-FM board — the
   bases as go stones, the count and outs as lamps). The engine plays a game by plate appearances, so the pitches
   are written afterwards from each plate appearance's result: the count it reached, how many fouls, which pitch and
   how fast (his repertoire and radar gun), always ending in the result the engine played (a strikeout on the third
   strike, a walk on ball four, a ball in play). Seeded by the game and the play: the same game reads the same way
   every time, and nothing here touches the simulation. */
import { rng } from '../draftroom';
import { distanceOf, type BattedBall } from './battedball';
import { clearance, layoutOf, type ParkLayout } from './layout';
import type { PlayEvent } from './engine/types';
import { averageVelocity, FASTBALL_LABELS, fastballOf, repertoire, PITCH_LABELS, type PitchType } from './pitches';
import { halfLabel, playText } from './playtext';
import type { LeagueState } from './state';
import { nationalLog, nationalName } from './nationalgames';

/** How much slower than his fastball each pitch comes (km/h). */
const PITCH_DROP: Record<PitchType, number> = { CB: 25, CH: 17, FRK: 17, CUT: 5, '2SFB': 5, SL: 13, SW: 13, SNK: 3, CIR: 17, SPL: 12, SLV: 18, KN: 38, SCR: 20, PLM: 27, SH: 4 };

export interface PitchFrame {
  /** Index of the play in the game's log (the relay's line). */
  play: number;
  half: string;
  inning: number;
  top: boolean;
  batter: string;
  pitcher: string;
  balls: number;
  strikes: number;
  outs: number;
  bases: [boolean, boolean, boolean];
  score: [number, number];
  /** "직구 147km/h · 볼", "타석: 김민준", the play itself on the last pitch. */
  text: string;
  /** The first frame of a plate appearance (no pitch yet) or a pitching change. */
  kind: 'up' | 'pitch' | 'result' | 'change';
  /** 1.7.1: where a pitch crossed the plate (the strike zone is −1…1 each way, up and the first-base side positive). */
  loc?: PitchLoc;
  /** 1.7.1: where a ball in play came down (metres from home plate, degrees off the centre-field line, right positive). */
  hit?: HitSpot;
  /** 2.0.2: the home park's fences (layout.ts), to draw the field by. */
  park?: ParkLayout;
}

export type PitchCall = 'ball' | 'strike' | 'swing' | 'foul' | 'play' | 'hbp';
export interface PitchLoc {
  x: number;
  y: number;
  call: PitchCall;
}
export interface HitSpot {
  dist: number;
  angle: number;
  kind: 'ground' | 'line' | 'fly' | 'hr';
  out: boolean;
}

/** Where a pitch went, from its call: balls outside the zone, called strikes on it (often the corners), chases low. */
function locOf(call: string, r: () => number): PitchLoc {
  const u = (a: number, b: number) => a + r() * (b - a);
  const outside = (): [number, number] => {
    for (;;) {
      const x = u(-2, 2),
        y = u(-1.9, 1.7);
      if (Math.abs(x) > 1.08 || Math.abs(y) > 1.08) return [x, y];
    }
  };
  switch (call) {
    case 'ball':
    case 'ball4': {
      const [x, y] = outside();
      return { x, y, call: 'ball' };
    }
    case 'called':
    case 'lookingK': {
      // Called strikes live on the edges more than the middle.
      const edge = () => (r() < 0.6 ? (r() < 0.5 ? -1 : 1) * u(0.55, 0.97) : u(-0.97, 0.97));
      return { x: edge(), y: edge(), call: 'strike' };
    }
    case 'swing':
    case 'swingK':
      // Half the swings and misses chase one low or away.
      return r() < 0.5 ? { x: u(-1.4, 1.4), y: u(-1.7, -1.1), call: 'swing' } : { x: u(-0.95, 0.95), y: u(-0.95, 0.95), call: 'swing' };
    case 'foul':
      return { x: u(-1.15, 1.15), y: u(-1.15, 1.15), call: 'foul' };
    case 'hbp':
      return { x: (r() < 0.5 ? -1 : 1) * u(1.8, 2.15), y: u(-0.4, 1.3), call: 'hbp' };
    default:
      return { x: u(-1.05, 1.05), y: u(-1.05, 1.05), call: 'play' };
  }
}

// prettier-ignore
/** Where the relay's words put the ball: the direction or the fielder, longest phrase first (canonical Korean, spaces
    taken out): [metres from home, degrees off the centre-field line, how far either way it may be]. */
const SPOTS: Record<string, [number, number, number?]> = {
  좌중월: [118, -22], 우중월: [118, 22], 좌월: [108, -36], 우월: [108, 36], 중월: [126, 0],
  좌중간: [96, -22], 우중간: [96, 22], 좌익선상: [84, -43], 우익선상: [84, 43], 펜스직격: [104, 0, 30],
  좌전: [58, -28], 중전: [64, 0], 우전: [58, 28], 내야안타: [26, 0, 35], 유격수옆: [46, -9], 투수맞고: [22, 6],
  포수: [9, -20], 유격수: [41, -15], '2루수': [41, 15], '3루수': [30, -34], '1루수': [30, 34],
  좌익수: [80, -28], 중견수: [90, 0], 우익수: [80, 28], 투수: [17, 0], 희생번트: [12, 12],
};

/** The landing spot of a ball in play (null for a strikeout, a walk or a hit batter). 2.0.1: with the ball's flight
    in the log, its direction and (in the air) its carry; the fielder's spot still for a ball on the ground. */
export function hitSpot(res: string, text: string, r: () => number, ball?: BattedBall, park?: ParkLayout): HitSpot | null {
  if (res === 'K' || res === 'BB' || res === 'HBP') return null;
  const out = res === 'OUT' || res === 'DP' || res === 'SF' || res === 'SH';
  const kind: HitSpot['kind'] = res === 'HR' ? 'hr' : /땅볼|병살|번트|내야|굴절|빠지는|실책/.test(text) ? 'ground' : /뜬공|플라이/.test(text) ? 'fly' : 'line';
  const jitter = (n: number) => (r() - 0.5) * 2 * n;
  const flat = text.replace(/\s/g, '');
  const spot = Object.keys(SPOTS).find((w) => flat.includes(w));
  const [dist, angle, wide = 5] = spot ? SPOTS[spot]! : [60, 0];
  // A foul pop comes down beyond the line on his side.
  const a = flat.includes('파울') ? (angle <= 0 ? -1 : 1) * (52 + r() * 10) : angle + jitter(wide);
  if (ball && !flat.includes('파울')) {
    const air = ball.la >= 10;
    const k: HitSpot['kind'] = res === 'HR' ? 'hr' : !air ? 'ground' : ball.la < 25 ? 'line' : 'fly';
    // A ground ball comes to rest where the fielder took it (or through the infield for a hit); a pop-up stays short.
    const carry = ball.dist ?? Math.min(115, distanceOf(ball.ev, ball.la) * (ball.la >= 50 ? 0.55 : 1));
    // In the park: a ball that stayed in came down short of the fence (or off it).
    const inside = park && res !== 'HR' ? Math.min(carry, clearance(park, ball.dir) - 2) : carry;
    const far = air ? inside : out ? dist : Math.max(dist, 42 + r() * 12);
    return { dist: Math.max(5, Math.round(far)), angle: ball.dir, kind: k, out };
  }
  return { dist: Math.max(5, dist + jitter(kind === 'hr' ? 6 : 5)), angle: a, kind, out };
}

type Call = 'ball' | 'called' | 'swing' | 'foul';

/** The count a plate appearance reached before its last pitch, and the pitches that got it there. */
function countPath(ev: Extract<PlayEvent, { k: 'pa' }>, looking: boolean, r: () => number): { calls: Call[]; last: string } {
  const pickInt = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  let balls: number, strikes: number;
  let last: string;
  switch (ev.res) {
    case 'K':
      balls = pickInt(0, 3);
      strikes = 2;
      last = looking ? 'lookingK' : 'swingK';
      break;
    case 'BB':
      balls = 3;
      strikes = pickInt(0, 2);
      last = 'ball4';
      break;
    case 'HBP':
      balls = pickInt(0, 3);
      strikes = pickInt(0, 2);
      last = 'hbp';
      break;
    case 'SH':
      balls = pickInt(0, 1);
      strikes = pickInt(0, 1);
      last = 'play';
      break;
    default:
      // Most balls in play come early in the count.
      balls = Math.min(3, Math.floor(r() * r() * 4.5));
      strikes = Math.min(2, Math.floor(r() * 3));
      last = 'play';
  }
  const calls: Call[] = [...Array<Call>(balls).fill('ball')];
  for (let i = 0; i < strikes; i++) {
    const x = r();
    calls.push(x < 0.4 ? 'called' : x < 0.65 ? 'swing' : 'foul');
  }
  // Shuffle, then the fouls a two-strike hitter spoils.
  for (let i = calls.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [calls[i], calls[j]] = [calls[j]!, calls[i]!];
  }
  if (strikes === 2) for (let i = 0, n = Math.floor(r() * r() * 4); i < n; i++) calls.push('foul');
  return { calls, last };
}

/** A pitch from his repertoire, and its speed on the radar gun. */
function pitchOf(s: LeagueState, pid: string, r: () => number): string {
  const p = s.players[pid];
  if (!p) return '';
  const avg = averageVelocity(p);
  const reps = repertoire(p);
  let x = r();
  for (const rep of reps) {
    if ((x -= rep.usage) < 0) {
      const drop = PITCH_DROP[rep.type];
      return avg ? __i18n_k("league.pitchfeed.text.977ba357", { type: PITCH_LABELS[rep.type], velo: Math.round(avg - drop + (r() - 0.5) * 6) }) : PITCH_LABELS[rep.type];
    }
  }
  // 1.9.3: his fastball by its kind (포심, 투심, 커터).
  const fb = FASTBALL_LABELS[fastballOf(p)];
  return avg ? __i18n_k("league.pitchfeed.text.977ba357", { type: fb, velo: Math.round(avg + (r() - 0.3) * 4) }) : fb;
}

const CALL_TEXT = (): Record<Call | 'ball4' | 'hbp' | 'swingK' | 'lookingK', string> => ({
  ball: __i18n_k("league.pitchfeed.text.c72996aa"),
  called: __i18n_k("league.pitchfeed.text.4a03be0a"),
  swing: __i18n_k("league.pitchfeed.text.6145417a"),
  foul: __i18n_k("league.pitchfeed.text.1bd463ff"),
  ball4: __i18n_k("league.pitchfeed.text.21e0537f"),
  hbp: __i18n_k("league.pitchfeed.text.d3bcca1e"),
  swingK: __i18n_k("league.pitchfeed.text.53bee11b"),
  lookingK: __i18n_k("league.pitchfeed.text.2a8b27c9"),
});

/** Every pitch of one of our games (null when its play-by-play is not kept). */
export function pitchFeed(s: LeagueState, id: string): PitchFrame[] | null {
  const log = s.pbp?.[id] ?? nationalLog(s, id);
  if (!log) return null;
  const name = (pid: string) => s.players[pid]?.name ?? nationalName(s, pid) ?? '?';
  const words = CALL_TEXT();
  const host = s.teams.find((t) => t.id === s.boxes?.[id]?.home);
  const park = host ? layoutOf(host) : undefined;
  const frames: PitchFrame[] = [];
  let half = '',
    outs = 0,
    bases: [boolean, boolean, boolean] = [false, false, false],
    score: [number, number] = [0, 0];
  log.forEach((ev, n) => {
    const h = halfLabel(ev.i, ev.top);
    if (h !== half) {
      half = h;
      outs = 0;
      bases = [false, false, false];
    }
    const base = { play: n, half: h, inning: ev.i, top: ev.top, ...(park ? { park } : {}) };
    if (ev.k === 'sub') {
      frames.push({ ...base, batter: '', pitcher: frames.at(-1)?.pitcher ?? '', balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: playText(ev, `${id}-${n}`, name), kind: 'change' });
      return;
    }
    if (ev.k === 'pitch') {
      frames.push({ ...base, batter: '', pitcher: name(ev.p), balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: playText(ev, `${id}-${n}`, name), kind: 'change' });
      return;
    }
    const r = rng(`${id}|pitches|${n}`);
    const text = playText(ev, `${id}-${n}`, name);
    const looking = ev.res === 'K' && text.includes(__i18n_k("league.pitchfeed.text.25c6a4e8"));
    const { calls, last } = countPath(ev, looking, r);
    const who = { batter: name(ev.b), pitcher: name(ev.p) };
    // Where the pitches went and the ball landed: a stream of their own (the words above stay as they were).
    const rl = rng(`${id}|loc|${n}`);
    let b = 0,
      st = 0;
    frames.push({ ...base, ...who, balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: __i18n_k("league.pitchfeed.text.8f578dfd", { name: who.batter }), kind: 'up' });
    for (const c of calls) {
      if (c === 'ball') b++;
      else if (c !== 'foul' || st < 2) st = Math.min(2, st + 1);
      frames.push({ ...base, ...who, balls: b, strikes: st, outs, bases: [...bases], score: [...score], text: __i18n_k("league.pitchfeed.text.d9ea4c15", { pitch: pitchOf(s, ev.p, r), call: words[c] }), kind: 'pitch', loc: locOf(c, rl) });
    }
    // The last pitch: the count it ends on, then the play as the relay tells it, and the bases after.
    const fb = last === 'ball4' ? 4 : b,
      fs = last === 'swingK' || last === 'lookingK' ? 3 : st;
    const pitch = pitchOf(s, ev.p, r);
    const lastText = last === 'play' ? __i18n_k("league.pitchfeed.text.d6233f39", { pitch }) : __i18n_k("league.pitchfeed.text.d9ea4c15", { pitch, call: words[last as keyof typeof words] });
    frames.push({ ...base, ...who, balls: Math.min(fb, 4), strikes: Math.min(fs, 3), outs, bases: [...bases], score: [...score], text: lastText, kind: 'pitch', loc: locOf(last, rl) });
    outs = ev.outs;
    bases = [...ev.bases];
    score = [...ev.score];
    const spot = hitSpot(ev.res, text, rl, ev.ball, park);
    // 2.0.1: what the tracking read off the ball.
    const flew = ev.ball;
    const read = flew ? (flew.dist ? __i18n_k("league.pitchfeed.text.d0a27f8f", { ev: flew.ev.toFixed(1), la: flew.la, dist: flew.dist }) : __i18n_k("league.pitchfeed.text.1186ab8b", { ev: flew.ev.toFixed(1), la: flew.la })) : '';
    frames.push({ ...base, ...who, balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: text + read, kind: 'result', ...(spot ? { hit: spot } : {}) });
  });
  return frames;
}
