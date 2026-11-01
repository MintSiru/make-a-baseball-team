import { k as __i18n_k } from '../i18n/index';
/* When a player reaches free agency (1.8.0, from the 1.7 feedback: 자팀·타팀 선수의 FA 계약 연도와 남은 기간). The
   rules are offseason.ts isFreeAgent's: eight registered seasons from high school (seven from college), four more
   after a free-agent deal; a registered season is 145 days on the first team (RULES.md §2). What is shown is a
   projection: the seasons he still needs, as if he spends each one on the first team, and no earlier than the last
   season of a contract he has signed. Every club's players are public, so the outlook is shown for anyone. */
import type { Player } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { isForeign } from './players';
import { faSeasonsFor, faSeasonsNeeded } from './offseason';
import type { LeagueState } from './state';

const F = KBO_2026.freeAgency;

export interface FaOutlook {
  /** The season after which he files (null: foreign, development or not in the league). */
  year: number | null;
  /** Seasons still to play before then, the current one included in the season. */
  left: number | null;
  /** A second free agency (four seasons after a deal). */
  again: boolean;
  /** The last season of his current contract, when it runs past this one. */
  until: number | null;
  /** In a sentence (the profile) and in a word (the tables). */
  text: string;
  short: string;
}

/** The season being played, or the one just finished in the winter. */
const seasonNow = (s: LeagueState) => (s.offseason ? s.offseason.year : s.year);
/** 2.0.67 (the user's report): the seasons the free agency of the coming winter asks, as offseason.ts counts them —
    the board's rule when it changed it (1.9.9), and the year's rule in a league that plays history. */
const neededSeasons = (p: Player, now: number) => {
  const n = faSeasonsNeeded(p, now + 1);
  return Number.isFinite(n) ? n : faSeasonsFor(p, now);
};

export function faOutlook(s: LeagueState, p: Player): FaOutlook {
  const now = seasonNow(s);
  const until = Math.max(0, ...(p.contract?.salaries ?? []).map((x) => x.season));
  const longer = until > now ? until : null;
  const none = (text: string, short = '-'): FaOutlook => ({ year: null, left: null, again: false, until: longer, text, short });
  if (isForeign(p)) return none(longer ? __i18n_k("league.faclock.text.72556efc", { until: longer }) : __i18n_k("league.faclock.text.5537cf5c"));
  if (p.contract?.kind === 'development') return none(__i18n_k("league.faclock.text.d33b3ebb"));
  if (p.status !== 'active' && p.status !== 'military') return none(__i18n_k("league.faclock.text.d72e5822"));
  const sv = p.service;
  const again = sv.lastFreeAgencyAt !== undefined;
  const need = again ? sv.lastFreeAgencyAt! + F.seasonsToRequalify : neededSeasons(p, now);
  // This season's days count toward this season while it is played.
  const inSeason = !s.offseason && (s.phase === 'regular' || s.phase === 'postseason');
  const have = sv.creditedSeasons;
  const short = Math.max(0, need - have);
  // In the season he still needs `short` seasons including this one; in the winter, from next season on.
  let year = short === 0 ? now : inSeason ? now + short - 1 : now + short;
  if (longer && longer > year) year = longer;
  const left = Math.max(0, year - now + (inSeason ? 1 : 0));
  const what = again ? __i18n_k("league.faclock.text.99ffd4b0") : 'FA';
  const text =
    short === 0 && !longer
      ? __i18n_k("league.faclock.text.af5d157c", { what })
      : year === now
        ? __i18n_k("league.faclock.text.8285a832", { year, what })
        : longer && longer === year && short > 0 && (inSeason ? now + short - 1 : now + short) < year
          ? __i18n_k("league.faclock.text.dfd84a0f", { year, what })
          : __i18n_k("league.faclock.text.60bb069e", { year, what, left });
  return { year, left, again, until: longer, text, short: year === now ? __i18n_k("league.faclock.text.3fd8a01e") : `'${String(year).slice(2)}` };
}
