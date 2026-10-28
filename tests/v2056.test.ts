/* 2.0.56 (the user's requests): a high-school player can go to the army after his first season; the owner's support
   comes in advance when the winter opens (the rookies' bonuses are paid from the fund); each winter's free agents in
   one list. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { faClass, faClassYears } from '../src/league/faclass';
import { ageIn } from '../src/league/players';
import { militaryDecision } from '../src/league/userclub';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { OFFSEASON } from '../src/league/tuning';
import { loadSave } from './helpers';

/** The 2.0.50 save played on into its winter, stopping at the first decision of `kind`. */
function winterUntil(kind: string) {
  const s = loadSave('2.0.50');
  s.pending = null;
  for (let g = 0; g < 3000 && (s.pending as { kind?: string } | null)?.kind !== kind; g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
    else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
    else apply(s, { kind: 'nextSeason' });
  }
  return s;
}

describe('a high-school player after his first season (2.0.56)', () => {
  it('is among the candidates at 19', () => {
    const s = loadSave('2.0.50');
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0 } as never;
    const next = s.year + 1;
    const young = orgPlayers(s, s.user!.teamId).find((p) => p.status === 'active' && p.service.military === 'pending' && ageIn(p, next) < OFFSEASON.military.minAge)!;
    young.birthday = `${next - 20}-08-01`;
    expect(ageIn(young, next)).toBe(19);
    const d = militaryDecision(s);
    expect(d?.kind).toBe('military');
    expect((d as { candidates: string[] }).candidates).toContain(young.id);
  });
});

describe('the owner’s support in advance (2.0.56)', () => {
  it('comes when the winter opens and is settled on opening day', { timeout: 300_000 }, () => {
    const s = winterUntil('rookieBonus');
    const u = s.user!;
    const next = s.offseason!.year + 1;
    expect(u.supportAdvance?.season).toBe(next);
    const advance = u.supportAdvance!.amount;
    expect(advance).toBeGreaterThan(0);
    expect(u.ledger.some((l) => l.amount === advance && l.settlement && l.year === next - 1)).toBe(true);
    // On to opening day: the season's support is what it would have been, the advance part of it.
    for (let g = 0; g < 3000 && !(s.phase === 'regular' && s.year === next && u.seasonSupport?.year === next); g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(u.seasonSupport?.year).toBe(next);
    expect(u.supportAdvance).toBeUndefined();
    const settle = u.ledger.filter((l) => l.year === next && l.settlement && l.label.includes('선지급'));
    expect(settle.length).toBe(1);
    expect(settle[0]!.amount).toBe(u.seasonSupport!.amount - advance);
  });
});

describe('each winter’s free agents (2.0.56)', () => {
  it('the players due before the market, the class with its results after', { timeout: 300_000 }, () => {
    const before = loadSave('2.0.50');
    const due = faClass(before, before.year);
    expect(due.length).toBeGreaterThan(0);
    expect(due.every((r) => r.due)).toBe(true);
    const s = winterUntil('draftPick');
    // Past the market (the draft comes after it in the winter? if not, play on until it closes).
    let x: LeagueState = s;
    for (let g = 0; g < 3000 && !x.faHistory?.length; g++) {
      if (x.pending) apply(x, { kind: 'decide', input: autoDecision(x)! });
      else apply(x, { kind: 'nextSeason' });
    }
    const year = x.faHistory![0]!.year;
    expect(faClassYears(x)).toContain(year);
    const rows = faClass(x, year);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.grade && r.to !== undefined)).toBe(true);
    expect(rows.some((r) => r.to && r.terms?.includes('총액'))).toBe(true);
  });
});
