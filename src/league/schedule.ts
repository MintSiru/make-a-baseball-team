/* Regular-season schedule. Clubs meet in series (three or two games) laid out on consecutive days,
   skipping Mondays and an All-Star break, like the KBO calendar. Works for any number of clubs: with
   an odd count one club rests each block (the 9-club era's bye, RULES.md §9, used from V0.3). */
import { rng } from '../draftroom';

export interface ScheduledGame {
  id: string;
  date: string; // YYYY-MM-DD
  home: string;
  away: string;
}

/** Series lengths that make up the games between one pair, and home/away alternates by series. */
export function seriesPlan(gamesPerPair: number): number[] {
  const threes = Math.floor(gamesPerPair / 3);
  const rest = gamesPerPair - threes * 3;
  // 16 → 3,3,3,3,2,2 ; 15 → 3×5 ; 14 → 3,3,3,3,2
  const plan = Array<number>(threes).fill(3);
  if (rest === 1) {
    plan.pop();
    plan.push(2, 2);
  } else if (rest === 2) plan.push(2);
  return plan;
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

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** Opening day: the last Saturday of March (2026: 3/28, as announced; real openers vary by about a week). */
export function openingDay(year: number): Date {
  const d = utc(year, 3, 31);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export function makeSchedule(teamIds: string[], year: number, seed: string, gamesPerPair = 16): ScheduledGame[] {
  const r = rng(`${seed}|schedule|${year}`);
  const n = teamIds.length;
  const base = roundRobin(n);
  const plan = seriesPlan(gamesPerPair);
  const games: ScheduledGame[] = [];
  const day = openingDay(year);
  const allStar = utc(year, 7, 10);
  let count = 0;
  const nextDay = () => {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() === 1) day.setUTCDate(day.getUTCDate() + 1); // Mondays off
    if (day >= allStar && day < utc(year, 7, 14)) day.setUTCDate(15); // All-Star break
  };
  plan.forEach((length, cycle) => {
    // Shuffle the order of rounds each cycle so the same pairs do not always meet at the same time.
    const order = base.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    for (const ri of order) {
      for (let g = 0; g < length; g++) {
        const date = isoDate(day);
        for (const [a, b] of base[ri]!) {
          const aHome = (cycle + a + b) % 2 === 0;
          games.push({ id: `${year}-${String(++count).padStart(4, '0')}`, date, home: teamIds[aHome ? a : b]!, away: teamIds[aHome ? b : a]! });
        }
        nextDay();
      }
    }
  });
  return games;
}
