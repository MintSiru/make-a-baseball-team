/* 1.6.0: scenarios (the owner's orders in 재기, the fantasy draft), stops at the moments that matter, the founding's
   risks and each AI club's plan in trades. The growth curves' 27–32 prime is in v110.test.ts. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { createLeague } from '../src/league/history';
import { autoDecision, budgetFor, foundingRisks } from '../src/league/expansion';
import { aiFantasyChoice, fantasyTeamAt, makeFantasyPick, openFantasy, runFantasy } from '../src/league/fantasy';
import { ageIn, isForeign } from '../src/league/players';
import { FANTASY, fantasyGrade, fantasyPoints, MEDDLE, resolveMeddle, scenarioProgress, scenarioWinter, SCENARIOS, withScenario } from '../src/league/scenarios';
import { staffOf } from '../src/league/staff';
import { orgIds, orgPlayers, type Decision, type ExpansionSettings, type LeagueState } from '../src/league/state';
import { raceState, watchStops } from '../src/league/stops';
import { clubStrategy, planFactor, planGuard, spotOf } from '../src/league/strategy';
import { checkTrade } from '../src/league/trade';
import { parseSave } from '../src/save/format';

const clone = (s: LeagueState) => JSON.parse(JSON.stringify(s)) as LeagueState;
let base: LeagueState;
beforeAll(() => {
  base = parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.3.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;
});

const free: ExpansionSettings = {
  name: '검증 고래',
  short: '검증',
  color: '#1f6fb2',
  cityId: 'ulsan',
  parentType: 'midsize',
  parentName: '검증그룹',
  stadium: 'existing',
  promotion: 'afterFutures',
  difficulty: 'normal',
  scenario: null,
};

describe('scenarios', () => {
  it('lock what they fix and leave the rest to the player', () => {
    const raiders = withScenario({ ...free, name: '아무개', parentType: 'conglomerate' }, 'raiders');
    expect(raiders.name).toBe('쌍방울 레이더스');
    expect(raiders.cityId).toBe('jeonju');
    expect(raiders.parentType).toBe('midsize');
    // Not locked: the player's own parent name stays.
    expect(raiders.parentName).toBe('검증그룹');
    const ulleung = withScenario(free, 'ulleung');
    expect([ulleung.cityId, ulleung.parentType, ulleung.difficulty, ulleung.firing]).toEqual(['ulleung', 'citizen', 'hard', true]);
    expect(withScenario(ulleung, null).scenario).toBeNull();
    for (const x of SCENARIOS) for (const k of x.locked) expect(x.fixed[k], `${x.id}.${k}`).not.toBeUndefined();
  });

  it('change the money: 재기 is richer, 울릉 poorer than the same owner without a scenario', () => {
    const rich = budgetFor(withScenario({ ...free, parentType: 'conglomerate' }, 'comeback'));
    const usual = budgetFor({ ...free, parentType: 'conglomerate', parentName: '한빛그룹' });
    expect(rich.fund).toBeGreaterThan(usual.fund * 1.3);
    expect(rich.payrollBudget).toBeGreaterThan(usual.payrollBudget * 1.3);
    const island = budgetFor(withScenario(free, 'ulleung'));
    const citizen = budgetFor({ ...free, parentType: 'citizen', difficulty: 'hard', cityId: 'jeju' });
    expect(island.payrollBudget).toBeLessThan(citizen.payrollBudget);
  });

  it('are judged in the winter: three titles win 돌격대의 귀환, a fired GM loses, the fantasy seasons are scored', () => {
    const s = clone(base);
    const u = s.user!;
    u.settings = { ...u.settings, scenario: 'raiders' };
    u.scenario = { status: 'active' };
    const me = u.teamId;
    const won = (year: number) => s.history.push({ ...structuredClone(s.history.at(-1)!), year, champion: me });
    won(2028);
    won(2029);
    scenarioWinter(s, 2029);
    expect(u.scenario.status).toBe('active');
    won(2030);
    scenarioWinter(s, 2030);
    expect(u.scenario.status).toBe('won');
    expect(s.alerts?.some((a) => a.id === 'scenario-raiders-2030')).toBe(true);
    expect(scenarioProgress(s)!.status).toBe('won');

    const f = clone(base);
    f.user!.settings = { ...f.user!.settings, scenario: 'ulleung' };
    f.user!.fired = 2029;
    scenarioWinter(f, 2029);
    expect(f.user!.scenario!.status).toBe('lost');

    // Points: (clubs + 1 − rank) × 10 and the postseason on top; the champion gets the most for October.
    const p = clone(base);
    const h = p.history.at(-1)!;
    const champ = h.champion!;
    const rank = h.table.find((r) => r.teamId === champ)!.rank;
    expect(fantasyPoints(p, h.year, champ)).toBe((h.table.length + 1 - rank) * FANTASY.rankPoints + FANTASY.post.champion);
    const last = h.table.find((r) => r.rank === h.table.length)!.teamId;
    expect(fantasyPoints(p, h.year, last)).toBe(FANTASY.rankPoints);
    expect(fantasyGrade(400)).toBe('S');
    expect(fantasyGrade(100)).toBe('D');
  });
});

describe("재기: the owner's orders", () => {
  const order = (s: LeagueState, kind: Extract<Decision, { kind: 'meddle' }>['order'], extra: Partial<Extract<Decision, { kind: 'meddle' }>> = {}) =>
    ({ kind: 'meddle', order: kind, date: `${s.year}-06-01`, lines: [], refuse: MEDDLE.refuse[kind], ...extra }) as Extract<Decision, { kind: 'meddle' }>;

  it('refusing costs trust, obeying earns a little', () => {
    const s = clone(base);
    s.user!.trust = 50;
    resolveMeddle(s, order(s, 'ticket'), 'refuse');
    expect(s.user!.trust).toBe(50 - MEDDLE.refuse.ticket);
    const price = s.clubs![s.user!.teamId]!.price;
    resolveMeddle(s, order(s, 'ticket'), 'obey');
    expect(s.user!.trust).toBe(50 - MEDDLE.refuse.ticket + MEDDLE.obey);
    expect(s.clubs![s.user!.teamId]!.price).toBeLessThan(price);
  });

  it("the manager order puts the owner's man in the dugout; the star order pays and is judged at the deadline", () => {
    const s = clone(base);
    const pick = { ...staffOf(s, s.user!.teamId).manager, id: 'st-owner', name: '구단주 지인', rating: 40 };
    resolveMeddle(s, order(s, 'manager', { manager: pick }), 'obey');
    expect(staffOf(s, s.user!.teamId).manager.name).toBe('구단주 지인');
    const fund = s.user!.fund;
    resolveMeddle(s, order(s, 'star'), 'obey');
    expect(s.user!.fund).toBe(fund + MEDDLE.starGrant);
    expect(s.user!.scenario!.star).toBeTruthy();
  });
});

describe('판타지 드래프트', () => {
  let s: LeagueState;
  let domestic: number;
  let foreign: Record<string, number>;
  beforeAll(() => {
    s = clone(base);
    s.user!.settings = { ...s.user!.settings, scenario: 'fantasy' };
    const clubs = s.teams.filter((t) => s.rosters[t.id]).map((t) => t.id);
    domestic = clubs.reduce((a, id) => a + orgPlayers(s, id).filter((p) => !isForeign(p) && p.status === 'active').length, 0);
    foreign = Object.fromEntries(clubs.map((id) => [id, orgPlayers(s, id).filter(isForeign).length]));
  });

  it('puts every domestic player and the class on the board, the clubs in a snake order drawn by lot', () => {
    const f = openFantasy(s, s.year);
    s.offseason = { year: s.year, step: 0, draft: null, released: [], done: [], fantasy: f } as LeagueState['offseason'];
    expect(f.pool.length).toBe(domestic + f.order.length * FANTASY.classRounds);
    expect(new Set(f.order).size).toBe(f.order.length);
    const c = f.order.length;
    expect(fantasyTeamAt(f, c - 1)).toBe(fantasyTeamAt(f, c));
    expect(fantasyTeamAt(f, 0)).toBe(fantasyTeamAt(f, 2 * c - 1));
    // Clubs keep only their foreign players meanwhile.
    for (const [id, n] of Object.entries(foreign)) expect(orgIds(s, id).length).toBe(n);
  });

  it('stops for our pick, then our scouts can take the rest; everyone ends up somewhere, the clubs evenly', () => {
    const f = s.offseason!.fantasy!;
    expect(runFantasy(s, f)).toBe('wait');
    expect(s.pending?.kind).toBe('fantasyPick');
    expect(fantasyTeamAt(f, f.next)).toBe(s.user!.teamId);
    const fund = s.user!.fund;
    const mine = aiFantasyChoice(s, f, s.user!.teamId)!;
    makeFantasyPick(s, f, mine);
    s.pending = null;
    f.autoUntil = f.rounds;
    expect(runFantasy(s, f)).toBe('done');
    expect(f.pool).toEqual([]);
    const counts = s.teams.filter((t) => s.rosters[t.id]).map((t) => orgPlayers(s, t.id).filter((p) => !isForeign(p)).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // The class signed rookie deals; ours were paid from the fund.
    const ours = f.picks.filter((x) => x.teamId === s.user!.teamId).map((x) => s.players[x.id]!);
    expect(ours.some((p) => p.contract?.kind === 'rookie')).toBe(true);
    expect(s.user!.fund).toBeLessThan(fund);
    for (const p of ours) expect(p.teamId).toBe(s.user!.teamId);
  });
});

describe('stops', () => {
  it('a regular hurt for weeks stops the run, with an alert', () => {
    const s = clone(base);
    const stop = watchStops(s);
    const me = s.user!.teamId;
    const p = s.rosters[me]!.active.map((id) => s.players[id]!).find((x) => x.scouting.current >= 50)!;
    s.injuries[p.id] = { until: `${s.year}-06-30`, days: 40, onList: true, part: '햄스트링' };
    s.next++;
    expect(stop()).toBe(true);
    expect(s.alerts?.some((a) => a.id.startsWith(`stop-injury-${p.id}`))).toBe(true);
  });

  it('a week before the trade deadline, once', () => {
    const s = clone(base);
    const i = s.schedule.findIndex((g) => g.date >= `${s.year}-07-24`);
    s.next = i - 1;
    const stop = watchStops(s);
    s.next = i;
    expect(stop()).toBe(true);
    s.next = i + 5;
    expect(stop()).toBe(false);
  });

  it('change nothing in the season: the same days give the same games', () => {
    const a = clone(base);
    const b = clone(base);
    a.user!.settings.stops = ['injury', 'deadline', 'debut', 'race'];
    // Decisions that come up in the season are answered the scouts' way in both.
    const settle = (x: LeagueState) => {
      while (x.pending) apply(x, { kind: 'decide', input: autoDecision(x)! });
    };
    const target = a.next + 60;
    let guard = 0;
    while (a.next < target && guard++ < 200) {
      apply(a, { kind: 'days', days: 26, stops: true });
      settle(a);
    }
    guard = 0;
    while (b.next < a.next && guard++ < 400) {
      apply(b, { kind: 'days', days: 1 });
      settle(b);
    }
    expect(b.next).toBe(a.next);
    expect(JSON.stringify(a.scores)).toBe(JSON.stringify(b.scores));
    expect(raceState(a)).toBeNull();
  });

  it('can be turned off one by one', () => {
    const s = clone(base);
    apply(s, { kind: 'stops', kinds: ['deadline'] });
    expect(s.user!.settings.stops).toEqual(['deadline']);
  });
});

describe("the founding's risks", () => {
  it('name what this combination is hard about', () => {
    const island = foundingRisks(withScenario(free, 'ulleung')).join(' ');
    expect(island).toContain('시장 규모 4');
    expect(island).toContain('시의회');
    expect(island).toContain('해임 있음');
    expect(island).toContain('외국인 3명');
    const easy = foundingRisks({ ...free, parentType: 'conglomerate', promotion: 'immediate' }).join(' ');
    expect(easy).toContain('바로 1군');
    expect(easy).not.toContain('해임');
  });
});

describe("each AI club's plan", () => {
  it('reads public facts: a mode, needs, age and cap room for every club', () => {
    for (const t of base.teams.filter((x) => base.rosters[x.id] && x.id !== base.user!.teamId)) {
      const plan = clubStrategy(base, t.id);
      expect(['contend', 'balanced', 'rebuild']).toContain(plan.mode);
      expect(plan.why.length).toBeGreaterThan(0);
      expect(plan.age).toBeGreaterThan(20);
    }
  });

  it('a rebuilding club values youth more and age less; a need is worth more', () => {
    const s = clone(base);
    const players = Object.values(s.players).filter((p) => p.teamId && p.status === 'active' && !isForeign(p));
    const young = players.find((p) => ageIn(p, s.year) <= 23)!;
    const old = players.find((p) => ageIn(p, s.year) >= 32)!;
    const rebuild = { mode: 'rebuild' as const, why: '', needs: [], age: 30, room: 0 };
    expect(planFactor(s, rebuild, young)).toBeGreaterThan(1);
    expect(planFactor(s, rebuild, old)).toBeLessThan(1);
    expect(planFactor(s, { ...rebuild, mode: 'balanced', needs: [spotOf(old)] }, old)).toBeGreaterThan(1);
  });

  it('keeps its last catchers, and says why it likes or refuses an offer', () => {
    const s = clone(base);
    const other = s.teams.find((t) => s.rosters[t.id] && t.id !== s.user!.teamId)!.id;
    const plan = clubStrategy(s, other);
    const catchers = orgPlayers(s, other).filter((p) => spotOf(p) === 'C' && !isForeign(p));
    expect(planGuard(s, other, plan, catchers, [])).toMatch(/포수/);
    const mine = orgPlayers(s, s.user!.teamId).filter((p) => !isForeign(p) && p.proSince <= s.year && p.contract?.kind !== 'development');
    const theirs = orgPlayers(s, other).filter((p) => !isForeign(p) && p.proSince <= s.year && spotOf(p) !== 'C' && p.contract?.kind !== 'development');
    const check = checkTrade(s, other, [mine[0]!.id], [theirs.at(-1)!.id]);
    expect(check.problem).toBeNull();
    expect(check.reasons?.[0]).toContain(s.teams.find((t) => t.id === other)!.short);
  });
});

describe('from the founding, the scouts deciding', () => {
  /** Plays on, answering every decision the scouts' way, until `until` says stop. */
  function play(settings: ExpansionSettings, seed: string, until: (s: LeagueState) => boolean) {
    let s = apply(apply(createLeague(seed), { kind: 'toFounding' }), { kind: 'found', settings });
    const kinds: { kind: string; year: number }[] = [];
    for (let guard = 0; guard < 3000 && !until(s); guard++) {
      if (s.pending) {
        kinds.push({ kind: s.pending.kind, year: s.offseason?.year ?? s.year });
        s = apply(s, { kind: 'decide', input: autoDecision(s)! });
      } else if (s.phase === 'regular' && !regularOver(s)) s = apply(s, { kind: 'days', days: 30 });
      else if (s.phase === 'regular' || (s.phase === 'postseason' && s.bracket && !s.bracket.done)) s = apply(s, { kind: 'postseason' });
      else s = apply(s, { kind: 'nextSeason' });
    }
    return { s, kinds };
  }

  it('판타지 드래프트: the winter of 2027 drafts the league again, with no market, special or second draft that winter', () => {
    const { s, kinds } = play(withScenario({ ...free, autoPrep: true }, 'fantasy'), 'v160-fantasy', (x) => x.year >= 2028 && x.phase === 'regular');
    const winter = kinds.filter((k) => k.year === FANTASY.year).map((k) => k.kind);
    expect(winter).toContain('fantasyPick');
    for (const k of ['faRound', 'specialDraft', 'secondProtect', 'draftPick', 'rookieBonus']) expect(winter, k).not.toContain(k);
    expect(s.alerts?.some((a) => a.id === `fantasy-${FANTASY.year}`)).toBe(true);
    // A first team to play with.
    expect(s.rosters[s.user!.teamId]!.active.length).toBeGreaterThanOrEqual(26);
    expect(scenarioProgress(s)!.lines[0]).toContain('합계');
  }, 300_000);

  it('재기: the owner calls in the first first-team season', () => {
    const { s, kinds } = play(withScenario({ ...free, parentType: 'conglomerate', promotion: 'immediate', autoPrep: true }, 'comeback'), 'v160-comeback', (x) => x.year >= 2028);
    expect(kinds.some((k) => k.kind === 'meddle')).toBe(true);
    expect(s.user!.scenario!.orders!.length).toBeGreaterThan(0);
    expect(s.user!.trust).toBeGreaterThan(0);
  }, 300_000);
});
