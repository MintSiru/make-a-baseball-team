/* 2.0.79 (the user's three asks): the AI clubs' trade offers worth more than the player they ask for; the founding
   season's coaching staff chosen by hand; a first signing into a foreign place never filled this season is not one of
   the season's replacements. */
import { describe, expect, it } from 'vitest';
import { rng } from '../src/draftroom';
import { apply } from '../src/league/actions';
import { setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { isForeign } from '../src/league/players';
import { OFFERS, aiOffers } from '../src/league/offers';
import { removeFromRoster } from '../src/league/offseason';
import { orgPlayers, type ExpansionSettings } from '../src/league/state';
import { OPEN_SLOT, canReplaceForeign, firstForeignSigning, foreignMarket, openForeign, pickValue, replaceForeign, tradeValue } from '../src/league/trade';
import { TRADES } from '../src/league/tuning';
import { foreignReplacements } from '../src/rules/kbo2026';
import { loadSave } from './helpers';

describe('2.0.79: the clubs that come to us pay for it', () => {
  it('offers more than the player is worth (the second player at a share), never less', () => {
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const s = loadSave('2.0.78');
      s.pending = null;
      for (const d of ['05-10', '06-05', '07-01', '07-24']) {
        s.user!.tradeOffers = [];
        aiOffers(s, `${s.year}-${d}`, rng(`v2079-offers|${k}|${d}`));
        for (const o of s.user!.tradeOffers ?? []) {
          if (o.block) continue;
          n++;
          const asked = tradeValue(s, s.players[o.give[0]!]!);
          const players = o.get.map((id) => tradeValue(s, s.players[id]!)).sort((a, b) => b - a);
          const given = players.reduce((a, v, i) => a + v * (TRADES.depth[i] ?? 0.4), 0) + (o.extras.picksIn ?? []).reduce((a, r) => a + pickValue(s, o.teamId, r), 0);
          expect(given).toBeGreaterThanOrEqual(asked * OFFERS.fair - 0.05);
        }
      }
    }
    expect(n).toBeGreaterThan(3);
  }, 300_000);
});

const free: ExpansionSettings = { name: '검증 고래', short: '검증', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '검증그룹', stadium: 'existing', promotion: 'afterFutures', difficulty: 'normal', scenario: null };

describe('2.0.79: the founding staff chosen by hand', () => {
  it('asks right after the tryout, with nothing to buy out; whoever is not replaced stays', () => {
    setEra(0);
    let s = apply(apply(createLeague('v2079-staff'), { kind: 'toFounding' }), { kind: 'found', settings: free });
    expect(s.pending?.kind).toBe('tryout');
    s = apply(s, { kind: 'decide', input: autoDecision(s)! });
    const d = s.pending!;
    expect(d.kind).toBe('staff');
    if (d.kind !== 'staff') return;
    expect(d.founding).toBe(true);
    expect(d.rows.every((r) => r.buyout === 0)).toBe(true);
    const u = s.user!;
    const fund = u.fund;
    const manager = d.rows.find((r) => r.role === 'manager')!;
    const pick = manager.candidates[0]!;
    const kept = d.rows.find((r) => r.role !== 'manager')!;
    s = apply(s, { kind: 'decide', input: { kind: 'staff', hires: { manager: pick.id } } });
    const staff = s.clubs![u.teamId]!.staff!;
    expect(staff.manager!.name).toBe(pick.name);
    expect(staff[kept.role]!.name).toBe(kept.current.name);
    expect(staff[kept.role]!.salary).toBe(kept.current.salary);
    // No buyout; only a manager's signing bonus, if any.
    expect(fund - s.user!.fund).toBe(staff.manager!.bonus ?? 0);
    expect(s.user!.staffSeen).toBe(true);
    // Nothing of the winter's (retirements) follows the founding's choice.
    expect(s.pending?.kind === 'retire').toBe(false);
    setEra(0);
  }, 300_000);
});

describe('2.0.79: a first signing into a foreign place is not a replacement', () => {
  it('fills a place never filled this season without using one; a place emptied in the season uses one', () => {
    const s = loadSave('2.0.78');
    s.pending = null;
    const me = s.user!.teamId;
    // One of our regular foreign players never signed this season: his place stands open, never filled.
    const f = orgPlayers(s, me).find((p) => isForeign(p) && !p.origin.asiaQuota && !p.contract?.temp)!;
    removeFromRoster(s, f);
    delete s.players[f.id];
    expect(openForeign(s, me).regular).toBeGreaterThan(0);
    expect(firstForeignSigning(s, me, false)).toBe(true);
    // Every replacement already spent: the first signing still goes through, and uses none.
    (s.foreignChanges ??= {})[me] = foreignReplacements();
    const cand = foreignMarket(s, me).find((p) => !p.origin.asiaQuota)!;
    expect(canReplaceForeign(s, me, OPEN_SLOT, cand.id)).toBeNull();
    replaceForeign(s, me, OPEN_SLOT, cand.id);
    expect(s.players[cand.id]!.teamId).toBe(me);
    expect(s.foreignChanges![me]).toBe(foreignReplacements());
    // Every other never-filled place filled too (the fixture's club had one more open).
    for (let i = 0; i < 4 && openForeign(s, me).regular > 0 && firstForeignSigning(s, me, false); i++) {
      const more = foreignMarket(s, me).find((p) => !p.origin.asiaQuota && s.players[p.id]?.teamId !== me)!;
      replaceForeign(s, me, OPEN_SLOT, more.id);
    }
    expect(s.foreignChanges![me]).toBe(foreignReplacements());
    // One let go in the season: his place filled again is a replacement.
    s.foreignChanges![me] = foreignReplacements() - 1;
    const out = s.players[cand.id]!;
    apply(s, { kind: 'release', id: out.id } as never);
    expect(s.players[out.id]?.teamId ?? null).not.toBe(me);
    expect(firstForeignSigning(s, me, false)).toBe(false);
    const next = foreignMarket(s, me).find((p) => !p.origin.asiaQuota && s.players[p.id]?.teamId !== me)!;
    expect(canReplaceForeign(s, me, OPEN_SLOT, next.id)).toBeNull();
    replaceForeign(s, me, OPEN_SLOT, next.id);
    expect(s.foreignChanges![me]).toBe(foreignReplacements());
    // And with none left, the next refill waits.
    const after = foreignMarket(s, me).find((p) => !p.origin.asiaQuota && s.players[p.id]?.teamId !== me);
    if (after && openForeign(s, me).regular > 0) expect(canReplaceForeign(s, me, OPEN_SLOT, after.id)).not.toBeNull();
  }, 300_000);
});
