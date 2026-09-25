/* V0.7.3: the market of KBO-experienced foreign players, posted players coming home, draftees abroad. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { foreignPoolAsk, foreignPoolPlayers, poolEntry } from '../src/league/foreignpool';
import { createLeague } from '../src/league/history';
import { openDraft, removeFromRoster } from '../src/league/offseason';
import { draftClass, isForeign } from '../src/league/players';
import { goAbroad } from '../src/league/returnees';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { foreignMarket } from '../src/league/trade';
import { KBO_2026 } from '../src/rules/kbo2026';

let s: LeagueState;
const decideAll = (watch?: () => void) => {
  while (s.pending) {
    watch?.();
    apply(s, { kind: 'decide', input: autoDecision(s)! });
  }
};
const winter = (watch?: () => void) => {
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  decideAll(watch);
};

beforeAll(() => {
  s = createLeague('v073-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  decideAll();
  winter();
  apply(s, { kind: 'days', days: 30 });
}, 480_000);

describe('foreign players other clubs let go', () => {
  it('released in the season, he is on every club’s list at the new-player price', () => {
    const f = orgPlayers(s, EXPANSION_ID).find(isForeign)!;
    apply(s, { kind: 'release', id: f.id });
    expect(poolEntry(s, f.id)?.from).toBe(EXPANSION_ID);
    expect(s.players[f.id]!.status).toBe('freeAgent');
    expect(foreignMarket(s, 'lg').some((p) => p.id === f.id)).toBe(true);
    const cap = f.origin.asiaQuota ? KBO_2026.foreign.asiaQuotaCapUSD : KBO_2026.foreign.newContractCapUSD;
    expect(foreignPoolAsk(s, f)).toBeLessThanOrEqual(cap);
  });

  it('in the winter the AI clubs settle theirs first, so the ones they let go are on the user’s list', () => {
    let listed = 0;
    winter(() => {
      if (s.pending?.kind === 'foreign') listed = s.pending.candidates.filter((id) => poolEntry(s, id)).length;
    });
    expect(listed).toBeGreaterThan(0);
    // Whoever signed left the list; the rest have no club, and nobody waits past two winters.
    expect(foreignPoolPlayers(s).every((p) => !p.teamId && !p.contract)).toBe(true);
    expect((s.foreignPool ?? []).every((e) => s.players[e.id]?.status === 'freeAgent' && s.year - 1 - e.since < 2)).toBe(true);
  }, 240_000);
});

describe('posted players coming home', () => {
  it('come back to the club that posted them; the user decides, and a pass frees his rights', () => {
    // Four of our players went to the majors ten years ago (their deals are long over).
    const gone = orgPlayers(s, EXPANSION_ID)
      .filter((p) => !isForeign(p) && p.status === 'active' && p.career.at(-1)?.teamId === EXPANSION_ID && !p.career.at(-1)?.level)
      .slice(0, 4);
    expect(gone.length).toBe(4);
    for (const p of gone) {
      removeFromRoster(s, p);
      p.teamId = null;
      p.contract = null;
      p.status = 'overseas';
      p.service.postedIn = s.year - 10;
    }
    let rows: { id: string; years: number; annual: number }[] = [];
    let chosen: string[] = [];
    winter(() => {
      if (s.pending?.kind === 'returnee') {
        rows = s.pending.rows;
        const a = autoDecision(s);
        chosen = a && a.kind === 'returnee' ? a.ids : [];
      }
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const p = s.players[r.id];
      expect(r.years).toBeGreaterThanOrEqual(1);
      if (chosen.includes(r.id)) {
        expect(p!.teamId).toBe(EXPANSION_ID);
        expect(p!.contract?.salaries[0]?.amount).toBe(r.annual);
      } else expect(!p || p.teamId !== EXPANSION_ID).toBe(true);
    }
    expect(s.news?.some((n) => n.facts.type === '해외 복귀')).toBe(true);
  }, 240_000);
});

describe('draftees who went abroad', () => {
  it('come back through the draft after the two-year wait', () => {
    const year = s.year;
    let back = null as (typeof s.players)[string] | null;
    for (const c of draftClass(s.seed, year + 30)) {
      s.players[c.id] = c;
      goAbroad(s, c, year);
      if (c.abroad?.draft) {
        back = c;
        break;
      }
      delete s.players[c.id];
    }
    expect(back).toBeTruthy();
    const draft = back!.abroad!.draft!;
    expect(draft).toBeGreaterThanOrEqual(year + 4); // two seasons abroad at least, then the two-year wait
    expect(draft).toBeLessThanOrEqual(year + 7);
    const before = back!.hidden.current;
    const d = openDraft(s, draft, []);
    expect(d.pool).toContain(back!.id);
    expect(back!.status).toBe('amateur');
    expect(back!.proSince).toBe(draft + 1);
    expect(back!.education.pathText).toContain('해외 진출');
    expect(back!.hidden.current).not.toEqual(before); // his years away changed him
    for (const id of d.pool) delete s.players[id];
  });
});
