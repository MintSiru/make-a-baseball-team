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
import { boardValue } from './era';
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
  | 'twoLeagues';
export type BoardVote = 'yes' | 'no' | 'abstain';

/** A rule change in force from season `from` (cap: the cap in percent of today's; postseason: the clubs in it). */
export interface BoardChange {
  from: number;
  item: BoardItem;
  value: number;
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
}

export interface BoardRecord extends BoardMotion {
  year: number;
  votes: Record<TeamId, BoardVote>;
  yes: number;
  need: number;
  passed: boolean;
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
  games: { min: 128, max: 152, step: 8 },
  postseason: { min: 4, max: 5, step: 1 },
  extras: { min: 11, max: 12, step: 1 },
  cap: { min: 80, max: 130, step: 10 },
  faSeasons: { min: 7, max: 9, step: 1 },
  twoLeagues: { min: 0, max: 1, step: 1 },
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
  }
}

/** The items this league may vote on: two leagues only with an even number of clubs (and its postseason then fixed),
    the number of games not with the twelve-club schedule. */
function items(s: LeagueState, season: number): BoardItem[] {
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
  }
}

const VOTE_EDGE = 0.05;
/** The executive committee's motions come pre-agreed: a pull on every club's vote. */
const COMMITTEE_PULL = 0.12;
const voteOf = (score: number): BoardVote => (score > VOTE_EDGE ? 'yes' : score < -VOTE_EDGE ? 'no' : 'abstain');

/** What each club means to vote, before the day's chance (the committee's mood, shown to our club). */
export function expectedVotes(s: LeagueState, year: number, m: BoardMotion): Record<TeamId, BoardVote> {
  const sides = clubSides(s, year);
  return Object.fromEntries(Object.entries(sides).map(([id, c]) => [id, id === m.by ? 'yes' : voteOf(stance(m.item, m.value > m.now, c) + m.push)]));
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
      votes[id] = id === me && ids.includes(me) ? (m.by === me ? 'yes' : (ours[i] ?? 'abstain')) : id === m.by ? 'yes' : voteOf(stance(m.item, m.value > m.now, sides[id]!) + m.push + chance);
    }
    const yes = Object.values(votes).filter((v) => v === 'yes').length;
    const rec: BoardRecord = { ...m, year, votes, yes, need, passed: yes >= need };
    if (rec.passed) b.changes.push({ from: year + 1, item: m.item, value: m.value });
    b.log.push(rec);
    return rec;
  });
  if (!records.length) return;
  const lines = records.map((x) => boardLine(s, x));
  const title = records.some((x) => x.passed) ? __i18n_k("league.board.text.24c660da") : __i18n_k("league.board.text.51346f04");
  addNews(s, { id: `board-${year}`, date: `${year}-11-01`, kind: 'season', title, body: lines.join(' '), quotes: [], facts: { motions: records.length }, players: [], mine: false });
  if (me) addAlert(s, { id: `board-${year}`, date: `${year}-11-01`, kind: 'season', title, lines });
  if (s.legacy) for (const x of records.filter((x) => x.passed)) leagueEvent(s, year, boardLine(s, x));
}

/** One motion as a line: what, the vote, carried or not. */
export function boardLine(s: LeagueState, x: BoardRecord): string {
  const what = motionText(x);
  return x.passed ? __i18n_k("league.board.text.e9db9a88", { what, yes: x.yes, need: x.need, season: x.year + 1 }) : __i18n_k("league.board.text.a52b1514", { what, yes: x.yes, need: x.need });
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
  }
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
