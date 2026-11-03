import { k as __i18n_k } from '../i18n/index';
/* 2.0.70 (the user's request): the official ball's liveliness (공인구 반발계수). The KBO allows a coefficient of
   restitution of 0.4034–0.4234 (game: its middle, 0.4134, a neutral season). Now and then over a winter the maker's
   process moves it — a livelier ball (탱탱볼, home runs up) or a deader one (저반발, home runs down) — and the papers
   tell of it at opening day. The KBO tests the balls in June (수시검사): a ball outside the range is announced, its
   maker fined, and the second half's balls are brought halfway back; the winter after, the KBO corrects it. The
   ball moves the engine's home runs and, a little, the balls in play falling for hits. Not a game's first season. */
import { rng } from '../draftroom';
import { addAlert } from './alerts';
import { startYear } from './era';
import { leagueEvent } from './leagueevents';
import { addNews } from './news';
import type { LeagueState } from './state';

export const BALL = {
  base: 0.4134,
  /** Half the allowed range. */
  range: 0.01,
  /** A winter's chance the ball changes (within the range), and the change. */
  chance: 0.15,
  step: [0.006, 0.014] as const,
  /** 2.0.75: a ball away from the middle (a dead or a lively ball era) does not stay for years. The farther off (as a
      share of the half range), the likelier a winter's change — up to `chance` more — and the likelier it goes back
      toward the middle — up to `toward` more than even; a step back that would cross the middle stops near it. */
  back: { chance: 0.5, toward: 0.4 },
  /** Out of the range: the KBO's correction the winter after (back near the middle). */
  fixChance: 0.8,
  /** The June test's mid-season correction (a share of the way back). */
  midFix: 0.5,
  /** Logit shifts a unit of the coefficient brings: 0.01 → home runs ×≈0.63 (the KBO's 2019 deader ball took a
      third of the home runs off), and a little off the balls in play. */
  hr: 45,
  babip: 6,
};

/** 2.0.74 (the user's request): the ball set by hand in the settings — a game option, from a deader ball to a much
    livelier one than the KBO allows; no winter's change and no June test while it is set. */
export const BALL_MANUAL = { min: 0.3934, max: 0.4334, step: 0.001 };

export type BallChange = 'up' | 'down' | 'fix';

export interface BallSeason {
  year: number;
  /** The coefficient from opening day. */
  cor: number;
  change?: BallChange;
  /** The June test (수시검사): the date, what it measured, and the coefficient from then (a ball out of the range
      brought halfway back). */
  test?: { date: string; cor: number; after?: number };
  /** 2.0.74: set by hand in the settings at opening day. */
  manual?: true;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;
export const inRange = (cor: number) => Math.abs(cor - BALL.base) <= BALL.range + 1e-9;
export const corText = (cor: number) => cor.toFixed(4);

/** This season's ball, if drawn. */
export const ballOf = (s: LeagueState, year = s.year) => s.ball?.find((b) => b.year === year);

/** The coefficient in play on `date` (the middle of the range when none was drawn). */
export function corOn(s: LeagueState, date: string): number {
  if (s.ballManual !== undefined) return s.ballManual;
  const b = ballOf(s, Number(date.slice(0, 4)));
  if (!b) return BALL.base;
  return b.test?.after !== undefined && date >= b.test.date ? b.test.after : b.cor;
}

/** The engine's shifts for a game on `date` (none with a neutral ball). */
export function ballShift(s: LeagueState, date: string): { hr: number; babip: number } | undefined {
  const d = corOn(s, date) - BALL.base;
  return Math.abs(d) < 1e-6 ? undefined : { hr: d * BALL.hr, babip: d * BALL.babip };
}

/** Opening day: the season's ball, and the news when it changed. */
export function ballSeason(s: LeagueState, date: string) {
  if (ballOf(s)) return;
  const list = (s.ball ??= []);
  // 2.0.74: the ball set by hand: the season's record, no news.
  if (s.ballManual !== undefined) {
    list.push({ year: s.year, cor: s.ballManual, manual: true });
    if (list.length > 30) list.splice(0, list.length - 30);
    return;
  }
  const prev = list.filter((b) => b.year < s.year).at(-1);
  const was = prev ? (prev.test?.after ?? prev.cor) : BALL.base;
  const r = rng(`${s.seed}|ball|${s.year}`);
  let cor = was;
  let change: BallChange | undefined;
  if (s.year > startYear()) {
    if (!inRange(was)) {
      // Out of the range: corrected, or (now and then) kept another season — never further out.
      if (r() < BALL.fixChance) {
        cor = BALL.base + (r() - 0.5) * 0.004;
        change = 'fix';
      }
    } else {
      const d = was - BALL.base;
      const pull = Math.min(1, Math.abs(d) / BALL.range);
      if (r() < BALL.chance + BALL.back.chance * pull) {
        const up = r() < 0.5 - Math.sign(d) * BALL.back.toward * pull;
        const step = BALL.step[0] + r() * (BALL.step[1] - BALL.step[0]);
        cor = was + (up ? step : -step);
        // Back past the middle: it stops near it.
        if (d !== 0 && Math.sign(cor - BALL.base) !== Math.sign(d)) cor = BALL.base + (r() - 0.5) * 0.004;
        change = up ? 'up' : 'down';
      }
    }
  }
  const b: BallSeason = { year: s.year, cor: round4(cor), ...(change ? { change } : {}) };
  list.push(b);
  // Kept for the record: the last thirty seasons.
  if (list.length > 30) list.splice(0, list.length - 30);
  if (!change) return;
  const title =
    change === 'up'
      ? __i18n_k("league.ball.text.b1c62601", { year: s.year })
      : change === 'down'
        ? __i18n_k("league.ball.text.bb31dc46", { year: s.year })
        : __i18n_k("league.ball.text.40fdb9bb", { year: s.year });
  const lines = [
    __i18n_k("league.ball.text.519fa8a5", { was: corText(was), now: corText(b.cor) }),
    change === 'up' ? __i18n_k("league.ball.text.efdedb99") : change === 'down' ? __i18n_k("league.ball.text.463b3a3e") : __i18n_k("league.ball.text.fd4dc809"),
  ];
  addNews(s, { id: `ball-${s.year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { cor: b.cor }, players: [], mine: false });
  addAlert(s, { id: `ball-${s.year}`, date, kind: 'season', title, lines });
  leagueEvent(s, s.year, title);
}

/** The first game day of June: the KBO's test of the balls. */
export function ballTest(s: LeagueState, date: string) {
  const b = ballOf(s);
  if (!b || b.test || date.slice(5, 7) !== '06' || s.ballManual !== undefined) return;
  const r = rng(`${s.seed}|ball-test|${s.year}`);
  const measured = round4(b.cor + (r() - 0.5) * 0.002);
  b.test = { date, cor: measured };
  const ok = inRange(measured);
  if (!ok) b.test.after = round4(b.cor + (BALL.base - b.cor) * BALL.midFix);
  const title = ok ? __i18n_k("league.ball.text.30fa4a1d", { year: s.year }) : __i18n_k("league.ball.text.05c39648", { year: s.year });
  const lines = [
    __i18n_k("league.ball.text.e79d5eb2", { cor: corText(measured), lo: corText(BALL.base - BALL.range), hi: corText(BALL.base + BALL.range) }),
    ...(ok ? [] : [measured > BALL.base ? __i18n_k("league.ball.text.f170065b") : __i18n_k("league.ball.text.0dc2b47b")]),
  ];
  addNews(s, { id: `ball-test-${s.year}`, date, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { cor: measured }, players: [], mine: false });
  // A passing test is an article; a failing one a full alert.
  addAlert(s, { id: `ball-test-${s.year}`, date, kind: 'season', title, lines, ...(ok ? { minor: true } : { tone: 'bad' as const }) });
  if (!ok) leagueEvent(s, s.year, title);
}

/** 2.0.74: sets the ball by hand (within BALL_MANUAL), or gives it back to the winters' events (null). */
export function setBallManual(s: LeagueState, cor: number | null) {
  if (cor === null || !Number.isFinite(cor)) {
    delete s.ballManual;
    return;
  }
  s.ballManual = round4(Math.min(BALL_MANUAL.max, Math.max(BALL_MANUAL.min, cor)));
}

/** About how many home runs a ball brings against the usual one (×). */
export const ballHrFactor = (cor: number) => Math.exp((cor - BALL.base) * BALL.hr);

/** The ball now: the one set by hand, or the latest season's (after its June test). */
export function currentCor(s: LeagueState): number {
  if (s.ballManual !== undefined) return s.ballManual;
  const b = s.ball?.at(-1);
  return b ? (b.test?.after ?? b.cor) : BALL.base;
}

/** 2.0.75: the ball the season shown was played with, and whether it was set by hand. Over the winter, the season
    played keeps its own (a value set by hand meanwhile is next season's); in season, the ball in play today. */
export function seasonBall(s: LeagueState, date: string): { cor: number; manual: boolean } {
  const b = ballOf(s);
  if (s.offseason && b) return { cor: b.manual ? b.cor : (b.test?.after ?? b.cor), manual: !!b.manual };
  return { cor: corOn(s, date), manual: s.ballManual !== undefined };
}
