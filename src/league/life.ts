import { k as __i18n_k } from '../i18n/index';
/* Life off the field (V0.10): what happens to the user's players away from the game, and what fans think of every
   player.

   Events (the user's club only): a child is born or a family member dies (경조사 휴가: up to five days off the
   roster, counted as registered days — KBO 규정 since 2019), a hot or a cold spell, kindness to fans, a gift to
   charity, a row on social media, a small accident at home; in the winter a wedding, a gift, work on his own. 1.2.0
   added extra work after the game, a senior's advice to a young player, a commercial, a TV show, his home town in the
   stands, a row in the dugout (a clubhouse leader settles it sooner) and a veteran in the futures who wants out; the
   hidden traits pick who (trouble finds the troublemakers, good deeds the leaders and the loyal). They move his form
   for a while (grade points on his main tools in games), and the fans' fondness.

   Fondness (0–100) is worked out from the record for any player: seasons with his club, recent WAR there, a
   home-grown or home-town player, honours; events add to it. The best-loved sell shirts, and fans feel it when one
   of theirs leaves. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { iga } from './josa';
import { addNews } from './news';
import { ageIn, isPitcher } from './players';
import { orgPlayers, type LeagueState } from './state';
import { FANS, LIFE as L } from './tuning';
import { traitsOf, troubleFactor } from './traits';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const short = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '';

// ── Fondness ─────────────────────────────────────────────────────────────────────────────────────

/** Whether he grew up where his club plays (its region, or the city of a new club). */
/** What the public sees of a player is enough (the profile shows these too). */
type Known = Omit<Player, 'hidden'>;

export function hometownOf(s: LeagueState, p: Known, teamId = p.teamId): boolean {
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) return false;
  return team.region.split('·').some((x) => p.birthplace.startsWith(x)) || p.education.region === team.region;
}

/** How much the fans of his club like him, 0–100. */
export function fanAffinity(s: LeagueState, p: Known, teamId = p.teamId): number {
  if (!teamId) return 0;
  const F = L.fans;
  const here = p.career.filter((c) => !c.level && c.teamId === teamId);
  const recent = here.slice(-3);
  const weights = recent.map((_, i) => i + 1);
  const war = recent.length ? recent.reduce((a, c, i) => a + c.war * weights[i]!, 0) / weights.reduce((a, b) => a + b, 0) : 0;
  const homeGrown = p.origin.kind !== 'foreign' && !!p.origin.draftYear && p.career.filter((c) => !c.level).every((c) => c.teamId === teamId);
  const honors = (p.honors ?? []).length;
  const score =
    F.base +
    Math.min(F.seasons, here.length * F.perSeason) +
    clamp(war * F.perWar, F.war[0], F.war[1]) +
    (homeGrown && here.length ? F.homeGrown : 0) +
    (hometownOf(s, p, teamId) ? F.hometown : 0) +
    Math.min(F.honors, honors * F.perHonor) +
    (teamId === p.teamId ? (p.life?.fans ?? 0) : 0);
  return Math.round(clamp(score, 0, 100));
}

/** A club's best-loved players. */
export const favourites = (s: LeagueState, teamId: TeamId, n = 3) =>
  orgPlayers(s, teamId)
    .map((p) => ({ p, love: fanAffinity(s, p, teamId) }))
    .sort((a, b) => b.love - a.love)
    .slice(0, n);

/** The user's club's extra shirt sales from its three best-loved players (0 for every other club). */
export function favouritesMerch(s: LeagueState, teamId: TeamId): number {
  if (teamId !== s.user?.teamId) return 0;
  const top = favourites(s, teamId);
  if (!top.length) return 0;
  const avg = top.reduce((a, x) => a + x.love, 0) / top.length;
  return L.merch * clamp((avg - 40) / 60, 0, 1);
}

const adjustFans = (p: Player, by: number) => {
  const life = (p.life ??= {});
  life.fans = clamp((life.fans ?? 0) + by, -30, 30);
};

/**
 * One of the user's well-liked players leaves (traded, released, a free agent elsewhere): the club's fans' mood
 * drops with how much they liked him, and they say so.
 */
export function farewell(s: LeagueState, p: Player, from: TeamId, how: string, date = s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${s.year}-04-01`) : `${s.year}-11-01`) {
  const u = s.user;
  if (!u || from !== u.teamId) return;
  const love = fanAffinity(s, p, from);
  if (love < L.farewell.from) return;
  const hit = L.farewell.most * ((love - L.farewell.from) / (100 - L.farewell.from) + 0.25);
  const c = clubState(s, from);
  c.interest = clamp(c.interest - hit, FANS.interestMin, FANS.interestMax);
  addNews(s, {
    date,
    kind: 'move',
    title: __i18n_k("league.life.farewell.title.14eb1471", { name: p.name, how: how }),
    body: __i18n_k("league.life.farewell.body.43ee73a8", { short: short(s, from), name: iga(p.name), how: how, love: love }),
    quotes: [{ who: __i18n_k("league.life.quotes.who.724cc77d"), role: 'fan', text: love >= 80 ? __i18n_k("league.life.quotes.text.3074c2b9") : __i18n_k("league.life.quotes.text.289efa77") }],
    facts: { player: p.name, fondness: love, how },
    players: [p.id],
    mine: true,
  });
}

// ── Family ───────────────────────────────────────────────────────────────────────────────────────

/** Married already when he came to us (by age, fixed per player), or married since. */
export function isMarried(s: LeagueState, p: Pick<Player, 'id' | 'birthday' | 'life'>, year = s.year): boolean {
  if (p.life?.married != null) return true;
  const age = year - Number(p.birthday.slice(0, 4));
  const chance = age >= 33 ? 0.8 : age >= 30 ? 0.6 : age >= 27 ? 0.3 : age >= 25 ? 0.12 : 0.03;
  return hashUnit(`${s.seed}|married|${p.id}`) < chance;
}

// ── Form ─────────────────────────────────────────────────────────────────────────────────────────

/** Grade points his main tools move in today's games. */
export const formOf = (p: Player, date: string) => (p.life?.form && p.life.form.until >= date ? p.life.form.delta : 0);

export const setForm = (p: Player, delta: number, from: string, days: number, why: string) => {
  (p.life ??= {}).form = { delta, until: addDays(from, days), why };
};

export const note = (p: Player, date: string, text: string, tone?: 'good' | 'bad') => {
  const life = (p.life ??= {});
  (life.events ??= []).push({ date, text, ...(tone ? { tone } : {}) });
  if (life.events.length > 12) life.events.splice(0, life.events.length - 12);
};

// ── Events in the season ─────────────────────────────────────────────────────────────────────────

type Kind = 'birth' | 'loss' | 'hot' | 'cold' | 'fanService' | 'charity' | 'row' | 'accident' | Extra;
/** 1.2.0: more of life, leaning on the hidden traits (traits.ts). */
type Extra = 'extraWork' | 'mentor' | 'commercial' | 'variety' | 'hometownCheer' | 'feud' | 'grumble';
const WEIGHTS = Object.entries(L.weights) as [Kind, number][];

const FAN_SERVICE = [__i18n_k("league.life.fAN_SERVICE.2189f36c"), __i18n_k("league.life.fAN_SERVICE.fbacc347"), __i18n_k("league.life.fAN_SERVICE.6bb2138f"), __i18n_k("league.life.fAN_SERVICE.3526e66a")];
const CHARITY = [__i18n_k("league.life.cHARITY.339563a8"), __i18n_k("league.life.cHARITY.a8979bab"), __i18n_k("league.life.cHARITY.d7254dd1"), __i18n_k("league.life.cHARITY.0405454b")];
const ROWS = [__i18n_k("league.life.rOWS.282a1c5b"), __i18n_k("league.life.rOWS.238a3286"), __i18n_k("league.life.rOWS.cec3be51")];
const ACCIDENTS = [__i18n_k("league.life.aCCIDENTS.fac9342b"), __i18n_k("league.life.aCCIDENTS.6469c74b"), __i18n_k("league.life.aCCIDENTS.5cfe12c8")];
const FAMILY = [__i18n_k("league.life.fAMILY.9bdf45f2"), __i18n_k("league.life.fAMILY.0ff67ad2"), __i18n_k("league.life.fAMILY.fb14d857"), __i18n_k("league.life.fAMILY.d2e54d40")];
const EXTRA_WORK: Record<'pitcher' | 'hitter', string[]> = {
  pitcher: [__i18n_k("league.life.eXTRA_WORK.pitcher.6f117e8d"), __i18n_k("league.life.eXTRA_WORK.pitcher.74fdac48"), __i18n_k("league.life.eXTRA_WORK.pitcher.4d33656e")],
  hitter: [__i18n_k("league.life.eXTRA_WORK.hitter.4074dbdf"), __i18n_k("league.life.eXTRA_WORK.hitter.8c36028d"), __i18n_k("league.life.eXTRA_WORK.hitter.a74ec075")],
};
const COMMERCIALS = [__i18n_k("league.life.cOMMERCIALS.58368dbf"), __i18n_k("league.life.cOMMERCIALS.d17b218f"), __i18n_k("league.life.cOMMERCIALS.e586b94e"), __i18n_k("league.life.cOMMERCIALS.d24f78d5"), __i18n_k("league.life.cOMMERCIALS.5d8d1358")];
const SHOWS = [__i18n_k("league.life.sHOWS.43fe8698"), __i18n_k("league.life.sHOWS.28a196ea"), __i18n_k("league.life.sHOWS.55c51429"), __i18n_k("league.life.sHOWS.ab52a761")];
const FEUDS = [__i18n_k("league.life.fEUDS.80f13c01"), __i18n_k("league.life.fEUDS.e3ba60d1"), __i18n_k("league.life.fEUDS.a8743417")];

const pickOf = <T,>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;

/** Who an event can happen to. */
function eligible(s: LeagueState, kind: Kind, p: Player, year: number, date: string): boolean {
  const active = s.user ? s.rosters[s.user.teamId]!.active.includes(p.id) : false;
  const age = ageIn(p, year);
  if (p.status !== 'active' || s.injuries[p.id] || s.away[p.id] || s.abroad?.[p.id]) return false;
  switch (kind) {
    case 'birth':
      // Not again within two years of the last child.
      return isMarried(s, p, year) && age >= 25 && age <= 38 && year - (p.life?.lastBirth ?? -99) >= 2;
    case 'loss':
      return age >= 24;
    case 'hot':
    case 'cold':
      return active && !formOf(p, date);
    case 'fanService':
    case 'charity':
    case 'row':
      return active || age >= 25;
    case 'accident':
      return true;
    case 'extraWork':
      return active && traitsOf(p).work >= 60 && !formOf(p, date);
    case 'mentor':
      return active && age <= 24 && !formOf(p, date) && !!mentorFor(s, p, year);
    case 'commercial':
      return fanAffinity(s, p) >= 55;
    case 'variety':
      return age >= 22 && (active || fanAffinity(s, p) >= 45);
    case 'hometownCheer':
      return active && hometownOf(s, p);
    case 'feud':
      return active && age >= 21 && traitsOf(p).controversy >= 35;
    case 'grumble':
      // A veteran stuck in the futures who would rather play elsewhere.
      return !active && age >= 26 && traitsOf(p).loyalty < 40 && p.scouting.current >= 45;
  }
}

/** A senior on our first team with a leader's voice to take a young player aside. */
function mentorFor(s: LeagueState, young: Player, year: number): Player | undefined {
  const active = s.rosters[s.user!.teamId]!.active;
  return active
    .map((id) => s.players[id]!)
    .filter((q) => q.id !== young.id && ageIn(q, year) >= 30 && traitsOf(q).leadership >= 60 && isPitcher(q) === isPitcher(young))
    .sort((a, b) => traitsOf(b).leadership - traitsOf(a).leadership)[0];
}

/** How likely each eligible player is to be the one (1.2.0): trouble finds the troublemakers, good deeds the
    leaders and the loyal, extra work the hard workers. */
function leanOf(kind: Kind, p: Player): number {
  const t = traitsOf(p);
  switch (kind) {
    case 'row':
    case 'feud':
      return troubleFactor(p);
    case 'fanService':
    case 'charity':
      return 1 + Math.max(0, t.leadership - 50) / 50 + Math.max(0, t.loyalty - 50) / 50;
    case 'extraWork':
      return 1 + (t.work - 60) / 20;
    default:
      return 1;
  }
}

/**
 * One game day: now and then something happens to one of the user's players. Returns the player it happened to,
 * if any.
 */
export function lifeDay(s: LeagueState, date: string): PlayerId | null {
  const u = s.user;
  if (!u) return null;
  const r = rng(`${s.seed}|life|${date}`);
  if (r() >= L.daily) return null;
  const year = s.year;
  const people = orgPlayers(s, u.teamId);
  const total = WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  const kind = WEIGHTS.find(([, w]) => (x -= w) < 0)?.[0] ?? 'hot';
  const pool = people.filter((p) => eligible(s, kind, p, year, date));
  if (!pool.length) return null;
  const weights = pool.map((q) => leanOf(kind, q));
  let y = r() * weights.reduce((a, b) => a + b, 0);
  const p = pool[weights.findIndex((w) => (y -= w) < 0)] ?? pool.at(-1)!;
  const onFirst = s.rosters[u.teamId]!.active.includes(p.id);
  const main = isPitcher(p) ? __i18n_k("league.life.lifeDay.main.6ff2c5c1") : __i18n_k("league.life.lifeDay.main.4f218994");
  let title = '',
    body = '',
    tone: 'good' | 'bad' | undefined;
  const quotes: { who: string; role: 'player' | 'fan' | 'manager'; text: string }[] = [];
  switch (kind) {
    case 'birth': {
      const life = (p.life ??= {});
      life.kids = (life.kids ?? 0) + 1;
      life.lastBirth = year;
      const days = L.leave.birth[0] + Math.floor(r() * (L.leave.birth[1] - L.leave.birth[0] + 1));
      const child = r() < 0.5 ? __i18n_k("league.life.lifeDay.child.ba81d8e5") : __i18n_k("league.life.lifeDay.child.56c513e2");
      if (onFirst) s.away[p.id] = addDays(date, days - 1);
      setForm(p, L.form.baby, addDays(date, onFirst ? days : 0), 14, child);
      adjustFans(p, 3);
      title = __i18n_k("league.life.lifeDay.fa8a46e7", { name: p.name, child: child, value: life.kids > 1 ? __i18n_k("league.life.lifeDay.10136944", { kids: life.kids }) : '' });
      body = __i18n_k("league.life.lifeDay.b994f585", { name: iga(p.name), value: date.slice(5).replace('-', '월 '), child: child, value2: onFirst ? __i18n_k("league.life.lifeDay.639746a9", { days: days }) : '' });
      quotes.push({ who: p.name, role: 'player', text: __i18n_k("league.life.lifeDay.text.42b1fecc") });
      tone = 'good';
      break;
    }
    case 'loss': {
      const days = L.leave.loss[0] + Math.floor(r() * (L.leave.loss[1] - L.leave.loss[0] + 1));
      const what = pickOf(FAMILY, r);
      if (onFirst) s.away[p.id] = addDays(date, days - 1);
      setForm(p, L.form.loss, addDays(date, onFirst ? days : 0), 10, what);
      adjustFans(p, 2);
      title = `${p.name}, ${what}`;
      body = __i18n_k("league.life.lifeDay.1304c609", { name: iga(p.name), what: what, value: onFirst ? __i18n_k("league.life.lifeDay.d5642763", { days: days }) : '' });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.bc591b6d") });
      break;
    }
    case 'hot': {
      const days = 10 + Math.floor(r() * 6);
      setForm(p, L.form.hot, date, days, __i18n_k("league.life.lifeDay.531b5109", { main: main }));
      title = __i18n_k("league.life.lifeDay.94708547", { name: p.name, main: main });
      body = __i18n_k("league.life.lifeDay.218899e5", { name: p.name, main: main });
      tone = 'good';
      break;
    }
    case 'cold': {
      const days = 12 + Math.floor(r() * 9);
      setForm(p, L.form.cold, date, days, __i18n_k("league.life.lifeDay.1fcc8b09"));
      title = __i18n_k("league.life.lifeDay.8471cc6d", { name: p.name });
      body = __i18n_k("league.life.lifeDay.848c05f6", { name: iga(p.name), value: isPitcher(p) ? __i18n_k("league.life.lifeDay.149785e2") : __i18n_k("league.life.lifeDay.8edcab3b") });
      tone = 'bad';
      break;
    }
    case 'fanService': {
      adjustFans(p, 4);
      title = __i18n_k("league.life.lifeDay.924ce6d9", { name: p.name });
      body = __i18n_k("league.life.lifeDay.e699b5bb", { name: iga(p.name), pickOf: pickOf(FAN_SERVICE, r) });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.02756c1f") });
      tone = 'good';
      break;
    }
    case 'charity': {
      adjustFans(p, 5);
      title = __i18n_k("league.life.lifeDay.4d10383c", { name: p.name });
      body = __i18n_k("league.life.lifeDay.3c611e6d", { name: iga(p.name), pickOf: pickOf(CHARITY, r) });
      tone = 'good';
      break;
    }
    case 'row': {
      adjustFans(p, -6);
      setForm(p, L.form.row, date, 7, __i18n_k("league.life.lifeDay.8ab841fb"));
      title = __i18n_k("league.life.lifeDay.222219cc", { name: p.name });
      body = __i18n_k("league.life.lifeDay.f0af0f1d", { name: iga(p.name), pickOf: pickOf(ROWS, r) });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.bddab9f3") });
      tone = 'bad';
      break;
    }
    case 'accident': {
      const days = 3 + Math.floor(r() * 5);
      const what = pickOf(ACCIDENTS, r);
      s.injuries[p.id] = { until: addDays(date, days + 1), days, onList: false, dtd: true, part: __i18n_k("league.life.lifeDay.part.fb307b9f") };
      title = __i18n_k("league.life.lifeDay.a434fede", { name: p.name, days: days });
      body = __i18n_k("league.life.lifeDay.0f7785fd", { name: iga(p.name), what: what, days: days });
      tone = 'bad';
      break;
    }
    case 'extraWork': {
      setForm(p, L.form.hot * 0.6, addDays(date, 2), 10, __i18n_k("league.life.lifeDay.52ffd42c"));
      adjustFans(p, 2);
      title = __i18n_k("league.life.lifeDay.42eef062", { name: p.name });
      body = __i18n_k("league.life.lifeDay.f03cf20d", { name: iga(p.name), pickOf: pickOf(EXTRA_WORK[isPitcher(p) ? 'pitcher' : 'hitter'], r) });
      quotes.push({ who: p.name, role: 'player', text: __i18n_k("league.life.lifeDay.text.30f7d5a9") });
      tone = 'good';
      break;
    }
    case 'mentor': {
      const vet = mentorFor(s, p, year)!;
      setForm(p, L.form.hot * 0.8, date, 12, __i18n_k("league.life.lifeDay.defee7c6", { name: vet.name }));
      adjustFans(vet, 2);
      note(vet, date, __i18n_k("league.life.lifeDay.1515cbd5", { name: p.name }), 'good');
      title = __i18n_k("league.life.lifeDay.0d97a14e", { name: p.name, name2: vet.name });
      body = __i18n_k("league.life.lifeDay.584cc12f", { name: iga(p.name), name2: vet.name, name3: iga(vet.name), value: isPitcher(p) ? __i18n_k("league.life.lifeDay.91a5042c") : __i18n_k("league.life.lifeDay.04946a96") });
      quotes.push({ who: p.name, role: 'player', text: __i18n_k("league.life.lifeDay.text.6d775b2f", { name: vet.name }) });
      tone = 'good';
      break;
    }
    case 'commercial': {
      adjustFans(p, 3);
      title = __i18n_k("league.life.lifeDay.93913486", { name: p.name });
      body = __i18n_k("league.life.lifeDay.ca1adf26", { name: iga(p.name), pickOf: pickOf(COMMERCIALS, r) });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.1c5bcc7f") });
      tone = 'good';
      break;
    }
    case 'variety': {
      adjustFans(p, 3);
      title = __i18n_k("league.life.lifeDay.456d9fd8", { name: p.name, pickOf: pickOf(SHOWS, r) });
      body = __i18n_k("league.life.lifeDay.1bb4ac47", { name: iga(p.name) });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.83395b98") });
      tone = 'good';
      break;
    }
    case 'hometownCheer': {
      adjustFans(p, 3);
      setForm(p, 1, date, 5, __i18n_k("league.life.lifeDay.99423aba"));
      title = __i18n_k("league.life.lifeDay.f74dddb0", { name: p.name });
      body = __i18n_k("league.life.lifeDay.e1caed67", { name: p.name });
      quotes.push({ who: p.name, role: 'player', text: __i18n_k("league.life.lifeDay.text.897f98c6") });
      tone = 'good';
      break;
    }
    case 'feud': {
      const other = pickOf(
        s.rosters[u.teamId]!.active.filter((id) => id !== p.id).map((id) => s.players[id]!),
        r,
      );
      const leader = s.rosters[u.teamId]!.active.map((id) => s.players[id]!).find((q) => q !== p && q !== other && ageIn(q, year) >= 28 && traitsOf(q).leadership >= 70);
      const hit = leader ? L.form.row / 2 : L.form.row * 1.5;
      setForm(p, hit, date, 7, __i18n_k("league.life.lifeDay.bee0823a"));
      if (other && !formOf(other, date)) setForm(other, hit, date, 7, __i18n_k("league.life.lifeDay.bee0823a"));
      adjustFans(p, -2);
      title = __i18n_k("league.life.lifeDay.39bc27c1", { name: p.name, value: other?.name ?? __i18n_k("league.life.lifeDay.affa151c") });
      body = __i18n_k("league.life.lifeDay.bd46d773", { name: iga(p.name), value: other?.name ?? __i18n_k("league.life.lifeDay.affa151c"), pickOf: pickOf(FEUDS, r), value2: leader ? __i18n_k("league.life.lifeDay.e2ce6ee0", { name: iga(leader.name) }) : __i18n_k("league.life.lifeDay.a57f02c8") });
      tone = 'bad';
      break;
    }
    case 'grumble': {
      adjustFans(p, -1);
      title = __i18n_k("league.life.lifeDay.124eb9b8", { name: p.name });
      body = __i18n_k("league.life.lifeDay.9fafbe5e", { name: iga(p.name) });
      quotes.push({ who: __i18n_k("league.life.lifeDay.who.724cc77d"), role: 'fan', text: __i18n_k("league.life.lifeDay.text.02cbfddb") });
      tone = 'bad';
      break;
    }
  }
  note(p, date, title, tone);
  addNews(s, { id: `life-${date}-${p.id}`, date, kind: 'interview', title, body, quotes, facts: { player: p.name, event: title }, players: [p.id], mine: true });
  // A pop-up only when it takes a first-team player out for a few days.
  if (onFirst && (kind === 'birth' || kind === 'loss' || kind === 'accident'))
    addAlert(s, { id: `life-${date}-${p.id}`, date, kind: 'life', title, lines: [body], ...(tone ? { tone } : {}), players: [p.id] });
  return p.id;
}

// ── The winter ───────────────────────────────────────────────────────────────────────────────────

const WORK: Record<'pitcher' | 'hitter', [import('../draftroom').ToolKey, string][]> = {
  pitcher: [
    ['stuff', __i18n_k("league.life.wORK.pitcher.f699c0f0")],
    ['command', __i18n_k("league.life.wORK.pitcher.44e8b540")],
    ['stamina', __i18n_k("league.life.wORK.pitcher.9d61324e")],
  ],
  hitter: [
    ['power', __i18n_k("league.life.wORK.hitter.08a2dbb7")],
    ['contact', __i18n_k("league.life.wORK.hitter.f7e5edeb")],
    ['speed', __i18n_k("league.life.wORK.hitter.faa2dbc4")],
  ],
};

/** The winter's events for the user's players: weddings, gifts, work on his own. */
export function lifeWinter(s: LeagueState, year: number) {
  const u = s.user;
  if (!u) return;
  const W = L.winter;
  for (const p of orgPlayers(s, u.teamId)) {
    if (p.status !== 'active') continue;
    const r = rng(`${s.seed}|life-winter|${year}|${p.id}`);
    const age = ageIn(p, year + 1);
    const date = `${year}-12-${String(5 + Math.floor(r() * 20)).padStart(2, '0')}`;
    if (!isMarried(s, p, year) && age >= 26 && age <= 33 && r() < W.marry) {
      (p.life ??= {}).married = year;
      adjustFans(p, 2);
      note(p, date, __i18n_k("league.life.lifeWinter.088f0833"), 'good');
      addNews(s, { id: `wed-${year}-${p.id}`, date, kind: 'interview', title: __i18n_k("league.life.lifeWinter.title.9b96e1c4", { name: p.name }), body: __i18n_k("league.life.lifeWinter.body.47b1e4ab", { name: iga(p.name), value: date.slice(5).replace('-', '월 ') }), quotes: [{ who: p.name, role: 'player', text: __i18n_k("league.life.quotes.text.a4b9b47e") }], facts: { player: p.name }, players: [p.id], mine: true });
    }
    if (r() < W.charity) {
      adjustFans(p, 4);
      note(p, date, __i18n_k("league.life.lifeWinter.29c86f2c"), 'good');
      addNews(s, { id: `gift-${year}-${p.id}`, date, kind: 'interview', title: __i18n_k("league.life.lifeWinter.title.5cdf821b", { name: p.name }), body: __i18n_k("league.life.lifeWinter.body.98237176", { name: iga(p.name), pickOf: pickOf(CHARITY, r) }), quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
    }
    if (age <= 30 && r() < W.selfWork) {
      const [tool, how] = pickOf(WORK[isPitcher(p) ? 'pitcher' : 'hitter'], r);
      const cur = p.hidden.current[tool];
      if (cur != null) {
        const g = 1 + Math.round(r() * 10) / 10;
        p.hidden.current[tool] = Math.min(80, cur + g);
        if (p.hidden.current[tool]! > (p.hidden.potential[tool] ?? 0)) p.hidden.potential[tool] = p.hidden.current[tool];
        note(p, date, __i18n_k("league.life.lifeWinter.b00ffa3e"), 'good');
        addNews(s, { id: `work-${year}-${p.id}`, date, kind: 'interview', title: __i18n_k("league.life.lifeWinter.title.0d1ee99c", { name: p.name }), body: __i18n_k("league.life.lifeWinter.body.4ba3e937", { name: iga(p.name), how: how }), quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
      }
    }
  }
}
