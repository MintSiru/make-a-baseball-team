/* 2.0.56 (the user's request): each winter's free agents in one list — who filed, his club and grade, and where he
   signed on what terms. The market (fa.ts) keeps its own list only until the season opens: when it closes, the class
   is written down here. Before the market, the season's list is the players due to file (faclock.ts); a save from
   before 2.0.56 shows its past winters from the players' moves (no terms then). Display only. */
import type { PlayerId, TeamId } from '../model/types';
import { faOutlook } from './faclock';
import { isForeign } from './players';
import type { LeagueState } from './state';

export interface FaClassRow {
  id: PlayerId;
  from: TeamId;
  grade?: string;
  /** Where he signed (his own club when he stayed); null when no one did. */
  to?: TeamId | null;
  terms?: string;
  /** Due to file, the market not open yet. */
  due?: boolean;
}
export interface FaClass {
  year: number;
  rows: FaClassRow[];
}

/** The winter's class as the market closes (fa.ts closeMarket). */
export function recordFaClass(s: LeagueState, m: { year: number; order: PlayerId[]; talks: Record<PlayerId, { from: TeamId; grade: string; signed?: { teamId: TeamId; offer: unknown }; gone?: boolean }> }, terms: (offer: never) => string) {
  const rows: FaClassRow[] = m.order.map((id) => {
    const t = m.talks[id]!;
    return { id, from: t.from, grade: t.grade, to: t.signed?.teamId ?? null, ...(t.signed ? { terms: terms(t.signed.offer as never) } : {}) };
  });
  s.faHistory = [...(s.faHistory ?? []).filter((x) => x.year !== m.year), { year: m.year, rows }];
}

/** The season the winter's market follows: the one being played, or the one just over. */
const seasonNow = (s: LeagueState) => (s.offseason ? s.offseason.year : s.year);

/** The winters there is a list for, latest first. */
export function faClassYears(s: LeagueState): number[] {
  const years = new Set((s.faHistory ?? []).map((x) => x.year));
  years.add(seasonNow(s));
  for (const p of Object.values(s.players)) for (const m of p.moves ?? []) if (m.kind === 'fa' || m.kind === 'faStay' || m.kind === 'unsigned') years.add(winterOf(m.date));
  return [...years].sort((a, b) => b - a);
}

/** A move in the winter after season Y is dated Y-11.. or (Y+1)-01..02. */
const winterOf = (date: string) => Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);

/** The winter's free agents: the closed market's record, the market under way, the players due, or the moves. */
export function faClass(s: LeagueState, year: number): FaClassRow[] {
  const kept = s.faHistory?.find((x) => x.year === year);
  if (kept) return kept.rows;
  const m = s.offseason?.fa;
  if (m && m.year === year)
    return m.order.map((id) => {
      const t = m.talks[id]!;
      return { id, from: t.from, grade: t.grade, ...(t.signed ? { to: t.signed.teamId } : t.gone ? { to: null } : {}) };
    });
  if (year === seasonNow(s) && !s.offseason?.faDone)
    return Object.values(s.players)
      .filter((p) => p.teamId && !isForeign(p) && (p.status === 'active' || p.status === 'military') && faOutlook(s, p).year === year)
      .map((p) => ({ id: p.id, from: p.teamId!, due: true }));
  const rows: FaClassRow[] = [];
  for (const p of Object.values(s.players))
    for (const mv of p.moves ?? []) {
      if ((mv.kind !== 'fa' && mv.kind !== 'faStay' && mv.kind !== 'unsigned') || winterOf(mv.date) !== year || !mv.from) continue;
      const [grade, ...rest] = (mv.note ?? '').split(' · ');
      rows.push({ id: p.id, from: mv.from, ...(mv.kind !== 'unsigned' && grade ? { grade } : {}), to: mv.kind === 'unsigned' ? null : mv.to, ...(rest.length ? { terms: rest.join(' · ') } : {}) });
    }
  return rows;
}
