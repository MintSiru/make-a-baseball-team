/* 2.0.69 (the user's request): the Larry Bird rule, a board rule in force from the start. A club re-signing its own
   free agent of three seasons or more may go over the salary cap, and the deal counts half against it. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { BIRD, birdResign, birdRuleOn, hasBirdRights } from '../src/league/bird';
import { currentValue, ruleLabel, setRule } from '../src/league/board';
import { capTotal } from '../src/league/cap';
import { capPay } from '../src/league/contracts';
import { setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { signTalk, splitOffer, guaranteed } from '../src/league/fa';
import { isForeign } from '../src/league/players';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

describe('the Larry Bird rule (2.0.69)', () => {
  it('stands from the start, and the general manager (or the board) may take it away', () => {
    const s = loadSave('2.0.67');
    setEra(s);
    const next = s.year + 1;
    expect(birdRuleOn(next)).toBe(true);
    expect(currentValue(s, 'birdRule', next)).toBe(1);
    expect(ruleLabel('birdRule')).toBe('래리 버드 룰');
    if (s.board) s.board.on = false;
    setRule(s, 'birdRule', 0);
    setEra(s);
    expect(birdRuleOn(next)).toBe(false);
    expect(birdRuleOn(s.year)).toBe(true);
    expect(currentValue(s, 'birdRule', next)).toBe(0);
  });

  it('counts a deal under it half against the salary cap, while it stands', () => {
    const s = loadSave('2.0.67');
    setEra(s);
    const u = s.user!;
    const year = s.year;
    const p = Object.values(s.players)
      .filter((x) => x.teamId === u.teamId && !isForeign(x) && capPay(x, year) > 0)
      .sort((a, b) => capPay(b, year) - capPay(a, year))[0]!;
    const before = capTotal(s, u.teamId, year);
    const pay = capPay(p, year);
    p.contract!.fa = { ...(p.contract!.fa ?? { years: 1, options: 0, incentive: 'games', paid: [] }), bird: true };
    const after = capTotal(s, u.teamId, year);
    expect(before - after).toBeGreaterThanOrEqual(Math.round(pay * BIRD.share) - pay * 0.02);
    // Without the rule, it counts in full again.
    s.board = { on: false, since: year - 5, changes: [{ from: year - 1, item: 'birdRule', value: 0 }], log: [] };
    setEra(s);
    expect(capTotal(s, u.teamId, year)).toBe(before);
  });

  it('marks his own club’s re-signing, not another club’s, and lets an AI club keep him over the cap', { timeout: 300_000 }, () => {
    const s: LeagueState = loadSave('2.0.67');
    s.pending = null;
    for (let g = 0; g < 3000 && (s.pending as { kind?: string } | null)?.kind !== 'faRound'; g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    setEra(s);
    const m = s.offseason!.fa!;
    const next = m.year + 1;
    const open = m.order.map((id) => m.talks[id]!).filter((t) => !t.signed && !t.gone);
    const veterans = open.filter((t) => hasBirdRights(s.players[t.id]!, t.from));
    expect(veterans.length).toBeGreaterThan(1);
    // His own club keeps him: under the rule.
    const a = veterans[0]!;
    const pa = s.players[a.id]!;
    expect(birdResign(pa, a.from, a.from, next)).toBe(true);
    signTalk(s, m, a, a.from, splitOffer(guaranteed(a.price), a.price.years, 0.3, 0, next), 1, next);
    expect(pa.contract?.fa?.bird).toBe(true);
    // Another club signs one: not under it.
    const b = veterans[1]!;
    const other = s.teams.find((t) => t.id !== b.from && s.rosters[t.id])!.id;
    expect(birdResign(s.players[b.id]!, b.from, other, next)).toBe(false);
    signTalk(s, m, b, other, splitOffer(guaranteed(b.price), b.price.years, 0.3, 0, next), 1, next);
    expect(s.players[b.id]!.contract?.fa?.bird).toBeUndefined();
    // A player with fewer than three seasons at the club has no Bird rights.
    const young = Object.values(s.players).find((p) => p.teamId && p.status === 'active' && new Set(p.career.filter((c) => c.teamId === p.teamId).map((c) => c.year)).size < BIRD.seasons)!;
    expect(hasBirdRights(young, young.teamId)).toBe(false);
  });
});
