/* Builds a league and prints league-wide numbers per season against docs/CALIBRATION.md.
   Usage: npx tsx scripts/league-report.ts [seed] [lastSeason] */
import { bootstrap, playFullSeason } from '../src/league/history';
import { salaryIn } from '../src/league/contracts';
import { ageIn, isForeign } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { era, obp, slg } from '../src/league/stats';

const seed = process.argv[2] ?? 'report';
const last = Number(process.argv[3] ?? 2025);

function report(s: LeagueState) {
  const h = s.history[s.history.length - 1]!;
  const b = h.totals.bat,
    p = h.totals.pit,
    tg = h.totals.games * 2;
  const pct = (x: number) => (100 * x).toFixed(1);
  const top = h.table[0]!,
    bottom = h.table[h.table.length - 1]!;
  const qs = Object.values(s.players).reduce((a, pl) => a + (pl.career.find((c) => c.year === h.year)?.pit?.qs ?? 0), 0);
  console.log(
    `${h.year} AVG ${(b.h / b.ab).toFixed(3)} OBP ${obp(b).toFixed(3)} SLG ${slg(b).toFixed(3)} ERA ${era(p).toFixed(2)} R/G ${(b.r / tg).toFixed(2)} HR/G ${(b.hr / tg).toFixed(2)} BB% ${pct(b.bb / b.pa)} K% ${pct(b.k / b.pa)} SB/G ${(b.sb / tg).toFixed(2)} SB% ${pct(b.sb / (b.sb + b.cs))} QS% ${pct(qs / tg)} top ${top.teamId} ${top.pct.toFixed(3)} bottom ${bottom.pct.toFixed(3)} champ ${h.champion}`,
  );
}

function rosterReport(s: LeagueState) {
  const year = s.year;
  const active = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
  const domestic = active.filter((p) => !isForeign(p) && p.career.length > 0);
  const avg = domestic.reduce((a, p) => a + salaryIn(p, year), 0) / domestic.length;
  const byTeam = s.teams.map((t) => {
    const ids = [...s.rosters[t.id]!.active, ...s.rosters[t.id]!.futures];
    return { t: t.short, n: ids.length, pay: Math.round(ids.map((id) => s.players[id]!).filter((p) => !isForeign(p)).reduce((a, p) => a + salaryIn(p, year), 0) / 10000) };
  });
  const ages = active.map((p) => ageIn(p, year));
  const mil = Object.values(s.players).filter((p) => p.status === 'military').length;
  const top = [...domestic].sort((a, b) => salaryIn(b, year) - salaryIn(a, year)).slice(0, 3).map((p) => `${p.name} ${(salaryIn(p, year) / 10000).toFixed(1)}억`);
  console.log(`${year} players ${active.length} military ${mil} avgAge ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)} avgSalary(non-rookie domestic) ${(avg / 10000).toFixed(2)}억 top ${top.join(', ')}`);
  console.log('  payroll(억)', byTeam.map((x) => `${x.t}:${x.n}/${x.pay}`).join(' '));
}

let t = Date.now();
const s = bootstrap(seed);
console.log(`bootstrap ${Date.now() - t}ms, players ${Object.keys(s.players).length}`);
rosterReport(s);
while (s.year <= last) {
  t = Date.now();
  playFullSeason(s);
  report(s);
  console.log(`  (${Date.now() - t}ms)`);
}
rosterReport(s);
console.log('stored players', Object.keys(s.players).length, 'JSON MB', (JSON.stringify(s).length / 1e6).toFixed(2));
