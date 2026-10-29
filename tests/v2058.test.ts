/* 2.0.58 (the user's report): a free agent of ours still on the market was on our list for the compensation pick;
   left off, he was taken, and signing him again in the market brought him back. A free agent on the market is under
   no club's contract: he is on no list. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { compensationPool, protectedBy, queuedDecision } from '../src/league/market';
import { registeredIds, type LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

describe('a free agent on the market is no one’s compensation (2.0.58)', () => {
  it('neither on our protection list nor in the pool the other club picks from', { timeout: 300_000 }, () => {
    const s: LeagueState = loadSave('2.0.56');
    s.pending = null;
    for (let g = 0; g < 3000 && (s.pending as { kind?: string } | null)?.kind !== 'faRound'; g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    const m = s.offseason!.fa!;
    const me = s.user!.teamId;
    const next = m.year + 1;
    // One of ours on the market (one is made from our best player when the winter has none).
    let ours = m.order.find((id) => m.talks[id]!.from === me && !m.talks[id]!.signed);
    if (!ours) {
      const any = m.order[0]!;
      ours = registeredIds(s, me).find((id) => !m.talks[id])!;
      m.talks[ours] = { ...m.talks[any]!, id: ours, from: me, offers: {}, signed: undefined, gone: undefined };
      m.order.push(ours);
    }
    const other = m.order.map((id) => m.talks[id]!).find((t) => t.from !== me)!;
    const d = queuedDecision(s, { kind: 'protect', fa: other.id, grade: 'A', from: other.from, to: me, salary: 10_000 }, next);
    if (d.kind !== 'faProtect') throw new Error(d.kind);
    expect(d.candidates).not.toContain(ours);
    expect(compensationPool(s, me, new Set(), next).map((p) => p.id)).not.toContain(ours);
    expect(protectedBy(s, me, 'A', next).has(ours)).toBe(false);
    // Once he has signed (with us), he is this winter's signing: still on no list.
    m.talks[ours]!.signed = { teamId: me, day: 1, offer: m.talks[ours]!.price };
    s.players[ours]!.contract = { ...s.players[ours]!.contract!, kind: 'freeAgent', signedIn: next - 1 };
    expect(compensationPool(s, me, new Set(), next).map((p) => p.id)).not.toContain(ours);
  });
});
