/* 2.0.19 (the user's request): inflation. The game keeps every amount in today's won (2026's) — the economy, the
   rules and the balance never change with it. With the display set to nominal won, an amount shows at the year's
   prices instead: before 2026 by the price level of the time (a game assumption that follows Statistics Korea's
   consumer price index loosely: 1982 about a fifth of today's), from 2026 on growing by the yearly rate chosen. */

/** Price level, 2026 = 1, at a few years (geometric in between). */
const LEVEL: [number, number][] = [
  [1982, 0.21],
  [1985, 0.24],
  [1990, 0.32],
  [1995, 0.44],
  [2000, 0.54],
  [2005, 0.64],
  [2010, 0.74],
  [2015, 0.81],
  [2020, 0.855],
  [2024, 0.97],
  [2026, 1],
];

/** The price level of `year` against 2026 (`rate`: the yearly inflation after 2026, 0.025 for 2.5%). */
export function priceLevel(year: number, rate: number): number {
  if (year >= 2026) return (1 + rate) ** (year - 2026);
  if (year <= LEVEL[0]![0]) return LEVEL[0]![1];
  for (let i = 1; i < LEVEL.length; i++) {
    const [y1, v1] = LEVEL[i]!,
      [y0, v0] = LEVEL[i - 1]!;
    if (year <= y1) return v0 * (v1 / v0) ** ((year - y0) / (y1 - y0));
  }
  return 1;
}

/** The yearly rates offered (percent). */
export const INFLATION_RATES = [1, 2, 2.5, 3, 5] as const;
