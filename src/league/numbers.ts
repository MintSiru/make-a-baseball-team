import { k as __i18n_k } from '../i18n/index';
/* Uniform numbers (V0.5.1). Every registered player wears a number from 0 to 99 that nobody else at
   his club wears; development players (육성선수) wear three-digit numbers, as in the league. A player
   who changes clubs, or becomes a registered player, gets a new one (his old number if it is free).
   A club retires the number of a great who spent his career there. */
import { rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { isForeign, isPitcher, isReliever } from './players';
import { isDevelopment, orgPlayers, type LeagueState } from './state';
import { milestone, unlock } from './milestones';
import { bullpenTitles } from './awards';

/** A number is retired for 12 first-team seasons at the club and WAR 60 there; 1.9.9: a reliever's WAR 35, 250
    saves and holds there or three save or hold titles (the user's request: a closer's WAR is small), and each number the club has already retired
    raises the bar by a quarter: the KBO's clubs retired one to four in forty years (두산 2, KIA 2, LG 3, 한화 4, 롯데 2,
    SSG 1, 삼성 4; RULES.md §9), where long games retired thirty and more at one club. */
const RETIRE = { war: 60, seasons: 12, relieverWar: 35, relieverSaves: 250, relieverTitles: 3, perRetired: 0.25 };

const fits = (p: Player, n: number) => (isDevelopment(p) ? n >= 100 && n <= 199 : n >= 0 && n <= 99);

/** How much a player likes a number: pitchers wear the teens to the sixties, hitters single digits and the twenties to fifties. */
function liking(p: Player, n: number): number {
  if (isDevelopment(p)) return 1;
  if (isPitcher(p)) return n >= 11 && n <= 69 ? 3 : n === 0 ? 0.2 : 1;
  if (isForeign(p)) return n >= 20 && n <= 59 ? 2 : 1;
  return n <= 10 || (n >= 20 && n <= 59) ? 2.5 : n === 0 ? 0.5 : 1;
}

function teamNumbers(s: LeagueState, teamId: TeamId) {
  const team = s.teams.find((t) => t.id === teamId)!;
  const retired = new Set((team.retiredNumbers ?? []).map((x) => x.number));
  const players = orgPlayers(s, teamId);
  const taken = new Set<number>();
  // Players who already wear a valid number here keep it; the longest-serving wins a clash.
  const keep = players
    .filter((p) => p.numberTeam === teamId && p.number != null && fits(p, p.number) && !retired.has(p.number))
    .sort((a, b) => a.proSince - b.proSince || a.id.localeCompare(b.id));
  const need: Player[] = players.filter((p) => !keep.includes(p));
  for (const p of keep) {
    if (taken.has(p.number!)) need.push(p);
    else taken.add(p.number!);
  }
  for (const p of need.sort((a, b) => a.proSince - b.proSince || a.id.localeCompare(b.id))) {
    const r = rng(`${s.seed}|number|${p.id}|${teamId}|${s.year}`);
    const own = p.number;
    let n: number | undefined;
    if (own != null && fits(p, own) && !taken.has(own) && !retired.has(own)) n = own;
    else {
      const pool = (from: number) => Array.from({ length: 100 }, (_, i) => from + i).filter((x) => !taken.has(x) && !retired.has(x));
      // 1.9.9: a club with so many numbers retired that 0–99 run out gives a registered player a free three-digit one.
      const free = isDevelopment(p) ? pool(100) : pool(0).length ? pool(0) : pool(100);
      const total = free.reduce((a, x) => a + liking(p, x), 0);
      let roll = r() * total;
      n = free.find((x) => (roll -= liking(p, x)) < 0) ?? free[free.length - 1];
    }
    // 1.9.9: none left at all: no number, rather than an old one (a retired number, or a teammate's) still showing.
    if (n == null) {
      delete p.number;
      continue;
    }
    p.number = n;
    p.numberTeam = teamId;
    taken.add(n);
  }
}

/** Why `n` cannot be his number, or null (V0.12): our player, the right range, not retired here. A teammate's
    number is fine: they swap. */
export function checkNumber(s: LeagueState, id: string, n: number): string | null {
  const p = s.players[id];
  const u = s.user;
  if (!p || !u || p.teamId !== u.teamId) return __i18n_k("league.numbers.checkNumber.5dc63468");
  if (!Number.isInteger(n)) return __i18n_k("league.numbers.checkNumber.911c30e8");
  if (!fits(p, n)) return isDevelopment(p) ? __i18n_k("league.numbers.checkNumber.1bc101b8") : __i18n_k("league.numbers.checkNumber.5354693d");
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const retired = team.retiredNumbers?.find((x) => x.number === n);
  if (retired) return __i18n_k("league.numbers.checkNumber.dbe113cd", { n: n, name: retired.name });
  return null;
}

/** Who at `teamId` wears `n` (a soldier included), other than `except`. */
export const numberHolder = (s: LeagueState, teamId: TeamId, n: number, except?: string) =>
  Object.values(s.players).find((q) => q.id !== except && q.teamId === teamId && q.numberTeam === teamId && q.number === n && q.status !== 'retired');

/** Gives one of our players number `n`; a teammate wearing it takes his old number if it suits him, or a new one. */
export function setNumber(s: LeagueState, id: string, n: number): string | null {
  const problem = checkNumber(s, id, n);
  if (problem) return problem;
  const p = s.players[id]!;
  const teamId = p.teamId!;
  const old = p.numberTeam === teamId ? p.number : undefined;
  // Anyone of ours wearing it, a soldier included (he would claim it back when he returns).
  const other = numberHolder(s, teamId, n, id);
  p.number = n;
  p.numberTeam = teamId;
  if (other) {
    if (old != null && fits(other, old)) other.number = old;
    else delete other.number;
    teamNumbers(s, teamId);
  }
  return null;
}

/** Gives every player at every club a number of his own. */
export function ensureNumbers(s: LeagueState) {
  for (const t of s.teams) if (s.rosters[t.id]) teamNumbers(s, t.id);
}

/** On retirement: a club retires the number of a player with a long, great career there. */
export function maybeRetireNumber(s: LeagueState, p: Player, teamId: TeamId, year: number) {
  if (p.number == null || p.numberTeam !== teamId || isDevelopment(p)) return;
  const here = p.career.filter((c) => c.teamId === teamId && !c.level);
  const war = here.reduce((a, c) => a + c.war, 0);
  const team = s.teams.find((t) => t.id === teamId);
  // 2.0.22 (the user's request): the rising bar can be turned off in the settings (each number at the same bar).
  const bar = s.retiredBarRise === false ? 1 : 1 + RETIRE.perRetired * (team?.retiredNumbers?.length ?? 0);
  const saves = here.reduce((a, c) => a + (c.pit?.sv ?? 0) + (c.pit?.hld ?? 0), 0);
  const great = isReliever(p) ? war >= RETIRE.relieverWar * bar || saves >= RETIRE.relieverSaves * bar || bullpenTitles(s, p.id) >= Math.ceil(RETIRE.relieverTitles * bar) : war >= RETIRE.war * bar;
  if (!great || here.length < RETIRE.seasons) return;
  if (!team || team.retiredNumbers?.some((x) => x.number === p.number)) return;
  (team.retiredNumbers ??= []).push({ number: p.number, playerId: p.id, name: p.name, year });
  if (teamId === s.user?.teamId) {
    unlock(s, 'retiredNumber', year, __i18n_k("league.numbers.maybeRetireNumber.05c2328c", { number: p.number, name: p.name }));
    milestone(s, year, __i18n_k("league.numbers.maybeRetireNumber.8985f06c", { name: p.name, number: p.number }));
  }
}
