/* 2.0.86 (the user's request: 해외에서 복귀했다가 계약을 못 해 20대에 은퇴하는 일): a player home from abroad whose rights
   are released and whom no club signs at once goes on the free-agent market if he is under 35 — and, unsigned there,
   on the next winter's again — instead of retiring. From 35, as before. */
import { describe, expect, it } from 'vitest';
import { joinMlb, leaveMlb } from '../src/league/mlb';
import { freeAgentsFor, homeFreeAgent, leaveLeague } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { releaseReturnee } from '../src/league/returnees';
import { clearPool } from '../src/league/trade';
import { orgPlayers } from '../src/league/state';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

/** A player of ours posted some winters ago, home now at `age`, with too little to him for another club (keep value). */
function returnee(s: LeagueState, p: Player, age: number) {
  const year = s.year;
  leaveLeague(s, p, 'overseas');
  p.service.postedIn = year - 3;
  joinMlb(p, year - 3, { years: 2, total: 3_000_000 });
  leaveMlb(p, year, 'back');
  p.birthday = `${year + 1 - age}-05-01`;
  p.status = 'freeAgent';
  // Too little for an AI club to sign at once.
  p.scouting.current = 40;
  p.hidden.current = Object.fromEntries(Object.entries(p.hidden.current).map(([k, v]) => [k, v == null ? v : 30])) as never;
}

describe('2.0.86: a returnee nobody signs does not retire before 35', () => {
  it('under 35: on this winter’s market, and the next if unsigned; 35 and over: retires', () => {
    const s = loadSave('2.0.85');
    const next = s.year + 1;
    const me = s.user!.teamId;
    const [young, old] = orgPlayers(s, me).filter((p) => !isForeign(p) && p.career.some((c) => !c.level));
    returnee(s, young!, 27);
    returnee(s, old!, 36);
    const o = (p: Player) => ({ id: p.id, years: 2, annual: 10000, abroad: 3 });
    // No other club in a position to sign them at once (as when none wants him).
    const was = s.teams.map((t) => t.firstTeamFrom);
    for (const t of s.teams) if (t.id !== me) t.firstTeamFrom = null;
    releaseReturnee(s, young!, o(young!), next);
    releaseReturnee(s, old!, o(old!), next);
    s.teams.forEach((t, i) => (t.firstTeamFrom = was[i]!));
    expect(old!.status).toBe('retired');
    expect(young!.status).toBe('freeAgent');
    expect(homeFreeAgent(young!, next)).toBe(true);
    expect(freeAgentsFor(s, next).map((p) => p.id)).toContain(young!.id);
    // Unsigned on the market (left in the pool), the season over: the next winter's market, not retirement.
    (young!.life ??= {}).unsigned = s.year;
    s.pool = [young!.id];
    s.year = next;
    clearPool(s);
    expect(young!.status).toBe('freeAgent');
    expect(homeFreeAgent(young!, next + 1)).toBe(true);
  });
});
