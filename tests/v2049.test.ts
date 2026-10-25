/* 2.0.49 (the user's report): NC merged into 삼성 and a club founded in its place — NC's old seasons in the players'
   records showed the new club's name. A club's past seasons keep the name it had then. */
import { describe, expect, it } from 'vitest';
import { resolveMerger } from '../src/league/merger';
import { moveHistory } from '../src/league/moves';
import { careerView, clubNameIn, shortName } from '../src/league/views';
import { clubIn } from '../src/league/lineage';
import { firstTeamIds, registeredIds } from '../src/league/state';
import { loadSave } from './helpers';

describe('a merged club’s old seasons keep its old name (2.0.49)', () => {
  it('the records before the merger show NC, the seasons after it the new club', () => {
    const s = loadSave('2.0.46');
    const year = s.year;
    const weak = firstTeamIds(s).find((id) => id === 'nc' && id !== s.user!.teamId)!;
    const partner = firstTeamIds(s).find((id) => id !== weak && id !== s.user!.teamId)!;
    const old = s.teams.find((t) => t.id === weak)!;
    const oldShort = old.short;
    // One of NC's players with a season there, and his draft pick by NC.
    const p = s.players[registeredIds(s, weak)[0]!]!;
    p.career.push({ ...(p.career[0] ?? ({} as never)), year: year - 1, teamId: weak, level: undefined, bat: { g: 100 } as never, pit: null, war: 1 } as never);
    s.draftLog = [...(s.draftLog ?? []), { year: year - 3, id: p.id, teamId: weak, overall: 3, label: '1R' } as never];
    resolveMerger(s, { kind: 'merger', weak, partner, needed: 0, clubs: firstTeamIds(s).length }, 'yes', year);
    const now = s.teams.find((t) => t.id === weak)!;
    expect(now.short).not.toBe(oldShort);
    expect(s.mergers?.at(-1)?.absorbedShort).toBe(oldShort);
    // His season before the merger: NC's name; a season after it: the new club's.
    const row = careerView(s, p).find((r) => r.year === year - 1 && !r.futures)!;
    expect(row.team).toBe(oldShort);
    expect(shortName(s, weak, year + 1)).toBe(now.short);
    expect(shortName(s, weak)).toBe(now.short);
    // His moves: drafted by NC.
    expect(moveHistory(s, p)[0]!.to).toBe(oldShort);
    // A save from before 2.0.49 (no old short name kept): the real club's short name.
    delete s.mergers!.at(-1)!.absorbedShort;
    expect(clubNameIn(s, weak, year - 1)?.short).toBe('NC');
  });

  it('a legacy league’s old seasons go by that era’s names', () => {
    const s = loadSave('2.0.46');
    const lg = clubIn('lg', 1985)!;
    expect(shortName(s, 'lg', 1985)).toBe(s.teams.find((t) => t.id === 'lg')!.short);
    s.legacy = {} as never;
    expect(lg.short).not.toBe(s.teams.find((t) => t.id === 'lg')!.short);
    expect(shortName(s, 'lg', 1985)).toBe(lg.short);
    expect(shortName(s, 'lg', 2027)).toBe(clubIn('lg', 2027)!.short);
  });
});
