/* Uniform numbers (V0.5.1). Every registered player wears a number from 0 to 99 that nobody else at
   his club wears; development players (육성선수) wear three-digit numbers, as in the league. A player
   who changes clubs, or becomes a registered player, gets a new one (his old number if it is free).
   A club retires the number of a great who spent his career there. */
import { rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { isForeign, isPitcher } from './players';
import { isDevelopment, orgPlayers, type LeagueState } from './state';

const RETIRE = { war: 45, seasons: 10 };

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
      const free = Array.from({ length: isDevelopment(p) ? 100 : 100 }, (_, i) => (isDevelopment(p) ? 100 + i : i)).filter((x) => !taken.has(x) && !retired.has(x));
      const total = free.reduce((a, x) => a + liking(p, x), 0);
      let roll = r() * total;
      n = free.find((x) => (roll -= liking(p, x)) < 0) ?? free[free.length - 1];
    }
    if (n == null) continue;
    p.number = n;
    p.numberTeam = teamId;
    taken.add(n);
  }
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
  if (war < RETIRE.war || here.length < RETIRE.seasons) return;
  const team = s.teams.find((t) => t.id === teamId);
  if (!team || team.retiredNumbers?.some((x) => x.number === p.number)) return;
  (team.retiredNumbers ??= []).push({ number: p.number, playerId: p.id, name: p.name, year });
}
