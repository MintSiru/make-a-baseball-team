/* 2.0.46 (the user's request): the AI clubs keep players not for sale (NFS) too — nobody trades for them, we or the
   other AI clubs. */
import { describe, expect, it } from 'vitest';
import { aiOffers, liveOffers } from '../src/league/offers';
import { AI_NFS, aiNotForSale, clubNotForSale } from '../src/league/nfs';
import { ageIn, currentValue, futureValue } from '../src/league/players';
import { firstTeamIds, type LeagueState } from '../src/league/state';
import { clubStrategy } from '../src/league/strategy';
import { aiDeadlineDeals, aiTrades, checkTrade, tradableOf, tradeValue } from '../src/league/trade';
import { rng } from '../src/draftroom';
import { TRADES } from '../src/league/tuning';
import { loadSave } from './helpers';

/** The 2.0.41 save in May, with the trade window open and no offers yet. */
const may = (): LeagueState => {
  const s = loadSave('2.0.41');
  s.pending = null;
  s.user!.tradeOffers = [];
  s.next = s.schedule.findIndex((g) => g.date >= `${s.year}-05-10`);
  return s;
};
const aiClubs = (s: LeagueState) => firstTeamIds(s).filter((id) => id !== s.user?.teamId && s.rosters[id]);

describe('the AI clubs keep players not for sale (2.0.46)', () => {
  it('three a club cannot do without, by its plan', () => {
    const s = may();
    for (const id of aiClubs(s)) {
      const kept = aiNotForSale(s, id).map((x) => s.players[x]!);
      expect(kept.length).toBe(AI_NFS.count);
      expect(kept.every((p) => p.teamId === id)).toBe(true);
      const mode = clubStrategy(s, id).mode;
      const others = tradableOf(s, id).filter((p) => !kept.includes(p));
      // A contender its best now; a rebuilding club its best young players.
      if (mode === 'contend') for (const p of others) expect(currentValue(p)).toBeLessThanOrEqual(Math.min(...kept.map(currentValue)));
      if (mode === 'rebuild') for (const p of kept) expect(ageIn(p, s.year)).toBeLessThanOrEqual(AI_NFS.youngAge);
      if (mode === 'rebuild') for (const p of others.filter((q) => ageIn(q, s.year) <= AI_NFS.youngAge)) expect(futureValue(p)).toBeLessThanOrEqual(Math.min(...kept.map(futureValue)));
    }
    // Ours are only the ones we marked.
    expect(clubNotForSale(s, s.user!.teamId)).toEqual([]);
  });

  it('we cannot trade for one, at any price', () => {
    const s = may();
    const club = aiClubs(s)[0]!;
    const star = aiNotForSale(s, club)[0]!;
    const ours = tradableOf(s, s.user!.teamId).sort((a, b) => tradeValue(s, b) - tradeValue(s, a)).slice(0, 3).map((p) => p.id);
    const check = checkTrade(s, club, ours, [star]);
    expect(check.accepted).toBe(false);
    expect(check.problem).toContain('NFS');
    expect(check.problem).toContain(s.players[star]!.name);
  });

  it('their offers to us never include one', () => {
    const s = may();
    let seen = 0;
    for (let i = 0; i < 30; i++) {
      s.user!.tradeOffers = [];
      aiOffers(s, `${s.year}-05-10`, rng(`v2046-offers|${i}`));
      for (const o of liveOffers(s)) {
        seen++;
        const kept = aiNotForSale(s, o.teamId);
        for (const id of o.get) expect(kept).not.toContain(id);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the AI clubs do not trade them among themselves', () => {
    const base = may();
    // One deal a call, each from the same day: a club's list is the one it had when it dealt (a deal can change it).
    const ai = TRADES.ai as Record<'perSeason' | 'deadline' | 'chance', number>;
    const was = { ...ai };
    Object.assign(ai, { perSeason: 1, deadline: 1, chance: 1 });
    let moved = 0;
    for (let i = 0; i < 40; i++) {
      const s = structuredClone(base);
      const kept = new Set(aiClubs(s).flatMap((id) => aiNotForSale(s, id)));
      const before = new Map(Object.values(s.players).map((p) => [p.id, p.teamId]));
      if (i % 2) aiTrades(s, rng(`v2046-ai|${i}`));
      else aiDeadlineDeals(s, rng(`v2046-deadline|${i}`));
      for (const p of Object.values(s.players)) {
        if (before.get(p.id) === p.teamId) continue;
        moved++;
        expect(kept.has(p.id), `${p.name} moved`).toBe(false);
      }
    }
    Object.assign(ai, was);
    expect(moved).toBeGreaterThan(0);
  });
});
