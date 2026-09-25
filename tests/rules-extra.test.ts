/* V0.5 rules outside the market: the second draft, the competitive balance tax, Korean particles. */
import { describe, expect, it } from 'vitest';
import { applyPickDrop, capFloorFor } from '../src/league/cap';
import { eulreul, iga, ro } from '../src/league/josa';
import { createLeague } from '../src/league/history';
import { exposable, feeFor, isSecondDraftYear, makeSecondPick, openSecondDraft, secondPool } from '../src/league/seconddraft';
import type { LeagueState } from '../src/league/state';

describe('particles', () => {
  it('follows the final consonant', () => {
    expect(ro('두산')).toBe('두산으로');
    expect(ro('서울')).toBe('서울로');
    expect(ro('LG')).toBe('LG로');
    expect(ro('키움')).toBe('키움으로');
    expect(iga('김민수')).toBe('김민수가');
    expect(iga('박준')).toBe('박준이');
    expect(eulreul('최강')).toBe('최강을');
    expect(eulreul('오스틴')).toBe('오스틴을');
    expect(eulreul('로하스')).toBe('로하스를');
  });
});

describe('competitive balance tax', () => {
  it('has a floor only from 2027', () => {
    expect(capFloorFor(2026)).toBeNull();
    expect(capFloorFor(2027)).toBeGreaterThan(0);
  });
  it('moves a three-time offender nine places down the first round', () => {
    const slots = Array.from({ length: 10 }, (_, i) => ({ teamId: `t${i}` }));
    const s = { pickDrop: { 2027: ['t0'] } } as unknown as LeagueState;
    expect(applyPickDrop(s, 2027, slots).map((x) => x.teamId).indexOf('t0')).toBe(9);
    expect(applyPickDrop(s, 2028, slots)).toEqual(slots);
  });
});

describe('second draft', () => {
  it('runs every other winter from 2023 with falling fees', () => {
    expect([2023, 2024, 2025, 2027].map(isSecondDraftYear)).toEqual([true, false, true, true]);
    expect(feeFor(1)).toBeGreaterThan(feeFor(3));
  });
  it('never offers protected, exempt or already-taken players', () => {
    const s = createLeague('second-test');
    const year = s.year;
    s.history.push({ year, table: s.teams.map((t) => ({ teamId: t.id })) } as never);
    const sd = openSecondDraft(s, year);
    const team = sd.slots[0]!.teamId;
    const pool = secondPool(s, sd, team);
    expect(pool.length).toBeGreaterThan(0);
    for (const p of pool) {
      expect(p.teamId).not.toBe(team);
      expect(sd.protected[p.teamId!]).not.toContain(p.id);
      expect(p.proSince).toBeLessThan(year - 2);
    }
    const first = pool[0]!;
    const from = first.teamId!;
    makeSecondPick(s, sd, first.id);
    expect(s.players[first.id]!.teamId).toBe(team);
    expect(secondPool(s, sd, sd.slots[1]!.teamId).map((p) => p.id)).not.toContain(first.id);
    expect(sd.losses[from]).toBe(1);
    expect(exposable(s, from, year).length).toBeGreaterThan(35);
  });
});
