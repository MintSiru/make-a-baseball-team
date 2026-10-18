/* 2.0.8: learning a new pitch over the winter. */
import { beforeAll, describe, expect, it } from 'vitest';
import { createLeague } from '../src/league/history';
import { checkLearn, LEARN, learnable, learnWinter, planLearn } from '../src/league/newpitch';
import { FAMILY, fastballOf, pitchGrades, repertoire } from '../src/league/pitches';
import { isPitcher } from '../src/league/players';
import type { LeagueState, UserClub } from '../src/league/state';

describe('a new pitch', () => {
  let s: LeagueState;
  let team: string;
  beforeAll(() => {
    s = createLeague('v208-pitch');
    team = s.teams[0]!.id;
    s.user = { teamId: team } as UserClub;
  }, 300_000);
  const ours = () => Object.values(s.players).filter((p) => p.teamId === team && p.status === 'active' && isPitcher(p) && learnable(p).length > 0);

  it('offers only pitches he does not throw, nor of a family he throws', () => {
    for (const p of ours().slice(0, 10)) {
      const rep = repertoire(p);
      const fams = new Set([...rep.map((x) => FAMILY[x.type]), FAMILY[fastballOf(p) as keyof typeof FAMILY]].filter(Boolean));
      for (const t of learnable(p)) {
        expect(rep.some((x) => x.type === t)).toBe(false);
        if (FAMILY[t]) expect(fams.has(FAMILY[t])).toBe(false);
      }
    }
  });

  it('plans up to three a winter, ours only', () => {
    const arms = ours();
    for (const p of arms.slice(0, LEARN.perWinter)) planLearn(s, p.id, learnable(p)[0]!);
    expect(Object.keys(s.user!.pitchPlans!).length).toBe(LEARN.perWinter);
    expect(checkLearn(s, arms[LEARN.perWinter]!.id, learnable(arms[LEARN.perWinter]!)[0]!)).not.toBeNull();
    const theirs = Object.values(s.players).find((p) => p.teamId && p.teamId !== team && isPitcher(p))!;
    expect(checkLearn(s, theirs.id, null)).not.toBeNull();
    planLearn(s, arms[0]!.id, null);
    expect(Object.keys(s.user!.pitchPlans!).length).toBe(LEARN.perWinter - 1);
  });

  it('learns it at the winter, low at first and rising for three winters', () => {
    const p = ours()[0]!;
    const type = learnable(p)[0]!;
    s.user!.pitchPlans = { [p.id]: type };
    const keep = { ...LEARN };
    Object.assign(LEARN, { base: 5, max: 1 });
    learnWinter(s, 2030);
    Object.assign(LEARN, keep);
    expect(s.user!.pitchPlans).toBeUndefined();
    const learned = repertoire(p).find((x) => x.type === type)!;
    expect(learned.usage).toBeCloseTo(0.08, 5);
    expect(learned.offset).toBe(LEARN.startOffset);
    expect(pitchGrades(p).some((x) => x.type === type)).toBe(true);
    expect((s.news ?? []).some((n) => n.id === `learn-2030-${p.id}`)).toBe(true);
    for (let y = 2031; y <= 2035; y++) learnWinter(s, y);
    expect(p.learned![0]!.offset).toBe(Math.min(LEARN.top, LEARN.startOffset + LEARN.gain * LEARN.gainWinters));
  });

  it('lets other clubs’ young arms pick one up now and then', () => {
    const arms = Object.values(s.players).filter((p) => isPitcher(p) && p.status === 'active');
    const learned = arms.filter((p) => p.learned?.length && p.teamId !== team);
    expect(learned.length / arms.length).toBeLessThan(0.15);
  });
});
