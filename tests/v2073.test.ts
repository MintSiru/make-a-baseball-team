/* 2.0.73 (the user's request: 「KBO판 래리버드룰」): every winter, once the free agents have signed and the salaries are
   set, each club names one player seven seasons or more with it; his pay counts half against the salary cap. The name
   may be changed until spring camp ends. */
import { describe, expect, it } from 'vitest';
import { apply, regularOver } from '../src/league/actions';
import { BIRD, birdCandidates, birdEligible, birdOpen, birdPick, birdShare, isBirdPick, nameBirds, seasonsWith, setBirdPick } from '../src/league/bird';
import { capTotal } from '../src/league/cap';
import { capPay } from '../src/league/contracts';
import { setEra } from '../src/league/era';
import { autoDecision } from '../src/league/expansion';
import { createLeague } from '../src/league/history';
import { isForeign } from '../src/league/players';
import { OFFSEASON_STEPS } from '../src/league/offseason';
import type { LeagueState } from '../src/league/state';
import type { Player } from '../src/model/types';
import { loadSave } from './helpers';

const load = () => {
  const s = loadSave('2.0.71');
  setEra(s);
  return s;
};

/** Gives him `n` seasons on the club's books before `season`. */
function serve(p: Player, teamId: string, n: number, season: number) {
  const row = p.career[0] ?? { year: season - 1, teamId, age: 25, days: 0, bat: null, pit: null, war: 0 };
  p.career = Array.from({ length: n }, (_, i) => ({ ...row, year: season - n + i, teamId }));
}

describe('2.0.73: the KBO’s Larry Bird rule', () => {
  it('names, for each club, its best-paid player of seven seasons or more, and counts his pay half', () => {
    const s = load();
    const year = s.year;
    // A save from before: each club named its player for the season under way (migrate.ts).
    for (const p of Object.values(s.players)) expect((p.contract?.fa as { bird?: true } | undefined)?.bird).toBeUndefined();
    const club = s.teams.find((t) => birdCandidates(s, t.id, year).length > 1)!.id;
    const list = birdCandidates(s, club, year);
    for (const p of list) {
      expect(seasonsWith(p, club, year - 1)).toBeGreaterThanOrEqual(BIRD.seasons);
      expect(isForeign(p)).toBe(false);
    }
    expect(birdPick(s, club, year)).toBe(list[0]!.id);
    expect(capPay(list[0]!, year)).toBeGreaterThanOrEqual(capPay(list[1]!, year));
    const p = list[0]!;
    expect(birdShare(s, p, year)).toBe(BIRD.share);
    expect(birdShare(s, list[1]!, year)).toBe(1);
    // Without the pick, his pay counts in full.
    const half = capTotal(s, club, year);
    delete s.birdPicks![year]![club];
    const full = capTotal(s, club, year);
    expect(full - half).toBeGreaterThanOrEqual(Math.round(capPay(p, year) * BIRD.share) - 1);
    // Six seasons are not enough.
    serve(p, club, BIRD.seasons - 1, year);
    expect(birdEligible(s, p, club, year)).toBe(false);
    serve(p, club, BIRD.seasons, year);
    expect(birdEligible(s, p, club, year)).toBe(true);
  });

  it('counts him in full at another club, and not at all once the board drops the rule', () => {
    const s = load();
    const year = s.year;
    const club = s.teams.find((t) => birdPick(s, t.id, year))!.id;
    const p = s.players[birdPick(s, club, year)!]!;
    expect(isBirdPick(s, p)).toBe(true);
    const other = s.teams.find((t) => t.id !== club && s.rosters[t.id])!.id;
    p.teamId = other;
    expect(birdShare(s, p, year)).toBe(1);
    expect(isBirdPick(s, p)).toBe(false);
    p.teamId = club;
    s.board = { on: false, since: year - 5, changes: [{ from: year, item: 'birdRule', value: 0 }], log: [] };
    setEra(s);
    expect(birdShare(s, p, year)).toBe(1);
  });

  it('lets us change our player over the winter, only to one who qualifies', () => {
    const s = load();
    const me = s.user!.teamId;
    const next = s.year + 1;
    const ours = Object.values(s.players)
      .filter((p) => p.teamId === me && !isForeign(p) && p.status === 'active')
      .slice(0, 3);
    for (const [i, p] of ours.entries()) {
      p.contract!.salaries = [...p.contract!.salaries.filter((x) => x.season !== next), { season: next, amount: 20000 + 10000 * i }];
      serve(p, me, i < 2 ? BIRD.seasons : BIRD.seasons - 1, next);
    }
    // Not yet: the winter's picks are not made.
    s.offseason = { year: s.year, step: OFFSEASON_STEPS.indexOf('renew') + 1, draft: null, released: [], done: [] } as unknown as LeagueState['offseason'];
    expect(birdOpen(s, next)).toBe(false);
    nameBirds(s, next);
    expect(birdOpen(s, next)).toBe(true);
    // The best-paid of the two who qualify, first.
    expect(birdPick(s, me, next)).toBe(ours[1]!.id);
    expect(s.alerts?.some((a) => a.id === `bird-${next}`)).toBe(true);
    apply(s, { kind: 'birdPick', id: ours[0]!.id });
    expect(birdPick(s, me, next)).toBe(ours[0]!.id);
    // Six seasons: refused.
    apply(s, { kind: 'birdPick', id: ours[2]!.id });
    expect(birdPick(s, me, next)).toBe(ours[0]!.id);
  });

  it('names the players after the free agents and the salaries, and holds them from the end of spring camp', { timeout: 300_000 }, () => {
    const s: LeagueState = loadSave('2.0.71');
    s.pending = null;
    const renew = OFFSEASON_STEPS.indexOf('renew');
    let seen = false;
    for (let g = 0; g < 4000 && !(seen && !s.offseason); g++) {
      if (s.offseason && s.offseason.step > renew && !seen) {
        setEra(s);
        const next = s.offseason.year + 1;
        expect(s.offseason.faDone).toBe(true);
        expect(birdOpen(s, next)).toBe(true);
        const named = Object.keys(s.birdPicks![next]!);
        expect(named.length).toBeGreaterThan(5);
        for (const c of named) expect(birdEligible(s, s.players[birdPick(s, c, next)!]!, c, next)).toBe(true);
        seen = true;
      }
      if (s.pending) apply(s, { kind: 'decide', input: autoDecision(s)! });
      else if (s.phase === 'regular' && !regularOver(s)) apply(s, { kind: 'regularEnd' });
      else if (s.phase === 'regular') apply(s, { kind: 'postseason' });
      else apply(s, { kind: 'nextSeason' });
    }
    expect(seen).toBe(true);
    expect(s.offseason).toBeNull();
    setEra(s);
    expect(birdOpen(s, s.year)).toBe(false);
    for (const [c, id] of Object.entries(s.birdPicks![s.year]!)) expect(s.players[id!]!.teamId).toBe(c);
  });

  it('leaves a player whose career an injury ended out of the founding tryout', { timeout: 300_000 }, () => {
    const s = createLeague('v2073-tryout');
    apply(s, { kind: 'toFounding' });
    const retired = Object.values(s.players).filter((p) => p.status === 'retired' && p.career.length && (p.career.at(-1)?.year ?? 0) >= s.year - 1);
    expect(retired.length).toBeGreaterThan(0);
    for (const p of retired) (p.life ??= {}).careerOver = `${p.career.at(-1)!.year}-08-30`;
    apply(s, {
      kind: 'found',
      settings: { name: '울산 고래단', short: '고래', color: '#1f6fb2', cityId: 'ulsan', parentType: 'conglomerate', parentName: '가상', stadium: 'existing', promotion: 'immediate', difficulty: 'normal', scenario: null } as never,
    });
    const d = s.pending as { kind: string; candidates: string[] };
    expect(d.kind).toBe('tryout');
    expect(d.candidates.length).toBeGreaterThan(0);
    expect(d.candidates.some((id) => s.players[id]!.life?.careerOver)).toBe(false);
  });
});
