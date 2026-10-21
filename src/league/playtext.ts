import { k as __i18n_k } from '../i18n/index';
/* Play-by-play in Korean (V0.7). Only the wording is picked here (from a hash of the game and event,
   never the simulation's random stream); the facts come from the engine's log. */
import { hashUnit } from '../draftroom';
import { distanceOf, type BattedBall } from './battedball';
import type { PlayEvent } from './engine/types';

const pickBy = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;

const OUTS = [__i18n_k("league.playtext.oUTS.7f111c95"), __i18n_k("league.playtext.oUTS.62c082bd"), __i18n_k("league.playtext.oUTS.028f714c"), __i18n_k("league.playtext.oUTS.b89bb598"), __i18n_k("league.playtext.oUTS.5786dec2"), __i18n_k("league.playtext.oUTS.1bff398a"), __i18n_k("league.playtext.oUTS.dea249dc"), __i18n_k("league.playtext.oUTS.2435e352"), __i18n_k("league.playtext.oUTS.7cabec65"), __i18n_k("league.playtext.oUTS.361fac51"), __i18n_k("league.playtext.oUTS.e8715b18"), __i18n_k("league.playtext.oUTS.a7902cf9")];
const SINGLES = [__i18n_k("league.playtext.sINGLES.83ca09de"), __i18n_k("league.playtext.sINGLES.2f8aefc0"), __i18n_k("league.playtext.sINGLES.d054bff7"), __i18n_k("league.playtext.sINGLES.5ad7d6e7"), __i18n_k("league.playtext.sINGLES.80f23bdc"), __i18n_k("league.playtext.sINGLES.148128da")];
const DOUBLES = [__i18n_k("league.playtext.dOUBLES.eec1ec97"), __i18n_k("league.playtext.dOUBLES.1f8e8259"), __i18n_k("league.playtext.dOUBLES.445b7482"), __i18n_k("league.playtext.dOUBLES.18052849"), __i18n_k("league.playtext.dOUBLES.4d2e26f9")];
const TRIPLES = [__i18n_k("league.playtext.tRIPLES.75bb93d4"), __i18n_k("league.playtext.tRIPLES.f19577fd"), __i18n_k("league.playtext.tRIPLES.d6447363")];
const HOMERS = [__i18n_k("league.playtext.hOMERS.5498be10"), __i18n_k("league.playtext.hOMERS.ba2289a6"), __i18n_k("league.playtext.hOMERS.6dfe4c13"), __i18n_k("league.playtext.hOMERS.8b3aad8b"), __i18n_k("league.playtext.hOMERS.22635295")];
const DPS = [__i18n_k("league.playtext.dPS.dc8c3604"), __i18n_k("league.playtext.dPS.e4b5cae2"), __i18n_k("league.playtext.dPS.9f27e453"), __i18n_k("league.playtext.dPS.9d1e3078")];
const ERRORS = [__i18n_k("league.playtext.eRRORS.ae52eeb7"), __i18n_k("league.playtext.eRRORS.7ef67f01"), __i18n_k("league.playtext.eRRORS.af3ca0ff"), __i18n_k("league.playtext.eRRORS.5031d097"), __i18n_k("league.playtext.eRRORS.8265a992")];

/** 1.7.0: where a defensive replacement goes (the alerts' position names). */
const POS: Record<string, string> = { C: __i18n_k("league.alerts.pOS.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.alerts.pOS.sS.3e24c7f1"), LF: __i18n_k("league.alerts.pOS.lF.73836db2"), CF: __i18n_k("league.alerts.pOS.cF.56780b2a"), RF: __i18n_k("league.alerts.pOS.rF.a28a0ef8") };

/** 2.0.1: the word that fits where the ball went (battedball.ts), as an index into the lists above; null without a
    ball (a log from before), when the wording is picked as it was. `dir`: degrees off the centre-field line, left
    field negative. */
function byBall(res: string, ball: BattedBall, runs: number): number | null {
  const { dir, la, ev } = ball;
  const ground = la < 10;
  // Infielders on the ground: third, short, second, first; the pitcher on a soft one up the middle.
  const infield = () => (Math.abs(dir) < 4 && ev < 125 ? 4 : dir < -22 ? 2 : dir < -2 ? 0 : dir < 20 ? 1 : 3);
  switch (res) {
    case 'HR':
      return dir < -22 ? 0 : dir < -8 ? 3 : dir <= 8 ? 1 : dir <= 22 ? 4 : 2;
    case '3B':
      return dir > 30 ? 2 : dir >= 0 ? 0 : 1;
    case '2B':
      return dir < -30 ? 2 : dir > 30 ? 3 : dir < 0 ? 0 : 1;
    case '1B':
      return ground && ev < 120 ? 3 : dir < -12 ? 0 : dir > 12 ? 2 : 1;
    case 'DP':
      return [0, 1, 2, 1, 3][infield()]!;
    case 'SF':
      return dir < -15 ? 0 : dir > 15 ? 2 : 1;
    case 'E':
      return ground ? [0, 2, 1, 3, 0][infield()]! : 4;
    case 'OUT': {
      if (ground || runs > 0) return infield();
      if (la >= 50) return Math.abs(dir) < 12 ? (dir < 0 ? 9 : 11) : dir < 0 ? 10 : 9;
      // 2.0.34: a liner caught in the infield is named by infieldAirOut; one that carried is an outfielder's.
      return dir < -15 ? 6 : dir > 15 ? 7 : 5;
    }
  }
  return null;
}

/** 2.0.34 (the user's report: the relay put a ball down by the mound and called it a fly to centre): an out in the air
    that came down short of the outfield grass — as far as its flight carried, which is where the relay draws it
    (pitchfeed.ts) — was an infielder's catch: a soft liner or a flare taken in the infield. Pop-ups (very high) keep
    their own words; a ground ball is a ground ball. */
export const INFIELD_DEPTH = 45;
const INFIELD_AIR: Record<'P' | '3B' | 'SS' | '2B' | '1B', () => [string, string]> = {
  P: () => [__i18n_k("league.playtext.text.7065790d"), __i18n_k("league.playtext.text.07aa6b67")],
  '3B': () => [__i18n_k("league.playtext.text.60d2f69b"), __i18n_k("league.playtext.text.b1cf5587")],
  SS: () => [__i18n_k("league.playtext.text.361fac51"), __i18n_k("league.playtext.text.0417ca29")],
  '2B': () => [__i18n_k("league.playtext.text.b918f520"), __i18n_k("league.playtext.text.7cabec65")],
  '1B': () => [__i18n_k("league.playtext.text.40076727"), __i18n_k("league.playtext.text.c5299a78")],
};
export function infieldAirOut(ball: BattedBall): string | null {
  const { dir, la, ev } = ball;
  if (la < 10 || la >= 50 || distanceOf(ev, la) >= INFIELD_DEPTH) return null;
  const pos = Math.abs(dir) <= 5 ? 'P' : dir < -22 ? '3B' : dir < 0 ? 'SS' : dir < 22 ? '2B' : '1B';
  return INFIELD_AIR[pos]()[la < 25 ? 1 : 0];
}

export function playText(ev: PlayEvent, key: string, name: (id: string) => string): string {
  if (ev.k === 'sub') {
    const v = { name: name(ev.in), out: name(ev.out) };
    if (ev.sub === 'PH') return __i18n_k("league.playtext.text.2c2b34d5", v);
    if (ev.sub === 'PR') return __i18n_k("league.playtext.text.6a7dbf39", v);
    return __i18n_k("league.playtext.text.6420ae1f", { ...v, pos: POS[ev.pos] ?? ev.pos });
  }
  if (ev.k === 'pitch') return __i18n_k("league.playtext.playText.43752078", { name: name(ev.out), name2: name(ev.p) });
  const who = name(ev.b);
  const at = ev.ball ? byBall(ev.res, ev.ball, ev.runs) : null;
  const pick = <T,>(xs: T[], key: string) => (at != null && xs[at] !== undefined ? xs[at]! : pickBy(xs, key));
  const what = (() => {
    switch (ev.res) {
      case 'HR':
        return __i18n_k("league.playtext.playText.what.9af5d080", { pick: pick(HOMERS, key), value: ev.runs >= 4 ? __i18n_k("league.playtext.playText.what.31c7e85f") : ev.runs > 1 ? __i18n_k("league.playtext.playText.what.b673cac3", { runs: ev.runs }) : __i18n_k("league.playtext.playText.what.42579f85") });
      case '3B':
        return pick(TRIPLES, key);
      case '2B':
        return pick(DOUBLES, key);
      case '1B':
        return pick(SINGLES, key);
      case 'BB':
        return __i18n_k("league.playtext.playText.what.21e0537f");
      case 'HBP':
        return __i18n_k("league.playtext.playText.what.58ef970a");
      case 'K':
        return pickBy([__i18n_k("league.playtext.playText.what.53bee11b"), __i18n_k("league.playtext.playText.what.2a8b27c9"), __i18n_k("league.playtext.playText.what.3f349ed1")], key);
      case 'DP':
        return pick(DPS, key);
      case 'SF':
        return pick([__i18n_k("league.playtext.playText.what.adb1790c"), __i18n_k("league.playtext.playText.what.01a4d22b"), __i18n_k("league.playtext.playText.what.54791ecb")], key);
      case 'SH':
        return __i18n_k("league.playtext.playText.what.eb193123");
      case 'E':
        return pick(ERRORS, key);
      default:
        // An out that scores a run is a ground ball to the infield (a fly would be a sacrifice fly).
        if (ev.res === 'OUT' && ev.ball && ev.runs === 0) {
          const short = infieldAirOut(ev.ball);
          if (short) return short;
        }
        return at != null ? OUTS[at]! : pick(ev.runs > 0 ? OUTS.filter((x) => x.endsWith('땅볼')) : OUTS, key);
    }
  })();
  return ev.res !== 'HR' && ev.runs > 0 ? __i18n_k("league.playtext.playText.7b8ebb4c", { who: who, what: what, runs: ev.runs }) : __i18n_k("league.playtext.playText.ebc0b8c7", { who: who, what: what });
}

export const halfLabel = (i: number, top: boolean) => __i18n_k("league.playtext.halfLabel.70a465d4", { i: i, value: top ? __i18n_k("league.playtext.halfLabel.3845248e") : __i18n_k("league.playtext.halfLabel.4d65d9d9") });

/** The key moment lines for a headline: the go-ahead or big hits. */
export function scoringPlays(log: PlayEvent[]): Extract<PlayEvent, { k: 'pa' }>[] {
  return log.filter((e): e is Extract<PlayEvent, { k: 'pa' }> => e.k === 'pa' && e.runs > 0);
}

