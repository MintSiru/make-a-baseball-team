/* Regular-season schedule. Clubs meet in series (three or two games) laid out on consecutive days,
   skipping Mondays and an All-Star break, like the KBO calendar. Works for any number of clubs: with
   an odd count one club rests each block (the 9-club era's bye, RULES.md §9). */
import { rng } from '../draftroom';
import { ELEVEN_CLUB_SCHEDULE } from '../rules/kbo2026';

export interface ScheduledGame {
  id: string;
  date: string; // YYYY-MM-DD
  home: string;
  away: string;
}

/** Six series per pair; home and away alternate by series so each side gets half (16 → 8/8, 15 → 8/7, 14 → 7/7). */
export function seriesPlan(gamesPerPair: number): number[] {
  const threes = gamesPerPair - 12; // 6 series of 2 = 12, each extra game turns a 2 into a 3
  if (threes < 0 || threes > 6) throw new Error(`unsupported games per pair: ${gamesPerPair}`);
  return [...Array<number>(threes).fill(3), ...Array<number>(6 - threes).fill(2)];
}

/** Circle-method round robin. Returns rounds of [a, b] index pairs; with an odd count, one club sits out per round. */
export function roundRobin(n: number): [number, number][][] {
  const ids = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i);
  const m = ids.length,
    rounds: [number, number][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i]!,
        b = ids[m - 1 - i]!;
      if (a < n && b < n) round.push([a, b]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop()!); // rotate all but the first
  }
  return rounds;
}

/** Games between each pair: 16 with ten clubs; with eleven, four opponents 15 and six 14 (a 4-regular circulant). */
export function pairGames(n: number, seed: string, year: number): (a: number, b: number) => number {
  if (n % 2 === 0) {
    const perPair = Math.round((ELEVEN_CLUB_SCHEDULE.gamesPerClub * 1) / (n - 1));
    return () => perPair;
  }
  const S = ELEVEN_CLUB_SCHEDULE;
  if (n !== 11) throw new Error(`no schedule rule for ${n} clubs`);
  // Shuffle positions each year so the heavier pairings change.
  const r = rng(`${seed}|pairs|${year}`);
  const pos = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pos[i], pos[j]] = [pos[j]!, pos[i]!];
  }
  const heavy = new Set([1, 2, n - 1, n - 2].slice(0, S.heavyOpponents));
  return (a, b) => (heavy.has((((pos[a]! - pos[b]!) % n) + n) % n) ? S.heavyGames : S.lightGames);
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Opening day: the last Saturday of March (2026: 3/28, as announced; real openers vary by about a week). */
export function openingDay(year: number): Date {
  const d = utc(year, 3, 31);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function makeSchedule(teamIds: string[], year: number, seed: string): ScheduledGame[] {
  const r = rng(`${seed}|schedule|${year}`);
  const n = teamIds.length;
  const base = roundRobin(n);
  const perPair = pairGames(n, seed, year);
  const games: ScheduledGame[] = [];
  const day = openingDay(year);
  const allStar = utc(year, 7, 10);
  let count = 0;
  const nextDay = () => {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() === 1) day.setUTCDate(day.getUTCDate() + 1); // Mondays off
    if (day >= allStar && day < utc(year, 7, 14)) day.setUTCDate(15); // All-Star break
  };
  for (let cycle = 0; cycle < 6; cycle++) {
    // Shuffle the order of rounds each cycle so the same pairs do not always meet at the same time.
    const order = base.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (const ri of order) {
      const pairs = base[ri]!.map(([a, b]) => ({ a, b, length: seriesPlan(perPair(a, b))[cycle]! }));
      const days = Math.max(...pairs.map((p) => p.length));
      for (let g = 0; g < days; g++) {
        const date = isoDate(day);
        for (const { a, b, length } of pairs) {
          if (g >= length) continue;
          const aHome = (cycle + a + b) % 2 === 0;
          games.push({ id: `${year}-${String(++count).padStart(4, '0')}`, date, home: teamIds[aHome ? a : b]!, away: teamIds[aHome ? b : a]! });
        }
        nextDay();
      }
    }
  }
  return games;
}
