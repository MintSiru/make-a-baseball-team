import { k as __i18n_k } from '../i18n/index';
/* 1.9.9: the board (이사회) changes the rules (the 1.9 plan's §11, RULES.md §9 and §14). Each winter, before the
   offseason's first step, the general managers' executive committee (실행위원회) puts one or two motions from the
   league's state of things — foreign players dominating, clubs over the salary cap — and our club may put one of
   its own. The clubs of the first team vote; two thirds of them (rounded up) carry a motion, from next season
   (the KBO's own rule: two thirds of the registered directors, S114~S117).

   Each club votes for what is good for it: a rich club for a looser cap and sooner free agency, a weak one for more
   foreign players and more postseason places, the top clubs against them; with a pull from the motion's cause and a
   little chance. Our club's vote is the general manager's. A game with the board off (the default outside the
   sandbox) never meets, and every rule stays as it was. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { boardValue, playsHistory, setEraBoard } from './era';
import { addAlert } from './alerts';
import { leagueEvent } from './leagueevents';
import { addNews } from './news';
import { payroll } from './offseason';
import { isForeign } from './players';
import { rulesFor } from '../rules/history';
import { KBO_2026, salaryCapFor } from '../rules/kbo2026';
import { firstTeamIds, type Decision, type LeagueSide, type LeagueState } from './state';
import { assignLeagues, twelveClubs } from './twelve';

export type BoardItem =
  | 'foreign'
  | 'asiaQuota'
  | 'foreignCap'
  | 'foreignTotal'
  | 'foreignChanges'
  | 'firstTeam'
  | 'rosterLimit'
  | 'games'
  | 'postseason'
  | 'extras'
  | 'ghostRunner'
  | 'threeBatter'
  | 'cap'
  | 'minSalary'
  | 'faSeasons'
  | 'postingSeasons'
  | 'draftRounds'
  | 'secondDraft'
  | 'territorial'
  | 'twoLeagues'
  // 2.0.17 (the user's request): a draft lottery, the automatic ball-strike system (2 full, 1 challenges, 0 none: the
  // umpires call it and a catcher's framing counts), and a full-time national-team manager (1) or a club's (0).
  | 'lottery'
  | 'abs'
  | 'nationalManager';
export type BoardVote = 'yes' | 'no' | 'abstain';

/** A rule change in force from season `from` (cap: the cap in percent of today's; postseason: the clubs in it). */
export interface BoardChange {
  from: number;
  item: BoardItem;
  value: number;
  /** 2.0.13: set by the general manager with the board off, not voted. */
  manual?: boolean;
}

export interface BoardMotion {
  item: BoardItem;
  /** What it would be, and what it is now. */
  value: number;
  now: number;
  /** The club that put it, or null for the executive committee. */
  by: TeamId | null;
  /** The committee's reason (a pull on every club's vote). */
  push: number;
  /** 2.0.25: put by the players' association (선수협). */
  union?: true;
}

export interface BoardRecord extends BoardMotion {
  year: number;
  votes: Record<TeamId, BoardVote>;
  yes: number;
  need: number;
  passed: boolean;
  /** 2.0.25: carried, then taken back after the players' association's protest. */
  withdrawn?: true;
}

export interface BoardState {
  /** The board meets (from the winter of `since`). */
  on: boolean;
  since: number;
  changes: BoardChange[];
  log: BoardRecord[];
}

/** Each item's range and step (0/1: off/on; the money rules in percent of today's; extras: innings). */
export const BOARD_ITEMS: Record<BoardItem, { min: number; max: number; step: number }> = {
  foreign: { min: 2, max: 4, step: 1 },
  asiaQuota: { min: 0, max: 1, step: 1 },
  foreignCap: { min: 70, max: 150, step: 10 },
  foreignTotal: { min: 70, max: 150, step: 10 },
  foreignChanges: { min: 1, max: 4, step: 1 },
  firstTeam: { min: 27, max: 31, step: 1 },
  rosterLimit: { min: 60, max: 70, step: 5 },
  ghostRunner: { min: 0, max: 1, step: 1 },
  threeBatter: { min: 0, max: 1, step: 1 },
  minSalary: { min: 80, max: 150, step: 10 },
  postingSeasons: { min: 6, max: 8, step: 1 },
  draftRounds: { min: 9, max: 13, step: 1 },
  secondDraft: { min: 0, max: 1, step: 1 },
  territorial: { min: 0, max: 1, step: 1 },
  games: { min: 128, max: 152, step: 8 },
  postseason: { min: 4, max: 5, step: 1 },
  extras: { min: 11, max: 12, step: 1 },
  cap: { min: 80, max: 130, step: 10 },
  faSeasons: { min: 7, max: 9, step: 1 },
  twoLeagues: { min: 0, max: 1, step: 1 },
  lottery: { min: 0, max: 1, step: 1 },
  abs: { min: 0, max: 2, step: 1 },
  nationalManager: { min: 0, max: 1, step: 1 },
};

/** The legacy start's board meets from the winter of today's game (before, the KBO's own history). */
export const LEGACY_BOARD_FROM = 2026;

/** Each item's value in `season` as the rules have it. */
export function currentValue(s: LeagueState, item: BoardItem, season: number): number {
  const r = rulesFor(season);
  switch (item) {
    case 'foreign':
      return r.foreign.hold;
    case 'firstTeam':
      return r.firstTeam.registered;
    case 'games':
      return r.gamesPerClub;
    case 'postseason':
      return r.postseason === 'four' ? 4 : 5;
    case 'extras':
      return r.extraInnings ?? 12;
    case 'cap':
      return boardValue('cap', season) ?? 100;
    case 'faSeasons':
      return r.freeAgencySeasons ?? 8;
    case 'twoLeagues':
      return r.twoLeagues || !!s.leagueSides || (s.twelve?.format === 'two' && !!s.twelve.leagues) ? 1 : 0;
    case 'asiaQuota':
      return r.foreign.asia ? 1 : 0;
    case 'foreignCap':
    case 'foreignTotal':
    case 'minSalary':
      return boardValue(item, season) ?? 100;
    case 'foreignChanges':
      return boardValue(item, season) ?? KBO_2026.foreign.replacementsPerSeason;
    case 'postingSeasons':
      return boardValue(item, season) ?? KBO_2026.posting.seasons;
    case 'rosterLimit':
      return r.rosterLimit;
    case 'draftRounds':
      return r.draftRounds;
    case 'secondDraft':
      return boardValue(item, season) ?? 1;
    case 'ghostRunner':
    case 'threeBatter':
      return boardValue(item, season) ?? 0;
    case 'territorial':
      return r.territorialPicks > 0 ? 1 : 0;
    case 'lottery':
      return boardValue(item, season) ?? 0;
    case 'abs':
      return absLevel(season);
    case 'nationalManager':
      return fullTimeManager(season) ? 1 : 0;
  }
}

/** 2.0.17: the ball-strike system in `season` — the KBO's full ABS from 2024 (a history game before: the umpires),
    or the board's. */
export const absLevel = (season: number): number => boardValue('abs', season) ?? (playsHistory() && season < 2024 ? 0 : 2);
/** How much a catcher's framing counts: all of it with the umpires calling, half with challenges, none with ABS. */
export const framingWeight = (season: number) => [1, 0.5, 0][absLevel(season)] ?? 0;
/** 2.0.17: a full-time national-team manager (the KBO's from 2017; a history game before: a club's). */
export const fullTimeManager = (season: number) => (boardValue('nationalManager', season) ?? (playsHistory() && season < 2017 ? 0 : 1)) === 1;

/** The items this league may vote on: two leagues only with an even number of clubs (and its postseason then fixed),
    the number of games not with the twelve-club schedule. */
export function items(s: LeagueState, season: number): BoardItem[] {
  const clubs = firstTeamIds(s, season).length;
  const two = currentValue(s, 'twoLeagues', season) === 1;
  return (Object.keys(BOARD_ITEMS) as BoardItem[]).filter((item) => {
    if (item === 'twoLeagues') return clubs >= 8 && clubs % 2 === 0;
    if (item === 'postseason') return !two;
    if (item === 'games') return !s.twelve?.teamId || !firstTeamIds(s, season).includes(s.twelve.teamId);
    return true;
  });
}

/** The board meets this winter. */
export const boardMeets = (s: LeagueState, year: number) => !!s.board?.on && year >= s.board.since && firstTeamIds(s, year).length >= 3;

// ── How the clubs vote ───────────────────────────────────────────────────────────────────────────

/** A club's standing (0 the worst, 1 the best last season) and wealth (0 the smallest payroll, 1 the biggest). */
function clubSides(s: LeagueState, year: number): Record<TeamId, { strength: number; rich: number }> {
  const ids = firstTeamIds(s, year);
  const table = s.history.find((h) => h.year === year)?.table ?? s.history.at(-1)?.table ?? [];
  const rankOf = (id: TeamId) => table.find((r) => r.teamId === id)?.rank ?? Math.ceil(ids.length / 2);
  const pay = ids.map((id) => [id, payroll(s, id, year)] as const).sort((a, b) => a[1] - b[1]);
  const n = Math.max(1, ids.length - 1);
  return Object.fromEntries(ids.map((id) => [id, { strength: 1 - (rankOf(id) - 1) / n, rich: pay.findIndex((x) => x[0] === id) / n }]));
}

/** How much a club likes the change (−1 to 1, before chance): `up` the value goes up. */
function stance(item: BoardItem, up: boolean, c: { strength: number; rich: number }): number {
  const d = up ? 1 : -1;
  switch (item) {
    case 'foreign':
      // More foreign players: the weak and the rich buy their way up; the strong home-grown clubs would rather not.
      return d * (0.5 * (1 - c.strength) + 0.5 * c.rich - 0.5);
    case 'firstTeam':
      return d * (c.rich - 0.5) * 0.6;
    case 'games':
      // More games, more gates: the rich and the strong; a thin squad suffers.
      return d * (0.6 * c.rich + 0.4 * c.strength - 0.5);
    case 'postseason':
      // A fifth place: the clubs in the middle and below; the top clubs lose an easy road.
      return d * (0.3 - 0.6 * c.strength);
    case 'extras':
      // Shorter extra innings spare the bullpens: most like it, the deep top clubs less.
      return -d * (0.15 - 0.3 * (c.strength - 0.5));
    case 'cap':
      return d * (c.rich - 0.5);
    case 'faSeasons':
      // Sooner free agency: the rich buy; the poor lose the players they raised.
      return -d * (c.rich - 0.5);
    case 'twoLeagues':
      // Two leagues: a weaker club's road to the postseason is shorter.
      return d * (0.3 * (1 - c.strength) - 0.15);
    case 'asiaQuota':
      return d * (0.4 * (1 - c.strength) + 0.4 * c.rich - 0.4);
    case 'foreignCap':
    case 'foreignTotal':
      // A bigger foreign budget: the rich can pay it.
      return d * (c.rich - 0.5);
    case 'foreignChanges':
      // More replacements: a second chance for the clubs that need one.
      return d * (0.25 - 0.5 * c.strength);
    case 'rosterLimit':
      return d * (c.rich - 0.5) * 0.6;
    case 'ghostRunner':
      // Shorter extra innings, rested arms: most like it, the deep top clubs a little less.
      return d * (0.12 - 0.3 * (c.strength - 0.5));
    case 'threeBatter':
      // Fewer pitching changes: the managers' tools go; the clubs with thin bullpens gain.
      return d * (0.05 - 0.4 * (c.strength - 0.5));
    case 'minSalary':
      // A higher minimum salary: the players' side; the poor clubs pay most of it in their squad.
      return d * (0.6 * (c.rich - 0.5) - 0.05);
    case 'postingSeasons':
      // Sooner posting: the clubs lose their stars sooner.
      return d * 0.15;
    case 'draftRounds':
      // More rounds: the clubs that grow their own.
      return d * (0.5 - c.rich) * 0.6;
    case 'secondDraft':
      // The second draft: a weaker club picks first from the others' depth.
      return d * (0.5 - c.strength) * 0.8;
    case 'territorial':
      // A territorial pick: the big cities' clubs, with the most high schools at home, gain; the others lose
      // the best of the class to them.
      return d * (0.6 * (c.rich - 0.5) + 0.05);
    case 'lottery':
      // A lottery: the clubs at the bottom lose the sure first pick; the middle ones may jump the queue.
      return d * (0.6 * c.strength - 0.25);
    case 'abs':
      // The machine's zone: most like it fair; the clubs with a good framer behind the plate would rather not.
      return d * 0.1;
    case 'nationalManager':
      // A full-time manager: no club's manager is taken away; the strong clubs, whose manager it would be, most.
      return d * (0.1 + 0.3 * c.strength);
  }
}

/** 2.0.25 (the user's request: the players' side against the board): the players' association (프로야구선수협회) on
    each rule — for the players (1) or against them (−1). Its word weighs on the clubs' votes (public opinion, the
    players in their own clubhouse); it puts a motion of its own most winters; and a rule against the players carried
    over its protest is now and then taken back after talks. */
export const UNION = { pressure: 0.1, motion: 0.6, withdraw: 0.35, against: -0.5 };
export function playersView(item: BoardItem, up: boolean): number {
  const d = up ? 1 : -1;
  switch (item) {
    case 'foreign':
    case 'asiaQuota':
      return -d; // fewer places for the home-grown
    case 'foreignCap':
    case 'foreignTotal':
      return -0.5 * d;
    case 'foreignChanges':
      return -0.3 * d;
    case 'firstTeam':
    case 'rosterLimit':
    case 'cap':
    case 'minSalary':
      return d; // more places, more pay
    case 'faSeasons':
    case 'postingSeasons':
      return -d; // freedom later
    case 'games':
      return -0.5 * d; // more work for the same pay
    case 'secondDraft':
      return 0.5 * d; // a way out for the blocked
    case 'postseason':
      return 0.3 * d;
    case 'ghostRunner':
      return 0.3 * d;
    case 'extras':
      return -0.3 * d;
    default:
      return 0;
  }
}
const unionPush = (m: Pick<BoardMotion, 'item' | 'value' | 'now'>) => UNION.pressure * playersView(m.item, m.value > m.now);

const VOTE_EDGE = 0.05;
/** The executive committee's motions come pre-agreed: a pull on every club's vote. */
const COMMITTEE_PULL = 0.12;
const voteOf = (score: number): BoardVote => (score > VOTE_EDGE ? 'yes' : score < -VOTE_EDGE ? 'no' : 'abstain');

/** What each club means to vote, before the day's chance (the committee's mood, shown to our club). */
export function expectedVotes(s: LeagueState, year: number, m: BoardMotion): Record<TeamId, BoardVote> {
  const sides = clubSides(s, year);
  return Object.fromEntries(Object.entries(sides).map(([id, c]) => [id, id === m.by ? 'yes' : voteOf(stance(m.item, m.value > m.now, c) + m.push + (s.board?.on ? unionPush(m) : 0))]));
}

/** Votes needed: two thirds of the first-team clubs, rounded up (7 of 10, 8 of 11 or 12, 11 of 16). */
export const votesNeeded = (clubs: number) => Math.ceil((clubs * 2) / 3);

// ── The motions ──────────────────────────────────────────────────────────────────────────────────

const clamp = (item: BoardItem, v: number) => Math.max(BOARD_ITEMS[item].min, Math.min(BOARD_ITEMS[item].max, v));

/** The motion that moves `item` one step `up` or down, or null at the end of its range. */
function motion(s: LeagueState, next: number, item: BoardItem, up: boolean, by: TeamId | null, push: number): BoardMotion | null {
  const now = currentValue(s, item, next);
  const value = clamp(item, now + (up ? 1 : -1) * BOARD_ITEMS[item].step);
  return value === now ? null : { item, value, now, by, push };
}

/** Changed or voted down in the last two winters: not again yet. */
const resting = (s: LeagueState, year: number, item: BoardItem) => (s.board?.log ?? []).some((r) => r.item === item && r.year >= year - 1);

/** The executive committee's motions this winter: from the league's state, one or two. */
export function committeeMotions(s: LeagueState, year: number): BoardMotion[] {
  const next = year + 1;
  const r = rng(`${s.seed}|board|${year}`);
  const ids = firstTeamIds(s, year);
  const war = (pred: (foreign: boolean) => boolean) =>
    Object.values(s.players).reduce((a, p) => a + (p.teamId && ids.includes(p.teamId) && pred(isForeign(p)) ? (p.career.find((c) => c.year === year && !c.level)?.war ?? 0) : 0), 0);
  const all = war(() => true);
  const share = all > 0 ? war((f) => f) / all : 0.2;
  const over = ids.filter((id) => payroll(s, id, next) > salaryCapFor(next)).length;
  const pool: { item: BoardItem; up: boolean; weight: number; push: number }[] = [
    share > 0.28 ? { item: 'foreign', up: false, weight: 2, push: 0.2 } : share < 0.18 ? { item: 'foreign', up: true, weight: 2, push: 0.2 } : { item: 'foreign', up: r() < 0.5, weight: 0.6, push: 0.05 },
    over >= 3 ? { item: 'cap', up: true, weight: 1.5, push: 0.15 } : { item: 'cap', up: false, weight: over ? 0.3 : 0.6, push: 0.05 },
    { item: 'games', up: r() < 0.5, weight: 0.5, push: 0.05 },
    { item: 'postseason', up: currentValue(s, 'postseason', next) === 4, weight: 0.6, push: 0.1 },
    { item: 'extras', up: currentValue(s, 'extras', next) === 11, weight: 0.4, push: 0.1 },
    { item: 'faSeasons', up: r() < 0.4, weight: 0.5, push: 0.05 },
    { item: 'firstTeam', up: r() < 0.6, weight: 0.5, push: 0.1 },
    { item: 'twoLeagues', up: currentValue(s, 'twoLeagues', next) === 0, weight: 0.3, push: 0 },
    { item: 'asiaQuota', up: currentValue(s, 'asiaQuota', next) === 0, weight: 0.3, push: 0.05 },
    { item: 'foreignCap', up: r() < 0.6, weight: 0.5, push: 0.05 },
    { item: 'foreignTotal', up: r() < 0.6, weight: 0.4, push: 0.05 },
    { item: 'foreignChanges', up: r() < 0.5, weight: 0.4, push: 0.05 },
    { item: 'rosterLimit', up: r() < 0.5, weight: 0.4, push: 0.05 },
    { item: 'ghostRunner', up: currentValue(s, 'ghostRunner', next) === 0, weight: 0.5, push: 0.1 },
    { item: 'threeBatter', up: currentValue(s, 'threeBatter', next) === 0, weight: 0.4, push: 0.05 },
    { item: 'minSalary', up: r() < 0.7, weight: 0.5, push: 0.1 },
    { item: 'postingSeasons', up: r() < 0.4, weight: 0.3, push: 0.05 },
    { item: 'draftRounds', up: r() < 0.5, weight: 0.4, push: 0.05 },
    { item: 'secondDraft', up: currentValue(s, 'secondDraft', next) === 0, weight: 0.3, push: 0.05 },
    { item: 'territorial', up: currentValue(s, 'territorial', next) === 0, weight: 0.4, push: 0.05 },
    { item: 'lottery', up: currentValue(s, 'lottery', next) === 0, weight: 0.4, push: 0.1 },
    { item: 'abs', up: currentValue(s, 'abs', next) < 2 && r() < 0.7, weight: 0.4, push: 0.05 },
    { item: 'nationalManager', up: currentValue(s, 'nationalManager', next) === 0, weight: 0.3, push: 0.1 },
  ];
  const open = items(s, next);
  const out: BoardMotion[] = [];
  const roll = r();
  const count = roll < 0.2 ? 3 : roll < 0.7 ? 2 : 1;
  for (let k = 0; k < count; k++) {
    const left = pool.filter((x) => open.includes(x.item) && !resting(s, year, x.item) && !out.some((m) => m.item === x.item));
    const total = left.reduce((a, x) => a + x.weight, 0);
    let roll = r() * total;
    const pick = left.find((x) => (roll -= x.weight) < 0) ?? left.at(-1);
    // The committee brings what it has already talked through: a pull for every motion it puts.
    const m = pick && motion(s, next, pick.item, pick.up, null, pick.push + COMMITTEE_PULL);
    if (m) out.push(m);
  }
  // 2.0.25: the players' association's own motion, most winters (a stream of its own).
  const ru = rng(`${s.seed}|board-union|${year}`);
  if (ru() < UNION.motion) {
    const wants: [BoardItem, boolean][] = [['minSalary', true], ['faSeasons', false], ['cap', true], ['rosterLimit', true], ['firstTeam', true], ['postingSeasons', false], ['foreign', false]];
    const left = wants.filter(([item]) => open.includes(item) && !resting(s, year, item) && !out.some((m) => m.item === item));
    const pick = left[Math.floor(ru() * left.length)];
    const m = pick && motion(s, next, pick[0], pick[1], null, 0);
    if (m) out.push({ ...m, union: true });
  }
  return out;
}

/** The motions our club may put: any item one step either way that the committee has not put and that is not resting. */
export function ownMotions(s: LeagueState, year: number, taken: BoardMotion[]): BoardMotion[] {
  const me = s.user?.teamId;
  if (!me) return [];
  const next = year + 1;
  return items(s, next)
    .filter((item) => !taken.some((m) => m.item === item) && !resting(s, year, item))
    .flatMap((item) => [motion(s, next, item, true, me, 0), motion(s, next, item, false, me, 0)])
    .filter((m): m is BoardMotion => !!m);
}

// ── The meeting ──────────────────────────────────────────────────────────────────────────────────

/** Holds the winter's meeting: the motions (ours added), each club's vote (ours as given), the result, the news. */
export function holdMeeting(s: LeagueState, year: number, motions: BoardMotion[], ours: Record<number, BoardVote> = {}) {
  const b = s.board!;
  const ids = firstTeamIds(s, year);
  const sides = clubSides(s, year);
  const need = votesNeeded(ids.length);
  const r = rng(`${s.seed}|board-vote|${year}`);
  const me = s.user?.teamId;
  const records = motions.map((m, i) => {
    const votes: Record<TeamId, BoardVote> = {};
    for (const id of ids) {
      const chance = (r() - 0.5) * 0.5;
      votes[id] = id === me && ids.includes(me) ? (m.by === me ? 'yes' : (ours[i] ?? 'abstain')) : id === m.by ? 'yes' : voteOf(stance(m.item, m.value > m.now, sides[id]!) + m.push + unionPush(m) + chance);
    }
    const yes = Object.values(votes).filter((v) => v === 'yes').length;
    const rec: BoardRecord = { ...m, year, votes, yes, need, passed: yes >= need };
    // 2.0.25: carried over the players' protest: now and then taken back after talks (a stream of its own).
    if (rec.passed && playersView(m.item, m.value > m.now) <= UNION.against && rng(`${s.seed}|board-union-protest|${year}|${m.item}`)() < UNION.withdraw) rec.withdrawn = true;
    if (rec.passed && !rec.withdrawn) b.changes.push({ from: year + 1, item: m.item, value: m.value });
    b.log.push(rec);
    return rec;
  });
  if (!records.length) return;
  const lines = records.map((x) => boardLine(s, x));
  const title = records.some((x) => x.passed) ? __i18n_k("league.board.text.24c660da") : __i18n_k("league.board.text.51346f04");
  addNews(s, { id: `board-${year}`, date: `${year}-11-01`, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { motions: records.length }, players: [], mine: false });
  if (me) addAlert(s, { id: `board-${year}`, date: `${year}-11-01`, kind: 'season', title, lines });
  if (s.legacy) for (const x of records.filter((x) => x.passed && !x.withdrawn)) leagueEvent(s, year, boardLine(s, x));
}

/** One motion as a line: what, the vote, carried or not. */
export function boardLine(s: LeagueState, x: BoardRecord): string {
  const what = (x.union ? __i18n_k("league.board.text.2e079ed8") : '') + motionText(x);
  // 2.0.25: the players' association's word on it.
  const view = playersView(x.item, x.value > x.now);
  const union = view >= 0.5 ? __i18n_k("league.board.text.c18acbde") : view <= UNION.against ? __i18n_k("league.board.text.b9443ba2") : '';
  if (x.withdrawn) return __i18n_k("league.board.text.8762dc42", { what, yes: x.yes });
  return (x.passed ? __i18n_k("league.board.text.e9db9a88", { what, yes: x.yes, need: x.need, season: x.year + 1 }) : __i18n_k("league.board.text.a52b1514", { what, yes: x.yes, need: x.need })) + union;
}

/** What a motion changes, in words. */
export function motionText(m: Pick<BoardMotion, 'item' | 'value' | 'now'>): string {
  const { value, now } = m;
  switch (m.item) {
    case 'foreign':
      return __i18n_k("league.board.text.204742c6", { now, value });
    case 'firstTeam':
      return __i18n_k("league.board.text.52f2a4fb", { now, value });
    case 'games':
      return __i18n_k("league.board.text.32a7662e", { now, value });
    case 'postseason':
      return __i18n_k("league.board.text.4678f520", { now, value });
    case 'extras':
      return __i18n_k("league.board.text.fb175b50", { now, value });
    case 'cap':
      return __i18n_k("league.board.text.d41a7a46", { now, value });
    case 'faSeasons':
      return __i18n_k("league.board.text.6c4ea7bc", { now, value });
    case 'twoLeagues':
      return value ? __i18n_k("league.board.text.a30c1148") : __i18n_k("league.board.text.a3878134");
    case 'asiaQuota':
      return value ? __i18n_k("league.board.text.5197bf18") : __i18n_k("league.board.text.856b4038");
    case 'foreignCap':
      return __i18n_k("league.board.text.2ba8e99f", { now, value });
    case 'foreignTotal':
      return __i18n_k("league.board.text.6f03fc80", { now, value });
    case 'foreignChanges':
      return __i18n_k("league.board.text.88908714", { now, value });
    case 'rosterLimit':
      return __i18n_k("league.board.text.c7f1c6ba", { now, value });
    case 'ghostRunner':
      return value ? __i18n_k("league.board.text.06bb0ef0") : __i18n_k("league.board.text.5c10f171");
    case 'threeBatter':
      return value ? __i18n_k("league.board.text.fbeba040") : __i18n_k("league.board.text.017e0c25");
    case 'minSalary':
      return __i18n_k("league.board.text.2aaf93b4", { now, value });
    case 'postingSeasons':
      return __i18n_k("league.board.text.0986b4c8", { now, value });
    case 'draftRounds':
      return __i18n_k("league.board.text.5ab98fc9", { now, value });
    case 'secondDraft':
      return value ? __i18n_k("league.board.text.1f5b0fb2") : __i18n_k("league.board.text.9e38c80a");
    case 'territorial':
      return value ? __i18n_k("league.board.text.ed851f8b") : __i18n_k("league.board.text.44d5ae3d");
    case 'lottery':
      return value ? __i18n_k("league.board.text.4fd36767") : __i18n_k("league.board.text.16a5ede4");
    case 'abs':
      return __i18n_k("league.board.text.2877ed40", { now: absText(now), value: absText(value) });
    case 'nationalManager':
      return value ? __i18n_k("league.board.text.86c35ec6") : __i18n_k("league.board.text.5a49352e");
  }
}

/** 2.0.17: the ball-strike system in words. */
export const absText = (v: number) => (v >= 2 ? __i18n_k("league.board.text.eeec9e36") : v === 1 ? __i18n_k("league.board.text.9a5d4538") : __i18n_k("league.board.text.87e8ddfa"));

/** A rule's value in words for the settings (null: the number itself, or on/off). */
export function ruleValueText(item: BoardItem, v: number): string | null {
  if (item === 'abs') return absText(v);
  if (item === 'nationalManager') return v ? __i18n_k("league.board.text.bbc60e87") : __i18n_k("league.board.text.73764add");
  return null;
}

// ── Our club at the meeting ──────────────────────────────────────────────────────────────────────

/** Our club's part this winter: the committee's motions with each club's expected vote, and the motions we may put
    (with the votes each would expect), or null when the board does not meet or our club is not in the first team. */
export function boardDecision(s: LeagueState, year: number): Decision | null {
  const me = s.user?.teamId;
  if (!me || !boardMeets(s, year) || !firstTeamIds(s, year).includes(me)) return null;
  const motions = committeeMotions(s, year);
  const options = ownMotions(s, year, motions);
  const tally = (m: BoardMotion) => Object.values(expectedVotes(s, year, m)).filter((v) => v === 'yes').length;
  return {
    kind: 'board',
    motions,
    expected: motions.map((m) => expectedVotes(s, year, m)),
    options,
    optionYes: options.map(tally),
    need: votesNeeded(firstTeamIds(s, year).length),
  };
}

/** What our club would vote by its own interest (the scouts' advice): its expected vote. */
export function autoBoard(s: LeagueState, d: Extract<Decision, { kind: 'board' }>): BoardVote[] {
  const me = s.user!.teamId;
  return d.expected.map((e) => e[me] ?? 'abstain');
}

/** Holds the meeting with our votes and our motion (index into the options, or null). */
export function resolveBoard(s: LeagueState, d: Extract<Decision, { kind: 'board' }>, votes: BoardVote[], own: number | null) {
  const o = s.offseason!;
  const motions = [...d.motions, ...(own != null && d.options[own] ? [d.options[own]!] : [])];
  holdMeeting(s, o.year, motions, Object.fromEntries(votes.map((v, i) => [i, v])));
  o.boardHeld = true;
}

/** Season start: one league or two as the board last voted (none voted: as the league already is). */
export function boardLeagues(s: LeagueState) {
  const two = boardValue('twoLeagues', s.year);
  if (two === undefined) return;
  const tw = s.twelve;
  if (two === 1) {
    if (tw && twelveClubs(s)) {
      tw.format = 'two';
      tw.leagues ??= assignLeagues(s);
      return;
    }
    if (s.leagueSides) return;
    const table = s.history.at(-1)?.table ?? [];
    const ids = firstTeamIds(s).sort((a, b) => (table.find((x) => x.teamId === a)?.rank ?? 99) - (table.find((x) => x.teamId === b)?.rank ?? 99) || a.localeCompare(b));
    const sides: Record<TeamId, LeagueSide> = {};
    // Down last season's table in a snake, so both leagues get strong and weak clubs.
    ids.forEach((id, i) => (sides[id] = i % 4 === 0 || i % 4 === 3 ? 'dream' : 'magic'));
    s.leagueSides = { sides };
    return;
  }
  delete s.leagueSides;
  if (tw?.format === 'two') {
    tw.format = 'single';
    delete tw.leagues;
  }
}

/** The general manager switches the board on or off (the settings): it meets from the coming winter; a legacy
    game's not before 2026. */
export function setBoardOn(s: LeagueState, on: boolean) {
  const year = s.offseason?.year ?? s.year;
  if (!s.board) {
    if (on) s.board = { on: true, since: s.legacy ? Math.max(LEGACY_BOARD_FROM, year) : year, changes: [], log: [] };
    return;
  }
  s.board.on = on;
}

// ── 2.0.13: the rules by hand ────────────────────────────────────────────────────────────────────
// The user's request: with the board off, the general manager sets the rules the board would vote on, each from the
// coming season (the same changes the board makes, so everything that reads them follows).

/** A rule's name for the settings. */
export function ruleLabel(item: BoardItem): string {
  switch (item) {
    case 'foreign':
      return __i18n_k("league.board.text.9449b000");
    case 'asiaQuota':
      return __i18n_k("league.board.text.74f290f1");
    case 'foreignCap':
      return __i18n_k("league.board.text.2c75d56a");
    case 'foreignTotal':
      return __i18n_k("league.board.text.fecd6261");
    case 'foreignChanges':
      return __i18n_k("league.board.text.28621d80");
    case 'firstTeam':
      return __i18n_k("league.board.text.4a59f9bc");
    case 'rosterLimit':
      return __i18n_k("league.board.text.134d9ac9");
    case 'games':
      return __i18n_k("league.board.text.faa5f0b0");
    case 'postseason':
      return __i18n_k("league.board.text.7ccc7479");
    case 'extras':
      return __i18n_k("league.board.text.ac86b705");
    case 'ghostRunner':
      return __i18n_k("league.board.text.21f26ef9");
    case 'threeBatter':
      return __i18n_k("league.board.text.69a60c9d");
    case 'cap':
      return __i18n_k("league.board.text.f0773e73");
    case 'minSalary':
      return __i18n_k("league.board.text.b1720721");
    case 'faSeasons':
      return __i18n_k("league.board.text.b551d014");
    case 'postingSeasons':
      return __i18n_k("league.board.text.2966e220");
    case 'draftRounds':
      return __i18n_k("league.board.text.70daeacb");
    case 'secondDraft':
      return __i18n_k("league.board.text.7021a262");
    case 'territorial':
      return __i18n_k("league.board.text.f1f3e66a");
    case 'twoLeagues':
      return __i18n_k("league.board.text.997dd883");
    case 'lottery':
      return __i18n_k("league.board.text.ec5ee8c6");
    case 'abs':
      return __i18n_k("league.board.text.4391b573");
    case 'nationalManager':
      return __i18n_k("league.board.text.cb0d5e9f");
  }
}

/** The season the rules set now start in. */
export const ruleSeason = (s: LeagueState) => (s.offseason?.year ?? s.year) + 1;

/** Why this rule cannot be set (null if it can). */
export function checkRule(s: LeagueState, item: BoardItem, value: number): string | null {
  if (!s.user) return __i18n_k("league.board.text.e7e6c495");
  if (s.board?.on) return __i18n_k("league.board.text.92aafcd6");
  const range = BOARD_ITEMS[item];
  if (!range || !items(s, ruleSeason(s)).includes(item)) return __i18n_k("league.board.text.a9648bbe");
  if (value < range.min || value > range.max || (value - range.min) % range.step !== 0) return __i18n_k("league.board.text.130e5c83");
  return null;
}

/** Sets a rule from the coming season (the same value again cancels a change not yet in force). */
export function setRule(s: LeagueState, item: BoardItem, value: number) {
  if (checkRule(s, item, value)) return;
  const from = ruleSeason(s);
  const b = (s.board ??= { on: false, since: from - 1, changes: [], log: [] });
  const before = b.changes.filter((c) => c.from < from || c.item !== item);
  // What it is without a change from `from` on: the latest earlier change, or the rule book.
  const earlier = [...before].reverse().find((c) => c.item === item && c.from <= from);
  const now = earlier?.value ?? baseValue(s, item, from);
  b.changes = before;
  if (value !== now) b.changes.push({ from, item, value, manual: true });
  const what = motionText({ item, value, now });
  addNews(s, { id: `rule-${from}-${item}-${b.changes.length}`, date: `${from - 1}-12-01`, kind: 'season', title: __i18n_k("league.board.text.0786e319", { what }), body: __i18n_k("league.board.text.ec999e16", { season: from, what }), quotes: [], facts: { season: from }, players: [], mine: false });
}

/** A rule's value from the rule book alone (no change by the board or by hand). */
function baseValue(s: LeagueState, item: BoardItem, season: number): number {
  const kept = [...(s.board?.changes ?? [])];
  if (s.board) s.board.changes = [];
  setEraBoard([]);
  try {
    return currentValue(s, item, season);
  } finally {
    if (s.board) s.board.changes = kept;
    setEraBoard(kept);
  }
}
