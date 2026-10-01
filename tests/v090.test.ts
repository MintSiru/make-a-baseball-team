/* V0.9: the twelfth club. Its founding (designed by the player, or voted down when the board offers it), the same
   founding steps the user's club took, the special draft where the user's club protects its 20, the free-agent
   exception, the 12-club schedules and the two-league postseason, and the rivalry. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, checkDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { playPostseason } from '../src/league/postseason';
import { rivalDecision, RIVAL_ID, specialEligible } from '../src/league/rival';
import { makeSchedule } from '../src/league/schedule';
import { firstTeamIds, registeredIds, type Decision, type LeagueState, type RivalSettings } from '../src/league/state';
import { assignLeagues, leagueTables, twelveGames } from '../src/league/twelve';
import { currentStandings } from '../src/league/season';
import { attendance, clubState } from '../src/league/fans';

let s: LeagueState;
const pending = () => s.pending as LeagueState['pending'];
let founding: { state: LeagueState; d: Extract<Decision, { kind: 'rival' }> } | null = null;
let protect: { state: LeagueState; d: Extract<Decision, { kind: 'rivalProtect' }>; ids: string[] } | null = null;
let faWinter: LeagueState | null = null;

const decideAll = () => {
  while (pending()) {
    const d = pending()!;
    if (d.kind === 'rival') founding = { state: structuredClone(s), d };
    if (d.kind === 'rivalProtect') protect = { state: structuredClone(s), d, ids: [] };
    if (d.kind === 'faRound' && s.twelve && s.offseason?.year === s.twelve.firstTeam - 1 && !faWinter) faWinter = structuredClone(s);
    const a = autoDecision(s)!;
    if (a.kind === 'rivalProtect') protect!.ids = a.ids;
    apply(s, { kind: 'decide', input: a });
  }
};

beforeAll(() => {
  s = createLeague('v090-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: {
      name: '울산 고래단',
      short: '고래',
      color: '#1f6fb2',
      cityId: 'ulsan',
      parentType: 'conglomerate',
      parentName: '가상',
      stadium: 'existing',
      promotion: 'immediate',
      difficulty: 'normal',
      scenario: null,
      twelve: { mode: 'year', year: 2027 },
    },
  });
  decideAll();
  // 2026, 2027 (the rival is founded that winter), 2028 (its futures year; the special draft that winter).
  for (let i = 0; i < 3; i++) {
    apply(s, { kind: 'regularEnd' });
    apply(s, { kind: 'postseason' });
    apply(s, { kind: 'nextSeason' });
    decideAll();
  }
}, 900_000);

const settings = (over: Partial<RivalSettings> = {}): RivalSettings => ({ ...founding!.d.suggestion, ...over });

describe('founding the twelfth club', () => {
  it('asks in the set winter, with a suggestion, and checks what the player decides', () => {
    expect(founding).not.toBeNull();
    const { state, d } = founding!;
    expect(d.year).toBe(2027);
    expect(d.event).toBe(false);
    expect(checkDecision(state, { kind: 'rival', settings: d.suggestion })).toBeNull();
    expect(checkDecision(state, { kind: 'rival', settings: null })).toMatch(/막을 수 없/);
    expect(checkDecision(state, { kind: 'rival', settings: settings({ cityId: 'ulsan' }) })).toMatch(/연고지/);
    expect(checkDecision(state, { kind: 'rival', settings: settings({ short: 'LG' }) })).toMatch(/같은 이름/);
    expect(checkDecision(state, { kind: 'rival', settings: settings({ name: '가' }) })).toMatch(/2~12자/);
  });

  it('founds a club that plays futures first and joins the first team two seasons later', () => {
    const tw = s.twelve!;
    expect(tw.founded).toBe(2027);
    expect(tw.firstTeam).toBe(2029);
    const team = s.teams.find((t) => t.id === RIVAL_ID)!;
    expect(team.firstTeamFrom).toBe(2029);
    expect(team.benefitsUntil).toBe(2030);
    expect(team.stadium.capacity).toBeGreaterThanOrEqual(12_000);
    expect(firstTeamIds(s, 2028)).not.toContain(RIVAL_ID);
    expect(firstTeamIds(s, 2029)).toContain(RIVAL_ID);
    // It drafted like a new club: priority picks and the first pick of each round in its first draft.
    const drafted = Object.values(s.players).filter((p) => p.teamId === RIVAL_ID && p.origin.draftYear === 2027 && p.origin.overallPick);
    expect(drafted.some((p) => p.origin.overallPick! <= 2)).toBe(true);
    expect(drafted.length).toBeGreaterThanOrEqual(15);
  });

  it('a board offer can be voted down, and comes back only a few winters later', () => {
    const c = structuredClone(founding!.state);
    c.user!.settings.twelve = { mode: 'event' };
    const d: Extract<Decision, { kind: 'rival' }> = { ...founding!.d, event: true };
    c.pending = d;
    expect(checkDecision(c, { kind: 'rival', settings: null })).toBeNull();
    apply(c, { kind: 'decide', input: { kind: 'rival', settings: null } });
    expect(c.twelve).toBeUndefined();
    expect(c.user!.twelveNo).toEqual([2027]);
    expect(rivalDecision(c, 2028)).toBeNull();
    expect(rivalDecision(c, 2029)).toBeNull();
  });
});

describe('the special draft and the free-agent exception', () => {
  it('the user protects 20, loses at most one unprotected player and gets 10억', () => {
    expect(protect).not.toBeNull();
    const { state, d, ids } = protect!;
    expect(d.protect).toBe(20);
    expect(ids).toHaveLength(20);
    expect(checkDecision(state, { kind: 'rivalProtect', ids: d.candidates.slice(0, 21) })).toMatch(/20명/);
    const picks = s.twelve!.picks!;
    expect(picks.length).toBeGreaterThanOrEqual(10);
    // One from each first-team club, never one the user protected.
    expect(new Set(picks.map((x) => x.from)).size).toBe(picks.length);
    const ours = picks.find((x) => x.from === EXPANSION_ID);
    if (ours) {
      expect(ids).not.toContain(ours.id);
      expect(s.user!.ledger.some((l) => /특별지명 보상금 수령/.test(l.label) && l.amount === 100_000)).toBe(true);
      expect(s.players[ours.id]!.teamId).toBe(RIVAL_ID);
    }
    // Eligibility: no foreign player or this winter's draftee is on the list.
    for (const id of d.candidates) expect(specialEligible(state, EXPANSION_ID, 2029).map((p) => p.id)).toContain(id);
  });

  it('signs up to three outside free agents without compensation in its founding winter', () => {
    expect(faWinter).not.toBeNull();
    const m = faWinter!.offseason!.fa!;
    expect(m.newClub).toBe(RIVAL_ID);
    const signed = Object.values(s.players).filter((p) => p.teamId === RIVAL_ID && p.contract?.kind === 'freeAgent' && p.contract.signedIn === 2028);
    expect(signed.length).toBeLessThanOrEqual(3);
  });

  it('starts its first season inside the roster limit, with an extra foreign player', () => {
    expect(s.year).toBe(2029);
    expect(registeredIds(s, RIVAL_ID).length).toBeLessThanOrEqual(68);
    const foreign = registeredIds(s, RIVAL_ID).filter((id) => s.players[id]!.origin.kind === 'foreign' && !s.players[id]!.origin.asiaQuota);
    expect(foreign.length).toBe(4);
  });
});

describe('twelve clubs', () => {
  it('one league: 144 games, 14 against the natural rival and 13 against the rest', () => {
    const teams = firstTeamIds(s);
    expect(teams).toHaveLength(12);
    const games = s.schedule;
    for (const t of teams) expect(games.filter((g) => g.home === t || g.away === t)).toHaveLength(144);
    const vs = (a: string, b: string) => games.filter((g) => (g.home === a && g.away === b) || (g.home === b && g.away === a)).length;
    expect(vs(EXPANSION_ID, RIVAL_ID)).toBe(14);
    expect(vs('lg', 'doosan')).toBe(14);
    expect(vs('lg', 'kia')).toBe(13);
  });

  it('two leagues: 14 inside the league, 13 against two of the other league and 12 against the rest', () => {
    const c = structuredClone(s);
    c.twelve!.format = 'two';
    c.twelve!.leagues = assignLeagues(c);
    const L = c.twelve!.leagues;
    expect(L[EXPANSION_ID]).toBe('dream');
    expect(L[RIVAL_ID]).toBe('dream');
    expect(Object.values(L).filter((x) => x === 'dream')).toHaveLength(6);
    const teams = firstTeamIds(c);
    const games = makeSchedule(teams, 2029, c.seed, twelveGames(c, teams, 2029));
    for (const t of teams) {
      expect(games.filter((g) => g.home === t || g.away === t)).toHaveLength(144);
      const counts = teams.filter((o) => o !== t).map((o) => games.filter((g) => (g.home === t && g.away === o) || (g.home === o && g.away === t)).length);
      const same = teams.filter((o) => o !== t && L[o] === L[t]);
      expect(same.map((o) => counts[teams.filter((x) => x !== t).indexOf(o)])).toEqual([14, 14, 14, 14, 14]);
      expect(counts.filter((n) => n === 13)).toHaveLength(2);
      expect(counts.filter((n) => n === 12)).toHaveLength(4);
    }
  });

  it('two leagues: league winners meet the other runner-up, a better third plays it for the spot', () => {
    const c = structuredClone(s);
    c.twelve!.format = 'two';
    c.twelve!.leagues = assignLeagues(c);
    apply(c, { kind: 'regularEnd' });
    playPostseason(c);
    const t = leagueTables(currentStandings(c), c.twelve!.leagues!);
    const po = c.postseason.filter((x) => x.round === 'po');
    expect(po).toHaveLength(2);
    expect(po.map((x) => x.high).sort()).toEqual([t.dream[0]!.teamId, t.magic[0]!.teamId].sort());
    const semis = c.postseason.filter((x) => x.round === 'semipo');
    const expected = (t.dream[2]!.pct > t.magic[1]!.pct ? 1 : 0) + (t.magic[2]!.pct > t.dream[1]!.pct ? 1 : 0);
    expect(semis).toHaveLength(expected);
    expect(c.postseason.filter((x) => x.round === 'ks')).toHaveLength(1);
    expect(c.postseason.some((x) => x.round === 'wildcard')).toBe(false);
  });

  it('the rivalry: an article for each game, the season series kept, and a bigger crowd', () => {
    const c = structuredClone(s);
    apply(c, { kind: 'regularEnd' });
    const rivalry = (c.news ?? []).filter((n) => n.title.startsWith('[라이벌전]'));
    expect(rivalry.length).toBeGreaterThanOrEqual(10);
    apply(c, { kind: 'postseason' });
    apply(c, { kind: 'nextSeason' });
    const h = c.twelve!.h2h!.find((x) => x.year === 2029)!;
    expect(h.w + h.l + h.t).toBe(14);
    expect((c.news ?? []).some((n) => /2029 라이벌전/.test(n.title))).toBe(true);
  });

  it('a rivalry game draws more than the same game against another club', () => {
    const c = structuredClone(s);
    c.teams.find((t) => t.id === EXPANSION_ID)!.stadium.capacity = 100_000;
    clubState(c, RIVAL_ID).popularity = clubState(c, 'kia').popularity;
    const g = { id: '2029-9999', date: '2029-05-02', home: EXPANSION_ID };
    expect(attendance(c, { ...g, away: RIVAL_ID }) / attendance(c, { ...g, away: 'kia' })).toBeCloseTo(1.15, 2);
  });
});
