/* 2.0.60 (the user's requests): the general manager's priority before leaving a draft pick to the scouts, and the
   foreign players' dollars shown with the won they come to. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { autoDecision, checkDecision } from '../src/league/expansion';
import { draftPathOf, fitsPrefer, type DraftPathway } from '../src/league/offseason';
import type { LeagueState } from '../src/league/state';
import { MANWON_PER_USD } from '../src/league/contracts';
import { usdWon, wonOfUsd } from '../src/ui/format';
import { loadSave } from './helpers';

describe('the draft priority (2.0.60)', () => {
  it('the scouts pick within it, it stays for the later picks, and an unknown one is refused', { timeout: 600_000 }, () => {
    const s = loadSave('2.0.58');
    s.pending = null;
    let picks = 0;
    for (let g = 0; g < 20000 && picks < 3; g++) {
      const d = s.pending as LeagueState['pending'];
      if (d?.kind === 'draftPick' && !d.eligible) {
        const draft = s.offseason!.draft!;
        if (picks === 0) {
          expect(checkDecision(s, { kind: 'draftPick', id: null, prefer: { role: 'XX' as never } })).not.toBeNull();
          // A catcher from college, if one is left; else a catcher.
          const path: DraftPathway | undefined = draft.pool.some((id) => s.players[id]!.role === 'C' && draftPathOf(s.players[id]!) === 'college') ? 'college' : undefined;
          const prefer = { role: 'C' as const, ...(path ? { path } : {}) };
          expect(checkDecision(s, { kind: 'draftPick', id: null, prefer })).toBeNull();
          const before = new Set(draft.pool);
          apply(s, { kind: 'decide', input: { kind: 'draftPick', id: null, prefer } });
          const taken = [...before].find((id) => !s.offseason!.draft!.pool.includes(id) && s.players[id]!.teamId === s.user!.teamId)!;
          expect(fitsPrefer(s.players[taken]!, prefer)).toBe(true);
          expect(s.offseason!.draft!.prefer).toEqual(prefer);
        } else {
          // The scouts' pick (no priority sent): still under the one set.
          const prefer = draft.prefer!;
          const left = draft.pool.filter((id) => fitsPrefer(s.players[id]!, prefer));
          const before = new Set(draft.pool);
          apply(s, { kind: 'decide', input: autoDecision(s)! });
          const taken = [...before].find((id) => !s.offseason?.draft?.pool.includes(id) && s.players[id]?.teamId === s.user!.teamId);
          if (taken && left.length) expect(fitsPrefer(s.players[taken]!, prefer)).toBe(true);
        }
        picks++;
      } else if (d) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(picks).toBe(3);
  });
});

describe('dollars with won (2.0.60)', () => {
  it('85만 달러 comes to 11.9억 at the game’s rate', () => {
    expect(MANWON_PER_USD).toBe(0.14);
    expect(wonOfUsd(850_000, 2026)).toBe('11.9억');
    expect(usdWon(850_000, 2026)).toBe('85만 달러 (≈11.9억)');
  });
});
