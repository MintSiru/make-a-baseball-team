/* Parity with KBO-Draft-Room 1.0.1: the ported modules must reproduce Draft Room's own golden hashes.
   This is Draft Room's tests/golden.cjs run against src/draftroom/, compare-only. The fixture is a copy
   of Draft Room's tests/fixtures/golden.json at the commit in docs/UPSTREAM.md.

   If a deliberate change to src/draftroom/ breaks this, the port has diverged from Draft Room: record
   that in docs/UPSTREAM.md and move the check to this project's own golden test instead. */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import Engine from '../src/draftroom/engine.js';
import Prospects from '../src/draftroom/prospects.js';
import golden from './fixtures/draftroom-golden.json';

/* eslint-disable @typescript-eslint/no-explicit-any -- Draft Room modules are untyped JS. */
const C: any = Engine;
const D: any = Prospects;
type Obj = Record<string, any>;

const CONFIGS: [string, boolean, string, string, string][] = [
  ['lg', true, 'golden-a', 'normal', 'development'],
  ['kiwoom', false, 'golden-b', 'hard', 'immediate'],
  ['samsung', true, 'golden-c', 'easy', 'needs'],
  ['kia', false, 'golden-d', 'normal', 'needs'],
  ['hanwha', true, 'golden-e', 'hard', 'development'],
  ['nc', false, 'golden-f', 'easy', 'immediate'],
];
const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const only = (o: Obj | null | undefined, keys: string[]) => (o == null ? o : Object.fromEntries(keys.map((k) => [k, o[k]])));
const numbersOf = (o: Obj | null | undefined) =>
  o == null ? o : Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number'));

const PLAYER_KEYS = ['id', 'rank', 'name', 'role', 'type', 'pathway', 'region', 'currentInstitutionId', 'highSchoolId', 'birthday', 'age',
  'height', 'weight', 'throwHand', 'batHand', 'velocity', 'ready', 'scoutCeiling', 'floorGrade', 'ceilingGrade', 'publicScore', 'tools',
  'futureTools', 'trueTools', 'potentialTools', 'growthCurve', 'developmentRate', 'observerBias', 'risk', 'favoriteTeam', 'pickTags',
  'uncertainty', 'regionalEligible', 'quotaEligible'];
const simPlayer = (p: Obj) => ({ ...only(p, PLAYER_KEYS), record: numbersOf(p.record) });
const RECORD_KEYS = ['playerId', 'teamId', 'year', 'age', 'role', 'second', 'route', 'serviceType', 'roleTier', 'growth', 'scoutReady', 'scoutFV',
  'publicTools', 'planScore', 'contribution', 'war', 'daysLost', 'limited'];
const simRecord = (r: Obj) => ({
  ...only(r, RECORD_KEYS),
  stats: numbersOf(r.stats),
  futures: numbersOf(r.futures),
  end: only(r.endState, ['ability', 'tools', 'performance']),
});

function simGame({ game: g, review, fans }: Obj) {
  // Key order matches Draft Room's golden.cjs so the hashes line up. That file lists `plans` twice
  // (club plans, then dev plans); in JS the later value wins at the first key's position, as written here.
  return {
    picks: g.picks.map((s: Obj) => [s.overall, s.teamId, s.playerId, s.fit]),
    dev: (g.devSigns || []).map((s: Obj) => [s.overall, s.teamId, s.playerId]),
    budgets: g.budgets,
    talks: g.talks.map((t: Obj) => [t.teamId, t.playerId, t.ask, t.offer, t.result, t.counter, t.bonus]),
    gm: [g.gmChoice, g.gmAnswers],
    news: g.news.map((n: Obj) => [n.playerId, n.delta]),
    forecasts: g.forecasts.map((f: Obj) => f.picks.map((s: Obj) => [s.teamId, s.round, s.playerId])),
    scout: g.scoutReport.candidates.map((c: Obj) => c.playerId),
    plans: g.devPlans || [],
    owner: g.owner && only(g.owner, ['score', 'grade', 'needScore', 'production', 'future', 'baseScore']),
    fans: fans.timeline.map((x: Obj) => [x.delta, x.score]),
    years: g.career.years.map((y: Obj) => ({
      records: y.records.map(simRecord),
      table: y.league.table.map((t: Obj) => [t.teamId, t.wins, t.losses, t.rank]),
      champion: y.league.champion,
      series: y.league.series.map((x: Obj) => [x.home, x.away, x.homeWins, x.awayWins]),
      awards: y.awards.map((a: Obj) => [a.id, a.playerId, a.teamId]),
      events: y.events.map((e: Obj) => [e.type, e.service, e.fromTeamId, e.toTeamId, ...e.playerIds]),
      international: (y.international || []).map((e: Obj) => [e.name, e.result, e.playerIds, e.exemptIds]),
    })),
    players: Object.values(g.career.players as Obj).map((s: Obj) =>
      only(s, ['playerId', 'status', 'currentTeamId', 'ability', 'scoutReady', 'scoutFV', 'served', 'exempt', 'service', 'role', 'focus',
        'twoWay', 'roleHistory', 'other'])),
    service: g.serviceOrders || [],
    review: review.map((x: Obj) => numbersOf(x)),
  };
}

function play([team, local, seed, difficulty, gm]: (typeof CONFIGS)[number]) {
  const g = C.createGame(team, local, seed, difficulty);
  C.openScouting(g);
  C.beginDraft(g);
  while (g.phase === 'draft') C.addPick(g, C.aiChoice(g).id);
  C.signAll(g);
  C.signDevelopment(g, C.undrafted(g).slice(2, 2 + Math.min(3, Math.floor(C.budgetLeft(g) / C.tuning.contracts.devCost))).map((p: Obj) => p.id));
  C.chooseGM(g, gm, { first: ['now', 'project', 'fit'][seed.charCodeAt(seed.length - 1) % 3] });
  const opts = C.planOptions(g),
    plans: Obj = {};
  if (opts[0]) plans[opts[0].playerId] = { focus: opts[0].focusOptions[1] };
  const mover = opts.find((o: Obj) => o.roleOptions.length && o !== opts[0]);
  if (mover) plans[mover.playerId] = { role: mover.roleOptions[0] };
  C.runSeason(g, plans);
  while (g.career.years.length < C.Career.SEASONS) {
    const o = C.serviceOptions(g)[0];
    C.nextSeason(g, o && g.career.years.length % 2 ? { [o.playerId]: o.sangmu ? 'sangmu' : o.must ? 'army' : 'defer' } : {});
  }
  return { game: g, review: C.careerReview(g), fans: C.fanState(g) };
}

const expected = golden.hashes as Record<string, { sim: string; full: string }>;

describe('Draft Room 1.0.1 parity', () => {
  it('runs the same simulation version', () => {
    expect(C.SIM_VERSION).toBe(golden.sim);
  });

  for (const seed of ['pool-a', 'pool-b', 'pool-c']) {
    it(`generates the same prospect pool (${seed})`, () => {
      const pool = D.generatePool(seed).players;
      expect({ sim: hash(pool.map(simPlayer)), full: hash(pool) }).toEqual(expected['pool:' + seed]);
    });
  }

  for (const cfg of CONFIGS) {
    it(`replays the same ten-season game (${cfg.join('/')})`, () => {
      const out = play(cfg);
      expect({ sim: hash(simGame(out)), full: hash(out) }).toEqual(expected['game:' + cfg.join('/')]);
    });
  }
});
