/* Large-scale balance runs (V1.0, docs/PLAN-1.0.md §4 D).
   Track A: the league alone (spectator), seed × 20 seasons from 2026.
   Track B: an expansion club run the scouts' way (autoDecision) for each difficulty × owner type.
   Every run writes its own JSON as soon as it ends, so a long batch can stop and pick up where it was.

   Usage:
     npx tsx scripts/balance.ts run A [seeds=200] [seasons=20] [jobs=4] [label=baseline]
     npx tsx scripts/balance.ts run B [perCell=8] [seasons=20] [jobs=4] [label=baseline]
     npx tsx scripts/balance.ts one A <seed> <seasons> <file>            (one run, used by `run`)
     npx tsx scripts/balance.ts one B <seed> <seasons> <file> <difficulty> <parent> <city>
     npx tsx scripts/balance.ts report [label=baseline]                  (prints Markdown tables) */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIM_VERSION } from '../src/core/version';
import { apply, regularOver } from '../src/league/actions';
import { capTotal } from '../src/league/cap';
import { salaryIn } from '../src/league/contracts';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { closeSeason, runOffseason } from '../src/league/offseason';
import { ageIn, isForeign, isPitcher } from '../src/league/players';
import { playPostseason } from '../src/league/postseason';
import { playRegularSeason, startSeason } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { era, obp, slg } from '../src/league/stats';
import type { Difficulty, ExpansionSettings } from '../src/league/state';
import type { ParentCompanyType } from '../src/club/types';
import type { Player } from '../src/model/types';

const ROOT = '.balance';
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
const PARENTS: ParentCompanyType[] = ['conglomerate', 'midsize', 'namingRights', 'citizen'];
const CITIES = ['ulsan', 'cheongju', 'goyang', 'seongnam', 'pohang', 'jeonju', 'hwaseong', 'jeju'];

type Num = number | null;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: Num, d = 3) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** First-team totals of one player's season (traded players have one line per club). */
function firstTeam(p: Player, year: number) {
  const lines = p.career.filter((c) => c.year === year && c.level !== 'futures');
  if (!lines.length) return null;
  const sum = <T extends object>(xs: (T | null)[]) =>
    xs.filter((x): x is T => !!x).reduce<Record<string, number>>((a, x) => {
      for (const [k, v] of Object.entries(x)) if (typeof v === 'number') a[k] = (a[k] ?? 0) + v;
      return a;
    }, {});
  return { bat: sum(lines.map((l) => l.bat)), pit: sum(lines.map((l) => l.pit)), war: lines.reduce((a, l) => a + l.war, 0) };
}

/** The season just closed: league rates, the standings, records, money and the population. */
function seasonMetrics(s: LeagueState, year: number) {
  const h = s.history.find((x) => x.year === year)!;
  const b = h.totals.bat,
    p = h.totals.pit,
    tg = h.totals.games * 2;
  const players = Object.values(s.players);
  const qs = players.reduce((a, pl) => a + (pl.career.find((c) => c.year === year && c.level !== 'futures')?.pit?.qs ?? 0), 0);
  const games = h.table.reduce((a, r) => a + r.w + r.l + r.t, 0) / h.table.length;
  let hr = 0,
    avg = 0,
    eraMin = 99,
    w = 0,
    sv = 0,
    sb = 0,
    warMax = 0;
  for (const pl of players) {
    const ft = firstTeam(pl, year);
    if (!ft) continue;
    hr = Math.max(hr, ft.bat.hr ?? 0);
    sb = Math.max(sb, ft.bat.sb ?? 0);
    if ((ft.bat.pa ?? 0) >= 3.1 * games && ft.bat.ab) avg = Math.max(avg, ft.bat.h! / ft.bat.ab);
    if ((ft.pit.outs ?? 0) >= 3 * games) eraMin = Math.min(eraMin, (27 * ft.pit.er!) / ft.pit.outs!);
    w = Math.max(w, ft.pit.w ?? 0);
    sv = Math.max(sv, ft.pit.sv ?? 0);
    warMax = Math.max(warMax, ft.war);
  }
  const tj = players.reduce((a, pl) => a + (pl.injuries ?? []).filter((x) => x.date.startsWith(String(year)) && x.part.includes('토미존')).length, 0);
  const surgeries = players.reduce((a, pl) => a + (pl.injuries ?? []).filter((x) => x.date.startsWith(String(year)) && x.surgery === 'major').length, 0);
  const payrolls = s.teams.filter((t) => s.rosters[t.id]).map((t) => capTotal(s, t.id, year));
  const capOver = Object.values(s.cap ?? {}).filter((rs) => rs.some((r) => r.year === year && r.over > 0)).length;
  const reports = s.teams.map((t) => s.clubs?.[t.id]?.reports.find((r) => r.year === year)).filter((r) => !!r);
  const ai = s.teams.filter((t) => t.id !== s.user?.teamId).map((t) => s.clubs?.[t.id]?.reports.find((r) => r.year === year)).filter((r) => !!r);
  return {
    year,
    avg: round(b.h / b.ab),
    obp: round(obp(b)),
    slg: round(slg(b)),
    era: round(era(p), 2),
    rg: round(b.r / tg, 2),
    hrg: round(b.hr / tg, 2),
    bb: round((100 * b.bb) / b.pa, 1),
    k: round((100 * b.k) / b.pa, 1),
    sbg: round(b.sb / tg, 2),
    sbp: round((100 * b.sb) / (b.sb + b.cs), 1),
    qs: round((100 * qs) / tg, 1),
    top: round(h.table[0]!.pct),
    bottom: round(h.table.at(-1)!.pct),
    first: h.table[0]!.teamId,
    champion: h.champion,
    rec: { hr, avg: round(avg), era: eraMin === 99 ? null : round(eraMin, 2), w, sv, sb, war: round(warMax, 1) },
    tj,
    surgeries,
    payroll: { min: Math.min(...payrolls), max: Math.max(...payrolls), mean: Math.round(mean(payrolls)!) },
    capOver,
    attendance: round(mean(reports.map((r) => r!.fans / Math.max(1, r!.homeGames))), 0),
    aiOperating: { min: Math.min(...ai.map((r) => r!.operating)), max: Math.max(...ai.map((r) => r!.operating)), support: Math.round(mean(ai.map((r) => r!.support))!) },
    hof: (s.hallOfFame ?? []).filter((e) => e.year === year + 1 || e.year === year).length,
  };
}

/** The roster population after a winter. */
function population(s: LeagueState, year: number) {
  const active = Object.values(s.players).filter((p) => p.status === 'active' && p.teamId);
  const domestic = active.filter((p) => !isForeign(p));
  const vets = domestic.filter((p) => p.career.length > 0);
  const salaries = vets.map((p) => salaryIn(p, year));
  const foreign = active.filter(isForeign);
  const hitters = domestic.filter((p) => !isPitcher(p));
  const positions: Record<string, number> = {};
  for (const p of hitters) positions[p.position ?? "?"] = (positions[p.position ?? "?"] ?? 0) + 1;
  return {
    active: active.length,
    age: round(mean(active.map((p) => ageIn(p, year))), 1),
    military: Object.values(s.players).filter((p) => p.status === 'military').length,
    overseas: Object.values(s.players).filter((p) => p.status === 'overseas').length,
    salaryAvg: Math.round(mean(salaries)!),
    salaryMax: Math.max(...salaries),
    foreignGrade: round(mean(foreign.map((p) => p.scouting.current)), 1),
    foreignMax: Math.max(...foreign.map((p) => p.scouting.current)),
    positions,
  };
}

/** Free agents and retirements of the winter that just ran (compares before and after). */
function winter(before: Map<string, string>, s: LeagueState, year: number) {
  const retired = Object.values(s.players).filter((p) => p.status === 'retired' && before.get(p.id) === 'active');
  const deals = Object.values(s.players)
    .filter((p) => p.contract?.fa && p.contract.signedIn >= year && !before.get(`${p.id}|fa|${p.contract.signedIn}`))
    .map((p) => (p.contract!.signingBonus + p.contract!.salaries.reduce((a, x) => a + x.amount, 0)) / 10_000);
  return {
    retired: retired.length,
    retireAge: round(mean(retired.map((p) => ageIn(p, year))), 1),
    retiredGood: retired.filter((p) => p.scouting.current >= 60).length,
    fa: deals.length,
    faTop: round(Math.max(0, ...deals), 1),
    fa100: deals.filter((x) => x >= 100).length,
  };
}

function snapshot(s: LeagueState) {
  const m = new Map<string, string>();
  for (const p of Object.values(s.players)) {
    m.set(p.id, p.status);
    if (p.contract?.fa) m.set(`${p.id}|fa|${p.contract.signedIn}`, '1');
  }
  return m;
}

function runA(seed: string, seasons: number) {
  const s = createLeague(seed);
  const out = [];
  for (let i = 0; i < seasons; i++) {
    const year = s.year;
    playRegularSeason(s);
    playPostseason(s);
    closeSeason(s);
    const season = seasonMetrics(s, year);
    const before = snapshot(s);
    runOffseason(s);
    const w = winter(before, s, year);
    startSeason(s);
    out.push({ ...season, ...w, pop: population(s, s.year) });
  }
  return out;
}

function runB(seed: string, seasons: number, difficulty: Difficulty, parentType: ParentCompanyType, cityId: string) {
  const s = createLeague(seed);
  apply(s, { kind: 'toFounding' });
  const settings: ExpansionSettings = { name: '검증 구단', short: '검증', color: '#1f6fb2', cityId, parentType, parentName: '검증', stadium: 'existing', promotion: 'afterFutures', difficulty, scenario: null };
  apply(s, { kind: 'found', settings });
  const out: Record<string, unknown>[] = [];
  let decisions = 0,
    seen = s.history.length;
  const end = 2026 + seasons;
  for (let guard = 0; guard < 200_000 && s.year < end; guard++) {
    if (s.pending) {
      apply(s, { kind: 'decide', input: autoDecision(s)! });
      if (++decisions > 3000) throw new Error(`stuck on ${s.pending?.kind ?? '?'} in ${s.year}`);
      continue;
    }
    if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else if (s.phase === 'postseason') apply(s, { kind: 'nextSeason' });
    else throw new Error(`stuck in phase ${s.phase} ${s.year}`);
    if (s.history.length > seen) {
      seen = s.history.length;
      const h = s.history.at(-1)!;
      const u = s.user!;
      const row = h.table.find((r) => r.teamId === EXPANSION_ID);
      const report = s.clubs?.[EXPANSION_ID]?.reports.find((r) => r.year === h.year);
      out.push({
        year: h.year,
        first: !!row,
        rank: row?.rank ?? null,
        clubs: h.table.length,
        pct: round(row?.pct ?? null),
        post: h.series.some((x) => x.high === EXPANSION_ID || x.low === EXPANSION_ID),
        champ: h.champion === EXPANSION_ID,
        fund: Math.round(u.fund / 10_000),
        trust: round(u.trust ?? null, 0),
        support: report ? Math.round(report.support / 10_000) : null,
        operating: report ? Math.round(report.operating / 10_000) : null,
        attendance: report ? Math.round(report.fans / Math.max(1, report.homeGames)) : null,
        payroll: Math.round(capTotal(s, EXPANSION_ID, h.year) / 10_000),
        decisions,
        league: seasonMetrics(s, h.year),
      });
      decisions = 0;
    }
  }
  return out;
}

function one(args: string[]) {
  const [track, seed, seasonsText, file, difficulty, parent, city] = args;
  const seasons = Number(seasonsText);
  const t = Date.now();
  let seasonsOut: unknown[] = [];
  let error: string | null = null;
  try {
    seasonsOut = track === 'A' ? runA(seed!, seasons) : runB(seed!, seasons, difficulty as Difficulty, parent as ParentCompanyType, city!);
  } catch (e) {
    error = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}` : String(e);
  }
  writeFileSync(file!, JSON.stringify({ track, seed, sim: SIM_VERSION, difficulty, parent, city, ms: Date.now() - t, error, seasons: seasonsOut }));
}

async function run(args: string[]) {
  const [track, nText, seasonsText, jobsText, label = 'baseline'] = args;
  const seasons = Number(seasonsText ?? 20),
    jobs = Number(jobsText ?? 4);
  const dir = join(ROOT, label);
  mkdirSync(dir, { recursive: true });
  const work: string[][] = [];
  if (track === 'A') {
    for (let i = 0; i < Number(nText ?? 200); i++) work.push(['A', `bal-a-${i}`, String(seasons), join(dir, `A-${i}.json`)]);
  } else {
    let i = 0;
    for (const d of DIFFICULTIES)
      for (const p of PARENTS)
        for (let k = 0; k < Number(nText ?? 8); k++, i++) work.push(['B', `bal-b-${i}`, String(seasons), join(dir, `B-${d}-${p}-${k}.json`), d, p, CITIES[i % CITIES.length]!]);
  }
  const todo = work.filter((w) => !existsSync(w[3]!));
  console.log(`${track}: ${work.length - todo.length} done, ${todo.length} to run, ${jobs} at a time`);
  let next = 0,
    done = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (next < todo.length) {
        const w = todo[next++]!;
        await new Promise<void>((resolve) => {
          const child = spawn(process.execPath, [...process.execArgv, process.argv[1]!, 'one', ...w], { stdio: ['ignore', 'ignore', 'inherit'] });
          child.on('exit', () => resolve());
        });
        done++;
        const per = (Date.now() - started) / done;
        console.log(`${done}/${todo.length} ${w[3]} (eta ${Math.round((per * (todo.length - done)) / 60_000)} min)`);
      }
    }),
  );
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────────

const pct = (xs: number[], q: number) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))]! : NaN;
};
const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const band = (xs: number[], d = 3) => `${fmt(mean(xs) ?? NaN, d)} (${fmt(pct(xs, 0.05), d)}–${fmt(pct(xs, 0.95), d)})`;

function load(label: string, track: string) {
  const dir = join(ROOT, label);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${track}-`) && f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function report(label: string) {
  const lines: string[] = [];
  const A = load(label, 'A');
  if (A.length) {
    const errors = A.filter((r) => r.error);
    const seasons = A.flatMap((r) => r.seasons);
    lines.push(`### 검증 A — 관전 리그 (${A.length}시드, ${seasons.length}시즌, 시뮬레이션 ${A[0].sim})`, '');
    lines.push(`예외: ${errors.length}건${errors.length ? ` — ${errors.map((e) => `${e.seed}: ${e.error.split('\n')[0]}`).join(' / ')}` : ''}. 시드당 평균 ${fmt((mean(A.map((r) => r.ms)) ?? 0) / 1000, 0)}초.`, '');
    const metric = (name: string, get: (x: any) => number, d = 3) => lines.push(`| ${name} | ${band(seasons.map(get).filter((x: number) => Number.isFinite(x)), d)} |`);
    lines.push('| 지표 | 평균 (5%–95%) |', '|---|---|');
    metric('타율', (x) => x.avg);
    metric('출루율', (x) => x.obp);
    metric('장타율', (x) => x.slg);
    metric('평균자책점', (x) => x.era, 2);
    metric('팀 경기당 득점', (x) => x.rg, 2);
    metric('팀 경기당 홈런', (x) => x.hrg, 2);
    metric('볼넷%', (x) => x.bb, 1);
    metric('삼진%', (x) => x.k, 1);
    metric('팀 경기당 도루', (x) => x.sbg, 2);
    metric('도루 성공률', (x) => x.sbp, 1);
    metric('QS%', (x) => x.qs, 1);
    metric('1위 승률', (x) => x.top);
    metric('최하위 승률', (x) => x.bottom);
    metric('최다 홈런', (x) => x.rec.hr, 0);
    metric('최고 타율(규정)', (x) => x.rec.avg);
    metric('최저 ERA(규정)', (x) => x.rec.era ?? NaN, 2);
    metric('최다승', (x) => x.rec.w, 0);
    metric('최다 세이브', (x) => x.rec.sv, 0);
    metric('최다 도루', (x) => x.rec.sb, 0);
    metric('최고 WAR', (x) => x.rec.war, 1);
    metric('토미존 (리그, 한 해)', (x) => x.tj, 1);
    metric('큰 수술 (리그, 한 해)', (x) => x.surgeries, 1);
    metric('평균 관중', (x) => x.attendance, 0);
    metric('구단 연봉 총액 최소 (억)', (x) => x.payroll.min / 10_000, 1);
    metric('구단 연봉 총액 최대 (억)', (x) => x.payroll.max / 10_000, 1);
    metric('경쟁균형세 초과 구단', (x) => x.capOver, 2);
    metric('AI 운영 결과 최저 (억)', (x) => x.aiOperating.min / 10_000, 0);
    metric('AI 운영 결과 최고 (억)', (x) => x.aiOperating.max / 10_000, 0);
    metric('AI 모기업 지원 평균 (억)', (x) => x.aiOperating.support / 10_000, 0);
    metric('은퇴 (한 겨울)', (x) => x.retired, 1);
    metric('은퇴 나이', (x) => x.retireAge, 1);
    metric('등급 60 이상 은퇴', (x) => x.retiredGood, 2);
    metric('FA 계약 수', (x) => x.fa, 1);
    metric('최대 FA 계약 (억)', (x) => x.faTop, 1);
    metric('100억 이상 FA', (x) => x.fa100, 2);
    metric('명예의 전당 입성', (x) => x.hof, 2);
    metric('현역 선수', (x) => x.pop.active, 0);
    metric('평균 나이', (x) => x.pop.age, 1);
    metric('군 복무', (x) => x.pop.military, 0);
    metric('기존 선수 평균 연봉 (억)', (x) => x.pop.salaryAvg / 10_000, 2);
    metric('최고 연봉 (억)', (x) => x.pop.salaryMax / 10_000, 1);
    metric('외국인 평균 등급', (x) => x.pop.foreignGrade, 1);
    lines.push('');
    // Seasons 1, 10 and 20 for drift over time.
    const byIndex = (i: number) => A.filter((r) => r.seasons[i]).map((r) => r.seasons[i]);
    lines.push('| 시즌 | 타율 | ERA | 평균 연봉 (억) | 최고 연봉 (억) | 현역 | 평균 나이 | 외국인 등급 |', '|---|---|---|---|---|---|---|---|');
    for (const i of [0, 4, 9, 14, 19]) {
      const xs = byIndex(i);
      if (!xs.length) continue;
      lines.push(`| ${xs[0].year} | ${fmt(mean(xs.map((x) => x.avg))!)} | ${fmt(mean(xs.map((x) => x.era))!, 2)} | ${fmt(mean(xs.map((x) => x.pop.salaryAvg / 10_000))!, 2)} | ${fmt(mean(xs.map((x) => x.pop.salaryMax / 10_000))!, 1)} | ${fmt(mean(xs.map((x) => x.pop.active))!, 0)} | ${fmt(mean(xs.map((x) => x.pop.age))!, 1)} | ${fmt(mean(xs.map((x) => x.pop.foreignGrade))!, 1)} |`);
    }
    lines.push('');
    // Competitive balance: titles per club over each run, the longest streak of titles.
    const titles = A.filter((r) => !r.error).map((r) => {
      const c: Record<string, number> = {};
      let streak = 0,
        best = 0,
        last = '';
      for (const x of r.seasons) {
        if (!x.champion) continue;
        c[x.champion] = (c[x.champion] ?? 0) + 1;
        streak = x.champion === last ? streak + 1 : 1;
        last = x.champion;
        best = Math.max(best, streak);
      }
      return { most: Math.max(0, ...Object.values(c)), clubs: Object.keys(c).length, best };
    });
    lines.push(`우승 분포 (시드당 ${A[0].seasons.length}시즌): 한 구단 최다 우승 ${band(titles.map((t) => t.most), 1)}, 우승 구단 수 ${band(titles.map((t) => t.clubs), 1)}, 최장 연속 우승 ${band(titles.map((t) => t.best), 1)}.`, '');
    const posTotals: Record<string, number[]> = {};
    for (const x of seasons) for (const [k, v] of Object.entries(x.pop.positions as Record<string, number>)) (posTotals[k] ??= []).push(v);
    lines.push(`국내 타자 포지션 (현역, 평균): ${Object.entries(posTotals).sort().map(([k, v]) => `${k} ${fmt(mean(v)!, 0)}`).join(' · ')}.`, '');
  }
  const B = load(label, 'B');
  if (B.length) {
    const errors = B.filter((r) => r.error);
    lines.push(`### 검증 B — 신생구단 (${B.length}회, 스카우트 추천 결정)`, '');
    lines.push(`예외·멈춤: ${errors.length}건${errors.length ? ` — ${errors.map((e) => `${e.seed}(${e.difficulty}/${e.parent}): ${e.error.split('\n')[0]}`).join(' / ')}` : ''}.`, '');
    lines.push('| 난이도 | 모기업 | 회 | 1군 5년 안 가을야구 | 1군 첫 가을야구까지 (해) | 1군 10년 승률 | 우승 (회당) | 10년 뒤 자금 (억) | 최저 신뢰도 |', '|---|---|---|---|---|---|---|---|---|');
    for (const d of DIFFICULTIES)
      for (const p of PARENTS) {
        const rs = B.filter((r) => r.difficulty === d && r.parent === p && !r.error);
        if (!rs.length) continue;
        const first = rs.map((r) => r.seasons.filter((x: any) => x.first));
        const in5 = first.filter((xs) => xs.slice(0, 5).some((x: any) => x.post)).length / rs.length;
        const toPost = first.map((xs) => {
          const i = xs.findIndex((x: any) => x.post);
          return i < 0 ? NaN : i + 1;
        });
        const pct10 = first.map((xs) => mean(xs.slice(0, 10).map((x: any) => x.pct)) ?? NaN);
        const champs = first.map((xs) => xs.filter((x: any) => x.champ).length);
        const fund10 = rs.map((r) => r.seasons[10]?.fund ?? NaN);
        const trust = rs.map((r) => Math.min(...r.seasons.map((x: any) => x.trust ?? 100)));
        const reached = toPost.filter((x) => Number.isFinite(x));
        lines.push(`| ${d} | ${p} | ${rs.length} | ${(100 * in5).toFixed(0)}% | ${reached.length ? fmt(mean(reached)!, 1) : '—'} (${reached.length}/${rs.length}) | ${fmt(mean(pct10.filter(Number.isFinite))!)} | ${fmt(mean(champs)!, 2)} | ${fmt(mean(fund10.filter(Number.isFinite))!, 0)} | ${fmt(mean(trust)!, 0)} |`);
      }
    lines.push('');
  }
  console.log(lines.join('\n'));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'one') one(rest);
else if (cmd === 'run') await run(rest);
else if (cmd === 'report') report(rest[0] ?? 'baseline');
else console.log('usage: balance.ts run A|B … | one … | report [label]');
