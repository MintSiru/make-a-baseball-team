/* 2.0.68 (the user's requests): free agents who signed abroad come home as unattached free agents; a returnee's free
   agency starts over (four seasons); and players who went abroad straight out of high school come back through the
   draft, older and readier, with no signing bonus. */
import { describe, expect, it } from 'vitest';
import { joinMlb } from '../src/league/mlb';
import { isFreeAgent, leaveLeague } from '../src/league/offseason';
import { draftClass, isForeign } from '../src/league/players';
import { DIRECT, freeAgentHomecomings, overseasDirects, restartFreeAgency } from '../src/league/returnees';
import { canSignFromPool, poolAsk, signFromPool } from '../src/league/trade';
import { minimumSalaryFor } from '../src/rules/kbo2026';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

describe('a free agent abroad comes home (2.0.68)', () => {
  it('as an unattached free agent any club may sign, and his free agency starts over', () => {
    const s = loadSave('2.0.66');
    const u = s.user!;
    // Several of the league's veterans signed abroad as free agents some winters ago, their deals long over.
    const year = s.year;
    const gone = Object.values(s.players)
      .filter((p) => p.status === 'active' && !isForeign(p) && p.career.filter((c) => !c.level).length >= 8 && p.scouting.current >= 50)
      .slice(0, 30);
    for (const p of gone) {
      leaveLeague(s, p, 'overseas');
      joinMlb(p, year - 4, { years: 2, total: 4_000_000 });
      p.mlb!.via = 'fa';
      p.birthday = `${year - 30}-05-01`;
    }
    s.phase = 'offseason';
    s.pending = null;
    const free = freeAgentHomecomings(s, year + 1);
    const back = gone.filter((p) => p.mlb!.back === year);
    expect(back.length).toBeGreaterThan(5);
    // Signed by an AI club (a returnee's deal) or waiting in the pool, unattached.
    for (const p of back) expect(p.teamId ? p.teamId !== u.teamId : s.pool!.includes(p.id)).toBe(true);
    for (const p of back.filter((x) => x.teamId)) expect(p.service.lastFreeAgencyAt).toBe(p.service.creditedSeasons);
    expect(free.length).toBeGreaterThan(0);
    expect(s.alerts?.some((a) => a.id === `fa-home-${year + 1}`)).toBe(true);
    // He asks a free agent's money, and signed by us his free agency starts over.
    const p = free[0]!;
    expect(poolAsk(s, p)).toBeGreaterThan(minimumSalaryFor(year + 1));
    expect(canSignFromPool(s, p.id)).toBeNull();
    signFromPool(s, p.id);
    expect(p.teamId).toBe(u.teamId);
    expect(p.service.lastFreeAgencyAt).toBe(p.service.creditedSeasons);
    // Not a free agent after one season: four more.
    p.contract!.salaries = [{ season: year + 1, amount: 10_000 }];
    p.service.creditedSeasons += 1;
    expect(isFreeAgent(p, year + 2)).toBe(false);
    p.service.creditedSeasons += 3;
    expect(isFreeAgent(p, year + 2)).toBe(true);
  });

  it('restarts only a returnee’s free agency', () => {
    const s = loadSave('2.0.66');
    const p = Object.values(s.players).find((x) => x.status === 'active' && !isForeign(x) && x.career.some((c) => !c.level))!;
    delete p.service.lastFreeAgencyAt;
    restartFreeAgency(p);
    expect(p.service.lastFreeAgencyAt).toBeUndefined();
  });
});

describe('straight abroad out of high school, then the draft (2.0.68)', () => {
  it('older and readier than the class, his wait served or at an independent club, no bonus asked', () => {
    const s = loadSave('2.0.66') as LeagueState;
    const made = [];
    for (let y = s.year; y < s.year + 40 && made.length < 6; y++) made.push(...overseasDirects(s, y, (x) => draftClass(s.seed, x, s.unified)));
    expect(made.length).toBeGreaterThan(3);
    for (const p of made) {
      const d = p.origin.draftYear!;
      const age = d + 1 - Number(p.birthday.slice(0, 4));
      expect(age).toBeGreaterThanOrEqual(18 + DIRECT.years[0] + 2);
      expect(p.origin.overseasDirect).toBeTruthy();
      expect(p.status).toBe('amateur');
      expect(p.amateur.intent).toBeUndefined();
      if (p.origin.overseasDirect!.wait === 'military') expect(p.service.military).toBe('served');
      expect(s.players[p.id]).toBe(p);
      // Readier than a high-school senior of his ceiling.
      expect(p.scouting.current).toBeGreaterThan(35);
    }
  });
});
