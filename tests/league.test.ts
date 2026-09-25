/* A whole league built from a seed: bootstrap, 2015–2025 played, waiting at 2026 opening day.
   Checks structure (rosters follow the rules) and balance (league rates inside the real 2021–2025 range). */
import { beforeAll, describe, expect, it } from 'vitest';
import stats from '../data/kbo-league-stats.json';
import { salaryIn } from '../src/league/contracts';
import { createLeague, GAME_START, HISTORY_START } from '../src/league/history';
import { firstTeamSize } from '../src/league/manager';
import { rosterLimit } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { playDay } from '../src/league/season';
import { developmentIds, orgIds, registeredIds, type LeagueState } from '../src/league/state';
import { OFFSEASON } from '../src/league/tuning';
import { era, obp, slg } from '../src/league/stats';
import type { BatTotals, PitTotals } from '../src/model/types';

let league: LeagueState;
beforeAll(() => {
  league = createLeague('league-test');
}, 120_000);

type Totals = { bat: BatTotals; pit: PitTotals; games: number };
const rates = ({ bat: b, pit: p, games }: Totals) => ({
  avg: b.h / b.ab,
  obp: obp(b),
  slg: slg(b),
  era: era(p),
  runs: b.r / (games * 2),
  hr: b.hr / (games * 2),
  bb: b.bb / b.pa,
  k: b.k / b.pa,
});

// Real league rates for each of the five seasons in data/kbo-league-stats.json.
type Row = Record<string, number>;
const real = ['2021', '2022', '2023', '2024', '2025'].map((y) => {
  const e = (stats as unknown as Record<string, Record<string, { total: Row }>>)[y]!;
  const h = e.hitter1!.total,
    h2 = e.hitter2!.total,
    p = e.pitcher1!.total;
  const tg = h.G! * 2;
  return { avg: h.H! / h.AB!, obp: h2.OBP!, slg: h2.SLG!, era: p.ERA!, runs: h.R! / tg, hr: h.HR! / tg, bb: h2.BB! / h.PA!, k: h2.SO! / h.PA! };
});

describe('league structure at 2026 opening day', () => {
  it('stands at the start of the game year with a full schedule', () => {
    expect(league.year).toBe(GAME_START);
    expect(league.phase).toBe('regular');
    expect(league.schedule).toHaveLength(720);
    expect(league.history.map((h) => h.year)).toEqual(Array.from({ length: GAME_START - HISTORY_START }, (_, i) => HISTORY_START + i));
  });

  it('keeps every club within the rules', () => {
    const seen = new Set<string>();
    for (const t of league.teams) {
      const r = league.rosters[t.id]!;
      const all = orgIds(league, t.id);
      const ids = registeredIds(league, t.id);
      for (const id of all) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
        const p = league.players[id]!;
        expect(p.teamId).toBe(t.id);
        expect(p.status).toBe('active');
      }
      expect(ids.length).toBeLessThanOrEqual(rosterLimit(GAME_START));
      // Development players sit outside the limit, up to the AI clubs' target.
      const dev = developmentIds(league, t.id);
      expect(dev.length).toBeGreaterThan(0);
      expect(dev.length).toBeLessThanOrEqual(OFFSEASON.development.aiTarget);
      expect(dev.every((id) => !r.active.includes(id))).toBe(true);
      expect(r.active).toHaveLength(firstTeamSize(league, t.id));
      const foreign = ids.map((id) => league.players[id]!).filter(isForeign);
      expect(foreign.filter((p) => !p.origin.asiaQuota)).toHaveLength(3);
      expect(foreign.filter((p) => p.origin.asiaQuota)).toHaveLength(1);
      expect(foreign.filter((p) => !p.origin.asiaQuota && ['SP', 'RP'].includes(p.role)).length).toBeLessThanOrEqual(2);
    }
  });

  it('has soldiers away and exemptions from the real 2018 and 2023 Asian Games golds', () => {
    const players = Object.values(league.players);
    expect(players.some((p) => p.status === 'military')).toBe(true);
    expect(league.international.filter((e) => e.year === 2018 || e.year === 2023).every((e) => e.medal)).toBe(true);
    expect(league.international.find((e) => e.year === 2021)?.medal).toBe(false);
    expect(players.some((p) => p.service.military === 'exempt' && !isForeign(p))).toBe(true);
  });

  it('pays salaries on the 2026 scale', () => {
    const domestic = Object.values(league.players).filter((p) => p.status === 'active' && p.teamId && !isForeign(p) && p.career.length > 0);
    const average = domestic.reduce((a, p) => a + salaryIn(p, GAME_START), 0) / domestic.length;
    expect(average).toBeGreaterThan(12_000); // 1.2억 (만 원 단위)
    expect(average).toBeLessThan(24_000); // 2.4억 (real 2026: 1억 7,536만)
    for (const t of league.teams) {
      const pay = [...league.rosters[t.id]!.active, ...league.rosters[t.id]!.futures].reduce((a, id) => a + (isForeign(league.players[id]!) ? 0 : salaryIn(league.players[id]!, GAME_START)), 0);
      expect(pay).toBeLessThan(1_600_000); // 160억 (만 원 단위)
    }
  });
});

describe('league balance against KBO 2021–2025', () => {
  const band = (key: keyof (typeof real)[number], margin: number) => {
    const xs = real.map((r) => r[key]);
    return [Math.min(...xs) * (1 - margin), Math.max(...xs) * (1 + margin)] as const;
  };

  it('averages 2021–2025 inside the real range', () => {
    const sim = league.history.filter((h) => h.year >= 2021).map((h) => rates(h.totals));
    for (const key of Object.keys(real[0]!) as (keyof (typeof real)[number])[]) {
      const mean = sim.reduce((a, r) => a + r[key], 0) / sim.length;
      const [lo, hi] = band(key, 0.06);
      expect(mean, key).toBeGreaterThanOrEqual(lo);
      expect(mean, key).toBeLessThanOrEqual(hi);
    }
  });

  it('keeps every simulated season near the real range', () => {
    for (const h of league.history) {
      const r = rates(h.totals);
      for (const key of Object.keys(r) as (keyof typeof r)[]) {
        const [lo, hi] = band(key, 0.18);
        expect(r[key], `${h.year} ${key}`).toBeGreaterThanOrEqual(lo);
        expect(r[key], `${h.year} ${key}`).toBeLessThanOrEqual(hi);
      }
      expect(h.table[0]!.pct).toBeLessThan(0.72);
      expect(h.table.at(-1)!.pct).toBeGreaterThan(0.25);
      expect(h.champion).not.toBeNull();
    }
  });
});

describe('snapshots', () => {
  it('continue exactly like the original after a JSON round trip', () => {
    const copy: LeagueState = JSON.parse(JSON.stringify(league));
    const original: LeagueState = JSON.parse(JSON.stringify(league));
    for (let i = 0; i < 12; i++) {
      playDay(copy);
      playDay(original);
    }
    expect(copy.scores).toEqual(original.scores);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
  });
});
