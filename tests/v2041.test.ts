/* 2.0.41 (the user's requests): a series starts each club's rotation over (the first-place club no longer opened the
   Korean Series with its 4th starter), each series has an MVP from its winners, our club's award winners are
   coloured, a 2차 pick's move reads as one, this fall's draftees are off our release list, and a development
   foreign player has one tag in the squad. */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ABROAD_VETS, abroadVetAsk, abroadVetsWinter, isAbroadVet } from '../src/league/abroadvets';
import { autoBroker, BROKER, brokerDay, brokerTargets, resolveBroker } from '../src/league/broker';
import { ACHIEVEMENTS, seasonMoments } from '../src/league/milestones';
import { ageIn, isForeign } from '../src/league/players';
import { scandalDay } from '../src/league/scandals';
import { poolAsk } from '../src/league/trade';
import { checkDecision, decide } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { managerLean, rotationFor } from '../src/league/manager';
import { moveHistory } from '../src/league/moves';
import { postseasonDay, startPostseason } from '../src/league/postseason';
import { playRegularSeason } from '../src/league/season';
import { rosterLimit } from '../src/league/offseason';
import { orgPlayers, registeredIds, type LeagueState } from '../src/league/state';
import { awardsView } from '../src/league/views';
import { loadSave } from './helpers';

describe('the postseason (2.0.41)', () => {
  let s: LeagueState;
  let ace: { team: string; id: string } | null = null;
  beforeAll(() => {
    s = createLeague('v2041-post');
    playRegularSeason(s);
    startPostseason(s);
    for (let d = 0; d < 80; d++) {
      const ks = s.bracket?.live.find((x) => x.round === 'ks');
      if (ks && ks.i === 0 && !ace) {
        // The high seed's rotation as its manager sets it, before game 1: the ace, if he is rested.
        const { prefer } = managerLean(s, ks.high);
        const first = rotationFor(s, s.rosters[ks.high]!.active, prefer)[0]!;
        const last = s.arms[first.id]?.lastDate;
        if (!last || (Date.parse(ks.date) - Date.parse(last)) / 86400000 >= 5) ace = { team: ks.high, id: first.id };
      }
      if (!postseasonDay(s)) break;
    }
  }, 600_000);

  it('opens the Korean Series with the first-place side’s ace when he is rested', () => {
    expect(s.bracket?.done).toBe(true);
    if (!ace) return;
    const box = s.boxes?.[`${s.year}-ks-1`];
    expect(box).toBeDefined();
    const side = box!.home === ace.team ? 1 : 0;
    expect(box!.pit[side][0]![0]).toBe(ace.id);
  });

  it('names an MVP for every series, from the side that won it', () => {
    expect(s.postseason.length).toBeGreaterThan(0);
    for (const x of s.postseason) {
      expect(x.mvp, x.round).toBeDefined();
      const p = s.players[x.mvp!]!;
      expect(p.teamId).toBe(x.winner);
      expect((s.news ?? []).some((n) => n.id === `series-mvp-${s.year}-${x.round}-${x.high}`)).toBe(true);
    }
  });
});

describe('the awards page and the moves (2.0.41)', () => {
  it('colours our winners and lists the series MVPs', () => {
    const s = loadSave('2.0.39');
    const me = s.user!.teamId;
    const ours = Object.values(s.players).find((p) => p.teamId === me && p.career.some((c) => !c.level))!;
    const year = ours.career.find((c) => !c.level)!.year;
    const h = s.history.find((x) => x.year === year) ?? s.history.at(-1)!;
    h.awards = { mvp: ours.id, rookie: null, goldenGloves: [], titles: [] };
    h.series = [{ round: 'ks', high: me, low: me, highWins: 4, lowWins: 0, winner: me, games: [], mvp: ours.id }];
    const view = awardsView(s).find((x) => x.year === h.year)!;
    const color = s.teams.find((t) => t.id === me)!.color;
    if (ours.career.find((c) => c.year === h.year && !c.level)?.teamId === me) expect(view.mvp?.color).toBe(color);
    expect(view.series).toHaveLength(1);
    expect(view.series[0]!.color).toBe(color);
  });

  it('reads a 2차 pick by its number among the 2차 picks', () => {
    const s = loadSave('2.0.39');
    const p = Object.values(s.players).find((x) => x.origin.kind === 'draftClass' && x.teamId)!;
    s.draftLog = [...(s.draftLog ?? []).filter((x) => x.id !== p.id), { year: 2026, overall: 12, label: '1R', teamId: p.teamId!, id: p.id, name: p.name, pos: 'SS', from: '', grade: null, second: 1 }];
    const row = moveHistory(s, p).find((r) => r.kind === 'draft')!;
    expect(row.note).toContain('2차');
    expect(row.note).toContain('1순위');
    expect(row.note).not.toContain('12');
  });
});

describe('our release list (2.0.41)', () => {
  it('leaves this fall’s draftees off it', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    const next = s.year + 1;
    const ids = registeredIds(s, u.teamId).filter((id) => !s.players[id]!.origin.asiaQuota && s.players[id]!.origin.kind !== 'foreign');
    // Two of ours drafted this fall, and the club five over the limit (copies of one of its players).
    const fresh = ids.filter((id) => s.players[id]!.origin.kind === 'draftClass').slice(0, 2);
    for (const id of fresh) s.players[id]!.origin.draftYear = next - 1;
    const model = s.players[ids.find((id) => !fresh.includes(id))!]!;
    const over = Math.max(0, rosterLimit(next) - registeredIds(s, u.teamId).length) + 5;
    for (let i = 0; i < over; i++) {
      const id = `${model.id}-copy${i}`;
      s.players[id] = { ...JSON.parse(JSON.stringify(model)), id };
      s.rosters[u.teamId]!.futures.push(id);
    }
    s.offseason = { year: s.year, step: 0, done: [] } as never;
    const d = decide(s, 'check');
    expect(d?.kind).toBe('roster');
    if (d?.kind !== 'roster') return;
    for (const id of fresh) expect(d.candidates).not.toContain(id);
    expect(d.candidates.length).toBeGreaterThanOrEqual(d.release);
    s.pending = d;
    expect(checkDecision(s, { kind: 'roster', ids: [fresh[0]!, ...d.candidates.slice(0, d.release - 1)] })).not.toBeNull();
  });
});

describe('Korean veterans home from abroad (2.0.41)', () => {
  it('come to the pool now and then as domestic players who ask a free agent’s money', () => {
    const s = loadSave('2.0.39');
    let next = s.year + 1;
    let arrived: string[] = [];
    for (; next < s.year + 40 && !arrived.length; next++) {
      abroadVetsWinter(s, next);
      arrived = Object.keys(s.players).filter((id) => id.startsWith(`av${next}-`));
    }
    expect(arrived.length).toBeGreaterThan(0);
    const year = next - 1;
    for (const id of arrived) {
      const p = s.players[id]!;
      expect(isAbroadVet(p)).toBe(true);
      expect(isForeign(p)).toBe(false);
      const age = ageIn(p, year);
      expect(age).toBeGreaterThanOrEqual(ABROAD_VETS.age[0]);
      expect(age).toBeLessThanOrEqual(ABROAD_VETS.age[1]);
      if (p.teamId) expect(p.contract?.salaries[0]!.amount).toBe(abroadVetAsk(p, year));
      else {
        expect(s.pool).toContain(id);
        s.phase = 'offseason';
        expect(poolAsk(s, p)).toBeGreaterThanOrEqual(abroadVetAsk(p, s.year + 1));
      }
    }
    expect((s.news ?? []).some((n) => n.id === `abroadvet-${year}`)).toBe(true);
  });
});

/** The decision waiting (read through a call: the test set it to null above). */
const pendingOf = (x: LeagueState) => x.pending;

describe('the broker (2.0.41)', () => {
  const keep = JSON.parse(JSON.stringify(BROKER));
  afterEach(() => Object.assign(BROKER.military, keep.military) && Object.assign(BROKER.doping, keep.doping));

  it('papers a player out of service; when they come out he is banned and must serve, and the club pays', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    u.fund = 5_000_000;
    s.pending = null;
    const p = orgPlayers(s, u.teamId).find((x) => x.status === 'active' && !isForeign(x) && x.scouting.current >= BROKER.military.grade)!;
    p.service.military = 'pending';
    p.birthday = `${s.year - 26}-03-01`;
    expect(brokerTargets(s, 'military').map((x) => x.id)).toContain(p.id);
    const d = { kind: 'broker' as const, offer: 'military' as const, ids: [p.id], cost: BROKER.military.cost, date: `${s.year}-05-10`, lines: [] };
    resolveBroker(s, d, 'accept');
    expect(p.service.military).toBe('exempt');
    expect(u.fund).toBe(5_000_000 - BROKER.military.cost);
    expect(u.broker?.deals).toHaveLength(1);
    // A later season: the papers come out.
    BROKER.military.exposure = 1;
    s.year += 1;
    const trust = u.trust ?? 60;
    expect(brokerDay(s, `${s.year}-08-01`)).toBe(true);
    expect(p.service.military).toBe('pending');
    expect(s.suspended?.[p.id]).toBeDefined();
    expect(pendingOf(s)?.kind).toBe('scandal');
    expect(u.fund).toBe(5_000_000 - BROKER.military.cost - BROKER.caught.fine);
    expect(u.trust).toBe(Math.max(0, trust - BROKER.caught.trust));
    expect(u.broker!.deals[0]!.out).toBe(true);
  });

  it('runs a doping program for a few of ours; a positive test brings the whole ring down', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    u.fund = 5_000_000;
    s.pending = null;
    for (const p of orgPlayers(s, u.teamId)) if (p.life) delete p.life.suspicion;
    const targets = brokerTargets(s, 'doping');
    expect(targets).toHaveLength(BROKER.doping.players);
    const before = targets.map((p) => ({ ...p.hidden.current }));
    const since = `${s.year}-05-10`;
    resolveBroker(s, { kind: 'broker', offer: 'doping', ids: targets.map((p) => p.id), cost: BROKER.doping.cost, date: since, lines: [] }, 'accept');
    for (const [i, p] of targets.entries()) {
      const tool = p.life!.suspicion!.boost!.tool;
      expect(p.hidden.current[tool]).toBe((before[i]![tool] ?? 40) + BROKER.doping.boost);
      expect(p.life!.suspicion!.broker).toBe(true);
    }
    // The tests always catch one now.
    BROKER.doping.testShare = 1e6;
    scandalDay(s, `${s.year}-06-20`);
    for (const [i, p] of targets.entries()) {
      expect(p.life?.suspicion).toBeUndefined();
      expect(p.hidden.current).toEqual(before[i]);
      expect(s.suspended?.[p.id]).toBeDefined();
    }
    expect(pendingOf(s)?.kind).toBe('scandal');
    expect(u.fund).toBe(5_000_000 - BROKER.doping.cost - BROKER.caught.fine);
  });

  it('is refused by the scouts, and refusing costs nothing', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    const fund = u.fund;
    resolveBroker(s, { kind: 'broker', offer: 'doping', ids: brokerTargets(s, 'doping').map((p) => p.id), cost: BROKER.doping.cost, date: `${s.year}-05-10`, lines: [] }, autoBroker());
    expect(u.fund).toBe(fund);
    expect(u.broker?.deals ?? []).toHaveLength(0);
  });
});

describe('the achievements (2.0.41)', () => {
  it('number more than thirty-five, each once', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(37);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlock at the end of a season: ten seasons, a rich club', () => {
    const s = loadSave('2.0.39');
    const u = s.user!;
    const year = s.history.at(-1)!.year;
    u.firstTeamYear = year - 9;
    u.fund = 10_000_000;
    u.achievements = (u.achievements ?? []).filter((a) => a.id !== 'tenSeasons' && a.id !== 'richClub');
    seasonMoments(s, year, s.history.at(-1)!.awards);
    const got = new Set(u.achievements.map((a) => a.id));
    expect(got.has('tenSeasons')).toBe(true);
    expect(got.has('richClub')).toBe(true);
  });
});
