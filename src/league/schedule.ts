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

/** Games between each pair: 16 with ten clubs; with eleven, four opponents 15 and six 14 (a 4-regular circulant).
    1.9.1: any number of clubs and games (`any`), and two leagues of the same size (`sides`). */
export function pairGames(n: number, seed: string, year: number, games: number = ELEVEN_CLUB_SCHEDULE.gamesPerClub, sides?: number[]): (a: number, b: number) => number {
  if (sides || games !== ELEVEN_CLUB_SCHEDULE.gamesPerClub || (n !== 10 && n !== 11)) return anyPairGames(n, seed, year, games, sides);
  if (n % 2 === 0) {
    const perPair = Math.round((ELEVEN_CLUB_SCHEDULE.gamesPerClub * 1) / (n - 1));
    return () => perPair;
  }
  const S = ELEVEN_CLUB_SCHEDULE;
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

/** Shuffled positions 0..n-1 for a year (which pairs get the extra games changes every season). */
function shuffled(n: number, r: () => number): number[] {
  const pos = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pos[i], pos[j]] = [pos[j]!, pos[i]!];
  }
  return pos;
}

/** Offsets of a circulant on `n` places where each place has `extra` neighbours (±1, ±2, …, and n/2 for an odd count). */
const circulant = (n: number, extra: number) => new Set([...Array.from({ length: Math.floor(extra / 2) }, (_, i) => [i + 1, n - i - 1]).flat(), ...(extra % 2 ? [n / 2] : [])]);

/**
 * 1.9.1: games between each pair for any league (RULES.md §9, game assumptions). One league: every pair the same,
 * and the games left over go to a few opponents each (a circulant on a shuffled order). Two leagues of the same size
 * (`sides`: 0 or 1 for each club): a quarter more against each club of the own league, the rest spread over the other
 * league the same way. With an odd number of clubs the total stays even, so every club plays `games`.
 */
export function anyPairGames(n: number, seed: string, year: number, games: number, sides?: number[]): (a: number, b: number) => number {
  const r = rng(`${seed}|pairs|${year}`);
  const half = sides ? sides.filter((x) => x === 0).length : 0;
  if (!sides || half * 2 !== n) {
    const base = Math.floor(games / (n - 1));
    const heavy = circulant(n, games - base * (n - 1));
    const pos = shuffled(n, r);
    return (a, b) => base + (heavy.has((((pos[a]! - pos[b]!) % n) + n) % n) ? 1 : 0);
  }
  const same = Math.round((games / (n - 1)) * 1.25);
  const rest = games - same * (half - 1);
  const base = Math.floor(rest / half),
    extra = rest - base * half;
  // Each club's place in its league; a club meets the other league's clubs at offsets 0..extra-1 one game more.
  const place: number[] = [];
  const order = [0, 1].map((side) => shuffled(half, r));
  const seen = [0, 0];
  sides.forEach((side, i) => (place[i] = order[side]![seen[side]!++]!));
  return (a, b) => {
    if (sides[a] === sides[b]) return same;
    const [x, y] = sides[a] === 0 ? [a, b] : [b, a];
    return base + ((((place[y]! - place[x]!) % half) + half) % half < extra ? 1 : 0);
  };
}

/** 1.9.1: series for any number of games: as many three-game series as it takes, the rest two-game. */
export const anySeriesPlan = (games: number): number[] => {
  if (games <= 0) return [];
  if (games === 1) return [1];
  const k = Math.ceil(games / 3);
  const threes = games - 2 * k;
  return [...Array<number>(threes).fill(3), ...Array<number>(k - threes).fill(2)];
};

/**
 * 1.9.1: the schedule when some pair plays outside the 12–18 games the six-cycle layout takes (sixteen clubs, the
 * early leagues). All series go into a pool; each round, the clubs are matched greedily — the pairs with the most
 * series left first, three-game series before two-game ones — and the round lasts as long as its longest series.
 * Home and away alternate series by series inside each pair.
 */
function poolSchedule(teamIds: string[], year: number, r: () => number, perPair: (a: number, b: number) => number): ScheduledGame[] {
  const n = teamIds.length;
  type Round = { a: number; b: number; length: number; home: boolean }[];
  /** One try at the rounds; the shortest of a few tries is kept. */
  const tryRounds = (): Round[] => {
    const pairs: { a: number; b: number; series: number[]; played: number }[] = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push({ a, b, series: shuffle(anySeriesPlan(perPair(a, b)), r), played: 0 });
    const left = new Array<number>(n).fill(0);
    for (const x of pairs) for (const l of x.series) (left[x.a]! += l), (left[x.b]! += l);
    // Home games so far less away games: the next series goes to the club further behind at home.
    const lean = new Array<number>(n).fill(0);
    const rounds: Round[] = [];
    for (let guard = 0; guard < 2000 && pairs.some((x) => x.series.length); guard++) {
      // Clubs with the most games left go first, so nobody is left with a long tail alone.
      const clubs = shuffle(Array.from({ length: n }, (_, i) => i), r).sort((x, y) => left[y]! - left[x]!);
      const busy = new Set<number>();
      const round: Round = [];
      let length = 0;
      for (const c of clubs) {
        if (busy.has(c)) continue;
        const other = (x: { a: number; b: number }) => (x.a === c ? x.b : x.a);
        // A series as long as the round's first, then the opponent with the most games left, then the pair with the
        // most series left.
        const better = (x: (typeof pairs)[number], y: (typeof pairs)[number]) => Number(x.series.at(-1) === length) - Number(y.series.at(-1) === length) || left[other(x)]! - left[other(y)]! || x.series.length - y.series.length;
        let pick: (typeof pairs)[number] | undefined;
        for (const x of pairs) if (x.series.length && (x.a === c || x.b === c) && !busy.has(other(x)) && (!pick || better(x, pick) > 0)) pick = x;
        if (!pick) continue;
        busy.add(pick.a).add(pick.b);
        const len = pick.series.pop()!;
        length ||= len;
        left[pick.a]! -= len;
        left[pick.b]! -= len;
        const home = lean[pick.a]! < lean[pick.b]! || (lean[pick.a] === lean[pick.b] && pick.played % 2 === 0);
        pick.played++;
        lean[home ? pick.a : pick.b]! += len;
        lean[home ? pick.b : pick.a]! -= len;
        round.push({ a: pick.a, b: pick.b, length: len, home });
      }
      rounds.push(round);
    }
    return rounds;
  };
  const days = (rounds: Round[]) => rounds.reduce((d, x) => d + Math.max(...x.map((y) => y.length)), 0);
  let best = tryRounds();
  for (let i = 0; i < 11; i++) {
    const next = tryRounds();
    if (days(next) < days(best)) best = next;
  }
  const games: ScheduledGame[] = [];
  const day = openingDay(year);
  const allStar = utc(year, 7, 10);
  let count = 0;
  const nextDay = () => {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() === 1) day.setUTCDate(day.getUTCDate() + 1);
    if (day >= allStar && day < utc(year, 7, 14)) day.setUTCDate(15);
  };
  for (const round of best) {
    const length = Math.max(...round.map((x) => x.length));
    for (let g = 0; g < length; g++) {
      const date = isoDate(day);
      for (const x of round) {
        if (g >= x.length) continue;
        games.push({ id: `${year}-${String(++count).padStart(4, '0')}`, date, home: teamIds[x.home ? x.a : x.b]!, away: teamIds[x.home ? x.b : x.a]! });
      }
      nextDay();
    }
  }
  return games;
}

function shuffle<T>(xs: T[], r: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
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

/** `pairs`: games between two clubs when the league sets them itself (twelve clubs, twelve.ts). 1.9.1: `games` a
    season and the two leagues' sides (0/1 by club) for any other league; a pair outside 12–18 games takes the pool
    layout (the six-cycle one, unchanged for 10–12 clubs, needs six series a pair). */
export function makeSchedule(teamIds: string[], year: number, seed: string, pairs?: (a: string, b: string) => number, seasonGames?: number, sides?: number[]): ScheduledGame[] {
  const r = rng(`${seed}|schedule|${year}`);
  const n = teamIds.length;
  const perPair = pairs ? (a: number, b: number) => pairs(teamIds[a]!, teamIds[b]!) : pairGames(n, seed, year, seasonGames, sides);
  let fits = true;
  for (let a = 0; a < n && fits; a++) for (let b = a + 1; b < n; b++) if (perPair(a, b) < 12 || perPair(a, b) > 18) fits = false;
  if (!fits) return poolSchedule(teamIds, year, r, perPair);
  const base = roundRobin(n);
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
