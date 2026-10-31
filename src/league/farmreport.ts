import { k as __i18n_k } from '../i18n/index';
/* 2.0.66 (the user's request): the coaches' monthly report on our futures (2군) and reserve (잔류군) players — how the
   month's training went (훈련 성과), how he went about it (훈련 태도), what got better and what still needs work, and
   what the farm coaches advise (call him up, push him, ease off, patience).

   - Each first game day of a month (and at the end of the regular season) for the month before: every player of ours
     below the first team. The result leans on his work ethic (성실성), how hard he trains (drills.ts), the farm staff,
     his month in the futures league and luck; the attitude on his work ethic, his mood and how the intensity sits
     with him. A player hard at it now and then hurts something in training (a few days).
   - The season's results count in the winter: a good season of reports grows him a little more, a poor one a little
     less (at most ±8%, with the intensity's own share on top; offseason.ts).
   - The reports are kept for the season (the training tab shows them month by month); the text is made when shown
     (data only in the save). The user's club only. Game assumptions throughout. */
import { rng, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { INTENSITY, intensityOf, programOf, programTools } from './drills';
import { ageIn, isForeign, isPitcher } from './players';
import { staffEdge, staffRating } from './staff';
import { traitsOf } from './traits';
import type { LeagueState } from './state';

export const FARM = {
  /** The month's score (0–100): from 50, work ethic (per point over 50), the farm staff (per edge), luck (sd). */
  work: 0.45,
  staff: 6,
  luck: 9,
  /** A good or poor month in the futures league (at most this much either way). */
  play: 10,
  /** The attitude: work ethic (per point), luck; hard training on a player of little work ethic. */
  attitudeWork: 0.6,
  attitudeLuck: 8,
  hardOnLazy: 10,
  /** A training injury in a month of hard work (per month), its days. */
  hurt: { chance: 0.03, days: [4, 14] as [number, number] },
  /** The winter: at most this share more or less growth from the season's average score. */
  growth: 0.08,
  /** Grades: A from 75, B from 62, C from 48, D from 35. */
  grades: [75, 62, 48, 35],
};

export type FarmNoteKind = 'ops' | 'hr' | 'era' | 'kbb' | 'focus' | 'rehab' | 'attitude' | 'weak' | 'walks' | 'strikeouts' | 'slump' | 'noGames' | 'tired' | 'steady';
export interface FarmNote {
  k: FarmNoteKind;
  v?: number;
  t?: ToolKey;
}
export type FarmAdvice = 'callUp' | 'harder' | 'lighter' | 'patience' | 'keep';

export interface FarmRow {
  id: PlayerId;
  squad: 'futures' | 'third';
  /** The month's training result and attitude, 0–100. */
  score: number;
  attitude: number;
  good: FarmNote[];
  work: FarmNote[];
  advice: FarmAdvice;
  /** Days out hurt in training this month. */
  hurt?: number;
  /** The month's futures line in brief: games, and PA/H/HR/OPS×1000 or outs/ER/K/BB. */
  line?: { g: number; bat?: [number, number, number, number]; pit?: [number, number, number, number] };
}

export interface FarmMonth {
  /** 'YYYY-MM'. */
  month: string;
  rows: FarmRow[];
}

export interface FarmState {
  season: number;
  months: FarmMonth[];
  /** The season's scores so far. */
  score: Record<PlayerId, { sum: number; n: number }>;
  /** Third-squad days counted at the last report (FuturesSeason.training is the season's running count). */
  days?: Record<PlayerId, number>;
}

export const farmGrade = (score: number) => ['A', 'B', 'C', 'D'][FARM.grades.findIndex((g) => score >= g)] ?? 'E';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const normal = (r: () => number) => {
  let x = 0;
  for (let i = 0; i < 6; i++) x += r();
  return x - 3;
};
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** His public grade in each ability his side uses, the lowest first. */
function weakest(p: Player): ToolKey | undefined {
  const keys: ToolKey[] = isPitcher(p) ? ['stuff', 'command', 'breaking', 'stamina'] : ['contact', 'power', 'eye', 'speed', 'defense'];
  const t = p.scouting.tools as Partial<Record<ToolKey, number>>;
  return [...keys].filter((k) => t[k] != null).sort((a, b) => t[a]! - t[b]!)[0];
}

/** The month `month` ('YYYY-MM') for ours below the first team, written on `date` (the day after it). */
export function farmMonth(s: LeagueState, month: string, date: string) {
  const u = s.user;
  const f = s.futures;
  if (!u || !f) return;
  const r0 = s.rosters[u.teamId];
  if (!r0) return;
  const farm: FarmState = u.farm?.season === s.year ? u.farm : { season: s.year, months: [], score: {} };
  if (farm.months.some((m) => m.month === month)) return;
  u.farm = farm;
  const mm = month.slice(5, 7);
  const staff = staffEdge(staffRating(s, u.teamId, 'farm'));
  const days = (farm.days ??= {});
  const rows: FarmRow[] = [];
  for (const [squad, ids] of [
    ['futures', r0.futures],
    ['third', r0.third],
  ] as const) {
    for (const id of ids) {
      const p = s.players[id];
      if (!p || p.status !== 'active' || (isForeign(p) && !p.origin.devForeign)) continue;
      const r = rng(`${s.seed}|farm|${month}|${id}`);
      const t = traitsOf(p);
      const intensity = intensityOf(p);
      const m = f.lines[id]?.months?.[mm];
      const hurtNow = s.injuries[id];
      const trained = (f.training[id] ?? 0) - (days[id] ?? 0);
      days[id] = f.training[id] ?? 0;
      const good: FarmNote[] = [];
      const work: FarmNote[] = [];
      // The month in the futures league.
      let play = 0;
      let line: FarmRow['line'];
      if (m?.bat && m.bat.pa > 0 && !isPitcher(p)) {
        const b = m.bat;
        const obp = (b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf);
        const slg = (b.h + b.d + 2 * b.t + 3 * b.hr) / Math.max(1, b.ab);
        const ops = obp + slg;
        line = { g: b.g, bat: [b.pa, b.h, b.hr, Math.round(ops * 1000)] };
        if (b.pa >= 20) {
          play = clamp((ops - 0.7) * 40, -FARM.play, FARM.play);
          if (ops >= 0.85) good.push({ k: 'ops', v: Math.round(ops * 1000) });
          else if (ops < 0.55) work.push({ k: 'slump', v: Math.round(ops * 1000) });
          if (b.k / b.pa >= 0.28) work.push({ k: 'strikeouts', v: Math.round((b.k / b.pa) * 100) });
        }
        if (b.hr >= 3) good.push({ k: 'hr', v: b.hr });
      } else if (m?.pit && m.pit.outs > 0 && isPitcher(p)) {
        const q = m.pit;
        const era = (27 * q.er) / q.outs;
        line = { g: q.g, pit: [q.outs, q.er, q.k, q.bb] };
        if (q.outs >= 30) {
          play = clamp((4.5 - era) * 3, -FARM.play, FARM.play);
          if (era <= 3) good.push({ k: 'era', v: Math.round(era * 100) });
          else if (era >= 6.5) work.push({ k: 'slump', v: Math.round(era * 100) });
          if (q.bb > 0 && q.k / q.bb >= 3) good.push({ k: 'kbb', v: Math.round((q.k / q.bb) * 10) });
          if ((27 * q.bb) / q.outs >= 5) work.push({ k: 'walks', v: Math.round(((27 * q.bb) / q.outs) * 10) });
        }
      } else if (!hurtNow && squad === 'third' && trained > 0) work.push({ k: 'noGames' });
      // The month's training and attitude.
      let attitude = 50 + (t.work - 50) * FARM.attitudeWork + normal(r) * FARM.attitudeLuck + (p.life?.form ? Math.sign(p.life.form.delta) * 4 : 0);
      if (intensity === 'hard' && t.work < 45) attitude -= FARM.hardOnLazy;
      attitude = Math.round(clamp(attitude, 0, 100));
      let score = 50 + (t.work - 50) * FARM.work + staff * FARM.staff + normal(r) * FARM.luck + play + INTENSITY[intensity].score + (attitude - 50) * 0.15;
      if (hurtNow && !hurtNow.dtd) score = 45 + normal(r) * 6 + staff * FARM.staff;
      score = Math.round(clamp(score, 0, 100));
      if (hurtNow && !hurtNow.dtd) good.push({ k: 'rehab', v: Math.max(0, Math.round((Date.parse(hurtNow.until) - Date.parse(date)) / 86400000)) });
      const focus = programTools(programOf(p));
      if (score >= 60 && !hurtNow) good.push(focus.length ? { k: 'focus', t: focus[0] } : { k: 'focus' });
      if (attitude >= 72) good.push({ k: 'attitude' });
      const weak = weakest(p);
      if (weak && !focus.includes(weak)) work.push({ k: 'weak', t: weak });
      if (intensity === 'hard' && attitude < 45) work.push({ k: 'tired' });
      // Nothing stood out but he kept at it.
      if (!good.length && !hurtNow && attitude >= 50) good.push({ k: 'steady' });
      // A training injury in a month of hard work.
      let hurt: number | undefined;
      if (intensity === 'hard' && !hurtNow && r() < FARM.hurt.chance) {
        const [lo, hi] = FARM.hurt.days;
        hurt = lo + Math.floor(r() * (hi - lo + 1));
        const part = isPitcher(p) ? __i18n_k("league.farmreport.text.f085c67c") : __i18n_k("league.farmreport.text.228bf02d");
        s.injuries[id] = { until: addDays(date, hurt), days: hurt, onList: false, part };
        (p.injuries ??= []).push({ date, days: hurt, part });
      }
      const goodPlay = good.some((n) => n.k === 'ops' || n.k === 'era');
      const advice: FarmAdvice =
        hurtNow || hurt
          ? 'patience'
          : squad === 'futures' && score >= 70 && goodPlay
            ? 'callUp'
            : intensity === 'hard' && attitude < 45
              ? 'lighter'
              : intensity !== 'hard' && attitude >= 65 && ageIn(p, s.year) <= 27
                ? 'harder'
                : score < 40
                  ? 'patience'
                  : 'keep';
      const sc = (farm.score[id] ??= { sum: 0, n: 0 });
      if (!hurtNow || hurtNow.dtd) {
        sc.sum += score;
        sc.n++;
      }
      rows.push({ id, squad, score, attitude, good: good.slice(0, 3), work: work.slice(0, 2), advice, ...(hurt ? { hurt } : {}), ...(line ? { line } : {}) });
    }
  }
  if (!rows.length) return;
  rows.sort((a, b) => b.score - a.score);
  farm.months.push({ month, rows });
  const n = Number(mm);
  const top = rows.filter((x) => x.advice === 'callUp').map((x) => s.players[x.id]!.name);
  const best = rows.slice(0, 3).map((x) => `${s.players[x.id]!.name}(${farmGrade(x.score)})`);
  addAlert(s, {
    id: `farm-${month}`,
    date,
    kind: 'season',
    title: __i18n_k("league.farmreport.text.3782e056", { n }),
    lines: [__i18n_k("league.farmreport.text.5e97d28f", { n: rows.length, names: best.join(', ') }), ...(top.length ? [__i18n_k("league.farmreport.text.74156b44", { names: top.join(', ') })] : []), __i18n_k("league.farmreport.text.56db7f32")],
    players: rows.slice(0, 3).map((x) => x.id),
    minor: true,
  });
}

/** The winter's growth for his training: the intensity, and for ours the season's reports (offseason.ts). */
export function trainingGrowth(s: LeagueState, p: Player, year: number): number {
  const k = INTENSITY[intensityOf(p)].growth;
  const u = s.user;
  const sc = u?.farm?.season === year && p.teamId === u.teamId ? u.farm.score[p.id] : undefined;
  if (!sc || sc.n < 2) return k;
  return k * (1 + clamp((sc.sum / sc.n - 50) / 50, -1, 1) * FARM.growth);
}
