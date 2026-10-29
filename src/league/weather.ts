import { k as __i18n_k } from '../i18n/index';
/* 2.0.59 (the user's request): games called off for the weather — rain (우천 취소), a heat wave (폭염 취소) and, in the
   north of a unified Korea, snow and cold (폭설·한파 취소) — weighted by where the home ballpark is: the south coast
   and the islands get the most rain, the 대구 basin and 광주 the worst heat, the north the cold of March, April,
   October and November, more the further north. A dome is never called off.

   A called-off game goes to the end of the season (the KBO's 잔여 경기 일정): the first day after the season's own
   last date when neither club plays — that period has no rest days. A game called off again goes on later again, at
   most twice; then it is played whatever the sky. First-team regular-season games only; the draws are the game's
   own (its id), so the same seed calls off the same games. Monthly chances are game assumptions shaped on the KBO's
   recent seasons (40–60 games called off a season, most in the July rains). */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import type { ScheduledGame } from './schedule';
import type { LeagueState } from './state';
import { isTiebreaker } from './tiebreak';

export type Weather = 'rain' | 'heat' | 'snow';

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

export function climateOf(s: LeagueState, teamId: TeamId): Climate {
  const city = homeCity(s, teamId);
  return ZONES[(city && CITY_ZONE[city]) || CLUB_ZONE[teamId] || 'central']!;
}

const postponedTimes = (id: string) => Number(id.match(/-r(\d+)$/)?.[1] ?? 0);
const baseId = (id: string) => id.replace(/-r\d+$/, '');

/** Whether the weather calls off this game today, and why. */
export function weatherFor(s: LeagueState, g: ScheduledGame): Weather | null {
  if (postponedTimes(g.id) >= WEATHER.maxPostponed) return null;
  // A dome: our own, or 고척 (the existing clubs' parks are not marked by size).
  const park = s.teams.find((t) => t.id === g.home)?.stadium;
  if (park?.size === 'dome' || /돔|Dome/.test(park?.name ?? '')) return null;
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

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** The day a called-off game is played: from September a free Monday (the KBO's late-season Monday games), else the
    first day after the season's own last date — after today, and when neither club plays. */
function makeupDate(s: LeagueState, g: ScheduledGame, today: string): string {
  const own = s.schedule.filter((x) => !/-r\d+$/.test(x.id) && !isTiebreaker(x.id)).reduce((a, x) => (x.date > a ? x.date : a), today);
  const busy = new Set(s.schedule.filter((x) => x.home === g.home || x.away === g.home || x.home === g.away || x.away === g.away).map((x) => x.date));
  const september = `${today.slice(0, 4)}-09-01`;
  const monday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() === 1;
  let d = addDays(today, 1);
  while (busy.has(d) || (d <= own && !(monday(d) && d >= september))) d = addDays(d, 1);
  return d;
}

/** Today's game at `s.next` is called off: it leaves today and goes on its makeup day. */
export function postpone(s: LeagueState, why: Weather, today: string) {
  const g = s.schedule[s.next]!;
  s.schedule.splice(s.next, 1);
  const to = makeupDate(s, g, today);
  const moved: ScheduledGame = { ...g, id: `${baseId(g.id)}-r${postponedTimes(g.id) + 1}`, date: to };
  let at = s.schedule.findIndex((x, i) => i >= s.next && x.date > to);
  if (at < 0) at = s.schedule.length;
  s.schedule.splice(at, 0, moved);
  (s.calledOff ??= []).push({ id: g.id, date: today, home: g.home, away: g.away, why, to });
  const me = s.user?.teamId;
  if (me && (g.home === me || g.away === me)) {
    const opp = s.teams.find((t) => t.id === (g.home === me ? g.away : g.home))?.short ?? '';
    const park = s.teams.find((t) => t.id === g.home)?.stadium.name ?? '';
    const title = why === 'rain' ? __i18n_k("league.weather.text.7833e9a9", { opp }) : why === 'heat' ? __i18n_k("league.weather.text.1f19a24e", { opp }) : __i18n_k("league.weather.text.923eee13", { opp });
    addAlert(s, { id: `called-off-${g.id}-${today}`, date: today, kind: 'season', title, lines: [__i18n_k("league.weather.text.a1812490", { date: today.slice(5).replace('-', '/'), park, to: to.slice(5).replace('-', '/') })] });
  }
}
