/* A future that moves (V0.12). A young player's ceiling is not fixed at the draft: every winter it can jump (a
   breakout), stall, or drift a little, and a season that says so makes the jump or the stall likelier. During
   the season the scouts revise a young player's future grade month by month from what they see: his numbers
   against the level he plays at, a step of five either way from the winter's report (two for the youngest who
   tear up the first team). Our players' changes make the news. */
import type { Player, PlayerId } from '../model/types';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { addInto, emptyBat, emptyPit, type LeagueState, type SeasonLine } from './state';
import { era, obp, slg } from './stats';
import { SCOUTING as S } from './tuning';
import { breakoutFactor } from './traits';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const young = (p: Player, season: number) => !isForeign(p) && ageIn(p, season) <= S.maxAge;

/** What last season said about him: +1 a season that points up, −1 one that points down, 0 otherwise. */
function lastSeasonSignal(p: Player, year: number): number {
  const major = p.career.find((c) => c.year === year && !c.level);
  const minor = p.career.find((c) => c.year === year && c.level === 'futures');
  const W = S.winter;
  if (major && ((major.bat?.pa ?? 0) >= W.majorPA || (major.pit?.outs ?? 0) >= W.majorOuts)) return major.war >= W.goodWar ? 1 : major.war <= W.badWar ? -1 : 0;
  if (minor?.bat && minor.bat.pa >= W.minorPA) {
    const ops = obp(minor.bat) + slg(minor.bat);
    return ops >= W.goodOps ? 1 : ops <= W.badOps ? -1 : 0;
  }
  if (minor?.pit && minor.pit.outs >= W.minorOuts) {
    const e = era(minor.pit);
    return e <= W.goodEra ? 1 : e >= W.badEra ? -1 : 0;
  }
  return 0;
}

/**
 * The winter's move of a young player's hidden ceiling: a breakout lifts one or two abilities, a stall lowers
 * them (never below what he can already do), and every ability drifts a little. Before the year's growth.
 */
export function driftPotential(p: Player, year: number, r: () => number) {
  if (!young(p, year + 1) || p.status === 'retired') return;
  const D = S.winter;
  const signal = lastSeasonSignal(p, year);
  const keys = Object.keys(p.hidden.potential) as (keyof Player['hidden']['potential'])[];
  const pickKeys = () => {
    const n = r() < 0.5 ? 1 : 2;
    return [...keys].sort(() => r() - 0.5).slice(0, n);
  };
  const set = (k: (typeof keys)[number], v: number) => (p.hidden.potential[k] = clamp(v, p.hidden.current[k] ?? 20, 80));
  const roll = r();
  const breakout = D.breakout * (signal > 0 ? D.signalBoost : 1) * (ageIn(p, year + 1) <= 23 ? 1.3 : 1) * breakoutFactor(p);
  const stall = D.stall * (signal < 0 ? D.signalBoost : 1);
  if (roll < breakout) for (const k of pickKeys()) set(k, (p.hidden.potential[k] ?? 40) + D.jump[0] + r() * (D.jump[1] - D.jump[0]));
  else if (roll < breakout + stall) for (const k of pickKeys()) set(k, (p.hidden.potential[k] ?? 40) - D.jump[0] - r() * (D.jump[1] - D.jump[0]));
  for (const k of keys) set(k, (p.hidden.potential[k] ?? 40) + normal(r) * D.drift);
}

// ── In the season ───────────────────────────────────────────────────────────────────────────────

type Level = { bat: ReturnType<typeof emptyBat>; pit: ReturnType<typeof emptyPit> };
const levelOf = (lines: Record<PlayerId, SeasonLine>): Level => {
  const bat = emptyBat(),
    pit = emptyPit();
  for (const l of Object.values(lines)) {
    if (l.bat) addInto(bat, l.bat);
    if (l.pit) addInto(pit, l.pit);
  }
  return { bat, pit };
};

/** How far his season stands from his level's average, in rough standard deviations (+ good), or null (too little). */
function zOf(p: Player, line: SeasonLine | undefined, level: Level, minor: boolean): number | null {
  const M = S.month;
  if (!line) return null;
  if (isPitcher(p)) {
    if (!line.pit || line.pit.outs < (minor ? M.minorOuts : M.majorOuts)) return null;
    return clamp((era(level.pit) - era(line.pit)) / M.eraSd, -3, 3);
  }
  if (!line.bat || line.bat.pa < (minor ? M.minorPA : M.majorPA)) return null;
  return clamp((obp(line.bat) + slg(line.bat) - obp(level.bat) - slg(level.bat)) / M.opsSd, -3, 3);
}

/** The step (grade points) the scouts add to the winter's future grade for what they have seen this season. */
export function seasonStep(p: Player, z: number, minor: boolean, season: number): number {
  const M = S.month;
  const [up, down] = minor ? [M.minorUp, M.minorDown] : [M.majorUp, M.majorDown];
  if (z >= up) return !minor && z >= M.twoSteps && ageIn(p, season) <= M.twoStepsAge ? 10 : 5;
  if (z <= -down) return -5;
  return 0;
}

/** First game day of a month: the scouts look again at every young player with enough of a season to judge. */
export function scoutMonth(s: LeagueState, date: string) {
  const major = levelOf(s.lines);
  const minor = s.futures ? levelOf(s.futures.lines) : null;
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || !p.teamId || !young(p, s.year)) continue;
    const sc = p.scouting;
    const base = sc.base ?? sc.futureValue;
    // The first team says more; the futures league when he has not played enough up there.
    let z = zOf(p, s.lines[p.id], major, false);
    let fromMinor = false;
    if (z === null && minor && s.futures) {
      z = zOf(p, s.futures.lines[p.id], minor, true);
      fromMinor = true;
    }
    if (z === null) continue;
    const step = seasonStep(p, z, fromMinor, s.year);
    const to = Math.max(sc.current, clamp(base + step, 20, 80));
    if (to === sc.futureValue) continue;
    const from = sc.futureValue;
    // The abilities his numbers speak to follow the grade.
    const keys: (keyof typeof sc.futureTools)[] = isPitcher(p) ? ['stuff', 'command', 'breaking'] : ['contact', 'power', 'eye'];
    for (const k of keys) if (sc.futureTools[k] != null) sc.futureTools[k] = clamp(sc.futureTools[k]! + (to - from), 20, 80);
    sc.base = base;
    sc.futureValue = to;
    sc.ceiling = Math.max(sc.ceiling, to);
    sc.moved = { date, from, to };
    if (p.teamId === s.user?.teamId) scoutNews(s, p, from, to, date, fromMinor);
  }
}

function scoutNews(s: LeagueState, p: Player, from: number, to: number, date: string, minor: boolean) {
  const up = to > from;
  const line = (minor ? s.futures?.lines : s.lines)?.[p.id];
  const stat = isPitcher(p)
    ? line?.pit
      ? `평균자책점 ${era(line.pit).toFixed(2)} (${Math.floor(line.pit.outs / 3)}이닝)`
      : ''
    : line?.bat
      ? `OPS ${(obp(line.bat) + slg(line.bat)).toFixed(3).replace(/^0/, '')} (${line.bat.pa}타석)`
      : '';
  addNews(s, {
    id: `scout-${p.id}-${date}`,
    date,
    kind: 'interview',
    title: `${p.name}, 스카우트 평가 ${up ? '상승' : '하락'} (미래 ${from} → ${to})`,
    body: `${minor ? '퓨처스리그' : '1군'}에서 ${stat}. 스카우트 팀이 ${p.name}의 미래 등급을 ${from}에서 ${to}로 ${up ? '올렸다' : '낮췄다'}.`,
    quotes: [],
    facts: { 선수: p.name, '미래 등급': `${from} → ${to}`, 기록: stat },
    players: [p.id],
    mine: true,
  });
}
