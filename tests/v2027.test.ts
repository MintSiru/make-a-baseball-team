/* 2.0.27: bench-clearing fixes, family odds, failure popups, the foreign pool and unsigned free agents. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { BRAWL, brawlGame } from '../src/league/brawl';
import type { GameOut, TeamBox } from '../src/league/engine/types';
import { FAMILY } from '../src/league/family';
import { foreignPoolPlayers } from '../src/league/foreignpool';
import { createLeague } from '../src/league/history';
import { isForeign, isPitcher } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { canSignFromPool, poolAsk } from '../src/league/trade';

const found = (s: LeagueState) => {
  apply(s, { kind: 'toFounding' });
  apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
};

const box = (teamId: string, batter: string, pitcher: string): TeamBox =>
  ({ teamId, runs: 0, hits: 0, errors: 0, lineScore: [], batting: [{ id: batter, hbp: 1 }], pitching: [{ id: pitcher, hbp: 1 }] }) as unknown as TeamBox;

describe('the benches clearing (2.0.27)', () => {
  it('puts the pitcher who threw it back on his own club, the second batter hit charges, and fines are in millions', () => {
    const s = createLeague('v2027-brawl');
    found(s);
    const of = (team: string, pitcher: boolean) => Object.values(s.players).find((p) => p.teamId === team && p.status === 'active' && isPitcher(p) === pitcher && !isForeign(p))!;
    const [homeBat, homePit, awayBat, awayPit] = [of('lg', false), of('lg', true), of('doosan', false), of('doosan', true)];
    // Every hit-back game: find one that clears, and one that ends in a scuffle.
    let payback = 0;
    for (let i = 0; i < 4000 && payback < 30; i++) {
      const out = { gameId: `g${i}`, innings: 9, result: 'home', home: box('lg', homeBat.id, homePit.id), away: box('doosan', awayBat.id, awayPit.id) } as unknown as GameOut;
      const b = brawlGame(s, out, `g${i}`, '2027-05-01');
      if (!b?.back) continue;
      payback++;
      // The side hit first answers through its own pitcher: he is banned for his own club.
      expect(b.back).toBe(b.hit);
      const avenger = b.bans.find((x) => x.why === 'payback')!;
      expect(avenger.teamId).toBe(b.hit);
      expect(avenger.id).toBe(b.hit === 'lg' ? homePit.id : awayPit.id);
      // The batter who charged is the other club's (the one hit in return).
      for (const x of b.bans.filter((x) => x.why !== 'payback' && !isPitcher(s.players[x.id]!))) expect(x.teamId).not.toBe(b.hit);
      for (const x of b.bans) expect(x.fine).toBeLessThanOrEqual(BRAWL.bans.fight.fine[1]!);
    }
    expect(payback).toBeGreaterThan(5);
    const news = (s.news ?? []).find((n) => n.id.startsWith('brawl-') && n.body.includes('투수'))!;
    expect(news.body).not.toMatch(/가의|이의/);
    expect(news.body).toMatch(/던져 퇴장|벌여 퇴장|휘둘러 퇴장/);
  });
});

describe('family odds (2.0.27)', () => {
  it('twins are rare and sons commoner than twins', () => {
    expect(FAMILY.twin).toBeLessThan(FAMILY.son / 5);
    expect(FAMILY.brother).toBeLessThan(0.02);
  });
});

describe('the foreign pool and unsigned free agents (2.0.27)', () => {
  it('a club does not see the foreigners it let go', () => {
    const s = createLeague('v2027-pool');
    found(s);
    const p = Object.values(s.players).find((x) => isForeign(x) && x.status === 'active')!;
    p.status = 'freeAgent';
    p.teamId = null;
    s.foreignPool = [{ id: p.id, since: s.year, from: 'new', usd: 1_000_000 }];
    expect(foreignPoolPlayers(s).map((x) => x.id)).toContain(p.id);
    expect(foreignPoolPlayers(s, 'new').map((x) => x.id)).not.toContain(p.id);
    expect(foreignPoolPlayers(s, 'lg').map((x) => x.id)).toContain(p.id);
  });

  it('an unsigned free agent waits for the season and keeps his market price', () => {
    const s = createLeague('v2027-unsigned');
    found(s);
    const p = Object.values(s.players).find((x) => !isForeign(x) && x.status === 'active' && x.teamId === 'lg')!;
    p.teamId = null;
    p.contract = null;
    p.life = { ...(p.life ?? {}), unsigned: s.year, unsignedAsk: 0 };
    s.pool = [p.id];
    const renewal = poolAsk(s, p);
    p.life.unsignedAsk = renewal * 10;
    // (In the season the ask is for what is left of it.)
    expect(poolAsk(s, p)).toBeGreaterThan(renewal * 2);
    s.phase = 'offseason';
    s.offseason = { ...(s.offseason ?? {}), year: s.year, faDone: true } as LeagueState['offseason'];
    expect(canSignFromPool(s, p.id)).toMatch(/개막/);
  });
});
