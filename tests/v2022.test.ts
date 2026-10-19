/* 2.0.22: the homes of the clubs already in the league can be chosen; the retired-number bar can stop rising. */
import { describe, expect, it } from 'vitest';
import { cityById, REAL_CLUB_CITIES } from '../src/club/cities';
import { apply } from '../src/league/actions';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { maybeRetireNumber } from '../src/league/numbers';
import type { LeagueState } from '../src/league/state';

describe('the existing clubs’ homes', () => {
  it('lists the eight cities of the league’s clubs, each at a temporary ground', () => {
    expect(REAL_CLUB_CITIES.map((c) => c.id)).toEqual(['seoul', 'incheon-new', 'busan', 'daegu', 'gwangju', 'daejeon', 'suwon', 'changwon']);
    for (const c of REAL_CLUB_CITIES) expect(cityById(c.id)).toBe(c);
    expect(REAL_CLUB_CITIES.filter((c) => c.id !== 'seoul').every((c) => !c.stadium.real)).toBe(true);
  });

  it('founds a club in Busan', () => {
    const s = createLeague('v2022-busan');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '부산 테스트', short: '테스트', color: '#1f6fb2', cityId: 'busan', parentType: 'midsize', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    for (let i = 0; i < 40 && s.pending; i++) apply(s, { kind: 'decide', input: autoDecision(s)! });
    const t = s.teams.find((x) => x.id === s.user!.teamId)!;
    expect(s.user!.settings.cityId).toBe('busan');
    expect(t.stadium.name).toContain('구덕');
  }, 300_000);
});

describe('the retired-number bar', () => {
  const retireTwo = (rise: boolean) => {
    const s = createLeague('v2022-numbers') as LeagueState;
    if (!rise) s.retiredBarRise = false;
    const team = s.teams[0]!;
    team.retiredNumbers = [];
    // Two greats with the same career there, WAR 65 each: the second clears the bar only when it does not rise.
    const greats = Object.values(s.players)
      .filter((p) => p.teamId === team.id && p.number != null && p.number < 100 && p.numberTeam === team.id && p.role !== 'RP')
      .slice(0, 2);
    for (const p of greats) {
      p.career = Array.from({ length: 13 }, (_, i) => ({ ...(p.career[0] ?? ({} as never)), year: 2000 + i, teamId: team.id, level: undefined, war: 5 }));
      maybeRetireNumber(s, p, team.id, 2026);
    }
    return team.retiredNumbers.length;
  };
  it('rises a quarter for each number retired, unless turned off', () => {
    expect(retireTwo(true)).toBe(1);
    expect(retireTwo(false)).toBe(2);
  }, 300_000);
});

describe('the road', () => {
  it('measures the trip between the clubs’ homes, an island’s crossing added', async () => {
    const { kmBetween } = await import('../src/league/travel');
    expect(kmBetween('서울', '부산')).toBeGreaterThan(300);
    expect(kmBetween('서울', '부산')).toBeLessThan(350);
    expect(kmBetween('서울', '서울')).toBe(0);
    expect(kmBetween('울릉', '포항')).toBeGreaterThan(400);
  });

  it('tires a side on the first game in a new city only, and not at all when turned off', async () => {
    const { travelCost, tired } = await import('../src/league/travel');
    const s = createLeague('v2022-road');
    const games = s.schedule;
    // A club's second game in a row at the same host costs nothing; the first after a move from far costs.
    let first = 0,
      second = 0;
    for (let i = 1; i < games.length; i++) {
      const g = games[i]!;
      const c = travelCost(s, g.id, g.home, g.away);
      const prev = games.slice(0, i).reverse().find((x) => x.away === g.away || x.home === g.away);
      if (prev && prev.home === g.home) second += c.away;
      else first += c.away;
    }
    expect(second).toBe(0);
    expect(first).toBeGreaterThan(0);
    s.travelFatigue = false;
    expect(games.every((g) => travelCost(s, g.id, g.home, g.away).away === 0)).toBe(true);
    const team = { teamId: 'x', lineup: [{ id: 'b', bats: 'R', contact: 50, power: 50, eye: 50, speed: 50, defense: 50, pos: 'C' }], starter: { id: 'p', throws: 'R', stuff: 50, command: 50, breaking: 50, stamina: 50, pitchLimit: 100 }, bullpen: [] } as never;
    const t = tired(team, 2) as { lineup: { contact: number }[]; starter: { stuff: number } };
    expect(t.lineup[0]!.contact).toBe(48);
    expect(t.starter.stuff).toBe(49);
  }, 300_000);
});

describe('foreign players’ nicknames', () => {
  it('never calls a foreign player 「토종 에이스」, and gives him a foreign player’s name', async () => {
    const { nicknameOf, nicknameWinter } = await import('../src/league/nicknames');
    const { isForeign } = await import('../src/league/players');
    const s = createLeague('v2022-nick');
    const foreign = Object.values(s.players).filter((p) => p.status === 'active' && isForeign(p));
    expect(foreign.length).toBeGreaterThan(5);
    for (const p of foreign) p.nickname = { code: 'ace', i: 4, year: s.year - 1 };
    nicknameWinter(s, s.year, false);
    for (const p of foreign) expect(nicknameOf(s, p) ?? '').not.toContain('토종');
    const p = foreign[0]!;
    p.nickname = { code: 'ace', i: 0, year: s.year, foreign: true };
    expect(nicknameOf(s, p)).toBe('외인 에이스');
  });
});
