import { k as __i18n_k } from '../i18n/index';
/* 1.9.5, scenario 15 (the 1.9 plan's 4.3): the 1982 legacy start. The league begins with the KBO's six clubs of 1982
   under their names then (lineage.ts) and plays the KBO's own rules year by year (rules/history.ts, `historical`);
   the money stays in today's terms (an era shift: 1982 is 2026's economy). The player watches the first season,
   founds the seventh club that summer and joins the first team in 1983. The other clubs come in their real years
   through the twelfth club's founding (rival.ts): 빙그레 1985 (first team 1986), 쌍방울 1990 (1991), NC 2011 (2013) and
   KT 2013 (2015) — so the league grows 7 → 8 → 9 → 10 → 11 and arrives at today's eleven-club game.

   Each opening day: the clubs founded that year, the names and owners of the year, the two leagues of 1999–2000, and
   a notice of the rules that changed. */
import { rng } from '../draftroom';
import type { Team, TeamId } from '../model/types';
import { EXPANSION_DEFAULTS } from '../rules/kbo2026';
import { ruleChanges, rulesFor, type YearRules } from '../rules/history';
import { addAlert } from './alerts';
import { existingTeams } from './clubs';
import { LEGACY_ERA, LEGACY_START } from './era';
import { clubState } from './fans';
import { ro } from './josa';
import { clubIn, LINEAGE, lineageOf } from './lineage';
import { milestone } from './milestones';
import { addNews } from './news';
import { leagueEvent } from './leagueevents';
import { rivalTryout, specialEligible, type FoundingClub } from './rival';
import { keepValue } from './players';
import { removeFromRoster } from './offseason';
import { MANAGER_STYLES, staffOf } from './staff';
import { emptyRoster, firstTeamIds, type GmStyle, type LeagueSide, type LeagueState, type ManagerStyle } from './state';

export { LEGACY_ERA, LEGACY_START };
/** Candidate cities a legacy start does not offer: a club history founds there later (쌍방울, 1990). */
export const LEGACY_TAKEN_CITIES = ['jeonju'];
/** How many a club founded in the AI's hands signs at its tryout. */
export const LEGACY_TRYOUT = 25;

export interface LegacyState {
  /** The clubs founded in their real years, run by the AI (빙그레, 쌍방울, NC, KT). */
  clubs: FoundingClub[];
  /** 1.9.7: the league's own timeline (리그 연표): openings, foundings, new names, rule changes, firsts. */
  events?: { year: number; text: string }[];
  /** 1.9.6: the foreign players' tryout draft of the winter (tryout.ts). */
  tryout?: import('./tryout').ForeignTryout;
}

export const isLegacy = (s: LeagueState) => !!s.historical;

export { leagueEvent } from './leagueevents';

const GM_KEYS: GmStyle[] = ['balanced', 'develop', 'winNow', 'moneyball'];

/** A club of today as it was in `year`: its name, owner and home then, founded and on the first team in its years. */
function asIn(t: Team, year: number): Team {
  const e = clubIn(t.id, year);
  const l = lineageOf(t.id);
  if (!e || !l) return t;
  return { ...t, name: e.name, short: e.short, region: e.region, founded: l.founded, firstTeamFrom: l.firstTeam, parent: { type: e.parent, name: e.company } };
}

/** The existing clubs founded by `year`, under that year's names (the 1982 league for the legacy start). */
export const legacyTeams = (year: number): Team[] =>
  existingTeams()
    .filter((t) => (lineageOf(t.id)?.founded ?? Infinity) <= year)
    .map((t) => asIn(t, year));

/** The new names and owners of `year` (a club sold or renamed over the winter), with the news of it. */
export function applyLineage(s: LeagueState, year: number) {
  for (const t of s.teams) {
    const e = clubIn(t.id, year);
    if (!e || t.id === s.user?.teamId) continue;
    const before = t.name;
    t.name = e.name;
    t.short = e.short;
    t.region = e.region;
    t.parent = { type: e.parent, name: e.company };
    if (before === e.name || year === LEGACY_START) continue;
    const title = __i18n_k("league.legacy1982.text.0958720a", { before, after: ro(e.name) });
    const body = __i18n_k("league.legacy1982.text.9628baee", { before, year, after: e.name, company: e.company, city: e.city });
    addNews(s, { id: `lineage-${year}-${t.id}`, date: `${year}-01-15`, kind: 'season', title, body, quotes: [], facts: { club: e.name, year }, players: [], mine: false });
    leagueEvent(s, year, title);
    milestone(s, year, title, 'lineage');
  }
}

/** The clubs founded in `year` (their real year): to the league, a tryout, the draft's priority picks this year, the
    special draft before their first first-team season — as the twelfth club (rival.ts). */
export function legacyFoundings(s: LeagueState, year: number) {
  const now = LINEAGE.filter((l) => l.founded === year && !s.teams.some((t) => t.id === l.id));
  if (!now.length) return;
  const r = rng(`${s.seed}|legacy-founding|${year}`);
  const legacy = (s.legacy ??= { clubs: [] });
  for (const l of now) {
    const base = existingTeams().find((t) => t.id === l.id)!;
    const team: Team = { ...asIn(base, year), kind: 'expansion', benefitsUntil: l.firstTeam + EXPANSION_DEFAULTS.benefitSeasons - 1 };
    s.teams.push(team);
    s.rosters[l.id] = emptyRoster();
    const gm = GM_KEYS[Math.floor(r() * GM_KEYS.length)]!;
    const club: FoundingClub = { teamId: l.id, founded: year, firstTeam: l.firstTeam, gm };
    legacy.clubs.push(club);
    clubState(s, l.id);
    staffOf(s, l.id).manager.style = (Object.keys(MANAGER_STYLES) as ManagerStyle[])[Math.floor(r() * Object.keys(MANAGER_STYLES).length)]!;
    const signed = rivalTryout(s, year, l.id, gm, true, { count: LEGACY_TRYOUT, make: (p) => p });
    const e = clubIn(l.id, year)!;
    const title = __i18n_k("league.legacy1982.text.e95a7510", { name: e.name });
    const lines = [__i18n_k("league.legacy1982.text.60eccbcf", { name: e.name, company: e.company, city: e.city, firstTeam: l.firstTeam }), __i18n_k("league.legacy1982.text.83a41736", { signed })];
    addNews(s, { id: `legacy-found-${l.id}`, date: `${year}-03-10`, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { club: e.name, firstTeam: l.firstTeam }, players: [], mine: false });
    addAlert(s, { id: `legacy-found-${l.id}`, date: `${year}-03-10`, kind: 'season', title, lines });
    leagueEvent(s, year, title);
    milestone(s, year, title, 'legacyFounded');
  }
}

/** 1999–2000: two leagues (드림·매직), drawn once down last season's table; one league again from 2001. */
export function legacyLeagues(s: LeagueState, year: number) {
  if (!rulesFor(year).twoLeagues) {
    if (s.leagueSides) delete s.leagueSides;
    return;
  }
  if (s.leagueSides) return;
  const table = s.history.at(-1)?.table ?? [];
  const ids = firstTeamIds(s, year).sort((a, b) => (table.find((x) => x.teamId === a)?.rank ?? 99) - (table.find((x) => x.teamId === b)?.rank ?? 99) || a.localeCompare(b));
  const sides: Record<TeamId, LeagueSide> = {};
  ids.forEach((id, i) => (sides[id] = i % 4 === 0 || i % 4 === 3 ? 'dream' : 'magic'));
  s.leagueSides = { sides };
}

/** How many players each first-team club hands a new club before its first first-team season, and how many of its
    best it keeps out of it (a game assumption after the 1980s allocations: with six to eight clubs and no free agency
    until 1999 one special-draft pick a club is far too little; with three each a new club wins about a third of its
    games in its first season, about 빙그레's .290 of 1986). */
export const ALLOCATION = { perClub: 3, keep: 10 };

/** The winter before a new club's first first-team season in a legacy league (ours, or one the AI founded): every
    other first-team club hands it three players beyond its best ten, free (after the special draft). */
export function legacyAllocations(s: LeagueState, next: number) {
  if (!isLegacy(s)) return;
  const u = s.user;
  const clubs = [...(u && u.firstTeamYear === next ? [u.teamId] : []), ...(s.legacy?.clubs ?? []).filter((c) => c.firstTeam === next).map((c) => c.teamId)];
  for (const to of clubs) {
    const got: string[] = [];
    for (const from of firstTeamIds(s, next - 1)) {
      if (from === to || clubs.includes(from)) continue;
      const give = specialEligible(s, from, next)
        .sort((a, b) => keepValue(b, next) - keepValue(a, next))
        .slice(ALLOCATION.keep, ALLOCATION.keep + ALLOCATION.perClub);
      for (const p of give) {
        removeFromRoster(s, p);
        p.teamId = to;
        if (p.contract) p.contract.teamId = to;
        s.rosters[to]!.futures.push(p.id);
        got.push(__i18n_k("league.legacy1982.text.0031dde3", { club: s.teams.find((t) => t.id === from)?.short ?? from, name: p.name }));
      }
    }
    if (!got.length) continue;
    const name = s.teams.find((t) => t.id === to)?.name ?? to;
    const title = __i18n_k("league.legacy1982.text.b921195d", { name, n: got.length });
    addNews(s, { id: `allocation-${next}-${to}`, date: `${next - 1}-12-05`, kind: 'move', title, body: got.join(', '), quotes: [], facts: { club: name, count: got.length }, players: [], mine: to === u?.teamId });
    if (to === u?.teamId) addAlert(s, { id: `allocation-${next}`, date: `${next - 1}-12-05`, kind: 'season', title, lines: [__i18n_k("league.legacy1982.text.d85e6ced", { keep: ALLOCATION.keep, per: ALLOCATION.perClub }), ...got] });
  }
}

/** One line for each rule that changed into `to` (the notices of the winter). */
export function ruleNoticeLines(from: YearRules, to: YearRules): string[] {
  const out: string[] = [];
  for (const k of ruleChanges(from, to)) {
    switch (k) {
      case 'gamesPerClub':
        out.push(__i18n_k("league.legacy1982.text.0787583b", { n: to.gamesPerClub }));
        break;
      case 'halves':
        out.push(to.halves ? __i18n_k("league.legacy1982.text.36f6b3b1") : __i18n_k("league.legacy1982.text.d89944b0"));
        break;
      case 'twoLeagues':
        out.push(to.twoLeagues ? __i18n_k("league.legacy1982.text.055743f2") : __i18n_k("league.legacy1982.text.f8339ebd"));
        break;
      case 'postseason':
        out.push(
          {
            halves: __i18n_k("league.legacy1982.text.bbe02fa6"),
            halvesBest: __i18n_k("league.legacy1982.text.33657e88"),
            halvesTickets: __i18n_k("league.legacy1982.text.a9f6ed90"),
            four: __i18n_k("league.legacy1982.text.851aba7f"),
            fourWithin3: __i18n_k("league.legacy1982.text.42c252bf"),
            twoLeagues: __i18n_k("league.legacy1982.text.e424641f"),
            five: __i18n_k("league.legacy1982.text.a1134e68"),
          }[to.postseason],
        );
        break;
      case 'extraInnings':
        out.push(to.extraInnings == null ? __i18n_k("league.legacy1982.text.005eb329") : __i18n_k("league.legacy1982.text.bec63209", { n: to.extraInnings }));
        break;
      case 'ties':
        out.push({ excluded: __i18n_k("league.legacy1982.text.c8100dca"), half: __i18n_k("league.legacy1982.text.3507a1ea"), wins: __i18n_k("league.legacy1982.text.381648ea"), loss: __i18n_k("league.legacy1982.text.d3a2b422") }[to.ties]);
        break;
      case 'firstTeam':
        out.push(__i18n_k("league.legacy1982.text.aaf739db", to.firstTeam));
        break;
      case 'rosterLimit':
        out.push(__i18n_k("league.legacy1982.text.5739c1e7", { n: to.rosterLimit }));
        break;
      case 'futuresLeague':
        if (to.futuresLeague) out.push(__i18n_k("league.legacy1982.text.515330e1"));
        break;
      case 'development':
        if (to.development) out.push(__i18n_k("league.legacy1982.text.98dff5b7"));
        break;
      case 'territorialPicks':
        out.push(to.territorialPicks === 0 ? __i18n_k("league.legacy1982.text.fac4f512") : to.territorialPicks === Infinity ? __i18n_k("league.legacy1982.text.396267e6") : __i18n_k("league.legacy1982.text.028d95de", { n: to.territorialPicks }));
        break;
      case 'foreign':
        if (from.foreign.hold === 0 && to.foreign.hold > 0) out.push(__i18n_k("league.legacy1982.text.af29f845", { n: to.foreign.hold }));
        else if (to.foreign.signing !== from.foreign.signing && to.foreign.signing === 'free') out.push(__i18n_k("league.legacy1982.text.269545f5"));
        else if (to.foreign.hold !== from.foreign.hold || to.foreign.play !== from.foreign.play) out.push(__i18n_k("league.legacy1982.text.0413ea6a", { hold: to.foreign.hold, play: to.foreign.play }));
        if (to.foreign.asia > from.foreign.asia) out.push(__i18n_k("league.legacy1982.text.1040c503", { n: to.foreign.asia }));
        break;
      case 'kyopo':
        if (!from.kyopo.allowed && to.kyopo.allowed) out.push(__i18n_k("league.legacy1982.text.877e3846", { n: to.kyopo.maxPlay ?? 0 }));
        else if (from.kyopo.maxPlay && !to.kyopo.maxPlay && to.kyopo.allowed && !to.kyopo.maxEntry) out.push(__i18n_k("league.legacy1982.text.402b37c3"));
        else if (to.kyopo.maxEntry) out.push(__i18n_k("league.legacy1982.text.1d534689", { n: to.kyopo.maxEntry }));
        break;
      case 'freeAgencySeasons':
        out.push(from.freeAgencySeasons == null ? __i18n_k("league.legacy1982.text.e905d50e", { n: to.freeAgencySeasons ?? 0 }) : __i18n_k("league.legacy1982.text.175acca3", { n: to.freeAgencySeasons ?? 0 }));
        break;
      case 'posting':
        if (to.posting) out.push(__i18n_k("league.legacy1982.text.68c47f6b"));
        break;
      case 'salaryCap':
        if (to.salaryCap) out.push(__i18n_k("league.legacy1982.text.eb2e39b4"));
        break;
      // Held every other winter, and what the scouts see: not rule news.
      case 'secondDraft':
      case 'overseasDraftInterest':
      case 'futuresSimulated':
      case 'series':
      case 'year':
        break;
    }
  }
  return out;
}

/** 1.9.7: how long after his last season a retired player's detail is kept in full. */
export const TRIM_AFTER = 10;

/** 1.9.7, a legacy game's fifty seasons (about 20 MB of save by 2032, players nine tenths of it): a player retired
    for `TRIM_AFTER` seasons keeps his season lines but not their left/right splits, nor his yearly grade log. */
export function trimRetired(s: LeagueState, year: number) {
  for (const p of Object.values(s.players)) {
    if (p.status !== 'retired' || !p.career.length || p.career.at(-1)!.year > year - TRIM_AFTER) continue;
    if (p.gradeLog) delete p.gradeLog;
    for (const c of p.career) {
      if (c.bat?.split) delete c.bat.split;
      if (c.pit?.split) delete c.pit.split;
    }
  }
}

/** Opening day of a legacy season: the clubs founded this year, the year's names, the leagues and the rule notices. */
export function legacySeason(s: LeagueState) {
  if (!isLegacy(s)) return;
  const year = s.year;
  trimRetired(s, year);
  legacyFoundings(s, year);
  applyLineage(s, year);
  legacyLeagues(s, year);
  if (year <= LEGACY_START) {
    if (year === LEGACY_START) leagueEvent(s, year, __i18n_k("league.legacy1982.text.7aedbca8", { clubs: firstTeamIds(s, year).map((id) => s.teams.find((t) => t.id === id)!.name).join('·') }));
    return;
  }
  const lines = ruleNoticeLines(rulesFor(year - 1), rulesFor(year));
  for (const line of lines) leagueEvent(s, year, line);
  if (!lines.length) return;
  const title = __i18n_k("league.legacy1982.text.56998c23", { year });
  addNews(s, { id: `rules-${year}`, date: `${year}-03-01`, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { year }, players: [], mine: true });
  addAlert(s, { id: `rules-${year}`, date: `${year}-03-01`, kind: 'season', title, lines });
}
