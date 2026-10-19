import { k as __i18n_k } from '../i18n/index';
/* 2.0.25 (the user's request): the commentator in the text relay (해설 실황). Now and then after a play, and before a
   big plate appearance, a line from the booth: a home run, a strikeout out of a jam, a double play, a lead changing
   hands, a hit batter, the late innings of a close game, a new arm on the mound, one of the league's best at the plate.
   Display only, on a stream of its own: nothing in the game depends on it. */
import { hashUnit } from '../draftroom';
import type { PlayEvent } from './engine/types';

type Pa = Extract<PlayEvent, { k: 'pa' }>;
type Line = (name: string) => string;

const pick = (key: string, lines: Line[], name: string) => lines[Math.floor(hashUnit(key) * lines.length)]!(name);

const HR: Line[] = [
  (n) => __i18n_k("league.commentary.text.7e61bb9b", { n }),
  () => __i18n_k("league.commentary.text.e0791534"),
  (n) => __i18n_k("league.commentary.text.b5d80fab", { n }),
  () => __i18n_k("league.commentary.text.ba36d0e9"),
];
const JAM_K: Line[] = [
  () => __i18n_k("league.commentary.text.a3da607d"),
  () => __i18n_k("league.commentary.text.d4128ab5"),
  () => __i18n_k("league.commentary.text.45c6482c"),
];
const DP: Line[] = [
  () => __i18n_k("league.commentary.text.ecf97507"),
  () => __i18n_k("league.commentary.text.e5365194"),
];
const LEAD: Line[] = [
  () => __i18n_k("league.commentary.text.20af4aeb"),
  () => __i18n_k("league.commentary.text.05b0aa5f"),
];
const TIE: Line[] = [() => __i18n_k("league.commentary.text.7aada43a"), () => __i18n_k("league.commentary.text.60c9cb4d")];
const HBP: Line[] = [
  () => __i18n_k("league.commentary.text.0930bdb4"),
  () => __i18n_k("league.commentary.text.e13284e0"),
];
const WALK_FULL: Line[] = [() => __i18n_k("league.commentary.text.f192f528"), () => __i18n_k("league.commentary.text.9085576b")];
const LATE: Line[] = [
  () => __i18n_k("league.commentary.text.ca8af3e1"),
  () => __i18n_k("league.commentary.text.e5668d16"),
];
const STAR: Line[] = [(n) => __i18n_k("league.commentary.text.cee200d7", { n }), (n) => __i18n_k("league.commentary.text.44e86835", { n })];
const CHANGE: Line[] = [(n) => __i18n_k("league.commentary.text.111b2a0d", { n }), (n) => __i18n_k("league.commentary.text.383ece68", { n })];

/** How often the booth speaks up for each kind of moment. */
export const TALK = { hr: 0.75, jamK: 0.6, dp: 0.5, lead: 0.9, tie: 0.7, hbp: 0.8, walkFull: 0.25, late: 0.35, star: 0.2, change: 0.3 };

/** A line after the play, or null. `before` is the score going in. */
export function afterPlay(ev: Pa, before: [number, number], basesBefore: [boolean, boolean, boolean], key: string, name: (id: string) => string, full: boolean): string | null {
  const roll = (p: number) => hashUnit(`${key}|talk`) < p;
  const batter = name(ev.b);
  const [aw, hm] = before,
    [aw2, hm2] = ev.score;
  const led = Math.sign(hm - aw),
    leads = Math.sign(hm2 - aw2);
  if (led !== 0 && leads !== 0 && led !== leads && roll(TALK.lead)) return pick(`${key}|lead`, LEAD, batter);
  if (led !== 0 && leads === 0 && roll(TALK.tie)) return pick(`${key}|tie`, TIE, batter);
  if (ev.res === 'HR' && roll(TALK.hr)) return pick(`${key}|hr`, HR, batter);
  if (ev.res === 'K' && (basesBefore[1] || basesBefore[2]) && roll(TALK.jamK)) return pick(`${key}|k`, JAM_K, batter);
  if (ev.res === 'DP' && roll(TALK.dp)) return pick(`${key}|dp`, DP, batter);
  if (ev.res === 'HBP' && roll(TALK.hbp)) return pick(`${key}|hbp`, HBP, batter);
  if (ev.res === 'BB' && full && roll(TALK.walkFull)) return pick(`${key}|bb`, WALK_FULL, batter);
  return null;
}

/** A line as a batter steps in, or null: the late innings of a close game, or a star. */
export function beforePlay(ev: Pa, score: [number, number], key: string, name: (id: string) => string, star: boolean): string | null {
  const roll = (p: number) => hashUnit(`${key}|talk-up`) < p;
  if (ev.i >= 8 && Math.abs(score[0] - score[1]) <= 1 && roll(TALK.late)) return pick(`${key}|late`, LATE, name(ev.b));
  if (star && roll(TALK.star)) return pick(`${key}|star`, STAR, name(ev.b));
  return null;
}

/** A line for a new pitcher, or null. */
export function onChange(pitcher: string, key: string): string | null {
  return hashUnit(`${key}|talk-change`) < TALK.change ? pick(`${key}|change`, CHANGE, pitcher) : null;
}
