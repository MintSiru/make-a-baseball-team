/* 2.0.43 (the user's requests): the unified scenario with the twelve-club setting (four northern clubs with ours, the
   twelfth club the sixteenth), and taking the twelfth club over when it is founded. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { moveBlocked } from '../src/league/clubmove';
import { autoDecision, budgetFor, checkDecision, EXPANSION_ID } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { foundRival, RIVAL_ID, suggestRival } from '../src/league/rival';
import { makeSchedule } from '../src/league/schedule';
import { withScenario } from '../src/league/scenarios';
import { firstTeamIds, registeredIds, type Decision, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { assignLeagues, rivalId, sidesOf, twelveGames } from '../src/league/twelve';
import { addCondition, checkCondition } from '../src/league/conditions';
import { conditionUnified } from '../src/league/unified';
import { assignUnifiedLeagues, NORTH_AI_CLUBS } from '../src/league/unified';
import { openProjects, projectOptions, startProject } from '../src/league/ballpark';
import { BALLPARK } from '../src/league/tuning';
import { loadSave } from './helpers';
import { abroadVetsWinter, isAbroadVet } from '../src/league/abroadvets';
import { canMove } from '../src/league/entry';
import { signFromPool } from '../src/league/trade';
import { repairState } from '../src/save/migrate';

const pendingOf = (s: LeagueState): Decision | null => s.pending;

describe('a unified league with the twelfth club (2.0.43)', () => {
  it('four northern clubs with ours, one league of fifteen, then two leagues of eight with the twelfth club', () => {
    const s = createLeague('v2043-unified');
    apply(s, { kind: 'toFounding' });
    const settings: ExpansionSettings = withScenario(
      { name: '평양 범', short: '평양', color: '#1f6fb2', cityId: 'pyongyang', parentType: 'conglomerate', parentName: '대동그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, twelve: { mode: 'year', year: 2027 } },
      'unifiedFree',
    );
    expect(settings.twelve).toEqual({ mode: 'year', year: 2027 });
    apply(s, { kind: 'found', settings });
    expect(s.unified!.clubs).toHaveLength(NORTH_AI_CLUBS - 1);
    expect(s.teams).toHaveLength(15);
    // The setting is fixed for the game.
    apply(s, { kind: 'twelveSetting', setting: { mode: 'off' } });
    expect(s.user!.settings.twelve).toEqual({ mode: 'year', year: 2027 });
    // Its first first-team season: fifteen clubs, no leagues yet, 144 games each.
    s.year = 2027;
    assignUnifiedLeagues(s);
    expect(s.leagueSides).toBeUndefined();
    const fifteen = firstTeamIds(s);
    expect(fifteen).toHaveLength(15);
    const count = (games: ReturnType<typeof makeSchedule>, id: string) => games.filter((g) => g.home === id || g.away === id).length;
    const one = makeSchedule(fifteen, 2027, s.seed, twelveGames(s, fifteen, 2027));
    for (const id of fifteen) expect(count(one, id)).toBe(144);
    // The twelfth club: founded that winter, its two leagues are the unified league's.
    foundRival(s, { ...suggestRival(s, 2027), format: 'two' }, 2027);
    expect(s.twelve!.format).toBe('single');
    s.year = 2029;
    assignUnifiedLeagues(s);
    const ids = firstTeamIds(s);
    expect(ids).toHaveLength(16);
    const sides = s.leagueSides!.sides;
    expect(ids.filter((id) => sides[id] === 'dream')).toHaveLength(8);
    expect(sides[RIVAL_ID]).toBeDefined();
    const north = [s.user!.teamId, ...s.unified!.clubs.map((c) => c.teamId)];
    expect(north.filter((id) => sides[id] === 'dream').length).toBeGreaterThanOrEqual(2);
    expect(twelveGames(s, ids, 2029)).toBeUndefined();
    const two = makeSchedule(ids, 2029, s.seed, undefined, undefined, ids.map((id) => (sides[id] === 'dream' ? 0 : 1)));
    for (const id of ids) expect(count(two, id)).toBe(144);
  }, 300_000);
});

describe('taking the twelfth club over (2.0.43)', () => {
  it('the general manager moves at the founding: new money and owner, the old club the AI’s, our founding decisions', () => {
    const s = createLeague('v2043-move');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, twelve: { mode: 'year', year: 2027 } } });
    // To the winter of 2027 and its founding decision.
    for (let g = 0; g < 3000 && pendingOf(s)?.kind !== 'rival'; g++) {
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    const d = pendingOf(s);
    expect(d?.kind).toBe('rival');
    if (d?.kind !== 'rival') return;
    // Not in a scenario with a goal; not when the founding is voted down.
    const scenario = s.user!.settings.scenario;
    s.user!.settings.scenario = 'seoul';
    expect(moveBlocked(s)).not.toBeNull();
    expect(checkDecision(s, { kind: 'rival', settings: d.suggestion, move: true })).not.toBeNull();
    s.user!.settings.scenario = scenario;
    expect(checkDecision(s, { kind: 'rival', settings: null, move: true })).not.toBeNull();
    expect(checkDecision(s, { kind: 'rival', settings: d.suggestion, move: true })).toBeNull();
    const oldRoster = registeredIds(s, EXPANSION_ID).length;
    const oldFund = s.user!.fund;
    apply(s, { kind: 'decide', input: { kind: 'rival', settings: d.suggestion, move: true } });
    const u = s.user!;
    expect(u.teamId).toBe(RIVAL_ID);
    expect(u.firstTeamYear).toBe(2029);
    expect(u.former).toEqual([{ teamId: EXPANSION_ID, name: '청주 독수리', from: 2026, to: 2027 }]);
    expect(u.settings.cityId).toBe(d.suggestion.cityId);
    expect(u.settings.twelve).toBeUndefined();
    const b = budgetFor(u.settings);
    expect(u.fund).toBe(b.fund - b.entryFee - b.developmentFund);
    expect(u.ledger.every((x) => x.year === 2027)).toBe(true);
    // The old club keeps its players and its money (none of it moved with us).
    expect(registeredIds(s, EXPANSION_ID).length).toBe(oldRoster);
    expect(oldFund).not.toBe(u.fund);
    // Our rival is now the club we left.
    expect(rivalId(s)).toBe(EXPANSION_ID);
    // On through the winter: our own special draft before the first first-team season, not the AI's.
    let special = false;
    for (let g = 0; g < 4000 && !(s.year === 2029 && s.phase === 'regular'); g++) {
      const p = pendingOf(s);
      if (p?.kind === 'specialDraft') special = true;
      if (p?.kind === 'rivalProtect') throw new Error('we do not protect against our own club');
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(special).toBe(true);
    expect(s.twelve!.picks).toBeUndefined();
    expect(firstTeamIds(s)).toContain(RIVAL_ID);
    expect(firstTeamIds(s)).toContain(EXPANSION_ID);
    expect(registeredIds(s, RIVAL_ID).length).toBeGreaterThan(40);
    // The new club drafted with the founding club's priority picks.
    const drafted = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass' && p.origin.draftYear === 2027 && p.teamId === RIVAL_ID);
    expect(drafted.length).toBeGreaterThanOrEqual(10);
  }, 900_000);
});

describe('ballpark expansion to the cap (2.0.43, user report)', () => {
  it('a 23,000-seat dome grown 3,000 at a time reaches 40,000 and then the mega expansion', () => {
    const s = loadSave('2.0.39');
    s.phase = 'offseason';
    s.offseason = { year: s.year, step: 0, done: [] } as never;
    s.pending = null;
    s.user!.fund = 200_000_000;
    s.user!.projects = [];
    const team = s.teams.find((t) => t.id === s.user!.teamId)!;
    team.stadium = { ...team.stadium, size: 'dome', capacity: 38_000 };
    const expand = projectOptions(s).find((o) => o.kind === 'expand')!;
    expect(expand.blocked).toBeNull();
    expect(projectOptions(s).find((o) => o.kind === 'mega')!.blocked).toBeTruthy();
    startProject(s, 'expand');
    openProjects(s, s.year + 1);
    // The next winter.
    (s.offseason as unknown as { year: number }).year += 1;
    expect(team.stadium.capacity).toBe(BALLPARK.maxSeats);
    expect(team.stadium.size).toBe('dome');
    expect(projectOptions(s).find((o) => o.kind === 'expand')!.blocked).toBeTruthy();
    expect(projectOptions(s).find((o) => o.kind === 'mega')!.blocked).toBeNull();
  });
});

describe('unified Korea added to a twelve-club league (2.0.43, the user\u2019s request)', () => {
  it('four northern clubs join the twelve: sixteen in two leagues of eight, the twelve clubs\u2019 own leagues set aside', () => {
    const s = createLeague('v2043-condition');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null, twelve: { mode: 'year', year: 2026 } } });
    s.pending = null;
    foundRival(s, { ...suggestRival(s, 2026), format: 'two' }, 2026);
    s.year = 2028;
    s.twelve!.leagues = assignLeagues(s);
    expect(firstTeamIds(s)).toHaveLength(12);
    // The winter of 2028, before its development step.
    s.phase = 'offseason';
    s.offseason = { year: 2028, step: 0, done: [] } as never;
    expect(checkCondition(s, 'unified')).toBeNull();
    addCondition(s, 'unified');
    expect(s.user!.settings.twelve?.mode).toBe('year');
    conditionUnified(s, 2028);
    expect(s.unified!.clubs).toHaveLength(NORTH_AI_CLUBS - 1);
    expect(s.unified!.clubs.every((c) => c.firstTeam === 2030)).toBe(true);
    s.year = 2030;
    s.phase = 'regular';
    assignUnifiedLeagues(s);
    const ids = firstTeamIds(s);
    expect(ids).toHaveLength(16);
    const sides = sidesOf(s)!;
    expect(ids.filter((id) => sides[id] === 'dream')).toHaveLength(8);
    expect(s.unified!.clubs.filter((c) => sides[c.teamId] === 'dream')).toHaveLength(2);
    expect(s.twelve!.format).toBe('single');
    expect(s.twelve!.leagues).toBeUndefined();
  }, 300_000);
});

describe('a veteran home from abroad signed from the pool can play (2.0.43, user report)', () => {
  it('is active once signed, can be registered, and an old save is repaired at load', () => {
    const s = loadSave('2.0.39');
    expect(s.phase).toBe('regular');
    // Winters until one waits in the pool.
    for (let next = s.year + 1; next < s.year + 40 && !(s.pool ?? []).some((id) => isAbroadVet(s.players[id]!)); next++) abroadVetsWinter(s, next);
    const id = (s.pool ?? []).find((x) => isAbroadVet(s.players[x]!))!;
    expect(id).toBeDefined();
    expect(s.players[id]!.status).toBe('freeAgent');
    s.user!.entry = 'manual';
    signFromPool(s, id);
    const p = s.players[id]!;
    expect(p.status).toBe('active');
    expect(p.teamId).toBe(s.user!.teamId);
    // A place on the first team (it was full), then he can be registered.
    const r = s.rosters[s.user!.teamId]!;
    apply(s, { kind: 'move', id: r.active.at(-1)!, to: 'futures' });
    expect(canMove(s, id, 'active')).toBeNull();
    // A save from before the fix: signed, but still a free agent.
    p.status = 'freeAgent';
    expect(canMove(s, id, 'active')).not.toBeNull();
    repairState(s);
    expect(p.status).toBe('active');
  });
});

describe('상무 in the moves (2.0.43, user report)', () => {
  it('shows 입대 and 전역 once each, by name, and no club changes for the service', async () => {
    const { moveHistory } = await import('../src/league/moves');
    const s = loadSave('2.0.39');
    const p = s.rosters[s.user!.teamId]!.active.map((id) => s.players[id]!).find((x) => x.origin.kind !== 'foreign')!;
    const club = p.teamId!;
    const line = (year: number, teamId: string, level?: 'futures') => ({ ...p.career[0]!, year, teamId, ...(level ? { level } : {}) });
    // A first-team season, 상무 for two (the futures league), back to his club's futures in June, then the first team.
    p.career = [line(2026, club), line(2026, club, 'futures'), line(2027, 'sangmu', 'futures'), line(2028, 'sangmu', 'futures'), line(2028, club, 'futures'), line(2029, club)];
    p.moves = [];
    const rows = moveHistory(s, p);
    const kinds = rows.map((r) => r.kind).filter((k) => k !== 'draft' && k !== 'join');
    expect(kinds, JSON.stringify(rows)).toEqual(['enlist', 'discharge']);
    const [enlist, discharge] = rows.filter((r) => r.kind === 'enlist' || r.kind === 'discharge');
    expect(enlist!.to).toBe('상무');
    expect(discharge!.from).toBe('상무');
    expect(enlist!.date < discharge!.date).toBe(true);
    expect(rows.some((r) => r.from === 'sangmu' || r.to === 'sangmu')).toBe(false);
  });
});
