import { k as __i18n_k } from '../i18n/index';
/* The relay a pitch at a time (1.7.0, from the 1.6 feedback: 1구씩 실시간 문자 중계, with an old-FM board — the
   bases as go stones, the count and outs as lamps). The engine plays a game by plate appearances, so the pitches
   are written afterwards from each plate appearance's result: the count it reached, how many fouls, which pitch and
   how fast (his repertoire and radar gun), always ending in the result the engine played (a strikeout on the third
   strike, a walk on ball four, a ball in play). Seeded by the game and the play: the same game reads the same way
   every time, and nothing here touches the simulation. */
import { rng } from '../draftroom';
import type { PlayEvent } from './engine/types';
import { averageVelocity, repertoire, PITCH_LABELS } from './pitches';
import { halfLabel, playText } from './playtext';
import type { LeagueState } from './state';

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
      const drop = rep.type === 'CB' ? 25 : rep.type === 'CH' || rep.type === 'FO' ? 17 : rep.type === 'CT' || rep.type === 'SI' ? 5 : 13;
      return avg ? __i18n_k("league.pitchfeed.text.977ba357", { type: PITCH_LABELS[rep.type], velo: Math.round(avg - drop + (r() - 0.5) * 6) }) : PITCH_LABELS[rep.type];
    }
  }
  return avg ? __i18n_k("league.pitchfeed.text.0a35a0ff", { velo: Math.round(avg + (r() - 0.3) * 4) }) : __i18n_k("league.pitchfeed.text.b17dbbc7");
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
  const log = s.pbp?.[id];
  if (!log) return null;
  const name = (pid: string) => s.players[pid]?.name ?? '?';
  const words = CALL_TEXT();
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
    const base = { play: n, half: h, inning: ev.i, top: ev.top };
    if (ev.k === 'pitch') {
      frames.push({ ...base, batter: '', pitcher: name(ev.p), balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: playText(ev, `${id}-${n}`, name), kind: 'change' });
      return;
    }
    const r = rng(`${id}|pitches|${n}`);
    const text = playText(ev, `${id}-${n}`, name);
    const looking = ev.res === 'K' && text.includes(__i18n_k("league.pitchfeed.text.25c6a4e8"));
    const { calls, last } = countPath(ev, looking, r);
    const who = { batter: name(ev.b), pitcher: name(ev.p) };
    let b = 0,
      st = 0;
    frames.push({ ...base, ...who, balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text: __i18n_k("league.pitchfeed.text.8f578dfd", { name: who.batter }), kind: 'up' });
    for (const c of calls) {
      if (c === 'ball') b++;
      else if (c !== 'foul' || st < 2) st = Math.min(2, st + 1);
      frames.push({ ...base, ...who, balls: b, strikes: st, outs, bases: [...bases], score: [...score], text: __i18n_k("league.pitchfeed.text.d9ea4c15", { pitch: pitchOf(s, ev.p, r), call: words[c] }), kind: 'pitch' });
    }
    // The last pitch: the count it ends on, then the play as the relay tells it, and the bases after.
    const fb = last === 'ball4' ? 4 : b,
      fs = last === 'swingK' || last === 'lookingK' ? 3 : st;
    const pitch = pitchOf(s, ev.p, r);
    const lastText = last === 'play' ? __i18n_k("league.pitchfeed.text.d6233f39", { pitch }) : __i18n_k("league.pitchfeed.text.d9ea4c15", { pitch, call: words[last as keyof typeof words] });
    frames.push({ ...base, ...who, balls: Math.min(fb, 4), strikes: Math.min(fs, 3), outs, bases: [...bases], score: [...score], text: lastText, kind: 'pitch' });
    outs = ev.outs;
    bases = [...ev.bases];
    score = [...ev.score];
    frames.push({ ...base, ...who, balls: 0, strikes: 0, outs, bases: [...bases], score: [...score], text, kind: 'result' });
  });
  return frames;
}
