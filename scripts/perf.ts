/* Main-thread cost of each step the page runs itself (V1.0 plan, V7). The page runs short steps (a day, a
   week, every decision) on its own thread and saves after each; this times them in Node, which is close to
   a desktop browser. A phone is roughly 3–5× slower.
   Usage: npx tsx scripts/perf.ts [seed] [seasons=3] */
import { apply, regularOver, type Action } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import type { ExpansionSettings, LeagueState } from '../src/league/state';
import { makeSave, serializeSave } from '../src/save/format';

const seed = process.argv[2] ?? 'perf';
const seasons = Number(process.argv[3] ?? 3);
const times = new Map<string, number[]>();
const time = (label: string, f: () => void) => {
  const t = performance.now();
  f();
  const ms = performance.now() - t;
  (times.get(label) ?? times.set(label, []).get(label)!).push(ms);
  return ms;
};

let s!: LeagueState;
time('리그 생성 (Worker)', () => (s = createLeague(seed)));
time('창단 전까지 (Worker)', () => apply(s, { kind: 'toFounding' }));
const settings: ExpansionSettings = { name: '측정 구단', short: '측정', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '측정', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null };
time('창단', () => apply(s, { kind: 'found', settings }));
const save = () => time('자동 저장 (문자열로)', () => void serializeSave(makeSave(s.seed, [], { at: { year: s.year, phase: 'regularSeason' }, state: s })));
const run = (label: string, a: Action) => {
  time(label, () => apply(s, a));
  save();
};
const end = s.year + seasons;
for (let guard = 0; guard < 20_000 && s.year < end; guard++) {
  if (s.pending) {
    run(`결정: ${s.pending.kind}`, { kind: 'decide', input: autoDecision(s)! });
    continue;
  }
  if (s.phase === 'regular' && !regularOver(s)) {
    run('하루', { kind: 'days', days: 1 });
    run('1주', { kind: 'days', days: 6 });
    if (!s.pending) run('정규시즌 끝까지 (Worker)', { kind: 'regularEnd' });
  } else if (s.phase === 'regular') run('포스트시즌 (Worker)', { kind: 'postseason' });
  else if (s.phase === 'postseason') run('다음 시즌으로 (Worker)', { kind: 'nextSeason' });
}
console.log(`상태 크기 ${(JSON.stringify(s).length / 1e6).toFixed(1)}MB (${s.year})`);
console.log('| 단계 | 횟수 | 평균 ms | 최대 ms |');
console.log('|---|---|---|---|');
for (const [label, xs] of [...times.entries()].sort((a, b) => Math.max(...b[1]) - Math.max(...a[1])))
  console.log(`| ${label} | ${xs.length} | ${Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)} | ${Math.round(Math.max(...xs))} |`);
