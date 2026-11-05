/* 2.0.78 (the user's request): a posted player coming home to us — the owner may be asked for more payroll budget on
   that screen, and one the budget cannot take now may have his rights kept a year rather than released. */
import { describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { joinMlb } from '../src/league/mlb';
import { removeFromRoster } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { canHoldReturnee, homecomings } from '../src/league/returnees';
import { orgPlayers } from '../src/league/state';
import { checkAnnual } from '../src/league/userclub';
import { loadSave } from './helpers';

describe('2.0.78: a posted player’s rights kept a year', () => {
  it('plays one more season abroad and comes home to us the next winter, once', () => {
    const s = loadSave('2.0.76');
    const me = s.user!.teamId;
    const year = s.year;
    const gone = orgPlayers(s, me)
      .filter((p) => !isForeign(p) && p.status === 'active' && p.career.at(-1)?.teamId === me && !p.career.at(-1)?.level)
      .slice(0, 8);
    for (const p of gone) {
      removeFromRoster(s, p);
      p.teamId = null;
      p.contract = null;
      p.status = 'overseas';
      p.service.postedIn = year - 8;
      joinMlb(p, year - 8, { years: 2, total: 2_000_000 });
      p.birthday = `${year - 32}-05-01`;
    }
    s.phase = 'offseason';
    const rows = homecomings(s, year + 1);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0]!;
    const p = s.players[row.id]!;
    expect(canHoldReturnee(p)).toBe(true);
    s.pending = { kind: 'returnee', rows };
    s.offseason ??= { year } as never;
    // Kept, not signed or released.
    expect(checkAnnual(s, s.pending, { kind: 'returnee', ids: [row.id], hold: [row.id] })).not.toBeNull();
    apply(s, { kind: 'decide', input: { kind: 'returnee', ids: [], hold: [row.id] } });
    expect(p.status).toBe('overseas');
    expect(p.teamId).toBeNull();
    expect(p.mlb!.back).toBeUndefined();
    expect(p.service.homeHeld).toBe(year);
    expect(p.service.agedAbroad).toBe(year);
    // The rest, neither signed nor kept, are released (signed elsewhere, or their careers over).
    for (const r of rows.slice(1)) expect(s.players[r.id]?.teamId ?? null).not.toBe(me);
    // Next winter: a season abroad, and home to us again for sure; aged one more winter, not all of them again.
    s.year = year + 1;
    s.offseason = { year: year + 1 } as never;
    s.pending = null;
    const again = homecomings(s, year + 2);
    const r2 = again.find((x) => x.id === p.id)!;
    expect(r2).toBeDefined();
    expect(p.mlb!.seasons.some((x) => x.year === year + 1)).toBe(true);
    expect(p.service.agedAbroad).toBe(year + 1);
    expect(r2.abroad).toBe(row.abroad + 1);
    // Once only.
    expect(canHoldReturnee(p)).toBe(false);
    expect(checkAnnual(s, { kind: 'returnee', rows: again }, { kind: 'returnee', ids: [], hold: [p.id] })).not.toBeNull();
  });
});
