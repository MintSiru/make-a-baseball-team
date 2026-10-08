import { k as __i18n_k } from '../i18n/index';
/* The draft combine (1.3.0, from the 1.1 feedback; a game assumption — the KBO holds no combine, only a tryout for
   players outside the school system). On August 25 of the draft year the best of the class — about sixty by the
   public ranking, less the few who stay away — are measured in front of every club: a pitcher's velocity, spin and
   strike rate, a hitter's 30 m sprint, exit velocity, throwing velocity and a strike-zone test. The numbers come from
   what he can really do today, so every club's public report on the measured abilities moves most of the way to the truth (and
   his future grade with it); the AI clubs draft by those reports.

   Our club can also bring up to five prospects in for a private workout and an interview (a fee each, before the draft):
   our scouts read those players — abilities, growth type, character — as if they had watched them a season longer.

   Measurements and who comes are drawn on streams of the prospect's own, so the board and the draft see the same combine. */
import { overall, rng, toGrade, type Tools } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addNews } from './news';
import { iga } from './josa';
import { isPitcher } from './players';
import type { LeagueState } from './state';
import { COMBINE as C } from './tuning';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const round5 = (n: number) => Math.round(n / 5) * 5;
/** About −0.9 … +0.9, centred, from a stream of its own. */
const noise = (key: string) => {
  const r = rng(key);
  return (r() + r() - 1) * 0.9;
};

export interface CombineLine {
  label: string;
  value: string;
  /** For sorting: higher is better. */
  score: number;
}

/** Whether the draft class of `draftYear` has been to the combine by now. */
export function combineHeld(s: LeagueState, draftYear: number): boolean {
  if (s.year > draftYear || (s.offseason && s.offseason.year >= draftYear)) return true;
  if (s.year < draftYear) return false;
  if (s.phase !== 'regular') return true;
  const date = s.schedule[s.next]?.date ?? `${s.year}-12-31`;
  return date >= `${draftYear}-${C.date}`;
}

/** Who comes: the top of the public ranking, less those who stay away. */
export const attends = (seed: string, draftYear: number, p: Player) => p.amateur.draftRank <= C.invited && rng(`${seed}|combine-skip|${draftYear}|${p.id}`)() >= C.skip;

/** His numbers at the combine. */
export function combineLines(seed: string, draftYear: number, p: Player): CombineLine[] {
  const t = p.hidden.current;
  const k = (what: string) => `${seed}|combine|${draftYear}|${p.id}|${what}`;
  const g = (key: keyof Tools) => (t[key] ?? 40) + noise(k(key)) * C.noise;
  if (isPitcher(p)) {
    const velo = (p.velocity ?? 140) + ((t.stuff ?? 40) - (p.velocityStuff ?? t.stuff ?? 40)) * 0.35 + noise(k('velo')) * 1.5;
    const spin = Math.round((2250 + (g('stuff') - 50) * 12 + (g('breaking') - 50) * 10) / 10) * 10;
    const strikes = clamp(62 + (g('command') - 50) * 0.45, 45, 78);
    return [
      { label: __i18n_k("league.combine.combineLines.label.b2ea2c6b"), value: `${Math.round(velo)}km/h`, score: velo },
      { label: __i18n_k("league.combine.combineLines.label.b3b8ad31"), value: `${spin}rpm`, score: spin },
      { label: __i18n_k("league.combine.combineLines.label.7641ca40"), value: `${strikes.toFixed(0)}%`, score: strikes },
    ];
  }
  const sprint = clamp(4.35 - (g('speed') - 50) * 0.012, 3.85, 4.9);
  const exit = clamp(148 + (g('power') - 50) * 0.55, 125, 175);
  const arm = clamp(122 + (g('defense') - 50) * 0.5, 100, 145);
  const zone = clamp(70 + (g('eye') - 50) * 0.5, 50, 90);
  return [
    { label: __i18n_k("league.combine.combineLines.label.ef680577"), value: __i18n_k("league.combine.combineLines.value.a0874363", { value: sprint.toFixed(2) }), score: -sprint },
    { label: __i18n_k("league.combine.combineLines.label.fa6a7e4e"), value: `${Math.round(exit)}km/h`, score: exit },
    { label: __i18n_k("league.combine.combineLines.label.30cfe100"), value: `${Math.round(arm)}km/h`, score: arm },
    { label: __i18n_k("league.combine.combineLines.label.4de222ef"), value: __i18n_k("league.combine.combineLines.value.c1b224c3", { value: Math.round(zone) }), score: zone },
  ];
}

/** The abilities the combine measures. */
const MEASURED: Record<'pitcher' | 'hitter', (keyof Tools)[]> = { pitcher: ['stuff', 'command', 'breaking'], hitter: ['speed', 'power', 'defense', 'eye'] };

/** Every club's public report after the combine: the measured abilities most of the way to the truth, the future with them. */
export function applyCombine(seed: string, draftYear: number, players: Player[]): Player[] {
  for (const p of players) {
    if (!attends(seed, draftYear, p) || p.scouting.combine) continue;
    const s = p.scouting;
    for (const key of MEASURED[isPitcher(p) ? 'pitcher' : 'hitter']) {
      const now = s.tools[key];
      const truth = p.hidden.current[key];
      if (now == null || truth == null) continue;
      const moved = round5(now + (truth - now) * C.reveal);
      const delta = moved - now;
      s.tools[key] = clamp(moved, 20, 80);
      if (s.futureTools[key] != null) s.futureTools[key] = clamp(round5(s.futureTools[key]! + delta), 20, 80);
    }
    s.current = toGrade(overall(s.tools, p.role));
    s.futureValue = Math.max(s.current, toGrade(overall(s.futureTools, p.role)));
    s.combine = true;
  }
  return players;
}

/** The day of the combine: the article (our club's league only). */
export function combineDay(s: LeagueState, date: string, players: () => Player[]) {
  const key = `${s.year}-combine`;
  if (!s.user || date < `${s.year}-${C.date}` || s.marketDone?.includes(key)) return;
  (s.marketDone ??= []).push(key);
  const came = players().filter((p) => attends(s.seed, s.year, p));
  const best = (label: string) =>
    came
      .map((p) => ({ p, line: combineLines(s.seed, s.year, p).find((l) => l.label === label) }))
      .filter((x): x is { p: Player; line: CombineLine } => !!x.line)
      .sort((a, b) => b.line.score - a.line.score)[0];
  const velo = best(__i18n_k("league.combine.combineDay.velo.b2ea2c6b")),
    sprint = best(__i18n_k("league.combine.combineDay.sprint.ef680577")),
    exit = best(__i18n_k("league.combine.combineDay.exit.fa6a7e4e"));
  addNews(s, {
    id: `combine-${s.year}`,
    date,
    kind: 'month',
    title: __i18n_k("league.combine.combineDay.title.51429558", { year: s.year, length: came.length }),
    body: __i18n_k("league.combine.combineDay.body.5733fa39", { length: came.length, value: velo ? __i18n_k("league.combine.combineDay.body.a10da8d9", { name: velo.p.name, value: velo.line.value }) : '', value2: sprint ? __i18n_k("league.combine.combineDay.body.f86b4c4f", { name: sprint.p.name, value: sprint.line.value }) : '', value3: exit ? __i18n_k("league.combine.combineDay.body.e4449607", { value: iga(`${exit.p.name}(${exit.line.value})`) }) : '' }),
    quotes: [],
    facts: { year: s.year, attended: came.length },
    players: [],
  });
}

// ── Our private workouts ─────────────────────────────────────────────────────────────────────────

/** Prospects we brought in this draft year. */
export const workoutsOf = (s: LeagueState, draftYear: number): PlayerId[] => s.user?.workouts?.[draftYear] ?? [];

/** Why we cannot bring him in now, or null. */
export function checkWorkout(s: LeagueState, draftYear: number, id: PlayerId): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.combine.checkWorkout.272add95");
  if (!id.startsWith(`d${draftYear}-`)) return __i18n_k("league.combine.checkWorkout.a21e72ad");
  if (s.offseason?.draft && s.offseason.year === draftYear) return __i18n_k("league.combine.checkWorkout.4e66852b");
  if (!combineHeld(s, draftYear)) return __i18n_k("league.combine.checkWorkout.2d5c711e", { number: Number(C.date.slice(0, 2)), number2: Number(C.date.slice(3)) });
  const done = workoutsOf(s, draftYear);
  if (done.includes(id)) return __i18n_k("league.combine.checkWorkout.e11fce5e");
  if (done.length >= C.workouts) return __i18n_k("league.combine.checkWorkout.35a057be", { workouts: C.workouts });
  if (u.fund < C.workoutCost) return __i18n_k("league.combine.checkWorkout.2ffbf119");
  return null;
}

/** Brings a prospect in for a private workout and an interview. */
export function workout(s: LeagueState, draftYear: number, id: PlayerId, name: string) {
  if (checkWorkout(s, draftYear, id)) return;
  const u = s.user!;
  ((u.workouts ??= {})[draftYear] ??= []).push(id);
  u.fund -= C.workoutCost;
  u.ledger.push({ year: s.year, label: __i18n_k("league.combine.workout.label.79216ba4", { name: name }), amount: -C.workoutCost });
}
