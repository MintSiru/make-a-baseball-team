/* 2.0.47 (the user's reports): the managers' 문책성 2군행 less often; a player out before the postseason but back by
   the series' first game may be in the entry, and he plays once he is back; a young player does not talk like a 고참. */
import { describe, expect, it } from 'vitest';
import { DISCIPLINE, disciplineDay } from '../src/league/discipline';
import { applyEntry, backOn, checkEntry, chooseEntry, entryDecision, entryProblem, postseasonUpkeep, suggestedEntry } from '../src/league/postentry';
import { available } from '../src/league/manager';
import { playerVoice, JUNIOR_AGE } from '../src/league/news';
import { ageIn, currentValue, isPitcher } from '../src/league/players';
import { firstTeamIds, registeredIds, type LeagueState } from '../src/league/state';
import { loadSave } from './helpers';

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/** The 2.0.46 save, with the postseason's first game ten days on from today. */
const october = () => {
  const s = loadSave('2.0.46');
  s.pending = null;
  const today = s.schedule[s.next]!.date;
  return { s, today, first: addDays(today, 10) };
};
const best = (s: LeagueState, teamId: string) => registeredIds(s, teamId).map((id) => s.players[id]!).filter((p) => p.status === 'active').sort((a, b) => currentValue(b) - currentValue(a));

describe('the postseason entry takes players back by the first game (2.0.47)', () => {
  it('an injury or a stay in the futures that ends before the first game does not keep him out', () => {
    const { s, today, first } = october();
    const team = s.user!.teamId;
    const [hurt, down, long] = best(s, team);
    s.injuries[hurt!.id] = { until: addDays(today, 5), days: 5, onList: true };
    (s.discipline ??= {})[down!.id] = { since: today, until: first, why: 'slump' };
    s.injuries[long!.id] = { until: addDays(first, 3), days: 13, onList: true };
    // Today (no date given) all three are out, as before.
    for (const p of [hurt!, down!, long!]) expect(entryProblem(s, team, p.id)).toBe('out');
    // By the first game: two are back, the third is not.
    expect(entryProblem(s, team, hurt!.id, first)).toBeNull();
    expect(entryProblem(s, team, down!.id, first)).toBeNull();
    expect(entryProblem(s, team, long!.id, first)).toBe('out');
    expect(backOn(s, hurt!.id)).toBe(addDays(today, 5));
    // The decision lists them as coming back and the scouts' entry keeps them (our best players).
    const d = entryDecision(s, 'po', firstTeamIds(s).find((id) => id !== team)!, first);
    if (d.kind !== 'postEntry') throw new Error(d.kind);
    expect(d.back?.[hurt!.id]).toBe(addDays(today, 5));
    expect(d.back?.[down!.id]).toBe(first);
    expect(d.candidates).not.toContain(long!.id);
    expect(d.suggested).toContain(hurt!.id);
    expect(d.suggested).toContain(down!.id);
    expect(checkEntry(s, team, d.suggested, first)).toBeNull();
    // Handed in: he is in the entry and plays once the day comes.
    applyEntry(s, team, d.suggested, 'po');
    expect(s.rosters[team]!.active).toContain(hurt!.id);
    expect(available(s, hurt!.id)).toBe(false);
    postseasonUpkeep(s, addDays(today, 5));
    expect(available(s, hurt!.id)).toBe(true);
    expect(s.discipline?.[down!.id]).toBeTruthy();
    postseasonUpkeep(s, first);
    expect(s.discipline?.[down!.id]).toBeUndefined();
  });

  it('the AI clubs take theirs back too', () => {
    const { s, today, first } = october();
    const team = firstTeamIds(s).find((id) => id !== s.user!.teamId)!;
    const star = best(s, team)[0]!;
    s.injuries[star.id] = { until: addDays(today, 7), days: 7, onList: true };
    expect(chooseEntry(s, team)).not.toContain(star.id);
    expect(chooseEntry(s, team, first)).toContain(star.id);
    expect(suggestedEntry(s, team, first)).toContain(star.id);
  });
});

describe('the managers send fewer players down (2.0.47)', () => {
  it('at most one of a club at a look, even when every slump is acted on', () => {
    const s = loadSave('2.0.46');
    s.pending = null;
    const was = DISCIPLINE.chance.slump;
    (DISCIPLINE.chance as { slump: number }).slump = 1;
    try {
      // Two weeks ago: two hitters of every club were where they are now less a dreadful fortnight (50 PA, OPS .200).
      const start = s.schedule[s.next]!.date;
      const markOf = (id: string) => {
        const b = s.lines[id]?.bat,
          p = s.lines[id]?.pit;
        return [b?.pa ?? 0, b ? b.h + b.bb + b.hbp : 0, b ? b.h + b.d + 2 * b.t + 3 * b.hr : 0, b ? b.ab + b.bb + b.hbp + b.sf : 0, b?.ab ?? 0, p?.outs ?? 0, p?.er ?? 0];
      };
      const lines: Record<string, number[]> = {};
      for (const t of firstTeamIds(s)) {
        const hitters = s.rosters[t]!.active.filter((id) => !isPitcher(s.players[id]!)).slice(0, 2);
        for (const id of s.rosters[t]!.active) lines[id] = markOf(id);
        for (const id of hitters) lines[id] = markOf(id).map((x, i) => x - [50, 5, 5, 50, 45, 0, 0][i]!);
      }
      s.formMark = { date: addDays(start, -14), lines };
      s.discipline = {};
      disciplineDay(s, start);
      const sent = Object.keys(s.discipline ?? {}).map((id) => s.players[id]!.teamId!);
      expect(sent.length).toBeGreaterThan(3);
      for (const t of new Set(sent)) expect(sent.filter((x) => x === t).length).toBe(1);
    } finally {
      (DISCIPLINE.chance as { slump: number }).slump = was;
    }
    expect(DISCIPLINE.chance.slump).toBeLessThan(0.14);
    expect(DISCIPLINE.slump.ops).toBeLessThan(0.45);
  });
});

describe('a young player talks like one (2.0.47)', () => {
  it('a 19-year-old leader thanks his seniors, a veteran his juniors', () => {
    const s = loadSave('2.0.46');
    const leaders = Object.values(s.players).filter((p) => p.personality === '책임감 강한 리더' && p.status === 'active');
    const young = leaders.find((p) => ageIn(p, s.year) <= JUNIOR_AGE)!;
    const old = leaders.find((p) => ageIn(p, s.year) >= 30)!;
    expect(young && old).toBeTruthy();
    const junior = playerVoice(young, s.year).join(' ');
    expect(junior).not.toContain('후배');
    expect(junior).not.toContain('고참');
    expect(junior).toContain('선배');
    expect(playerVoice(old, s.year).join(' ')).toContain('후배');
  });
});
