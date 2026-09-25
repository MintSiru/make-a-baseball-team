/* Engine calibration: builds (or loads) a league at 2026 opening day, then replays that season with
   engine overrides and prints league rates next to the 2025 KBO targets (docs/CALIBRATION.md).
   Usage: npx tsx scripts/calibrate.ts [overrides.json] [seasons]
   Overrides are deep-merged into ENGINE, e.g. {"base":{"k":0.17}}. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createLeague } from '../src/league/history';
import { playPostseason } from '../src/league/postseason';
import { playRegularSeason, startSeason } from '../src/league/season';
import { closeSeason } from '../src/league/offseason';
import type { LeagueState } from '../src/league/state';
import { era, obp, slg } from '../src/league/stats';
import { ENGINE } from '../src/league/tuning';

const cache = process.env.LEAGUE_CACHE ?? '/tmp/league-2026.json';
const merge = (into: Record<string, unknown>, from: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) merge(into[k] as Record<string, unknown>, v as Record<string, unknown>);
    else into[k] = v;
  }
};
if (process.argv[2]) merge(ENGINE as unknown as Record<string, unknown>, JSON.parse(readFileSync(process.argv[2], 'utf8')));

let base: string;
if (existsSync(cache)) base = readFileSync(cache, 'utf8');
else {
  base = JSON.stringify(createLeague('calibrate'));
  writeFileSync(cache, base);
}
const seasons = Number(process.argv[3] ?? 2);
const sum: Record<string, number[]> = {};
for (let i = 0; i < seasons; i++) {
  const s: LeagueState = JSON.parse(base);
  s.seed = `calibrate-${i}`;
  startSeason(s);
  playRegularSeason(s);
  playPostseason(s);
  closeSeason(s);
  const h = s.history.at(-1)!;
  const b = h.totals.bat,
    p = h.totals.pit,
    tg = h.totals.games * 2;
  const qs = Object.values(s.players).reduce((a, pl) => a + (pl.career.find((c) => c.year === h.year)?.pit?.qs ?? 0), 0);
  const sv = Object.values(s.players).reduce((a, pl) => a + (pl.career.find((c) => c.year === h.year)?.pit?.sv ?? 0), 0);
  const hld = Object.values(s.players).reduce((a, pl) => a + (pl.career.find((c) => c.year === h.year)?.pit?.hld ?? 0), 0);
  const ties = s.scores.filter((g) => g.hs === g.as).length / s.scores.length;
  const apps = Object.values(s.players).reduce((a, pl) => a + (pl.career.find((c) => c.year === h.year)?.pit?.g ?? 0), 0);
  const m: Record<string, number> = {
    AVG: b.h / b.ab, OBP: obp(b), SLG: slg(b), ERA: era(p), 'R/G': b.r / tg, 'HR/G': b.hr / tg, 'BB%': (100 * b.bb) / b.pa, 'K%': (100 * b.k) / b.pa,
    'HBP%': (100 * b.hbp) / b.pa, '2B%': (100 * b.d) / b.pa, '3B%': (100 * b.t) / b.pa, 'SB/G': b.sb / tg, 'SB%': (100 * b.sb) / (b.sb + b.cs), 'QS%': (100 * qs) / tg,
    'GDP/G': b.gdp / tg, 'SH%': (100 * b.sh) / b.pa, 'SF%': (100 * b.sf) / b.pa, 'PA/G': b.pa / tg, 'ER/R': p.er / p.r, 'SV/G': sv / h.totals.games, 'HLD/G': hld / h.totals.games, 'tie%': 100 * ties, 'P/G': apps / tg,
    top: h.table[0]!.pct, bottom: h.table.at(-1)!.pct,
  };
  for (const [k, v] of Object.entries(m)) (sum[k] ??= []).push(v);
}
const target: Record<string, number> = { AVG: 0.262, OBP: 0.338, SLG: 0.389, ERA: 4.31, 'R/G': 4.73, 'HR/G': 0.83, 'BB%': 9.1, 'K%': 19.7, 'HBP%': 1.44, '2B%': 4.0, '3B%': 0.37, 'SB/G': 0.75, 'SB%': 74.9, 'QS%': 39.0, 'GDP/G': 0.7, 'SH%': 1.06, 'SF%': 0.81, 'PA/G': 38.9, 'ER/R': 0.898, 'SV/G': 0.48, 'HLD/G': 1.04, 'tie%': 3.1, top: 0.603, bottom: 0.336 };
for (const [k, vs] of Object.entries(sum)) {
  const v = vs.reduce((a, b) => a + b, 0) / vs.length;
  const t = target[k];
  console.log(`${k.padEnd(6)} ${v.toFixed(3).padStart(8)}` + (t === undefined ? '' : `  target ${String(t).padStart(6)}  ${(v - t).toFixed(3)}`));
}
