import { k as __i18n_k } from '../i18n/index';
/* Freak injuries (1.7.0, from the 1.6 feedback: 어이없는 부상). Rarely, a player gets hurt away from the field in a
   way the papers cannot resist: a car accident on the way to the park, a fall on the subway stairs, a hamstring
   pulled racing his child at sports day, a bathroom sink that gave way under him, a morning too hungover to play.
   About one a season for every two or three clubs; most cost a week or a few, the hangover a game (and a fine).
   They come off the same injured list as any other injury (injuries.ts) and are in his injury history. */
import { rng } from '../draftroom';
import type { InjuryRecord, Player } from '../model/types';
import { addAlert } from './alerts';
import { iga } from './josa';
import { isMarried } from './life';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { firstTeamIds, type LeagueState } from './state';
import { traitsOf } from './traits';

export const FREAK = {
  /** A club's chance of one, each game day of the regular season. */
  perClubDay: 0.0028,
};

interface Freak {
  key: string;
  weight: number;
  days: [number, number];
  /** A day or two out of the lineup without going on the injured list. */
  dtd?: boolean;
  /** Who it can happen to. */
  fits?: (s: LeagueState, p: Player) => boolean;
  /** How much likelier for this player (troublemakers and hangovers). */
  lean?: (p: Player) => number;
  part: () => string;
  title: (v: { club: string; name: string }) => string;
  body: (v: { club: string; name: string; who: string; weeks: string }) => string;
}

const weeksOf = (days: number) => (days <= 10 ? __i18n_k("league.freak.text.d766c287") : __i18n_k("league.freak.text.13bc372f", { n: Math.round(days / 7) }));

const FREAKS: Freak[] = [
  {
    key: 'car',
    weight: 2,
    days: [14, 42],
    part: () => __i18n_k("league.freak.text.a6fd2c35"),
    title: (v) => __i18n_k("league.freak.text.16f0eec5", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.ddade789", { who: iga(v.who), weeks: v.weeks }),
  },
  {
    key: 'stairs',
    weight: 3,
    days: [10, 28],
    part: () => __i18n_k("league.freak.text.94f14dd9"),
    title: (v) => __i18n_k("league.freak.text.62496a57", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.ae72cfb9", { who: iga(v.who), weeks: v.weeks }),
  },
  {
    key: 'kid',
    weight: 3,
    days: [14, 35],
    fits: (s, p) => !isForeign(p) && ageIn(p, s.year) >= 29 && ((p.life?.kids ?? 0) > 0 || isMarried(s, p)),
    part: () => __i18n_k("league.freak.text.a5fcf68a"),
    title: (v) => __i18n_k("league.freak.text.6155c54a", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.94e53300", { who: iga(v.who), weeks: v.weeks }),
  },
  {
    key: 'sink',
    weight: 2,
    days: [7, 21],
    part: () => __i18n_k("league.freak.text.53dcab57"),
    title: (v) => __i18n_k("league.freak.text.df971733", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.caacd214", { who: iga(v.who), weeks: v.weeks }),
  },
  {
    key: 'hangover',
    weight: 2.5,
    days: [1, 1],
    dtd: true,
    lean: (p) => 1 + Math.max(0, traitsOf(p).controversy - 40) / 15,
    part: () => __i18n_k("league.freak.text.1fc9663a"),
    title: (v) => __i18n_k("league.freak.text.a8647c32", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.7a735399", { who: iga(v.who) }),
  },
  {
    key: 'neck',
    weight: 3,
    days: [2, 4],
    dtd: true,
    part: () => __i18n_k("league.freak.text.052a2b56"),
    title: (v) => __i18n_k("league.freak.text.358079af", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.b4a9451a", { who: iga(v.who) }),
  },
  {
    key: 'dog',
    weight: 1.5,
    days: [10, 21],
    part: () => __i18n_k("league.freak.text.265cd268"),
    title: (v) => __i18n_k("league.freak.text.af1ac3e6", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.9fc6d192", { who: iga(v.who), weeks: v.weeks }),
  },
  {
    key: 'moving',
    weight: 1.5,
    days: [7, 21],
    part: () => __i18n_k("league.freak.text.06733032"),
    title: (v) => __i18n_k("league.freak.text.331e9366", { club: v.club, name: v.name }),
    body: (v) => __i18n_k("league.freak.text.bf54fa43", { who: iga(v.who), weeks: v.weeks }),
  },
];

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const ROLE_WORD = (p: Player) => (isPitcher(p) ? __i18n_k("league.freak.text.ef406667") : __i18n_k("league.freak.text.9dac0c64"));

/** Before the day's games: now and then, something silly happens to someone. */
export function freakDay(s: LeagueState, date: string) {
  if (s.phase !== 'regular') return;
  for (const teamId of firstTeamIds(s)) {
    const r = rng(`${s.seed}|freak|${teamId}|${date}`);
    if (r() >= FREAK.perClubDay) continue;
    const squad = (s.rosters[teamId]?.active ?? []).map((id) => s.players[id]!).filter((p) => p && !s.injuries[p.id]);
    if (!squad.length) continue;
    const p = squad[Math.floor(r() * squad.length)]!;
    const options = FREAKS.filter((f) => !f.fits || f.fits(s, p));
    const total = options.reduce((a, f) => a + f.weight * (f.lean?.(p) ?? 1), 0);
    let x = r() * total;
    const f = options.find((o) => (x -= o.weight * (o.lean?.(p) ?? 1)) < 0) ?? options[0]!;
    const days = f.days[0] + Math.floor(r() * (f.days[1] - f.days[0] + 1));
    const part = f.part();
    s.injuries[p.id] = { until: addDays(date, days + (f.dtd ? 1 : 0)), days, onList: !f.dtd, part, ...(f.dtd ? { dtd: true } : {}) };
    if (!f.dtd) {
      const rec: InjuryRecord = { date, days, part };
      (p.injuries ??= []).push(rec);
    }
    const club = s.teams.find((t) => t.id === teamId)?.short ?? teamId;
    const mine = teamId === s.user?.teamId;
    const v = { club, name: p.name, who: `${ROLE_WORD(p)} ${p.name}`, weeks: weeksOf(days) };
    const id = `freak-${p.id}-${date}`;
    addNews(s, { id, date, kind: 'injury', title: f.title(v), body: f.body(v), quotes: [], facts: { player: p.name, club, part, days }, players: [p.id], mine });
    if (mine) {
      if (!f.dtd) addAlert(s, { id, date, kind: 'injury', title: f.title(v), lines: [f.body(v)], tone: 'bad', players: [p.id] });
      ((p.life ??= {}).events ??= []).push({ date, text: f.title(v), tone: 'bad' });
    }
  }
}

/** The kinds, for tests. */
export const FREAK_KEYS = FREAKS.map((f) => f.key);
