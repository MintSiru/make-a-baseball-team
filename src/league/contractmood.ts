import { k as __i18n_k } from '../i18n/index';
/* 2.0.39 (the user's request): money moves a player. On opening day each player's mood over his contract is set for
   the season:
   - his walk year (free agency after this season, no deal beyond it): now and then he plays above himself;
   - the first season of a big free-agent deal: now and then he settles — he plays below himself, and that winter
     he loses a step (more likely the less he works, and the bigger the deal);
   - pay far over what his play is worth: now and then the weight of it tells the same way (less so on a strong mind).
   The edge is grade points on his main tools in every game (manager.ts withForm); the winter's loss comes before his
   development. Each player has his own random stream, so nothing else moves with it. */
import { rng } from '../draftroom';
import type { Player } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { salaryIn } from './contracts';
import { iga } from './josa';
import { note } from './life';
import { faSeasonsNeeded } from './offseason';
import { isForeign } from './players';
import type { LeagueState } from './state';
import { traitsOf } from './traits';
import { SALARY } from './tuning';

export type MoodKind = 'walk' | 'settled' | 'pressure';

export const MOOD = {
  /** Walk year: the chance, and the grade points (a range). Players of at least this grade only. */
  walk: { chance: 0.5, edge: [1, 3] as const, minGrade: 45 },
  /** After a free-agent deal: the chance (and its rise for a lazy one and a big deal: 만 원 a season), the edge
      (negative), and the winter's loss on every tool. */
  settled: { base: 0.15, work: 0.35, big: 0.1, bigYearly: 50_000, edge: [1.5, 3.5] as const, loss: [0.5, 2] as const },
  /** Overpaid: pay at least this (만 원) and this many times what his last two seasons are worth. */
  pressure: { floor: 30_000, ratio: 1.6, base: 0.1, mental: 0.3, edge: [1, 2.5] as const, loss: [0.3, 1.2] as const },
};

const between = (r: () => number, [a, b]: readonly [number, number]) => Math.round((a + r() * (b - a)) * 10) / 10;

/** His last two first-team seasons' WAR, the latest counting double. */
function recentWar(p: Player) {
  const recs = p.career.filter((r) => !r.level).slice(-2);
  if (!recs.length) return 0;
  return recs.reduce((a, r, i) => a + r.war * (i + 1), 0) / recs.reduce((a, _, i) => a + i + 1, 0);
}

/** What his play is worth a season (만 원), as a free agent's deal is valued. */
export const playWorth = (p: Player) => 4000 + Math.max(0, recentWar(p)) ** 1.5 * SALARY.freeAgentPerWar;

/** Free agency after this season: no deal beyond it and the seasons in (counting this one). */
export function walkYear(p: Player, year: number): boolean {
  if (isForeign(p) || p.contract?.salaries.some((x) => x.season > year)) return false;
  const need = faSeasonsNeeded(p, year + 1);
  if (need === Infinity) return false;
  const sv = p.service;
  return sv.lastFreeAgencyAt === undefined ? sv.creditedSeasons + 1 >= need : sv.creditedSeasons + 1 - sv.lastFreeAgencyAt >= KBO_2026.freeAgency.seasonsToRequalify;
}

/** The first season of a free-agent deal signed this past winter. */
const freshDeal = (p: Player, year: number) => !!p.contract?.fa && p.contract.signedIn === year - 1;

/** Opening day: every player's mood for the season. */
export function seasonMoods(s: LeagueState) {
  const year = s.year;
  const of: NonNullable<LeagueState['moods']>['of'] = {};
  for (const p of Object.values(s.players)) {
    if (p.status !== 'active' || !p.teamId || isForeign(p)) continue;
    const r = rng(`${s.seed}|mood|${year}|${p.id}`);
    const t = traitsOf(p);
    if (freshDeal(p, year)) {
      const S = MOOD.settled;
      const yearly = salaryIn(p, year);
      const chance = S.base + S.work * (1 - t.work / 100) + (yearly >= S.bigYearly ? S.big : 0);
      if (r() < chance) of[p.id] = { kind: 'settled', edge: -between(r, S.edge) };
      continue;
    }
    if (walkYear(p, year)) {
      if (p.scouting.current >= MOOD.walk.minGrade && r() < MOOD.walk.chance) of[p.id] = { kind: 'walk', edge: between(r, MOOD.walk.edge) };
      continue;
    }
    const P = MOOD.pressure;
    const pay = salaryIn(p, year);
    if (pay >= P.floor && pay >= P.ratio * playWorth(p) && r() < P.base + P.mental * (1 - t.mental / 100)) of[p.id] = { kind: 'pressure', edge: -between(r, P.edge) };
  }
  s.moods = { year, of };
  const u = s.user;
  if (!u) return;
  const date = `${year}-03-20`;
  for (const [id, m] of Object.entries(of)) {
    const p = s.players[id]!;
    if (p.teamId !== u.teamId) continue;
    const text =
      m.kind === 'walk'
        ? __i18n_k("league.contractmood.text.2a394c10", { name: p.name })
        : m.kind === 'settled'
          ? __i18n_k("league.contractmood.text.50852cd8", { name: p.name })
          : __i18n_k("league.contractmood.text.e00620c8", { name: p.name });
    note(p, date, text, m.kind === 'walk' ? 'good' : 'bad');
  }
}

/** His mood's grade points in today's games (0 for none). */
export const moodEdge = (s: LeagueState, p: Player) => (s.moods?.year === s.year ? (s.moods.of[p.id]?.edge ?? 0) : 0);

/** The winter after a settled or pressured season: a step lost on every tool (before his development). */
export function moodWinter(s: LeagueState, p: Player, year: number) {
  const m = s.moods?.year === year ? s.moods.of[p.id] : undefined;
  if (!m || m.kind === 'walk' || p.status !== 'active') return;
  const r = rng(`${s.seed}|mood-loss|${year}|${p.id}`);
  const loss = between(r, m.kind === 'settled' ? MOOD.settled.loss : MOOD.pressure.loss);
  const h = p.hidden.current;
  for (const k of Object.keys(h) as (keyof typeof h)[]) if (h[k] != null) h[k] = Math.max(20, h[k]! - loss);
  const u = s.user;
  if (!u || p.teamId !== u.teamId) return;
  const title = m.kind === 'settled' ? __i18n_k("league.contractmood.text.d3dd8664", { name: iga(p.name) }) : __i18n_k("league.contractmood.text.b0ac1a46", { name: iga(p.name) });
  const line = m.kind === 'settled' ? __i18n_k("league.contractmood.text.b4d68e72") : __i18n_k("league.contractmood.text.f69ce6ae");
  addAlert(s, { id: `mood-${year}-${p.id}`, date: `${year}-12-05`, kind: 'life', title, lines: [line], tone: 'bad', players: [p.id] });
  note(p, `${year}-12-05`, title, 'bad');
}
