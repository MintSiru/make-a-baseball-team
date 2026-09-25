/* The expansion club from founding to its first first-team season, with the scouts' choices. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision, EXPANSION_ID, FOUNDING_DATE } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { firstTeamSize, foreignSlots } from '../src/league/manager';
import { rosterLimit } from '../src/league/offseason';
import { isForeign } from '../src/league/players';
import { developmentIds, firstTeamIds, registeredIds, type Decision, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { EXPANSION_DEFAULTS } from '../src/rules/kbo2026';
import { OFFSEASON } from '../src/league/tuning';

let base = '';
beforeAll(() => {
  base = JSON.stringify(createLeague('expansion-test'));
}, 120_000);

const settings = (promotion: ExpansionSettings['promotion']): ExpansionSettings => ({
  name: '테스트 구단',
  short: '테스트',
  color: '#1f6fb2',
  cityId: 'cheongju',
  parentType: 'conglomerate',
  parentName: '가상그룹',
  stadium: 'existing',
  promotion,
  difficulty: 'normal',
  scenario: null,
});

/** Plays on, taking the scouts' choice at every decision, until `year` is reached. Returns the decisions seen. */
function playTo(s: LeagueState, year: number, onDecision?: (d: Decision, s: LeagueState) => void) {
  const seen: Decision[] = [];
  const decide = () => {
    while (s.pending) {
      seen.push(s.pending);
      onDecision?.(s.pending, s);
      apply(s, { kind: 'decide', input: autoDecision(s)! });
    }
  };
  decide();
  while (s.year < year) {
    apply(s, { kind: 'regularEnd' });
    apply(s, { kind: 'postseason' });
    apply(s, { kind: 'nextSeason' });
    decide();
  }
  return seen;
}

function found(promotion: ExpansionSettings['promotion']) {
  const s: LeagueState = JSON.parse(base);
  apply(s, { kind: 'toFounding' });
  expect(s.schedule[s.next]!.date >= FOUNDING_DATE).toBe(true);
  expect(s.schedule[s.next - 1]!.date < FOUNDING_DATE).toBe(true);
  apply(s, { kind: 'found', settings: settings(promotion) });
  return s;
}

describe('expansion after a futures year (NC/KT path)', () => {
  let s: LeagueState;
  const specialLists: Record<string, string[]> = {};
  let fundBeforeSpecial = 0;
  beforeAll(() => {
    s = found('afterFutures');
  }, 60_000);

  it('opens with the founding tryout and pays the entry fee and development fund', () => {
    expect(s.pending?.kind).toBe('tryout');
    expect(s.user!.firstTeamYear).toBe(2028);
    expect(s.user!.ledger.filter((l) => l.amount < 0).map((l) => l.amount)).toEqual([-EXPANSION_DEFAULTS.entryFee, -1_000_000]);
    expect(firstTeamIds(s)).not.toContain(EXPANSION_ID);
  });

  it('gets two priority picks, the first pick of every round and five extra picks in the first draft', () => {
    playTo(s, 2027);
    const picks = Object.values(s.players).filter((p) => p.origin.draftYear === 2026 && p.origin.overallPick && p.teamId === EXPANSION_ID && p.contract?.kind === 'rookie');
    expect(picks.length).toBe(EXPANSION_DEFAULTS.rookiePriorityPicks + 11 + EXPANSION_DEFAULTS.extraPicksAfterRound2);
    expect(Math.min(...picks.map((p) => p.origin.overallPick!))).toBe(1);
    expect(s.year).toBe(2027);
  }, 60_000);

  it('plays a futures year while ten clubs play the first team', () => {
    expect(firstTeamIds(s)).toHaveLength(10);
    expect(s.schedule).toHaveLength(720);
    expect(s.futures!.schedule.length).toBeGreaterThan(90);
    expect(foreignSlots(s, EXPANSION_ID).regular).toBeGreaterThan(0);
    expect([...s.rosters[EXPANSION_ID]!.active, ...s.rosters[EXPANSION_ID]!.futures].some((id) => isForeign(s.players[id]!))).toBe(false);
  });

  it('takes one unprotected player per club for 10억 each, and at most three free agents, before joining', () => {
    let faSeen = 0;
    playTo(s, 2028, (d, st) => {
      if (d.kind === 'specialDraft') {
        Object.assign(specialLists, d.lists);
        fundBeforeSpecial = st.user!.fund;
        for (const [teamId, ids] of Object.entries(d.lists)) {
          const org = registeredIds(st, teamId).filter((id) => {
            const p = st.players[id]!;
            return !isForeign(p) && p.proSince < 2028 && !(p.contract?.kind === 'freeAgent' && p.contract.signedIn === 2027);
          });
          expect(org.length - ids.length).toBeLessThanOrEqual(EXPANSION_DEFAULTS.specialDraft.protected);
        }
        const [team, ids] = Object.entries(d.lists)[0]!;
        const protectedId = registeredIds(st, team).find((id) => !ids.includes(id) && !isForeign(st.players[id]!))!;
        expect(checkDecision(st, { kind: 'specialDraft', picks: { [team]: protectedId } })).toMatch(/보호선수/);
      }
      if (d.kind === 'freeAgents') {
        faSeen++;
        expect(checkDecision(st, { kind: 'freeAgents', ids: d.candidates.slice(0, d.max + 1) })).toMatch(/최대/);
      }
    });
    expect(faSeen).toBe(1);
    const specialPicks = s.user!.ledger.filter((l) => l.label.startsWith('특별지명'));
    expect(specialPicks.length).toBeGreaterThan(0);
    expect(specialPicks.length).toBeLessThanOrEqual(10);
    for (const l of specialPicks) expect(l.amount).toBe(-EXPANSION_DEFAULTS.specialDraft.feePerPlayer);
    expect(s.user!.fund).toBeLessThan(fundBeforeSpecial);
    expect(s.history.find((h) => h.year === 2027)?.userFutures).toBeDefined();
  }, 60_000);

  it('joins an eleven-club first team with its benefits and legal rosters', () => {
    expect(s.year).toBe(2028);
    expect(firstTeamIds(s)).toContain(EXPANSION_ID);
    expect(s.schedule).toHaveLength(792);
    for (const id of firstTeamIds(s)) {
      expect(s.schedule.filter((g) => g.home === id || g.away === id)).toHaveLength(144);
      expect(registeredIds(s, id).length).toBeLessThanOrEqual(rosterLimit(2028));
      expect(developmentIds(s, id).length).toBeLessThanOrEqual(OFFSEASON.development.cap);
    }
    expect(firstTeamSize(s, EXPANSION_ID)).toBe(30);
    expect(s.rosters[EXPANSION_ID]!.active).toHaveLength(30);
    expect(foreignSlots(s, EXPANSION_ID).regular).toBe(4);
    expect(firstTeamSize(s, EXPANSION_ID, 2030)).toBe(29);
    expect(foreignSlots(s, 'kia').regular).toBe(3);
  });
});

describe('expansion straight into the first team', () => {
  it('does the special draft in the first winter and plays 2027 with eleven clubs', () => {
    const s = found('immediate');
    const seen = playTo(s, 2027).map((d) => d.kind);
    expect(seen).toContain('specialDraft');
    expect(seen).toContain('foreign');
    expect(firstTeamIds(s)).toContain(EXPANSION_ID);
    expect(s.schedule).toHaveLength(792);
    // Every club, the new one included, and 상무 play in the futures league.
    expect(s.futures?.teams).toHaveLength(12);
    expect(s.futures?.teams).toContain(EXPANSION_ID);
  }, 60_000);

  it('is deterministic for the same seed and choices', () => {
    const a = found('immediate'),
      b = found('immediate');
    playTo(a, 2027);
    playTo(b, 2027);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  }, 90_000);
});
