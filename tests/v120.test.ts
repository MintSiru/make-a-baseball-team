/* 1.2.0: the All-Star game with its voting, interviews after big days, more of life, and the optional foreign veteran
   rule. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { apply } from '../src/league/actions';
import { allStarSides, checkCampaign, SEATS, SIDES, SPOTS, tally, type AllStarState } from '../src/league/allstar';
import { autoDecision, foreignSigningDecision } from '../src/league/expansion';
import { capPlayers, kboSeasons, slotExempt, slotForeigners } from '../src/league/foreigncap';
import { createLeague } from '../src/league/history';
import { heroInterview } from '../src/league/interviews';
import { eulreul, iga, ro } from '../src/league/josa';
import { isForeign } from '../src/league/players';
import { playDay } from '../src/league/season';
import type { LeagueState } from '../src/league/state';
import { ALL_STAR } from '../src/league/tuning';
import { parseSave } from '../src/save/format';

const loadSave = () => parseSave(gunzipSync(readFileSync(new URL('./fixtures/save-1.1.0.json.gz', import.meta.url))).toString('utf8')).snapshot!.state as LeagueState;

/** Plays (answering every decision the scouts' way) until the first game day on or after `md` this season. */
function playTo(s: LeagueState, md: string) {
  for (let g = 0; g < 2000 && s.phase === 'regular' && (s.schedule[s.next]?.date ?? '9') < `${s.year}-${md}`; g++) {
    if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
    else if (s.user) apply(s, { kind: 'days', days: 1 });
    else playDay(s);
  }
}

describe('the All-Star game in a league', () => {
  let s: LeagueState;
  let a: AllStarState;
  beforeAll(() => {
    s = createLeague('v120-allstar');
    playTo(s, '07-20');
    a = s.allStar!;
  }, 300_000);

  it('splits the clubs into 드림 and 나눔, five a side', () => {
    const sides = allStarSides(s);
    expect(Object.values(sides).filter((x) => x === 'dream')).toHaveLength(5);
    expect(sides.lotte).toBe('dream');
    expect(sides.lg).toBe('nanum');
  });

  it('counts the ballots weekly and elects twelve a side by 70% fans and 30% players', () => {
    expect(a.tallies).toEqual(ALL_STAR.dates.tallies.map((md) => `${s.year}-${md}`));
    const rows = tally(a);
    for (const side of SIDES)
      for (const spot of SPOTS) {
        const xs = rows.filter((r) => r.side === side && r.spot === spot);
        if (!xs.length) continue;
        expect(xs.reduce((t, r) => t + r.score, 0)).toBeCloseTo(1, 6);
        expect(xs.map((r) => r.rank)).toEqual(xs.map((_, i) => i + 1));
      }
    expect(a.elected).toHaveLength(SIDES.length * Object.values(SEATS).reduce((t, n) => t + n, 0));
    for (const id of a.elected!) expect(s.players[id]!.honors?.some((h) => h === `${s.year} 올스타 베스트12`)).toBe(true);
  });

  it('fills both squads to 24, every club sending at least two', () => {
    for (const side of SIDES) {
      const squad = a.squads![side];
      expect(squad).toHaveLength(ALL_STAR.squad);
      expect(new Set(squad).size).toBe(squad.length);
      for (const [teamId, x] of Object.entries(a.sides)) if (x === side) expect(squad.filter((id) => s.players[id]!.teamId === teamId).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('plays the game and the home run race without touching the season', () => {
    const g = a.game!;
    expect(g.date).toBe(`${s.year}-${ALL_STAR.dates.game}`);
    const box = s.boxes![g.boxId]!;
    expect([box.home, box.away].sort()).toEqual(['dream', 'nanum']);
    expect(box.rhe[0][0] + box.rhe[1][0]).toBe(g.runs.dream + g.runs.nanum);
    expect(s.scores.some((x) => x.id === g.boxId)).toBe(false);
    expect(g.derby.rounds).toHaveLength(ALL_STAR.derby.field);
    expect(g.derby.rounds.filter((r) => r.final !== undefined)).toHaveLength(2);
    expect(g.derby.rounds.find((r) => r.id === g.derby.winner)!.final).toBeDefined();
    if (g.mvp) expect([...a.squads!.dream, ...a.squads!.nanum]).toContain(g.mvp);
    expect(s.allStarHistory!.at(-1)!.year).toBe(s.year);
    // Years played before the user's league began are on record too.
    expect(s.allStarHistory!.length).toBeGreaterThan(1);
  });

  it('writes no articles in a league without a club of ours', () => {
    expect((s.news ?? []).filter((n) => n.kind === 'allstar')).toHaveLength(0);
    expect(checkCampaign(s)).not.toBeNull();
  });
});

describe('our club in the All-Star season', () => {
  let s: LeagueState;
  beforeAll(() => {
    s = loadSave();
    playTo(s, '06-10');
  }, 300_000);

  it('runs a voting drive once, paid from the fund', () => {
    expect(s.allStar?.year).toBe(s.year);
    expect(checkCampaign(s)).toBeNull();
    const fund = s.user!.fund;
    apply(s, { kind: 'allStarCampaign' });
    expect(s.allStar!.campaign).toBe(true);
    expect(s.user!.fund).toBe(fund - ALL_STAR.campaign.cost);
    expect(s.user!.ledger.at(-1)!.amount).toBe(-ALL_STAR.campaign.cost);
    expect(checkCampaign(s)).toBe('이미 투표 독려 캠페인을 했습니다.');
  });

  it('reports the voting and the game in our news, and life brings new kinds of events', () => {
    playTo(s, '09-10');
    const titles = (s.news ?? []).filter((n) => n.kind === 'allstar').map((n) => n.title);
    expect(titles.some((t) => t.includes('팬 투표 시작'))).toBe(true);
    expect(titles.some((t) => t.includes('중간 집계'))).toBe(true);
    expect(titles.some((t) => t.includes('베스트12 확정'))).toBe(true);
    expect(titles.some((t) => t.includes('올스타전'))).toBe(true);
    const life = [...Object.values(s.players).flatMap((p) => p.life?.events ?? []).map((e) => e.text), ...(s.news ?? []).map((n) => n.title)];
    expect(life.some((t) => /특훈 자청|조언에 반등|광고 모델|출연으로 화제|단체 응원|신경전|아쉬움 토로/.test(t))).toBe(true);
  }, 300_000);
});

describe('interviews after a big day', () => {
  const s = loadSave();
  const ours = Object.values(s.players).find((p) => p.teamId === s.user!.teamId && p.status === 'active')!;
  const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== s.user!.teamId && p.status === 'active')!;

  it('asks three questions of our hero, in his own voice, the same every time', () => {
    const iv = heroInterview(s, ours.id, '2027-05-01', { kind: 'noHit' }, 'k1')!;
    expect(iv.kind).toBe('interview');
    expect(iv.title.startsWith(`[인터뷰] ${ours.name}`)).toBe(true);
    expect(iv.body.split('\n').filter((l) => l.startsWith('— '))).toHaveLength(3);
    expect(heroInterview(s, ours.id, '2027-05-01', { kind: 'noHit' }, 'k1')).toEqual(iv);
    expect(heroInterview(s, theirs.id, '2027-05-01', { kind: 'noHit' }, 'k1')).toBeNull();
  });

  it('comes now and then for an ordinary big game, always for a rare one', () => {
    const n = 400;
    const some = Array.from({ length: n }, (_, i) => heroInterview(s, ours.id, '2027-05-01', { kind: 'fourHits', h: 4 }, `g${i}`)).filter(Boolean).length;
    expect(some / n).toBeGreaterThan(0.25);
    expect(some / n).toBeLessThan(0.45);
    for (let i = 0; i < 20; i++) expect(heroInterview(s, ours.id, '2027-05-01', { kind: 'milestone', label: '100홈런' }, `m${i}`)).not.toBeNull();
  });
});

describe('particles after numbers', () => {
  it('reads the number aloud', () => {
    expect(ro('5-3')).toBe('5-3으로');
    expect(ro('3-1')).toBe('3-1로');
    expect(ro('2-10')).toBe('2-10으로');
    expect(iga('3')).toBe('3이');
    expect(iga('2')).toBe('2가');
    expect(eulreul('홈런 100')).toBe('홈런 100을');
    expect(ro('두산')).toBe('두산으로');
    expect(ro('서울')).toBe('서울로');
  });
});

describe('the optional foreign veteran rule', () => {
  it('lets a long-serving foreign player off the foreign slots and the cap', () => {
    const s = loadSave();
    const teamId = s.user!.teamId;
    const next = s.year + 1;
    const vet = slotForeigners(s, teamId, next).find((p) => !p.origin.asiaQuota && p.contract?.salaries.some((x) => x.season === next)) ?? slotForeigners(s, teamId, next).find((p) => !p.origin.asiaQuota)!;
    expect(isForeign(vet)).toBe(true);
    // Eight first-team seasons with us already.
    vet.career = Array.from({ length: 8 }, (_, i) => ({ year: s.year - 8 + i, teamId, age: 25 + i, days: 150, bat: null, pit: null, war: 2 }));
    expect(kboSeasons(vet, next)).toBe(8);
    const before = foreignSigningDecision(s, next);
    const openBefore = before && before.kind === 'foreign' ? before.regular : 0;
    expect(slotExempt(s, vet, next)).toBe(false);
    s.foreignVeteran = 8;
    expect(slotExempt(s, vet, next)).toBe(true);
    expect(slotForeigners(s, teamId, next).map((p) => p.id)).not.toContain(vet.id);
    expect(capPlayers(s, teamId, next).map((p) => p.id)).not.toContain(vet.id);
    const after = foreignSigningDecision(s, next);
    expect(after?.kind).toBe('foreign');
    expect(after && after.kind === 'foreign' ? after.regular : 0).toBe(openBefore + 1);
    // Off again: back on the slots.
    apply(s, { kind: 'foreignVeteran', seasons: null });
    expect(s.foreignVeteran).toBeNull();
    expect(slotExempt(s, vet, next)).toBe(false);
  });
});
