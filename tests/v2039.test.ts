/* 2.0.39 (the user's requests): a founded club's territorial picks come from its city's region (울릉 in 대구·경북,
   the north's cities in theirs); a foreign player re-signs for at least a full season's worth, however little a late
   replacement deal paid; and money moves a player — a walk year lifts him, a big deal or pay far over his play can
   weigh on him, in the season and the winter after. */
import { describe, expect, it } from 'vitest';
import { MOOD, moodEdge, moodWinter, seasonMoods, walkYear } from '../src/league/contractmood';
import { foreignRenewalAsk, foreignWorth, territorialEligible } from '../src/league/offseason';
import { draftClass, isForeign } from '../src/league/players';
import { draftRegionOf } from '../src/league/territorial';
import { apply } from '../src/league/actions';
import { clubState } from '../src/league/fans';
import { settleFinances } from '../src/league/finance';
import { checkSponsor, regionSchools, schoolBoost, schoolPick, schoolRegion, SCHOOLS, schoolsWinter } from '../src/league/schools';
import { traitsOf } from '../src/league/traits';
import { INTERNATIONAL } from '../src/league/international';
import { playNationalGames } from '../src/league/nationalgames';
import type { NationalEntry } from '../src/league/state';
import { formOf } from '../src/league/life';
import { checkSpend, SPEND } from '../src/league/spending';
import { travelCost } from '../src/league/travel';
import { loadSave } from './helpers';

describe('territorial picks of a founded club (2.0.39)', () => {
  it('a club on 울릉도 draws on 대구·경북, a northern one on its province', () => {
    const s = loadSave('2.0.38');
    const me = s.user!.teamId;
    const team = s.teams.find((t) => t.id === me)!;
    const cls = draftClass(s.seed, s.year, s.unified);
    for (const [city, region] of [
      ['울릉', '대구·경북'],
      ['함흥', '함경남도'],
      ['청주', '대전·충청·전북'],
    ] as const) {
      team.region = city;
      expect(draftRegionOf(s, me)).toBe(region);
    }
    team.region = '울릉';
    const ours = cls.filter((p) => territorialEligible(s, me, p));
    expect(ours.length).toBeGreaterThan(20);
    expect(ours.every((p) => p.education.region === '대구·경북' && p.origin.entryCategory === 'high-school')).toBe(true);
    // The original clubs keep their own regions.
    expect(draftRegionOf(s, 'samsung')).toBeNull();
  });
});

describe('re-signing a late replacement (2.0.39)', () => {
  it('asks a full season’s worth, not the few weeks he was paid', () => {
    const s = loadSave('2.0.38');
    const p = Object.values(s.players).find((x) => isForeign(x) && x.teamId && !x.origin.asiaQuota && x.contract?.usd)!;
    p.scouting.current = 65;
    p.contract!.usd = { bonus: 10_000, salary: 20_000, options: 0 };
    const ask = foreignRenewalAsk(p, s.year + 1);
    expect(ask).toBeGreaterThanOrEqual(Math.round(foreignWorth(p, 0) / 10_000) * 10_000 - 10_000);
    expect(ask).toBeGreaterThan(800_000);
    // An Asia quota player the same, under his own cap.
    const a = Object.values(s.players).find((x) => isForeign(x) && x.origin.asiaQuota && x.contract?.usd);
    if (a) {
      a.scouting.current = 60;
      a.contract!.usd = { bonus: 5_000, salary: 15_000, options: 0 };
      expect(foreignRenewalAsk(a, s.year + 1)).toBeGreaterThan(100_000);
    }
  });
});

describe('money and mood (2.0.39)', () => {
  const sure = <T>(f: () => T): T => {
    const was = JSON.parse(JSON.stringify(MOOD));
    MOOD.walk.chance = 1;
    MOOD.settled.base = 1;
    MOOD.pressure.base = 1;
    try {
      return f();
    } finally {
      Object.assign(MOOD.walk, was.walk);
      Object.assign(MOOD.settled, was.settled);
      Object.assign(MOOD.pressure, was.pressure);
    }
  };

  it('a walk year lifts him; a fresh free-agent deal weighs on him, and he loses a step that winter', () => {
    const s = loadSave('2.0.38');
    const me = s.user!.teamId;
    const ours = Object.values(s.players).filter((p) => p.teamId === me && p.status === 'active' && !isForeign(p));
    const fa = ours.find((p) => !walkYear(p, s.year))!;
    fa.contract = { ...fa.contract!, signedIn: s.year - 1, salaries: [{ season: s.year, amount: 60_000 }, { season: s.year + 1, amount: 60_000 }], fa: { years: 2, options: 0, incentive: 'games' } as never };
    sure(() => seasonMoods(s));
    const walks = Object.entries(s.moods!.of).filter(([, m]) => m.kind === 'walk');
    expect(walks.length).toBeGreaterThan(0);
    for (const [id, m] of walks) {
      expect(m.edge).toBeGreaterThan(0);
      expect(walkYear(s.players[id]!, s.year)).toBe(true);
    }
    const m = s.moods!.of[fa.id]!;
    expect(m.kind).toBe('settled');
    expect(m.edge).toBeLessThan(0);
    expect(moodEdge(s, fa)).toBe(m.edge);
    expect(fa.life?.events?.some((e) => e.tone === 'bad')).toBe(true);
    const before = { ...fa.hidden.current };
    moodWinter(s, fa, s.year);
    for (const [k, v] of Object.entries(before)) if (v != null && v > 21) expect(fa.hidden.current[k as keyof typeof before]!).toBeLessThan(v);
    const a = (s.alerts ?? []).find((x) => x.id === `mood-${s.year}-${fa.id}`);
    expect(a?.tone).toBe('bad');
    expect(a?.minor).toBeFalsy();
    // Next season the mood is gone.
    s.year++;
    expect(moodEdge(s, fa)).toBe(0);
  });

  it('pay far over his play weighs on him; a walk year never costs a step', () => {
    const s = loadSave('2.0.38');
    const me = s.user!.teamId;
    const p = Object.values(s.players).find((x) => x.teamId === me && x.status === 'active' && !isForeign(x) && !walkYear(x, s.year) && !x.contract?.fa)!;
    p.career = p.career.filter((r) => r.level);
    p.contract = { ...p.contract!, signedIn: s.year - 2, salaries: [{ season: s.year, amount: 80_000 }, { season: s.year + 1, amount: 80_000 }] };
    sure(() => seasonMoods(s));
    expect(s.moods!.of[p.id]?.kind).toBe('pressure');
    const walker = Object.entries(s.moods!.of).find(([, m]) => m.kind === 'walk');
    if (walker) {
      const w = s.players[walker[0]]!;
      const before = JSON.stringify(w.hidden.current);
      moodWinter(s, w, s.year);
      expect(JSON.stringify(w.hidden.current)).toBe(before);
    }
  });
});

describe('the owner’s dividend is not the club’s spending (2.0.39)', () => {
  it('leaves it out of the season’s cash flows', () => {
    const s = loadSave('2.0.38');
    const u = s.user!;
    u.ledger.push({ year: s.year, label: 'sweep', amount: -20_000_000, sweep: true }, { year: s.year, label: 'fee', amount: -1_000 });
    settleFinances(s, s.year);
    const r = clubState(s, u.teamId).reports.find((x) => x.year === s.year)!;
    expect(r.cashFlows).toBeGreaterThan(-20_000_000 + 1);
    expect(r.cashFlows).toBeLessThanOrEqual(-1_000);
  });
});

describe('sponsoring the region’s high schools (2.0.39)', () => {
  it('up to three schools of our region, each paid for; their players come better, and loyal to us', () => {
    const s = loadSave('2.0.38');
    const u = s.user!;
    s.teams.find((t) => t.id === u.teamId)!.region = '울릉';
    expect(schoolRegion(s)).toBe('대구·경북');
    const list = regionSchools(s);
    expect(list.length).toBeGreaterThan(3);
    expect(checkSponsor(s, '없는고', true)).not.toBeNull();
    const fund = u.fund;
    for (const name of list.slice(0, 3)) {
      expect(checkSponsor(s, name, true)).toBeNull();
      apply(s, { kind: 'sponsorSchool', name, on: true });
    }
    expect(Object.keys(u.schools!)).toHaveLength(3);
    expect(u.fund).toBe(fund - 3 * SCHOOLS.cost);
    expect(checkSponsor(s, list[3]!, true)).not.toBeNull();
    apply(s, { kind: 'sponsorSchool', name: list[0]!, on: false });
    expect(Object.keys(u.schools!)).toHaveLength(2);

    // A school sponsored three seasons by the draft: its players three points better on every tool.
    const pool = draftClass(s.seed, s.year, s.unified);
    const p = pool.find((x) => x.origin.entryCategory === 'high-school' && x.education.region === '대구·경북')!;
    u.schools = { [p.education.school]: s.year - 5 };
    const before = JSON.parse(JSON.stringify(p.hidden.current)) as Record<string, number>;
    schoolBoost(s, pool, s.year);
    for (const [k, v] of Object.entries(before)) if (v != null) expect(p.hidden.current[k as keyof typeof p.hidden.current]).toBe(Math.min(80, v + SCHOOLS.growth * SCHOOLS.most));
    p.hidden.traits = { ...traitsOf(p), loyalty: 50 };
    schoolPick(s, p, u.teamId);
    expect(p.hidden.traits.loyalty).toBe(50 + SCHOOLS.loyalty);
    // The winter: next season's sums and the region's goodwill.
    const interest = clubState(s, u.teamId).interest;
    const left = u.fund;
    schoolsWinter(s, s.year);
    expect(u.fund).toBe(left - SCHOOLS.cost);
    expect(clubState(s, u.teamId).interest).toBeCloseTo(interest + SCHOOLS.interest);
  });
});

describe('the national team’s games fit its result (2.0.39)', () => {
  it('a title has its semi-final and final won, a bronze its bronze game, and so on', () => {
    const s = loadSave('2.0.38');
    const squad = Object.values(s.players).filter((p) => p.status === 'active' && !isForeign(p)).sort((a, b) => b.scouting.current - a.scouting.current).slice(0, 28).map((p) => p.id);
    const won = (x?: { us: number; them: number }) => !!x && x.us > x.them;
    // The 2045 WBC once lost its semi-final 4–14 under a title.
    for (const e of INTERNATIONAL.filter((x) => x.year >= 2041 && x.year <= 2045))
      for (const f of ['champion', 'runnerUp', 'third', 'fourth', 'second', 'first'] as const) {
        const s2 = { ...s, international: [] } as typeof s;
        const entry = { id: e.id, year: e.year, name: e.name, kind: e.kind, medal: false, squad, finish: f } as NationalEntry;
        s2.international.push(entry);
        playNationalGames(s2, e, entry);
        const g = entry.watch!.games;
        const [semi, last] = [g.at(-2), g.at(-1)];
        const ok = { champion: won(last) && won(semi), runnerUp: !won(last) && won(semi), third: won(last) && !won(semi), fourth: !won(last) && !won(semi), second: !won(last), first: !won(last) }[f];
        expect(ok, `${e.id} ${f}`).toBe(true);
      }
  });
});

describe('more uses for the fund (2.0.39)', () => {
  it('a bonus lifts the first team’s form, a month apart', () => {
    const s = loadSave('2.0.38');
    const u = s.user!;
    u.fund = 10_000_000;
    expect(checkSpend(s, 'bonus', 1)).toBeNull();
    apply(s, { kind: 'spend', what: 'bonus', tier: 1 });
    expect(u.fund).toBe(10_000_000 - SPEND.bonus.tiers[1]!.cost);
    const date = s.schedule[s.next]!.date;
    const active = s.rosters[u.teamId]!.active.map((id) => s.players[id]!);
    expect(active.every((p) => formOf(p, date) >= SPEND.bonus.tiers[1]!.points)).toBe(true);
    expect(checkSpend(s, 'bonus', 0)).not.toBeNull();
  });

  it('charters halve the road for our club only; a fan day once a season; gifts to the owner raise trust and are not the club’s spending', () => {
    const s = loadSave('2.0.38');
    const u = s.user!;
    u.fund = 30_000_000;
    // A trip into a game for our club, before and after the charters.
    const g = s.schedule.slice(s.next).find((x) => (x.away === u.teamId || x.home === u.teamId) && travelCost(s, x.id, x.home, x.away)[x.away === u.teamId ? 'away' : 'home'] > 0);
    const side = g && (g.away === u.teamId ? 'away' : 'home');
    const before = g ? travelCost(s, g.id, g.home, g.away) : null;
    apply(s, { kind: 'spend', what: 'charter' });
    expect(u.spending?.charter).toBe(s.year);
    expect(checkSpend(s, 'charter')).not.toBeNull();
    if (g && before && side) {
      const after = travelCost(s, g.id, g.home, g.away);
      expect(after[side]).toBeCloseTo(before[side] * (1 - SPEND.charter.share));
      const other = side === 'away' ? 'home' : 'away';
      expect(after[other]).toBe(before[other]);
    }
    const c = clubState(s, u.teamId);
    const [interest, popularity] = [c.interest, c.popularity];
    apply(s, { kind: 'spend', what: 'fanDay' });
    expect(c.interest).toBeCloseTo(interest + SPEND.fanDay.interest);
    expect(c.popularity).toBeGreaterThan(popularity);
    expect(checkSpend(s, 'fanDay')).not.toBeNull();
    u.trust = 50;
    for (let i = 0; i < SPEND.gift.most; i++) apply(s, { kind: 'spend', what: 'gift' });
    expect(u.trust).toBe(50 + SPEND.gift.most);
    expect(checkSpend(s, 'gift')).not.toBeNull();
    // The gifts are the owner's money, not the club's spending.
    settleFinances(s, s.year);
    const r = clubState(s, u.teamId).reports.find((x) => x.year === s.year)!;
    expect(r.cashFlows!).toBeGreaterThan(-SPEND.gift.most * SPEND.gift.perPoint);
  });
});
