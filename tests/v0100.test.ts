/* V0.10: players and facilities. Programmes at training centres abroad, life off the field (events, form, family
   leave), the fans' fondness for each player, and the facilities the user's club can build. */
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { autoDecision, EXPANSION_ID } from '../src/league/expansion';
import { facilityGrowth, facilityInjury, facilityOptions, facilityUpkeep, openFacilities, premiumShare } from '../src/league/facilities';
import { createLeague } from '../src/league/history';
import { fanAffinity, farewell, favouritesMerch, formOf, lifeDay } from '../src/league/life';
import { matchInputs } from '../src/league/manager';
import { ageIn, isForeign, isPitcher } from '../src/league/players';
import { orgPlayers, type LeagueState } from '../src/league/state';
import { checkTrip, finishTrips, SITES, tripGains } from '../src/league/training';
import { clubState } from '../src/league/fans';
import { statLine } from '../src/league/views';

let s: LeagueState;
const pending = () => s.pending as LeagueState['pending'];
const decideAll = () => {
  while (pending()) apply(s, { kind: 'decide', input: autoDecision(s)! });
};

beforeAll(() => {
  s = createLeague('v0100-test');
  apply(s, { kind: 'toFounding' });
  apply(s, {
    kind: 'found',
    settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null },
  });
  decideAll();
  apply(s, { kind: 'regularEnd' });
  apply(s, { kind: 'postseason' });
  apply(s, { kind: 'nextSeason' });
  decideAll();
}, 600_000);

const mine = (c: LeagueState) => orgPlayers(c, EXPANSION_ID).filter((p) => p.status === 'active' && !isForeign(p));

describe('training abroad', () => {
  it('takes only the right players, within the limits and the fund', () => {
    const c = structuredClone(s);
    expect(c.phase).toBe('regular');
    const pitcher = mine(c).find(isPitcher)!;
    const hitter = mine(c).find((p) => !isPitcher(p))!;
    expect(checkTrip(c, hitter.id, 'seattle')).toMatch(/투수만/);
    expect(checkTrip(c, pitcher.id, 'arizona')).toMatch(/타자만/);
    const foreign = orgPlayers(c, EXPANSION_ID).find(isForeign)!;
    expect(checkTrip(c, foreign.id, 'tokyo')).toMatch(/외국인/);
    const other = Object.values(c.players).find((p) => p.teamId === 'kia')!;
    expect(checkTrip(c, other.id, 'tokyo')).toMatch(/우리 선수/);
    c.user!.fund = 1000;
    expect(checkTrip(c, pitcher.id, 'tokyo')).toMatch(/자금/);
  });

  it('during the season he leaves the roster, and comes back with what he gained', () => {
    const c = structuredClone(s);
    const p = mine(c).filter(isPitcher).sort((a, b) => ageIn(a, c.year) - ageIn(b, c.year))[0]!;
    const fund = c.user!.fund;
    apply(c, { kind: 'trip', id: p.id, site: 'seattle' });
    expect(c.user!.fund).toBe(fund - SITES.seattle.cost);
    expect(c.abroad?.[p.id]).toBeDefined();
    expect(c.rosters[EXPANSION_ID]!.active).not.toContain(p.id);
    expect(checkTrip(c, p.id, 'tokyo')).toMatch(/이미/);
    const until = c.abroad![p.id]!;
    apply(c, { kind: 'days', days: 50 });
    expect(c.abroad?.[p.id]).toBeUndefined();
    const trip = c.user!.trips!.find((t) => t.id === p.id)!;
    expect(trip.until).toBe(until);
    expect(trip.result).toBeDefined();
    expect(c.alerts?.some((a) => a.id === `trip-${c.year}-${p.id}`)).toBe(true);
  });

  it('young players with room gain more than veterans, and a gain can lift the ceiling a little', () => {
    const c = structuredClone(s);
    const ps = mine(c).filter(isPitcher);
    const young = ps.sort((a, b) => ageIn(a, c.year) - ageIn(b, c.year))[0]!;
    const old = [...ps].sort((a, b) => ageIn(b, c.year) - ageIn(a, c.year))[0]!;
    young.hidden.potential.stuff = (young.hidden.current.stuff ?? 50) + 10;
    old.hidden.potential.stuff = (old.hidden.current.stuff ?? 50) + 10;
    const half = () => 0.5;
    const g1 = tripGains(c, young, 'seattle', c.year, half).stuff ?? 0;
    const g2 = tripGains(c, old, 'seattle', c.year, half).stuff ?? 0;
    expect(g1).toBeGreaterThan(g2);
    const capped = mine(c).filter(isPitcher)[1]!;
    capped.hidden.potential.stuff = capped.hidden.current.stuff;
    const g3 = tripGains(c, capped, 'seattle', c.year, () => 0.99).stuff ?? 0;
    expect(g3).toBeLessThanOrEqual(1);
    expect(capped.hidden.potential.stuff).toBeCloseTo(capped.hidden.current.stuff!, 5);
  });

  it('a winter programme runs in December and is over by opening day', () => {
    const c = structuredClone(s);
    apply(c, { kind: 'regularEnd' });
    apply(c, { kind: 'postseason' });
    apply(c, { kind: 'nextSeason' });
    const p = mine(c).find((x) => !isPitcher(x))!;
    expect(c.phase).toBe('offseason');
    apply(c, { kind: 'trip', id: p.id, site: 'arizona' });
    const trip = c.user!.trips!.at(-1)!;
    expect(trip.inSeason).toBe(false);
    expect(trip.from).toBe(`${c.offseason!.year}-12-01`);
    expect(c.abroad?.[p.id]).toBeUndefined();
    while (c.pending) apply(c, { kind: 'decide', input: autoDecision(c)! });
    expect(c.phase).toBe('regular');
    expect(trip.result).toBeDefined();
    finishTrips(c, '9999-01-01');
  });
});

describe('facilities', () => {
  it('are built in the winter, from the fund, and open the next season', () => {
    const c = structuredClone(s);
    expect(facilityOptions(c).every((o) => o.blocked)).toBe(true);
    apply(c, { kind: 'regularEnd' });
    apply(c, { kind: 'postseason' });
    apply(c, { kind: 'nextSeason' });
    c.user!.fund = 5_000_000;
    const fund = c.user!.fund;
    apply(c, { kind: 'facility', facility: 'indoor' });
    expect(c.user!.fund).toBe(fund - 800_000);
    expect(c.user!.ledger.at(-1)).toMatchObject({ capital: true });
    expect(facilityOptions(c).find((o) => o.kind === 'gym')!.blocked).toMatch(/하나/);
    expect(openFacilities(c, c.offseason!.year + 1)).toEqual(['indoor']);
    const p = mine(c)[0]!;
    expect(facilityGrowth(c, p, c.year)).toBeCloseTo(0.03, 5);
    expect(facilityUpkeep(c, EXPANSION_ID).training).toBe(20_000);
  });

  it('do nothing for AI clubs', () => {
    const c = structuredClone(s);
    c.user!.facilities = { indoor: 2, gym: 2, premium: 2, turf: 1 };
    const kia = Object.values(c.players).find((p) => p.teamId === 'kia')!;
    expect(facilityGrowth(c, kia, c.year)).toBe(0);
    expect(facilityInjury(c, 'kia')).toBe(0);
    expect(premiumShare(c, 'kia')).toBe(0);
    expect(facilityInjury(c, EXPANSION_ID)).toBeCloseTo(0.17, 5);
    expect(premiumShare(c, EXPANSION_ID)).toBeCloseTo(0.12, 5);
  });
});

describe('life off the field', () => {
  it('a season brings a few dozen events to the user’s players, none to others', () => {
    const c = structuredClone(s);
    apply(c, { kind: 'regularEnd' });
    const events = (c.news ?? []).filter((n) => n.id.startsWith('life-'));
    expect(events.length).toBeGreaterThanOrEqual(8);
    expect(events.length).toBeLessThanOrEqual(45);
    for (const n of events) expect(c.players[n.players[0]!]!.teamId).toBe(EXPANSION_ID);
    expect(Object.values(c.players).some((p) => p.teamId !== EXPANSION_ID && p.life)).toBe(false);
  });

  it('family leave (a birth or a loss) is at most five days, on the away list that keeps registered days', () => {
    const c = structuredClone(s);
    let found = 0;
    for (let i = 0; i < 600; i++) {
      const date = new Date(Date.parse('2027-04-01') + i * 86400000).toISOString().slice(0, 10);
      const before = new Set(Object.keys(c.away));
      const id = lifeDay(c, date);
      if (id && c.away[id] && !before.has(id)) {
        found++;
        expect((Date.parse(c.away[id]!) - Date.parse(date)) / 86400000).toBeLessThan(5);
        delete c.away[id];
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('form moves his tools in the game inputs', () => {
    const c = structuredClone(s);
    const game = c.schedule.slice(c.next).find((g) => g.home === EXPANSION_ID || g.away === EXPANSION_ID)!;
    const side = game.home === EXPANSION_ID ? 'home' : 'away';
    const spec = { teamId: EXPANSION_ID };
    const other = { teamId: game.home === EXPANSION_ID ? game.away : game.home };
    const before = matchInputs(c, game.date, side === 'home' ? spec : other, side === 'home' ? other : spec)[side]!;
    const b = before.lineup[0]!;
    const p = c.players[b.id]!;
    (p.life ??= {}).form = { delta: 2.5, until: game.date, why: 'test' };
    expect(formOf(p, game.date)).toBe(2.5);
    const after = matchInputs(c, game.date, side === 'home' ? spec : other, side === 'home' ? other : spec)[side]!;
    const a = after.lineup.find((x) => x.id === b.id)!;
    expect(a.contact - b.contact).toBeCloseTo(2.5, 5);
    expect(a.power - b.power).toBeCloseTo(2.5, 5);
    expect(a.speed).toBe(b.speed);
  });

  it('births and deaths in the family are rare (0.10.1), and pop up only when a first-team player is out', () => {
    const c = structuredClone(s);
    let family = 0;
    for (let i = 0; i < 180; i++) {
      const date = new Date(Date.parse('2027-04-01') + i * 86400000).toISOString().slice(0, 10);
      const before = new Set(Object.keys(c.away));
      const id = lifeDay(c, date);
      const news = id ? c.news!.find((n) => n.id === `life-${date}-${id}`) : undefined;
      if (news && /득남|득녀|(부친|모친|조부|조모)상/.test(news.title)) family++;
      const alert = c.alerts?.find((a) => a.id === `life-${date}-${id}`);
      if (alert && id) expect(!!c.away[id] && !before.has(id) || !!c.injuries[id]).toBe(true);
      if (id) delete c.away[id];
    }
    expect(family).toBeLessThanOrEqual(5);
  });

  it('nothing happens in a spectator league', () => {
    const c = structuredClone(s);
    c.user = null;
    expect(lifeDay(c, c.schedule[c.next]!.date)).toBeNull();
  });
});

describe('a player at a glance (0.10.1)', () => {
  it('the free-agent list and the search show his last numbers', () => {
    const veterans = Object.values(s.players).filter((p) => p.teamId === 'kia' && p.career.some((c) => !c.level && (c.bat?.pa ?? 0) > 200 || (c.pit?.outs ?? 0) > 150));
    const hitter = veterans.find((p) => !isPitcher(p))!;
    const pitcher = veterans.find((p) => isPitcher(p))!;
    expect(statLine(s, hitter)!.text).toMatch(/OPS/);
    expect(statLine(s, pitcher)!.text).toMatch(/ERA .*이닝/);
  });
});

describe('the fans’ fondness', () => {
  it('home-grown long-serving stars are loved most, and the user’s favourites sell shirts', () => {
    const kia = Object.values(s.players).filter((p) => p.teamId === 'kia' && p.status === 'active');
    const loved = kia.map((p) => ({ p, love: fanAffinity(s, p) })).sort((a, b) => b.love - a.love);
    const top = loved[0]!;
    expect(top.love).toBeGreaterThan(60);
    expect(top.p.career.filter((c) => !c.level && c.teamId === 'kia').length).toBeGreaterThanOrEqual(3);
    expect(loved.at(-1)!.love).toBeLessThan(top.love);
    expect(favouritesMerch(s, 'kia')).toBe(0);
    expect(favouritesMerch(s, EXPANSION_ID)).toBeGreaterThanOrEqual(0);
  });

  it('a well-liked player leaving cools the fans', () => {
    const c = structuredClone(s);
    const p = mine(c)[0]!;
    (p.life ??= {}).fans = 30;
    p.career.push(...[1, 2, 3, 4, 5].map((i) => ({ year: c.year - i, teamId: EXPANSION_ID, age: 28, days: 150, bat: null, pit: null, war: 5 })));
    expect(fanAffinity(c, p)).toBeGreaterThanOrEqual(60);
    const before = clubState(c, EXPANSION_ID).interest;
    farewell(c, p, EXPANSION_ID, '트레이드');
    expect(clubState(c, EXPANSION_ID).interest).toBeLessThan(before);
    expect((c.news ?? []).some((n) => n.title.includes(p.name) && n.title.includes('떠나'))).toBe(true);
  });
});
