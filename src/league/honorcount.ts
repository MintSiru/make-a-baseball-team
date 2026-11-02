import { k as __i18n_k } from '../i18n/index';
/* 2.0.71 (the user's request: 「MVP 몇 회 골글 몇 회 이런 식으로」): a player's honours counted — each award once with
   how many times and in which seasons, the big ones first (MVP, 신인왕, 골든글러브, 수비상, the titles, the
   All-Star games), instead of a tag for every season. For the screen only. */

export interface HonorCount {
  /** The award without its season or its detail: "MVP", "골든글러브", "홈런 1위", "올스타 베스트12". */
  key: string;
  count: number;
  /** Each time, first to last: its season and its detail ("1루수", "45"), if any. */
  times: { year: number | null; detail: string }[];
}

const ORDER = ['MVP', '신인왕', '골든글러브', '수비상'];
/** The All-Star honours as allstar.ts writes them, without the season. */
const BEST12 = __i18n_k('league.allstar.elect.05313858', { year: '' }).trim();
const ALL_STAR = [BEST12, __i18n_k('league.allstar.playAllStar.c1465cfc', { year: '' }).trim()];
const rank = (key: string) => {
  const i = ORDER.indexOf(key);
  if (i >= 0) return i;
  if (key.endsWith('1위')) return ORDER.length;
  const j = ALL_STAR.indexOf(key);
  return j >= 0 ? ORDER.length + 1 + j : ORDER.length + 3;
};

/** "2027 골든글러브 (1루수)" → its season, the award and its detail. */
export function splitHonor(h: string): { year: number | null; key: string; detail: string } {
  const m = /^(\d{4})\s+(.*)$/.exec(h.trim());
  const rest = m ? m[2]! : h.trim();
  const d = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rest);
  return { year: m ? Number(m[1]) : null, key: (d ? d[1]! : rest).trim(), detail: d ? d[2]!.trim() : '' };
}

/** His honours, each award once with its count, the big ones first (then the most times, then the earliest). */
export function honorCounts(honors: readonly string[] | undefined): HonorCount[] {
  const by = new Map<string, HonorCount>();
  for (const h of honors ?? []) {
    const { year, key, detail } = splitHonor(h);
    const c = by.get(key) ?? { key, count: 0, times: [] };
    c.count++;
    c.times.push({ year, detail });
    by.set(key, c);
  }
  return [...by.values()].sort((a, b) => rank(a.key) - rank(b.key) || b.count - a.count || (a.times[0]!.year ?? 0) - (b.times[0]!.year ?? 0));
}

/** The head of his panel: MVP, 골든글러브 and the All-Star games, as "MVP 2회". */
export function headlineHonors(honors: readonly string[] | undefined): { key: string; label: string; count: number }[] {
  const all = honorCounts(honors);
  const of = (key: string) => all.find((c) => c.key === key)?.count ?? 0;
  return [
    { key: 'MVP', label: 'MVP', count: of('MVP') },
    { key: '신인왕', label: __i18n_k("league.honorcount.text.9ecfbb08"), count: of('신인왕') },
    { key: '골든글러브', label: __i18n_k("league.honorcount.text.f2b151c4"), count: of('골든글러브') },
    { key: BEST12, label: __i18n_k("league.honorcount.text.a36fb8da"), count: of(BEST12) },
  ].filter((x) => x.count > 0);
}
