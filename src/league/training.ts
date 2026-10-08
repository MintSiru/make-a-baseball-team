import { k as __i18n_k } from '../i18n/index';
/* Short programmes at private training centres abroad (V0.10). The user's club sends a player in the winter (a
   programme before spring camp) or during the season (he leaves the roster for the programme, as KIA sent four
   pitchers to Japan in June 2026). Each centre works on different abilities; what he gains depends on his age,
   how far he is from his potential, luck and the club's analysts. The money comes from the club's fund.

   The centres are made up, each modelled on a kind of place KBO clubs really use (a data-driven pitching lab in
   Washington state, a hitting lab in Arizona, a conditioning campus in Florida, a biomechanics lab near Tokyo);
   see RULES.md §9. */
import { rng, TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { facilityLevel } from './facilities';
import { addNews } from './news';
import { rescout } from './offseason';
import { topVelocity } from './pitches';
import { ageIn, isForeign, isPitcher } from './players';
import { staffEdge, staffRating } from './staff';
import { moveTo, type LeagueState, type SiteId, type TrainingTrip } from './state';
import { TRAINING as T } from './tuning';

export interface Site {
  name: string;
  place: string;
  country: '미국' | '일본';
  /** Who it takes: pitchers, hitters or both. */
  who: 'pitcher' | 'hitter' | 'all';
  /** The tools it works on, main one first. */
  focus: { pitcher?: ToolKey[]; hitter?: ToolKey[] };
  weeks: number;
  /** Per player, fees, travel and a coach's share (만 원). */
  cost: number;
  /** Chance of a sore arm or a strain from the workload. */
  risk: number;
  /** Lowers his injury chance for the season (a conditioning programme). */
  conditioning?: boolean;
  note: string;
}

export const SITES: Record<SiteId, Site> = {
  seattle: {
    name: __i18n_k("league.training.seattle.name.d1bd4481"),
    place: __i18n_k("league.training.seattle.place.67c61751"),
    country: '미국',
    who: 'pitcher',
    focus: { pitcher: ['stuff', 'stamina'] },
    weeks: 6,
    cost: 6_000,
    risk: 0.05,
    note: __i18n_k("league.training.seattle.note.e6ac3c16"),
  },
  arizona: {
    name: __i18n_k("league.training.arizona.name.2525c4c4"),
    place: __i18n_k("league.training.arizona.place.4f7db8eb"),
    country: '미국',
    who: 'hitter',
    focus: { hitter: ['power', 'contact'] },
    weeks: 6,
    cost: 5_000,
    risk: 0.02,
    note: __i18n_k("league.training.arizona.note.f9c34e1e"),
  },
  florida: {
    name: __i18n_k("league.training.florida.name.8db8aa4e"),
    place: __i18n_k("league.training.florida.place.ca344a85"),
    country: '미국',
    who: 'all',
    focus: { pitcher: ['stamina', 'command'], hitter: ['speed', 'defense'] },
    weeks: 6,
    cost: 4_500,
    risk: 0,
    conditioning: true,
    note: __i18n_k("league.training.florida.note.b55b5a43"),
  },
  tokyo: {
    name: __i18n_k("league.training.tokyo.name.fa2ae7df"),
    place: __i18n_k("league.training.tokyo.place.58092e61"),
    country: '일본',
    who: 'all',
    focus: { pitcher: ['command', 'breaking'], hitter: ['eye', 'contact'] },
    weeks: 4,
    cost: 3_000,
    risk: 0.01,
    note: __i18n_k("league.training.tokyo.note.8feef8d5"),
  },
};

export const SITE_IDS = Object.keys(SITES) as SiteId[];

/** The last day a programme can start in the season, as "8월 15일". */
export const lastStartText = T.lastStart
  .split('-')
  .map((x, i) => __i18n_k("league.training.lastStartText.24be69f9", { number: Number(x), value: i ? __i18n_k("league.training.lastStartText.06cf3e90") : __i18n_k("league.training.lastStartText.75448692") }))
  .join(' ');

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const nextDay = (s: LeagueState) => s.schedule[s.next]?.date ?? null;
const eok = (manwon: number) => __i18n_k("league.training.eok.db0fc332", { value: Math.round(manwon / 1000) / 10 });

/** The season a programme booked now counts for, and whether it runs during the season. */
export function tripSeason(s: LeagueState): { season: number; inSeason: boolean } | null {
  if (s.phase === 'offseason') return { season: (s.offseason?.year ?? s.year) + 1, inSeason: false };
  const day = nextDay(s);
  if (s.phase === 'regular' && day && day.slice(5) <= T.lastStart) return { season: s.year, inSeason: true };
  return null;
}

export const onTrip = (s: LeagueState, id: PlayerId) => !!s.abroad?.[id];

/** The dates a programme booked now would run. */
export function tripDates(s: LeagueState, site: SiteId): { from: string; until: string } | null {
  const when = tripSeason(s);
  if (!when) return null;
  const from = when.inSeason ? nextDay(s)! : `${when.season - 1}-${T.winterStart}`;
  return { from, until: addDays(from, SITES[site].weeks * 7) };
}

/** Why he cannot go now, or null. */
export function checkTrip(s: LeagueState, id: PlayerId, site: SiteId): string | null {
  const u = s.user;
  const p = s.players[id];
  const S = SITES[site];
  if (!u || !p || p.teamId !== u.teamId) return __i18n_k("league.training.checkTrip.60e00321");
  if (!S) return __i18n_k("league.training.checkTrip.33324eb5");
  const when = tripSeason(s);
  if (!when) return s.phase === 'regular' ? __i18n_k("league.training.checkTrip.da145061", { lastStartText: lastStartText }) : __i18n_k("league.training.checkTrip.644bd1b0");
  if (p.status !== 'active') return __i18n_k("league.training.checkTrip.52c49e05");
  if (isForeign(p)) return __i18n_k("league.training.checkTrip.35394cc3");
  if (s.injuries[id] && !s.injuries[id]!.dtd) return __i18n_k("league.training.checkTrip.ad55c585");
  if (S.who === 'pitcher' && !isPitcher(p)) return __i18n_k("league.training.checkTrip.d95248ff", { name: S.name });
  if (S.who === 'hitter' && isPitcher(p)) return __i18n_k("league.training.checkTrip.db2c5dcc", { name: S.name });
  const trips = u.trips ?? [];
  if (trips.some((t) => t.id === id && t.season === when.season)) return __i18n_k("league.training.checkTrip.0b1f311e");
  if (when.inSeason) {
    if (Object.keys(s.abroad ?? {}).length >= T.seasonMax) return __i18n_k("league.training.checkTrip.3a50fcd9", { seasonMax: T.seasonMax });
    if (s.away[id]) return __i18n_k("league.training.checkTrip.8695a35f");
  } else if (trips.filter((t) => t.season === when.season && !t.inSeason).length >= T.winterMax) return __i18n_k("league.training.checkTrip.7bf1b328", { winterMax: T.winterMax });
  if (S.cost > u.fund) return __i18n_k("league.training.checkTrip.2e725bb1", { eok: eok(S.cost) });
  return null;
}

/** Sends him: the fund pays, and during the season he leaves the roster until he is back. */
export function sendTrip(s: LeagueState, id: PlayerId, site: SiteId) {
  const problem = checkTrip(s, id, site);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const p = s.players[id]!;
  const S = SITES[site];
  const when = tripSeason(s)!;
  const dates = tripDates(s, site)!;
  const trip: TrainingTrip = { id, site, season: when.season, from: dates.from, until: dates.until, cost: S.cost, inSeason: when.inSeason };
  (u.trips ??= []).push(trip);
  u.fund -= S.cost;
  u.ledger.push({ year: when.inSeason ? s.year : when.season - 1, label: __i18n_k("league.training.sendTrip.label.c9fa004b", { name: p.name, name2: S.name }), amount: -S.cost });
  if (when.inSeason) {
    (s.abroad ??= {})[id] = dates.until;
    moveTo(s, id, 'third');
  }
  (u.log ??= []).push({ year: when.inSeason ? s.year : when.season - 1, text: __i18n_k("league.training.sendTrip.text.f539a91b", { name: p.name, place: S.place, name2: S.name, weeks: S.weeks, from: dates.from, until: dates.until }) });
}

/** What a programme did for him. */
export function tripGains(s: LeagueState, p: Player, site: SiteId, season: number, r: () => number): Partial<Record<ToolKey, number>> {
  const keys = SITES[site].focus[isPitcher(p) ? 'pitcher' : 'hitter'] ?? [];
  // His velocity reading moves with his 구위 from here (as in the yearly development).
  if (p.velocity != null && p.hidden.current.stuff != null) p.velocityStuff ??= p.hidden.current.stuff;
  const age = ageIn(p, season);
  const ageK = T.age.find(([a]) => age <= a)![1];
  const lab = 1 + T.analytics * staffEdge(staffRating(s, p.teamId, 'analytics')) + facilityLevel(s, 'analytics') * 0.1;
  const gains: Partial<Record<ToolKey, number>> = {};
  keys.forEach((k, i) => {
    const cur = p.hidden.current[k];
    if (cur == null) return;
    const pot = p.hidden.potential[k] ?? cur;
    const want = T.gain * ageK * lab * (i === 0 ? 1 : T.secondary) * (0.25 + r() * 1.1);
    const g = Math.round(Math.max(0, Math.min(want, Math.max(0, pot - cur) + T.overPotential)) * 10) / 10;
    if (g <= 0) return;
    const now = Math.min(80, cur + g);
    p.hidden.current[k] = now;
    if (now > pot) p.hidden.potential[k] = now;
    gains[k] = Math.round((now - cur) * 10) / 10;
  });
  return gains;
}

/** Programmes over by `date`: he comes back with what he gained (or a sore arm), and the club hears about it. */
export function finishTrips(s: LeagueState, date: string) {
  const u = s.user;
  if (!u?.trips) return;
  for (const trip of u.trips) {
    if (trip.result || trip.until > date) continue;
    const p = s.players[trip.id];
    delete s.abroad?.[trip.id];
    if (!p || p.teamId !== u.teamId) {
      trip.result = { gains: {}, text: __i18n_k("league.training.finishTrips.text.0b0d714a") };
      continue;
    }
    const S = SITES[trip.site];
    const r = rng(`${s.seed}|trip|${trip.season}|${trip.id}|${trip.site}`);
    const before = topVelocity(p);
    const gains = tripGains(s, p, trip.site, trip.season, r);
    // His reports catch up with what the centre measured.
    rescout(p, trip.season, Math.max(0, trip.season - p.proSince), r);
    const after = topVelocity(p);
    let injury: string | undefined;
    if (r() < S.risk) {
      injury = isPitcher(p) ? (r() < 0.5 ? __i18n_k("league.training.finishTrips.46268499") : __i18n_k("league.training.finishTrips.9d69bc2d")) : __i18n_k("league.training.finishTrips.278ac5b6");
      const days = 14 + Math.floor(r() * 22);
      if (!s.injuries[p.id]) s.injuries[p.id] = { until: addDays(trip.until, days), days, onList: trip.inSeason, part: injury };
    }
    if (S.conditioning) (p.life ??= {}).conditioned = trip.season;
    const list = Object.entries(gains).map(([k, g]) => `${TOOL_LABELS[k as ToolKey] ?? k} +${g!.toFixed(1)}`);
    const velo = before != null && after != null && after > before ? __i18n_k("league.training.finishTrips.velo.de0c38eb", { before: before, after: after }) : '';
    const text = list.length ? `${list.join(', ')}${velo}` : __i18n_k("league.training.finishTrips.text.b4f24aa3");
    trip.result = { gains, ...(before != null && after != null ? { velocity: [before, after] as [number, number] } : {}), ...(injury ? { injury } : {}), text };
    const good = list.length > 0 && !injury;
    addAlert(s, {
      id: `trip-${trip.season}-${trip.id}`,
      date: trip.until,
      kind: 'season',
      title: __i18n_k("league.training.finishTrips.title.f54f2bfb", { name: p.name }),
      lines: [__i18n_k("league.training.finishTrips.lines.f0265be6", { name: S.name, place: S.place, weeks: S.weeks, text: text }), ...(injury ? [__i18n_k("league.training.finishTrips.lines.39dcee08", { injury: injury })] : []), ...(S.conditioning ? [__i18n_k("league.training.finishTrips.lines.042a4402")] : [])],
      tone: good ? 'good' : injury ? 'bad' : undefined,
      players: [p.id],
    });
    addNews(s, {
      id: `trip-${trip.season}-${trip.id}`,
      date: trip.until,
      kind: 'interview',
      title: __i18n_k("league.training.finishTrips.title.cd74286f", { name: p.name, country: S.country }),
      body: __i18n_k("league.training.finishTrips.body.3ec5d66e", { name: p.name, place: S.place, name2: S.name, weeks: S.weeks, text: text, value: injury ? __i18n_k("league.training.finishTrips.body.abb8efdc", { injury: injury }) : '' }),
      quotes: [{ who: p.name, role: 'player', text: good ? __i18n_k("league.training.quotes.text.734605a8") : __i18n_k("league.training.quotes.text.0def6e19") }],
      facts: { player: p.name, site: S.name, place: S.place, weeks: S.weeks, result: text },
      players: [p.id],
      mine: true,
    });
  }
}
