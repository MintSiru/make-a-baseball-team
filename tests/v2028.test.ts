/* 2.0.28: a high-school senior year in four events; real clubs for the prospects who played pro ball abroad. */
import { describe, expect, it } from 'vitest';
import Catalog from '../src/draftroom/catalog.js';
import { careerStages } from '../src/league/amateur';
import { createLeague } from '../src/league/history';
import { hsEvents, splitRecord } from '../src/league/hsevents';
import { MLB_CLUBS } from '../src/league/mlb';
import { proClubName, withRealClubs } from '../src/league/proclubs';

const institutions = (Catalog as unknown as { institutions: { id: string; kind: string; name: string; level?: string }[] }).institutions;

describe('real clubs abroad (2.0.28)', () => {
  it('names a big-league stop after an MLB club and a minor-league one after its farm team', () => {
    const mlb = institutions.find((x) => x.kind === 'overseas-pro' && x.level === 'MLB')!;
    const aaa = institutions.find((x) => x.kind === 'overseas-pro' && x.level === 'AAA')!;
    expect(MLB_CLUBS).toContain(proClubName('p1', { institutionId: mlb.id }));
    const farm = proClubName('p1', { institutionId: aaa.id })!;
    expect(farm.endsWith(' AAA')).toBe(true);
    expect(MLB_CLUBS).toContain(farm.slice(0, -4));
    // The same every time.
    expect(proClubName('p1', { institutionId: aaa.id })).toBe(farm);
  });

  it('leaves no invented big-league or minor-league club in a new league, and a save from before is fixed the same way', () => {
    const s = createLeague('v2028-clubs');
    const pro = new Set(institutions.filter((x) => x.kind === 'overseas-pro' && ['MLB', 'AAA', 'AA', 'A'].includes(x.level ?? '')).map((x) => x.name));
    const players = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass');
    let renamed = 0;
    for (const p of players)
      for (const e of p.education.history ?? []) {
        expect(pro.has(e.name)).toBe(false);
        if (proClubName(p.id, e)) renamed++;
      }
    expect(renamed).toBeGreaterThan(0);
    // An old save's names come back as a new game's.
    const p = players.find((x) => x.education.history?.some((e) => proClubName(x.id, e)))!;
    const e = p.education.history.find((x) => proClubName(p.id, x))!;
    const now = e.name;
    e.name = institutions.find((x) => x.id === e.institutionId)!.name;
    withRealClubs(p);
    expect(e.name).toBe(now);
  });
});

describe('a high-school senior year, event by event (2.0.28)', () => {
  it('gives every school the weekend league and the open national; the qualified national and the champions to a few', () => {
    const schools = institutions.filter((x) => x.kind === 'high-school' || x.kind === 'hs-club');
    const all = schools.map((s) => hsEvents(s.id, { key: 'v2028|hs|2026' }));
    for (const ev of all) {
      expect(ev.some((x) => x.kind === 'league')).toBe(true);
      expect(ev.some((x) => x.kind === 'open')).toBe(true);
    }
    expect(all.filter((ev) => ev.some((x) => x.kind === 'qualified')).length).toBe(32);
    const champs = all.filter((ev) => ev.some((x) => x.kind === 'champions'));
    expect(champs).toHaveLength(8);
    expect(champs.filter((ev) => ev.find((x) => x.kind === 'champions')!.result === '우승')).toHaveLength(1);
  });

  it('shares his senior record out without losing a game, a hit or an out', () => {
    const s = createLeague('v2028-hs');
    const hs = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass' && p.education.history?.length);
    let split = 0;
    for (const p of hs.slice(0, 300)) {
      for (const st of careerStages(p, s.seed)) {
        if (!st.events) continue;
        split++;
        const sum = (k: string) => st.events!.reduce((a, e) => a + (Number(e.record[k]) || 0), 0);
        expect(sum('games')).toBe(st.record.games);
        if (st.record.kind === 'pitcher') {
          expect(sum('outs')).toBe(st.record.outs);
          expect(sum('k')).toBe(st.record.k);
        } else {
          expect(sum('hits')).toBe(st.record.hits);
          expect(sum('hr')).toBe(st.record.hr);
          for (const e of st.events!) expect(Number(e.record.hr)).toBeLessThanOrEqual(Number(e.record.hits));
        }
      }
    }
    expect(split).toBeGreaterThan(100);
    // A plain split keeps its totals.
    const parts = splitRecord({ kind: 'hitter', games: 30, ab: 100, hits: 33, hr: 3, doubles: 6, triples: 1, bb: 10, sb: 5, rbi: 20, runs: 18 }, [9, 3, 2, 1], 'x');
    expect(parts.reduce((a, r) => a + Number(r.ab), 0)).toBe(100);
  });
});

describe('college events and the youth teams (2.0.28)', () => {
  it("gives a college Draft Room's league and, to each conference's top four, its national", async () => {
    const { schoolEvents } = await import('../src/league/hsevents');
    const four = institutions.filter((x) => x.kind === 'college').map((c) => schoolEvents(c.id, { key: 'v2028|college|2025' }));
    const two = institutions.filter((x) => x.kind === 'college2').map((c) => schoolEvents(c.id, { key: 'v2028|college|2025' }));
    for (const ev of [...four, ...two]) expect(ev.some((x) => x.kind === 'collegeLeague')).toBe(true);
    expect(four.filter((ev) => ev.some((x) => x.kind === 'collegeNational')).length).toBe(12);
    expect(two.filter((ev) => ev.some((x) => x.kind === 'collegeNational')).length).toBe(Math.min(4, two.length));
  });

  it('shows the U-18 team for a senior with the award, the U-23 team for a college player with his', () => {
    const s = createLeague('v2028-youth');
    const ps = Object.values(s.players).filter((p) => p.origin.kind === 'draftClass' && p.education.history?.length);
    const u18 = ps.filter((p) => p.amateur.awards.includes('U-18 대표팀'));
    const u23 = ps.filter((p) => p.amateur.awards.includes('대학 대표팀'));
    expect(u18.length + u23.length).toBeGreaterThan(0);
    for (const p of u18) expect(careerStages(p, s.seed).at(-1)!.youth?.kind).toBe('u18');
    for (const p of u23) expect(careerStages(p, s.seed).at(-1)!.youth?.kind).toBe('u23');
    // The same finish for the whole team in a year (the league holds many draft classes).
    const byYear = new Map<string, Set<string>>();
    for (const p of u18) {
      const year = p.education.history.at(-1)!.end ?? '';
      (byYear.get(year) ?? byYear.set(year, new Set()).get(year)!).add(careerStages(p, s.seed).at(-1)!.youth!.result);
    }
    for (const finishes of byYear.values()) expect(finishes.size).toBe(1);
  });
});

describe('the fall league, Australia and the wrap-up camp (2.0.28)', () => {
  it('sends prospects, keeps their lines and growth, bills the club, and allows each once a year', async () => {
    const { apply } = await import('../src/league/actions');
    const { checkCamp, checkDev, devCandidates, holdCamp, sendDev } = await import('../src/league/development');
    const s = createLeague('v2028-dev');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.phase = 'offseason';
    s.offseason ??= { year: s.year } as never;
    s.user!.fund = 1_000_000;
    // Some young players on the futures list to choose from.
    const r = s.rosters[s.user!.teamId]!;
    const young = Object.values(s.players).filter((p) => p.teamId === 'lg' && p.status === 'active' && p.origin.kind === 'draftClass').slice(0, 6);
    for (const p of young) {
      p.teamId = s.user!.teamId;
      p.birthday = `${s.offseason!.year - 21}-05-01`;
      r.futures.push(p.id);
    }
    const fall = devCandidates(s, 'fall').slice(0, 3).map((p) => p.id);
    expect(fall.length).toBe(3);
    const before = s.user!.fund;
    sendDev(s, 'fall', fall);
    expect(s.user!.fund).toBeLessThan(before);
    for (const id of fall) expect(s.players[id]!.devLog?.[0]?.kind).toBe('fall');
    expect(checkDev(s, 'fall', fall)).toMatch(/이미/);
    const abl = devCandidates(s, 'abl').slice(0, 2).map((p) => p.id);
    sendDev(s, 'abl', abl);
    expect(s.players[abl[0]!]!.devLog?.at(-1)?.kind).toBe('abl');
    expect(checkDev(s, 'abl', devCandidates(s, 'abl').slice(0, 4).map((p) => p.id))).not.toBeNull();
    // The camp: once a year, the young ones a little better.
    const p = s.players[young[5]!.id]!;
    const sum = () => Object.values(p.hidden.current).reduce((a, b) => a + (b ?? 0), 0);
    const was = sum();
    holdCamp(s, 'okinawa');
    expect(sum()).toBeGreaterThanOrEqual(was);
    expect(checkCamp(s, 'guam')).toMatch(/이미/);
  });
});

describe('the north on its own school circuit (2.0.28, 통일 한국)', () => {
  const southEvents = /^(서울|경기·강원|인천|대전·충청·전북|대구·경북|부산·울산|경남|광주·전남·제주) 권역|다이아몬드|퓨처 베이스볼|대학리그 (수도권|충청|영남)|^전문대학 리그/;

  it("gives a northern prospect the north's schools and tournaments, one winner each, awards that match", async () => {
    const { draftClass } = await import('../src/league/players');
    const { isNorthern } = await import('../src/league/north');
    const { northSeason } = await import('../src/league/northevents');
    const north = draftClass('v2028-north', 2030, { since: 2029 }).filter(isNorthern);
    expect(north.length).toBeGreaterThan(100);
    const southNames = new Set(institutions.map((x) => x.name));
    let withEvents = 0;
    for (const p of north) {
      for (const h of p.education.history) if (['high-school', 'hs-club', 'college', 'college2'].includes(h.kind)) expect(southNames.has(h.name)).toBe(false);
      for (const a of p.amateur.awards) expect(a).not.toMatch(southEvents);
      for (const s of careerStages(p, 'v2028-north')) {
        for (const e of s.events ?? []) expect(e.label).not.toMatch(southEvents);
        if (s.kept && s.events?.length) {
          withEvents++;
          // Each league or tournament won is an award, and each award one he won.
          for (const e of s.events) if ((e.result === '우승' || e.result === '준우승') && e.kind !== 'open' && e.kind !== 'champions') expect(p.amateur.awards).toContain(`${e.label} ${e.result}`);
        }
      }
    }
    expect(withEvents).toBeGreaterThan(50);
    const wins = new Map<string, number>();
    for (const evs of northSeason('v2028-north|draft|2030|north').values()) for (const e of evs) if (e.result === '우승') wins.set(e.label, (wins.get(e.label) ?? 0) + 1);
    expect(wins.size).toBeGreaterThanOrEqual(11);
    for (const n of wins.values()) expect(n).toBe(1);
  });

  it("puts an old save's northern player through the same circuit", async () => {
    const { draftClass } = await import('../src/league/players');
    const { isNorthern } = await import('../src/league/north');
    const { northernPast } = await import('../src/league/northevents');
    const p = draftClass('v2028-north', 2030, { since: 2029 }).filter(isNorthern).find((x) => x.education.history.length > 1)!;
    const school = institutions.find((x) => x.kind === 'high-school')!;
    const old = { ...p, education: { ...p.education, history: p.education.history.map((h, i) => (i === 0 ? { ...h, kind: 'high-school', name: school.name } : h)) }, amateur: { ...p.amateur, awards: ['서울 권역 주말리그 우승', 'U-18 대표팀'] } };
    const fixed = northernPast(old, 'v2028-north|draft|2030|north');
    expect(fixed.education.history[0]!.name).not.toBe(school.name);
    expect(fixed.amateur.awards).toContain('U-18 대표팀');
    expect(fixed.amateur.awards.some((a) => a.startsWith('서울'))).toBe(false);
    // Again changes nothing.
    expect(northernPast(fixed, 'v2028-north|draft|2030|north')).toEqual(fixed);
  });
});

describe('the AI clubs offer us trades (2.0.28)', () => {
  it('offers a fair deal it would sign off on, keeps it ten days, and goes through when we take it', async () => {
    const { apply } = await import('../src/league/actions');
    const { firstTeamIds } = await import('../src/league/state');
    const { aiOffers, liveOffers, OFFERS } = await import('../src/league/offers');
    const { checkTrade, tradeValue, pickValue } = await import('../src/league/trade');
    const { rng } = await import('../src/draftroom');
    const s = createLeague('v2028-offers');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    // Run one of the clubs already in the league, in May.
    s.user!.teamId = firstTeamIds(s)[0]!;
    s.pending = null;
    s.next = s.schedule.findIndex((g) => g.date >= `${s.year}-05-10`);
    for (let i = 0; i < 20; i++) aiOffers(s, `${s.year}-05-10`, rng(`v2028-offers|${i}`));
    const offers = liveOffers(s);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.length).toBeLessThanOrEqual(OFFERS.open);
    expect(s.alerts?.some((a) => a.id === offers[0]!.id)).toBe(true);
    for (const o of offers) {
      expect(checkTrade(s, o.teamId, o.give, o.get, o.extras).accepted).toBe(true);
      const ask = o.give.reduce((a, id) => a + tradeValue(s, s.players[id]!), 0);
      const pay = o.get.reduce((a, id) => a + tradeValue(s, s.players[id]!), 0) + (o.extras.picksIn ?? []).reduce((a, r) => a + pickValue(s, o.teamId, r), 0);
      expect(pay).toBeGreaterThanOrEqual(ask * OFFERS.fair - 0.01);
    }
    // Turned down: gone. Taken: the players change clubs.
    apply(s, { kind: 'tradeOffer', id: offers[0]!.id, accept: false });
    expect(liveOffers(s).some((o) => o.id === offers[0]!.id)).toBe(false);
    const take = liveOffers(s)[0];
    if (take) {
      apply(s, { kind: 'tradeOffer', id: take.id, accept: true });
      expect(s.players[take.give[0]!]!.teamId).toBe(take.teamId);
      expect(s.players[take.get[0]!]!.teamId).toBe(s.user!.teamId);
    }
    // Ten days on, an offer left alone has lapsed.
    s.next = s.schedule.findIndex((g) => g.date > `${s.year}-05-${10 + OFFERS.days}`);
    expect(liveOffers(s).length).toBe(0);
  });
});

describe('클러치 (2.0.28)', () => {
  it('is a hidden trait that leans on 멘탈, stays the same for a player from before, and stays within ±5 grade points', async () => {
    const { clutchEdge, clutchOf, rollTraits } = await import('../src/league/traits');
    const xs = Array.from({ length: 2000 }, (_, i) => rollTraits('v2028-clutch', `p${i}`, '큰 무대를 즐기는 대담형'));
    const ys = Array.from({ length: 2000 }, (_, i) => rollTraits('v2028-clutch', `p${i}`, '분석을 즐기는 연구형'));
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(xs.map((t) => t.clutch!))).toBeGreaterThan(mean(ys.map((t) => t.clutch!)));
    // An old player (no 클러치 kept) gets the same value every time.
    const old = { id: 'old-1', personality: '', hidden: { traits: { ...xs[0]!, clutch: undefined } } } as never;
    expect(clutchOf(old)).toBe(clutchOf(old));
    for (const t of xs) expect(Math.abs(clutchEdge({ id: 'x', personality: '', hidden: { traits: t } } as never))).toBeLessThanOrEqual(5);
  });

  it('moves a hitter with runners in scoring position only, and counts those plate appearances apart', async () => {
    const { simulateGame } = await import('../src/league/engine/game');
    const { rng } = await import('../src/draftroom');
    const POS = ['CF', 'SS', '2B', '1B', '3B', 'LF', 'RF', 'DH', 'C'] as const;
    const team = (id: string, clutch: number) => ({
      teamId: id,
      lineup: POS.map((pos, i) => ({ id: `${id}-b${i}`, bats: 'R' as const, contact: 55, power: 55, eye: 55, speed: 55, defense: 55, pos, clutch })),
      starter: { id: `${id}-sp`, throws: 'R' as const, stuff: 55, command: 55, breaking: 55, stamina: 55, pitchLimit: 90 },
      bullpen: (['CL', 'SU', 'HL', 'MU', 'LR'] as const).map((role, i) => ({ id: `${id}-rp${i}`, throws: 'R' as const, stuff: 55, command: 55, breaking: 55, stamina: 40, pitchLimit: 30, role })),
    });
    const line = (clutch: number) => {
      const t = { all: { pa: 0, h: 0, ab: 0 }, risp: { pa: 0, h: 0, ab: 0 } };
      for (let i = 0; i < 150; i++) {
        const out = simulateGame({ gameId: `c${i}`, home: team('H', clutch), away: team('A', 0), maxInnings: 11, park: 1 }, rng(`v2028-clutch|${i}`));
        for (const b of out.home.batting) {
          t.all.pa += b.pa;
          t.all.h += b.h;
          t.all.ab += b.ab;
          const s = b.split?.S;
          if (s) {
            t.risp.pa += s.pa;
            t.risp.h += s.h;
            t.risp.ab += s.ab;
          }
        }
      }
      return t;
    };
    const hi = line(5),
      lo = line(-5);
    expect(hi.risp.pa).toBeGreaterThan(500);
    expect(hi.risp.pa).toBeLessThan(hi.all.pa);
    expect(hi.risp.h / hi.risp.ab).toBeGreaterThan(lo.risp.h / lo.risp.ab);
    // With the bases empty or a runner on first only, the same hitters.
    const rest = (t: typeof hi) => (t.all.h - t.risp.h) / (t.all.ab - t.risp.ab);
    expect(Math.abs(rest(hi) - rest(lo))).toBeLessThan(0.03);
  });
});

describe("a player's moves (2.0.28)", () => {
  it('starts from his draft pick, notes trades, free-agent deals and retirement, and reads an old save off his career', async () => {
    const { moveHistory } = await import('../src/league/moves');
    const s = createLeague('v2028-moves');
    const ps = Object.values(s.players);
    const kinds = new Set(ps.flatMap((p) => (p.moves ?? []).map((m) => m.kind)));
    for (const k of ['trade', 'fa', 'retire', 'release'] as const) expect(kinds.has(k)).toBe(true);
    const traded = ps.find((p) => p.moves?.some((m) => m.kind === 'trade') && s.draftLog?.some((d) => d.id === p.id))!;
    const rows = moveHistory(s, traded);
    expect(rows[0]!.kind).toBe('draft');
    expect(rows.find((r) => r.kind === 'trade')!.note).toMatch(/↔/);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.date >= rows[i - 1]!.date).toBe(true);
    // A save from before: no moves kept, the club changes come from his career.
    const mover = ps.find((p) => new Set(p.career.map((c) => c.teamId)).size >= 3)!;
    const old = moveHistory(s, { ...mover, moves: undefined });
    expect(old.filter((r) => r.kind === 'change').length).toBeGreaterThanOrEqual(2);
  });
});

describe('논쟁성, arguing the calls, and the rare scandals (2.0.28)', () => {
  it('is a hidden trait the hotheads lean to, about 1 on average as a factor, and read by the manager', async () => {
    const { rollTraits, temperFactor } = await import('../src/league/traits');
    const as = (personality: string) => Array.from({ length: 1500 }, (_, i) => ({ id: `t${i}`, personality, hidden: { traits: rollTraits('v2028-temper', `t${i}`, personality) } }) as never);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const hot = as('승부욕 강한 도전자').map(temperFactor),
      calm = as('차분한 노력파').map(temperFactor);
    expect(mean(hot)).toBeGreaterThan(mean(calm) * 1.5);
    const all = ['차분한 노력파', '승부욕 강한 도전자', '밝은 분위기 메이커', '분석을 즐기는 연구형', '책임감 강한 리더', '말보다 행동하는 실천형', '꾸준함을 믿는 성실형', '큰 무대를 즐기는 대담형'].flatMap((x) => as(x).map(temperFactor));
    expect(mean(all)).toBeGreaterThan(0.8);
    expect(mean(all)).toBeLessThan(1.3);
  });

  it('lets most arguments go, throws the hotheads out far more often, and writes up the ejections', async () => {
    const { protestGame } = await import('../src/league/protests');
    // Our club's arguments (their count is kept on our players' pages), once hot-headed and once calm (one league,
    // copied for each run: making it twice outran the time limit).
    const base = createLeague('v2028-protest');
    const run = (temper: number) => {
      const s = structuredClone(base);
      const [a, b] = s.teams.filter((t) => s.rosters[t.id]).map((t) => t.id);
      s.user = { teamId: a! } as never;
      const side = (teamId: string, t: number) => {
        const ids = s.rosters[teamId]!.active.slice(0, 10);
        for (const id of ids) s.players[id]!.hidden.traits = { ...s.players[id]!.hidden.traits!, temper: t };
        return { teamId, runs: 0, hits: 0, errors: 0, lineScore: [], batting: ids.map((id) => ({ id, pa: 4 })), pitching: [] } as never;
      };
      const home = side(a!, temper),
        away = side(b!, 50);
      for (let i = 0; i < 4000; i++) protestGame(s, { gameId: `pg${i}`, innings: 9, home, away, result: 'tie' }, `pg${i}`, `${s.year}-06-01`);
      const ours = Object.values(s.players).filter((p) => p.teamId === a);
      return { protests: ours.reduce((x, p) => x + (p.life?.protests ?? 0), 0), ejections: ours.reduce((x, p) => x + (p.life?.ejections ?? 0), 0), news: (s.news ?? []).filter((n) => n.id.startsWith('protest-')).length, theirs: Object.values(s.players).filter((p) => p.teamId === b && p.life?.protests).length };
    };
    const hot = run(95),
      calm = run(15);
    expect(hot.protests).toBeGreaterThan(calm.protests * 2);
    expect(hot.ejections / hot.protests).toBeGreaterThan(calm.ejections / Math.max(1, calm.protests));
    expect(hot.ejections).toBeLessThan(hot.protests);
    expect(hot.news).toBeGreaterThan(0);
    // The other club's players keep no page of it.
    expect(hot.theirs).toBe(0);
  });

  it('has the new player and club trouble, with the KBO penalty where there is one and none where there is not', async () => {
    const { apply } = await import('../src/league/actions');
    const { scandalDay } = await import('../src/league/scandals');
    const { SCANDAL } = await import('../src/league/tuning');
    const s = createLeague('v2028-scandal');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.user!.teamId = s.teams.find((t) => s.rosters[t.id]?.active.length)!.id;
    s.pending = null;
    const saved = { rare: { ...SCANDAL.rare }, club: { ...SCANDAL.club.rates }, rates: { ...SCANDAL.rates } };
    try {
      for (const k of Object.keys(SCANDAL.rare) as (keyof typeof SCANDAL.rare)[]) SCANDAL.rare[k] = 4;
      for (const k of Object.keys(SCANDAL.club.rates) as (keyof typeof SCANDAL.club.rates)[]) SCANDAL.club.rates[k] = 4;
      for (const k of Object.keys(SCANDAL.rates) as (keyof typeof SCANDAL.rates)[]) SCANDAL.rates[k] = 0;
      const seen = new Set<string>();
      for (let d = 0; d < 300 && seen.size < 7; d++) {
        const date = new Date(Date.parse(`${s.year}-04-01`) + d * 86400000).toISOString().slice(0, 10);
        scandalDay(s, date);
        const pend = s.pending as { kind: string; id: string; offense: string } | null;
        if (pend?.kind === 'scandal') {
          seen.add(pend.offense);
          const banned = !!s.suspended?.[pend.id];
          expect(banned).toBe(['gambling', 'gangs', 'draftDodge', 'drunkBrawl', 'hazing'].includes(pend.offense));
          s.pending = null;
        }
      }
      expect(seen.size).toBeGreaterThanOrEqual(5);
      expect((s.alerts ?? []).filter((x) => x.id.startsWith('club-trouble-')).length).toBeGreaterThan(0);
    } finally {
      Object.assign(SCANDAL.rare, saved.rare);
      Object.assign(SCANDAL.club.rates, saved.club);
      Object.assign(SCANDAL.rates, saved.rates);
    }
    // And rare in a normal season: a few in a hundred club seasons each.
    for (const v of Object.values(SCANDAL.rare)) expect(v).toBeLessThanOrEqual(0.02);
  });
});

describe('the calls argued, foreign players and the papers (2.0.28)', () => {
  it('argues balls and strikes only without the ABS, and the plays on the bases and the lines either way', async () => {
    const { protestGame } = await import('../src/league/protests');
    const { setEraBoard } = await import('../src/league/era');
    // One league for both runs (it takes about a minute to make), a fresh copy each.
    const base = createLeague('v2028-calls');
    const run = (abs: number) => {
      const s = structuredClone(base);
      setEraBoard([{ from: 0, item: 'abs', value: abs }]);
      const [a, b] = s.teams.filter((t) => s.rosters[t.id]).map((t) => t.id);
      const side = (teamId: string) => {
        const ids = s.rosters[teamId]!.active.slice(0, 10);
        for (const id of ids) s.players[id]!.hidden.traits = { ...s.players[id]!.hidden.traits!, temper: 95 };
        return { teamId, runs: 0, hits: 0, errors: 0, lineScore: [], batting: ids.map((id) => ({ id, pa: 4 })), pitching: [] } as never;
      };
      const home = side(a!),
        away = side(b!);
      for (let i = 0; i < 3000; i++) protestGame(s, { gameId: `c${i}`, innings: 9, home, away, result: 'tie' }, `c${i}`, `${s.year}-06-01`);
      setEraBoard([]);
      return (s.news ?? []).filter((n) => n.id.startsWith('protest-')).map((n) => n.body);
    };
    const withAbs = run(2),
      without = run(0);
    expect(withAbs.some((t) => t.includes('볼·스트라이크'))).toBe(false);
    expect(without.some((t) => t.includes('볼·스트라이크'))).toBe(true);
    for (const call of ['아웃·세이프', '홈런·파울', '페어·파울']) expect(withAbs.some((t) => t.includes(call))).toBe(true);
    expect(withAbs.some((t) => t.includes('비디오 판독'))).toBe(true);
    expect(withAbs.length).toBeLessThan(without.length);
  });

  it('keeps the foreign players’ trouble and the papers rare, and points them at the right players', async () => {
    const { FOREIGN_TROUBLE } = await import('../src/league/scandals');
    const { SCANDAL } = await import('../src/league/tuning');
    expect(FOREIGN_TROUBLE.medical).toBeLessThanOrEqual(0.05);
    for (const v of Object.values(FOREIGN_TROUBLE.rates)) expect(v).toBeLessThanOrEqual(0.02);
    for (const v of Object.values(SCANDAL.pr.rates)) expect(v).toBeLessThanOrEqual(0.03);
    const { apply } = await import('../src/league/actions');
    const { scandalDay } = await import('../src/league/scandals');
    const s = createLeague('v2028-foreign-trouble');
    apply(s, { kind: 'toFounding' });
    apply(s, { kind: 'found', settings: { name: '청주 독수리', short: '독수리', color: '#1f6fb2', cityId: 'cheongju', parentType: 'conglomerate', parentName: '청주그룹', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } });
    s.user!.teamId = s.teams.find((t) => s.rosters[t.id]?.active.length)!.id;
    s.pending = null;
    const saved = { f: { ...FOREIGN_TROUBLE.rates }, pr: { ...SCANDAL.pr.rates }, rates: { ...SCANDAL.rates }, rare: { ...SCANDAL.rare }, club: { ...SCANDAL.club.rates } };
    try {
      for (const o of [SCANDAL.rates, SCANDAL.rare, SCANDAL.club.rates] as Record<string, number>[]) for (const k of Object.keys(o)) o[k] = 0;
      for (const k of Object.keys(FOREIGN_TROUBLE.rates) as (keyof typeof FOREIGN_TROUBLE.rates)[]) FOREIGN_TROUBLE.rates[k] = 8;
      for (const k of Object.keys(SCANDAL.pr.rates) as (keyof typeof SCANDAL.pr.rates)[]) SCANDAL.pr.rates[k] = 4;
      const offenses: string[] = [];
      for (let d = 0; d < 200; d++) {
        const date = new Date(Date.parse(`${s.year}-04-01`) + d * 86400000).toISOString().slice(0, 10);
        scandalDay(s, date);
        const pend = s.pending as { kind: string; id: string; offense: string } | null;
        if (pend?.kind === 'scandal') {
          offenses.push(pend.offense);
          expect(s.players[pend.id]!.origin.kind).toBe('foreign');
          s.pending = null;
        }
      }
      expect(offenses.length).toBeGreaterThan(0);
      expect(new Set(offenses).size).toBeLessThanOrEqual(2);
      expect((s.news ?? []).filter((n) => n.id.startsWith('pr-')).length).toBeGreaterThan(0);
    } finally {
      Object.assign(FOREIGN_TROUBLE.rates, saved.f);
      Object.assign(SCANDAL.pr.rates, saved.pr);
      Object.assign(SCANDAL.rates, saved.rates);
      Object.assign(SCANDAL.rare, saved.rare);
      Object.assign(SCANDAL.club.rates, saved.club);
    }
  });
});
