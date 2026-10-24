/* 2.0.45 (the user's request): our players marked not for sale (NFS) — the AI clubs stop asking for them. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { aiOffers, isNotForSale, liveOffers, notForSale } from '../src/league/offers';
import { tradableOf, tradeValue } from '../src/league/trade';
import { rng } from '../src/draftroom';
import type { LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

/** The 2.0.41 save in May, with the trade window open and no offers yet. */
const may = (): LeagueState => {
  const s = loadSave('2.0.41');
  s.pending = null;
  s.user!.tradeOffers = [];
  s.next = s.schedule.findIndex((g) => g.date >= `${s.year}-05-10`);
  return s;
};
/** The players the clubs ask for over a number of offer days. */
const asked = new Set<string>();
const ask = (s: LeagueState, rounds: number) => {
  for (let i = 0; i < rounds; i++) {
    s.user!.tradeOffers = [];
    aiOffers(s, `${s.year}-05-10`, rng(`v2045|${i}`));
    for (const o of liveOffers(s)) asked.add(o.give[0]!);
  }
};

describe('not for sale (2.0.45)', () => {
  it('keeps the clubs off the players we mark, and they ask for others instead', () => {
    const s = may();
    const u = s.user!;
    // Unmarked, the clubs come for our best.
    asked.clear();
    ask(s, 40);
    expect(asked.size).toBeGreaterThan(0);
    const wanted = [...asked];
    // Every one they asked for marked: they never ask for those again, and still come with offers.
    for (const id of wanted) apply(s, { kind: 'notForSale', id, on: true });
    expect(new Set(notForSale(s))).toEqual(new Set(wanted));
    asked.clear();
    ask(s, 40);
    expect(asked.size).toBeGreaterThan(0);
    for (const id of asked) expect(wanted).not.toContain(id);
    // Our best by trade value, if it was asked for, is among the ones left alone now.
    const best = tradableOf(s, u.teamId).sort((a, b) => tradeValue(s, b) - tradeValue(s, a))[0]!;
    if (wanted.includes(best.id)) expect(asked.has(best.id)).toBe(false);
  });

  it('withdraws an offer standing for him, lifts with a click, and lets go of a player who leaves', () => {
    const s = may();
    for (let i = 0; i < 20 && !liveOffers(s).length; i++) aiOffers(s, `${s.year}-05-10`, rng(`v2045-standing|${i}`));
    const offer = liveOffers(s)[0]!;
    expect(offer).toBeTruthy();
    const id = offer.give[0]!;
    apply(s, { kind: 'notForSale', id, on: true });
    expect(isNotForSale(s, id)).toBe(true);
    expect(liveOffers(s).some((o) => o.give.includes(id))).toBe(false);
    apply(s, { kind: 'notForSale', id, on: false });
    expect(isNotForSale(s, id)).toBe(false);
    // Only ours: another club's player cannot be marked, and one of ours who leaves drops off the list.
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== s.user!.teamId)!;
    apply(s, { kind: 'notForSale', id: theirs.id, on: true });
    expect(notForSale(s)).not.toContain(theirs.id);
    apply(s, { kind: 'notForSale', id, on: true });
    s.players[id]!.teamId = offer.teamId;
    expect(notForSale(s)).not.toContain(id);
  });
});
