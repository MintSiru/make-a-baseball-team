import { k as __i18n_k } from '../i18n/index';
/* 2.0.59 (the user's request): games called off for the weather — rain (우천 취소), a heat wave (폭염 취소) and, in the
   north of a unified Korea, snow and cold (폭설·한파 취소) — weighted by where the home ballpark is: the south coast
   and the islands get the most rain, the 대구 basin and 광주 the worst heat, the north the cold of March, April,
   October and November, more the further north. A dome is never called off.

   A called-off game goes to the end of the season (the KBO's 잔여 경기 일정): the first day after the season's own
   last date when neither club plays — that period has no rest days. A game called off again goes on later again, at
   most twice; then it is played whatever the sky. First-team regular-season games only; the draws are the game's
   own (its id), so the same seed calls off the same games. Monthly chances are game assumptions shaped on the KBO's
   recent seasons (40–60 games called off a season, most in the July rains).

   Later the same version (the user's request): rain that comes during a game — before five innings 노게임 (played
   again like a game called off), after them 강우 콜드 (the score stands, a tie a draw) or, when the visitors have just
   tied or taken the lead in an inning the home side has not batted in, 서스펜디드: finished from there the next time
   the two meet (or on a makeup day), before that day's game, with the lineups it stopped with. And 더블헤더: a game called off goes to the next day of
   the same series as the day's first game (not in the July–August heat, the KBO's 혹서기). Game assumptions on the
   KBO's rules (야구규칙 7.01·7.02). */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import type { GameOut, PlayEvent } from './engine/types';
import { addAlert } from './alerts';
import { FACILITIES } from './facilities';
import type { ScheduledGame } from './schedule';
import type { LeagueState } from './state';
import { isTiebreaker } from './tiebreak';

export type Weather = 'rain' | 'heat' | 'snow' | 'typhoon';

/** Rain during a game: its chance against the day's chance of a game called off, and the innings it can come in. */
export const RAIN_IN_GAME = { share: 0.3, from: 2, to: 9 };
/** 더블헤더: a game called off is played the next day of its series as the first of two, but not in these months. */
export const DOUBLEHEADER = { offMonths: [7, 8], withinDays: 2 };

/** Chances a game is called off, by month (1–12), before the home city's weights. */
export const WEATHER = {
  rain: { 3: 0.02, 4: 0.035, 5: 0.04, 6: 0.055, 7: 0.1, 8: 0.065, 9: 0.045, 10: 0.025, 11: 0.02 } as Record<number, number>,
  heat: { 6: 0.002, 7: 0.01, 8: 0.013, 9: 0.002 } as Record<number, number>,
  snow: { 3: 0.035, 4: 0.01, 10: 0.008, 11: 0.035 } as Record<number, number>,
  /** A game called off this many times is played the next time whatever the weather. */
  maxPostponed: 2,
};

/** A climate: weights on the monthly chances. */
interface Climate {
  rain: number;
  heat: number;
  snow: number;
}
const ZONES: Record<string, Climate> = {
  /** The south coast (부산·창원·울산…): the most rain, the summer milder by the sea. */
  south: { rain: 1.25, heat: 0.8, snow: 0 },
  /** 대구 and the basin round it: the heat. */
  basin: { rain: 0.85, heat: 2, snow: 0 },
  /** 광주 and 전북: wet and hot. */
  southwest: { rain: 1.15, heat: 1.35, snow: 0.05 },
  /** 서울, 인천, 경기, 충청 and 대전. */
  central: { rain: 1, heat: 1, snow: 0.15 },
  /** 강원. */
  gangwon: { rain: 1.05, heat: 0.7, snow: 0.6 },
  /** 제주 and 울릉: rain and wind off the sea, little heat. */
  island: { rain: 1.4, heat: 0.4, snow: 0.2 },
  /** The north, by how far north (unified Korea). */
  north1: { rain: 1.05, heat: 0.6, snow: 1 },
  north2: { rain: 1.1, heat: 0.45, snow: 1.6 },
  north3: { rain: 1, heat: 0.3, snow: 2.4 },
};

/** The climate of each home: the existing clubs by id, the other homes by city id. */
const CLUB_ZONE: Record<string, keyof typeof ZONES> = { kia: 'southwest', samsung: 'basin', lg: 'central', doosan: 'central', kt: 'central', ssg: 'central', nc: 'south', kiwoom: 'central', hanwha: 'central', lotte: 'south' };
const CITY_ZONE: Record<string, keyof typeof ZONES> = {
  ulsan: 'south', busan: 'south', changwon: 'south', gimhae: 'south', jinju: 'south', yeosu: 'south', pohang: 'basin', gyeongju: 'basin', daegu: 'basin',
  gwangju: 'southwest', jeonju: 'southwest', gunsan: 'southwest',
  goyang: 'central', seongnam: 'central', hwaseong: 'central', yongin: 'central', bucheon: 'central', pyeongtaek: 'central', incheon: 'central', seoul: 'central', suwon: 'central', cheongju: 'central', cheonan: 'central', sejong: 'central', daejeon: 'central',
  chuncheon: 'gangwon', wonju: 'gangwon',
  jeju: 'island', ulleung: 'island',
  kaesong: 'north1', sariwon: 'north1', nampo: 'north1', pyongyang: 'north2', wonsan: 'north2', sinuiju: 'north2', hamhung: 'north2', songjin: 'north3', chongjin: 'north3',
};

/** The home city of a club (ours, the twelfth, the north's; the others by id). */
function homeCity(s: LeagueState, teamId: TeamId): string | undefined {
  if (s.user?.teamId === teamId) return s.user.settings.cityId;
  if (s.twelve?.teamId === teamId) return s.twelve.cityId;
  const north = s.unified?.clubs.find((c) => c.teamId === teamId);
  if (north) return north.cityId;
  return undefined;
}

type Zone = keyof typeof ZONES;
export const zoneOf = (s: LeagueState, teamId: TeamId): Zone => {
  const city = homeCity(s, teamId);
  return (city && CITY_ZONE[city]) || CLUB_ZONE[teamId] || 'central';
};
export const climateOf = (s: LeagueState, teamId: TeamId): Climate => ZONES[zoneOf(s, teamId)]!;

/** 2.0.59 (the user's request): typhoons in August and September — the south coast and the islands always in the
    path, the rest less often the further north. One that comes in stops the games in its path for one to three days,
    and may wreck a part of our ballpark when it comes through our city. Drawn from the date alone (the game's own
    stream untouched); about one a season, as the KBO has had (game assumption). */
export const TYPHOON = {
  months: [8, 9],
  perDay: 0.018,
  /** Chance each zone is in a typhoon's path. */
  path: { island: 1, south: 1, southwest: 0.6, basin: 0.5, central: 0.25, gangwon: 0.2, north1: 0.1, north2: 0.05, north3: 0 } as Record<Zone, number>,
  /** Our ballpark in its path: the chance something is wrecked (a facility a level down, else a repair bill), 만 원. */
  damage: 0.35,
  repair: [50_000, 150_000] as [number, number],
};

/** A typhoon that comes in on `date`: how many days it stays and the zones in its path. */
function typhoonFrom(s: LeagueState, date: string): { days: number; zones: Set<Zone> } | null {
  if (!TYPHOON.months.includes(Number(date.slice(5, 7)))) return null;
  const r = rng(`${s.seed}|typhoon|${date}`);
  if (r() >= TYPHOON.perDay) return null;
  const days = 1 + Math.floor(r() * 3);
  const zones = new Set((Object.keys(TYPHOON.path) as Zone[]).filter((z) => r() < (TYPHOON.path[z] ?? 0)));
  return { days, zones };
}

/** The zones a typhoon is over on `date` (one that came in today or in the two days before), or null. */
export function typhoonOn(s: LeagueState, date: string): Set<Zone> | null {
  for (let k = 0; k < 3; k++) {
    const t = typhoonFrom(s, addDays(date, -k));
    if (t && k < t.days) return t.zones;
  }
  return null;
}

const postponedTimes = (id: string) => Number(id.match(/-r(\d+)$/)?.[1] ?? 0);
const baseId = (id: string) => id.replace(/-r\d+$/, '');

/** A dome: our own, or 고척 (the existing clubs' parks are not marked by size). */
function isDome(s: LeagueState, teamId: TeamId) {
  const park = s.teams.find((t) => t.id === teamId)?.stadium;
  return park?.size === 'dome' || /돔|Dome/.test(park?.name ?? '');
}

/** A suspended game being finished. */
export const isResumed = (id: string) => /-s$/.test(id);

/** Whether the weather calls off this game today, and why. */
export function weatherFor(s: LeagueState, g: ScheduledGame): Weather | null {
  if (postponedTimes(g.id) >= WEATHER.maxPostponed || isResumed(g.id)) return null;
  if (isDome(s, g.home)) return null;
  // A typhoon over the park: called off, whatever else.
  if (typhoonOn(s, g.date)?.has(zoneOf(s, g.home))) return 'typhoon';
  const month = Number(g.date.slice(5, 7));
  const c = climateOf(s, g.home);
  const x = rng(`${s.seed}|weather|${g.id}`)();
  const rain = (WEATHER.rain[month] ?? 0) * c.rain,
    heat = (WEATHER.heat[month] ?? 0) * c.heat,
    snow = (WEATHER.snow[month] ?? 0) * c.snow;
  if (x < snow) return 'snow';
  if (x < snow + heat) return 'heat';
  if (x < snow + heat + rain) return 'rain';
  return null;
}

/** Rain that comes during this game: the inning it stops play in, after the top half or the whole inning; or null. */
export function rainDuring(s: LeagueState, g: ScheduledGame): { inning: number; top: boolean } | null {
  if (isResumed(g.id) || isDome(s, g.home)) return null;
  const r = rng(`${s.seed}|rain-in-game|${g.id}`);
  if (r() >= (WEATHER.rain[Number(g.date.slice(5, 7))] ?? 0) * climateOf(s, g.home).rain * RAIN_IN_GAME.share) return null;
  return { inning: RAIN_IN_GAME.from + Math.floor(r() * (RAIN_IN_GAME.to - RAIN_IN_GAME.from + 1)), top: r() < 0.5 };
}

export type Ruling = { kind: 'final' | 'noGame' | 'suspended'; inning: number; top: boolean } | null;

/** What rain at `at` makes of a game that went as `away`/`home` (its line score played out): nothing if the game was
    over by then; before five innings (four and a half with the home side ahead) no game; after the whole inning the
    score stands; after its top half, the home side ahead — over; the visitors having just tied or gone ahead —
    suspended; else the score of the last whole inning stands. */
export function callRuling(away: number[], home: number[], at: { inning: number; top: boolean }): Ruling {
  const n = away.length,
    I = at.inning;
  if (I > n || (I === n && (at.top ? home.length < n : true)) || (!at.top && home.length < I)) return null;
  const sum = (xs: number[], k: number) => xs.slice(0, k).reduce((a, x) => a + x, 0);
  if (!at.top) return I >= 5 ? { kind: 'final', inning: I, top: false } : { kind: 'noGame', inning: I, top: false };
  const a = sum(away, I),
    a0 = sum(away, I - 1),
    h = sum(home, I - 1);
  if (h > a) return I >= 5 ? { kind: 'final', inning: I, top: true } : { kind: 'noGame', inning: I, top: true };
  if (I - 1 < 5) return { kind: 'noGame', inning: I, top: true };
  if (a > a0 && a0 <= h) return { kind: 'suspended', inning: I, top: true };
  return { kind: 'final', inning: I - 1, top: false };
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** The day a called-off game is played: from September a free Monday (the KBO's late-season Monday games), else the
    first day after the season's own last date — after today, and when neither club plays. */
function makeupDate(s: LeagueState, g: ScheduledGame, today: string): string {
  const own = s.schedule.filter((x) => !/-(r\d+|s)$/.test(x.id) && !isTiebreaker(x.id)).reduce((a, x) => (x.date > a ? x.date : a), today);
  const busy = new Set(s.schedule.filter((x) => x.home === g.home || x.away === g.home || x.home === g.away || x.away === g.away).map((x) => x.date));
  const september = `${today.slice(0, 4)}-09-01`;
  const monday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() === 1;
  let d = addDays(today, 1);
  while (busy.has(d) || (d <= own && !(monday(d) && d >= september))) d = addDays(d, 1);
  return d;
}

const plays = (x: ScheduledGame, t: TeamId) => x.home === t || x.away === t;
const samePair = (x: ScheduledGame, g: ScheduledGame) => plays(x, g.home) && plays(x, g.away);

/** The two clubs' next game within `days` — a day of the same series — when it is their only game that day. */
function nextMeeting(s: LeagueState, g: ScheduledGame, today: string, days: number): ScheduledGame | undefined {
  const next = s.schedule.find((x, i) => i >= s.next && x !== g && x.date > today && x.date <= addDays(today, days) && samePair(x, g) && !isTiebreaker(x.id));
  if (!next || s.schedule.some((x) => x !== next && x.date === next.date && (plays(x, g.home) || plays(x, g.away)))) return undefined;
  return next;
}

/** Puts `moved` on its day, before that day's games (a doubleheader's first game, a suspended game's end). */
function insertFirst(s: LeagueState, moved: ScheduledGame) {
  let at = s.schedule.findIndex((x, i) => i >= s.next && x.date >= moved.date);
  if (at < 0) at = s.schedule.length;
  s.schedule.splice(at, 0, moved);
}

/** Today's game at `s.next` is called off (or rain made it no game): it leaves today and goes on its makeup day — the
    next day of its series as a doubleheader's first game when it can. */
export function postpone(s: LeagueState, why: Weather, today: string, noGameIn?: number) {
  const g = s.schedule[s.next]!;
  s.schedule.splice(s.next, 1);
  const dh = why !== 'typhoon' && !DOUBLEHEADER.offMonths.includes(Number(today.slice(5, 7))) && !postponedTimes(g.id) ? nextMeeting(s, g, today, DOUBLEHEADER.withinDays) : undefined;
  const to = dh ? dh.date : makeupDate(s, g, today);
  insertFirst(s, { ...g, id: `${baseId(g.id)}-r${postponedTimes(g.id) + 1}`, date: to });
  (s.calledOff ??= []).push({ id: g.id, date: today, home: g.home, away: g.away, why, to, ...(dh ? { dh: true } : {}), ...(noGameIn ? { noGame: true } : {}) });
  const me = s.user?.teamId;
  if (me && (g.home === me || g.away === me)) {
    const opp = s.teams.find((t) => t.id === (g.home === me ? g.away : g.home))?.short ?? '';
    const park = s.teams.find((t) => t.id === g.home)?.stadium.name ?? '';
    const title = noGameIn ? __i18n_k("league.weather.text.b53333ba", { opp }) : why === 'rain' ? __i18n_k("league.weather.text.7833e9a9", { opp }) : why === 'heat' ? __i18n_k("league.weather.text.1f19a24e", { opp }) : why === 'typhoon' ? __i18n_k("league.weather.text.f22de627", { opp }) : __i18n_k("league.weather.text.923eee13", { opp });
    const day = (d: string) => d.slice(5).replace('-', '/');
    const lines = [noGameIn ? __i18n_k("league.weather.text.cc9bad43", { date: day(today), park, inning: noGameIn, to: day(to) }) : __i18n_k("league.weather.text.a1812490", { date: day(today), park, to: day(to) })];
    if (dh) lines.push(__i18n_k("league.weather.text.8b4c4174", { to: day(to) }));
    addAlert(s, { id: `called-off-${g.id}-${today}`, date: today, kind: 'season', title, lines });
  }
}

/** A suspended game: its whole play (drawn on the day, so its first part is what was played), kept until the day it
    is finished — the two clubs' next meeting (else a makeup day) — and played before that day's game. */
export interface SuspendedGame {
  from: string;
  at: { inning: number; top: boolean };
  /** The score when it stopped (away, home). */
  score: [number, number];
  out: GameOut;
  log?: PlayEvent[];
}

export function suspend(s: LeagueState, out: GameOut, log: PlayEvent[] | undefined, today: string) {
  const g = s.schedule[s.next]!;
  const at = out.called!;
  const score: [number, number] = [out.away.lineScore.slice(0, at.inning).reduce((a, x) => a + x, 0), out.home.lineScore.slice(0, at.inning - 1).reduce((a, x) => a + x, 0)];
  const to = nextMeeting(s, g, today, 366)?.date ?? makeupDate(s, g, today);
  const id = `${baseId(g.id)}-s`;
  insertFirst(s, { ...g, id, date: to });
  (s.suspendedGames ??= {})[id] = { from: today, at: { inning: at.inning, top: at.top }, score, out, ...(log ? { log } : {}) };
  const me = s.user?.teamId;
  if (me && (g.home === me || g.away === me)) {
    const opp = s.teams.find((t) => t.id === (g.home === me ? g.away : g.home))?.short ?? '';
    const day = (d: string) => d.slice(5).replace('-', '/');
    addAlert(s, {
      id: `suspended-${g.id}`,
      date: today,
      kind: 'season',
      title: __i18n_k("league.weather.text.25c0d49d", { opp }),
      lines: [__i18n_k("league.weather.text.8d8e0633", { inning: at.inning, away: score[0], home: score[1], to: day(to) })],
    });
  }
}

/** A game rain called after five innings, to the user: the score stands. */
export function calledGameNote(s: LeagueState, out: GameOut, g: ScheduledGame, today: string) {
  const me = s.user?.teamId;
  if (!me || !out.called || (g.home !== me && g.away !== me)) return;
  const opp = s.teams.find((t) => t.id === (g.home === me ? g.away : g.home))?.short ?? '';
  const ours = g.home === me ? out.home.runs : out.away.runs,
    theirs = g.home === me ? out.away.runs : out.home.runs;
  addAlert(s, {
    id: `rain-called-${g.id}`,
    date: today,
    kind: 'season',
    title: __i18n_k("league.weather.text.29563a62", { opp }),
    lines: [ours === theirs ? __i18n_k("league.weather.text.77bf8121", { inning: out.called.inning, ours, theirs }) : __i18n_k("league.weather.text.772c0f91", { inning: out.called.inning, ours, theirs, result: ours > theirs ? __i18n_k("league.weather.text.3b1908b7") : __i18n_k("league.weather.text.36260e2c") })],
    tone: ours > theirs ? 'good' : ours < theirs ? 'bad' : undefined,
  });
}

/** Our ballpark's facilities a typhoon can wreck. */
const BALLPARK_FACILITIES = (Object.keys(FACILITIES) as (keyof typeof FACILITIES)[]).filter((k) => FACILITIES[k].group === 'ballpark');

/** The day a typhoon comes in: through our city, it may wreck a part of the ballpark — a facility a level down, or
    (none to lose) a repair bill from the fund. */
export function typhoonDay(s: LeagueState, date: string) {
  const u = s.user;
  const t = u ? typhoonFrom(s, date) : null;
  if (!u || !t || !t.zones.has(zoneOf(s, u.teamId)) || isDome(s, u.teamId)) return;
  const r = rng(`${s.seed}|typhoon-damage|${date}`);
  const lines = [__i18n_k("league.weather.text.64a11807", { days: t.days })];
  if (r() < TYPHOON.damage) {
    const built = BALLPARK_FACILITIES.filter((k) => (u.facilities?.[k] ?? 0) > 0);
    if (built.length) {
      const kind = built[Math.floor(r() * built.length)]!;
      u.facilities![kind] = u.facilities![kind]! - 1;
      lines.push(__i18n_k("league.weather.text.124f0633", { facility: FACILITIES[kind].label }));
    } else {
      const [lo, hi] = TYPHOON.repair;
      const cost = Math.round((lo + r() * (hi - lo)) / 1000) * 1000;
      u.fund -= cost;
      u.ledger.push({ year: s.year, label: __i18n_k("league.weather.text.2a3db7ab"), amount: -cost });
      lines.push(__i18n_k("league.weather.text.f3f62f86", { eok: Math.round(cost / 1000) / 10 }));
    }
  }
  addAlert(s, { id: `typhoon-${date}`, date, kind: 'season', title: __i18n_k("league.weather.text.ff4e0f68"), lines, tone: 'bad' });
}
