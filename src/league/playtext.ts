import { k as __i18n_k } from '../i18n/index';
/* Play-by-play in Korean (V0.7). Only the wording is picked here (from a hash of the game and event,
   never the simulation's random stream); the facts come from the engine's log. */
import { hashUnit } from '../draftroom';
import type { PlayEvent } from './engine/types';

const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;

const OUTS = [__i18n_k("league.playtext.oUTS.7f111c95"), __i18n_k("league.playtext.oUTS.62c082bd"), __i18n_k("league.playtext.oUTS.028f714c"), __i18n_k("league.playtext.oUTS.b89bb598"), __i18n_k("league.playtext.oUTS.5786dec2"), __i18n_k("league.playtext.oUTS.1bff398a"), __i18n_k("league.playtext.oUTS.dea249dc"), __i18n_k("league.playtext.oUTS.2435e352"), __i18n_k("league.playtext.oUTS.7cabec65"), __i18n_k("league.playtext.oUTS.361fac51"), __i18n_k("league.playtext.oUTS.e8715b18"), __i18n_k("league.playtext.oUTS.a7902cf9")];
const SINGLES = [__i18n_k("league.playtext.sINGLES.83ca09de"), __i18n_k("league.playtext.sINGLES.2f8aefc0"), __i18n_k("league.playtext.sINGLES.d054bff7"), __i18n_k("league.playtext.sINGLES.5ad7d6e7"), __i18n_k("league.playtext.sINGLES.80f23bdc"), __i18n_k("league.playtext.sINGLES.148128da")];
const DOUBLES = [__i18n_k("league.playtext.dOUBLES.eec1ec97"), __i18n_k("league.playtext.dOUBLES.1f8e8259"), __i18n_k("league.playtext.dOUBLES.445b7482"), __i18n_k("league.playtext.dOUBLES.18052849"), __i18n_k("league.playtext.dOUBLES.4d2e26f9")];
const TRIPLES = [__i18n_k("league.playtext.tRIPLES.75bb93d4"), __i18n_k("league.playtext.tRIPLES.f19577fd"), __i18n_k("league.playtext.tRIPLES.d6447363")];
const HOMERS = [__i18n_k("league.playtext.hOMERS.5498be10"), __i18n_k("league.playtext.hOMERS.ba2289a6"), __i18n_k("league.playtext.hOMERS.6dfe4c13"), __i18n_k("league.playtext.hOMERS.8b3aad8b"), __i18n_k("league.playtext.hOMERS.22635295")];
const DPS = [__i18n_k("league.playtext.dPS.dc8c3604"), __i18n_k("league.playtext.dPS.e4b5cae2"), __i18n_k("league.playtext.dPS.9f27e453"), __i18n_k("league.playtext.dPS.9d1e3078")];
const ERRORS = [__i18n_k("league.playtext.eRRORS.ae52eeb7"), __i18n_k("league.playtext.eRRORS.7ef67f01"), __i18n_k("league.playtext.eRRORS.af3ca0ff"), __i18n_k("league.playtext.eRRORS.5031d097"), __i18n_k("league.playtext.eRRORS.8265a992")];

export function playText(ev: PlayEvent, key: string, name: (id: string) => string): string {
  if (ev.k === 'pitch') return __i18n_k("league.playtext.playText.43752078", { name: name(ev.out), name2: name(ev.p) });
  const who = name(ev.b);
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
        return pick([__i18n_k("league.playtext.playText.what.53bee11b"), __i18n_k("league.playtext.playText.what.2a8b27c9"), __i18n_k("league.playtext.playText.what.3f349ed1")], key);
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
        return pick(ev.runs > 0 ? OUTS.filter((x) => x.endsWith('땅볼')) : OUTS, key);
    }
  })();
  return ev.res !== 'HR' && ev.runs > 0 ? __i18n_k("league.playtext.playText.7b8ebb4c", { who: who, what: what, runs: ev.runs }) : __i18n_k("league.playtext.playText.ebc0b8c7", { who: who, what: what });
}

export const halfLabel = (i: number, top: boolean) => __i18n_k("league.playtext.halfLabel.70a465d4", { i: i, value: top ? __i18n_k("league.playtext.halfLabel.3845248e") : __i18n_k("league.playtext.halfLabel.4d65d9d9") });

/** The key moment lines for a headline: the go-ahead or big hits. */
export function scoringPlays(log: PlayEvent[]): Extract<PlayEvent, { k: 'pa' }>[] {
  return log.filter((e): e is Extract<PlayEvent, { k: 'pa' }> => e.k === 'pa' && e.runs > 0);
}

