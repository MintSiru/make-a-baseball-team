import { existingTeams } from './clubs';
import { clubIn } from './lineage';
import type { TeamId } from '../model/types';
import type { LeagueState } from './state';

/** 2.0.49 (the user's report: NC merged into 삼성 and a club founded in its place, NC's old seasons showed the new
    club's name): a club's name in `year` when it went by another then — before a merger or a sale gave it a new name
    in place (merger.ts), or a legacy league's name of that era (lineage.ts) — else null (today's). */
export function clubNameIn(s: LeagueState, id: TeamId | null, year: number): { name: string; short: string } | null {
  if (!id) return null;
  const mine = (s.mergers ?? []).filter((m) => m.teamId === id);
  const m = mine.filter((x) => year <= x.year).sort((a, b) => a.year - b.year)[0];
  if (s.legacy && (m || !mine.length)) {
    const e = clubIn(id, year);
    if (e) return { name: e.name, short: e.short };
  }
  if (!m) return null;
  // A save from before 2.0.49 has no old short name: today's real one when it was that club, else the name's first word.
  const real = existingTeams().find((t) => t.id === id && t.name === m.absorbed)?.short;
  return { name: m.absorbed, short: m.absorbedShort ?? real ?? m.absorbed.split(' ')[0]! };
}
