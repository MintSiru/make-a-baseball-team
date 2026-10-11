import { k as __i18n_k } from '../i18n/index';
/* The draft over the years (1.7.0, from the 1.6 feedback): every pick as it was made, kept even after the player
   leaves the league, and read back with what became of him; and the prospects talked about before the draft — the
   race for the top pick in spring, a name from the school tournaments in early summer, the top ten a month out. */
import type { Player, PlayerId, TeamId } from '../model/types';
import { hashUnit } from '../draftroom';
import { iga } from './josa';
import { addNews } from './news';
import { draftClass, isPitcher } from './players';
import type { LeagueState } from './state';
import { positionLabel, shortName } from './views';

export interface DraftPick {
  /** The year of the September draft (the class plays from the next season). */
  year: number;
  overall: number;
  /** The slot's label ("1R", "우선지명"…). */
  label: string;
  teamId: TeamId;
  id: PlayerId;
  name: string;
  pos: string;
  /** School or club he came from. */
  from: string;
  /** The public future grade on draft day; null for picks logged from a save older than 1.7.0. */
  grade: number | null;
}

/** A pick, as it is made. */
export function logPick(s: LeagueState, p: Player, teamId: TeamId, year: number, overall: number, label: string) {
  (s.draftLog ??= []).push({ year, overall, label, teamId, id: p.id, name: p.name, pos: positionLabel(p), from: p.education.school, grade: p.scouting.futureValue });
}

/** A save from before 1.7.0: the picks read back from the players still in the league (the club that has him now,
    or the first one he played for). */
export function backfillDraftLog(s: LeagueState) {
  if (s.draftLog) return;
  const out: DraftPick[] = [];
  for (const p of Object.values(s.players)) {
    const o = p.origin;
    if (o.kind !== 'draftClass' || !o.draftYear || !o.overallPick) continue;
    const teamId = p.career.find((c) => !c.level)?.teamId ?? p.career[0]?.teamId ?? p.teamId;
    if (!teamId) continue;
    out.push({ year: o.draftYear, overall: o.overallPick, label: '', teamId, id: p.id, name: p.name, pos: positionLabel(p), from: p.education.school, grade: o.draftGrade ?? null });
  }
  s.draftLog = out.sort((a, b) => a.year - b.year || a.overall - b.overall);
}

/** Years with a draft on record, newest first. */
export const draftYears = (s: LeagueState) => [...new Set((s.draftLog ?? []).map((x) => x.year))].sort((a, b) => b - a);

export interface DraftRow extends DraftPick {
  club: string;
  /** Where he is now: a club, 군 복무, 해외, 은퇴 or 리그를 떠남. */
  now: string;
  inLeague: boolean;
  /** First-team seasons, games and WAR so far. */
  seasons: number;
  games: number;
  war: number;
}

/** One year's draft with what became of each pick. */
export function draftView(s: LeagueState, year: number): DraftRow[] {
  return (s.draftLog ?? [])
    .filter((x) => x.year === year)
    .sort((a, b) => a.overall - b.overall)
    .map((x) => {
      const p = s.players[x.id];
      const major = (p?.career ?? []).filter((c) => !c.level);
      const now = !p
        ? __i18n_k("league.draftlog.text.0588d4f7")
        : p.status === 'retired'
          ? __i18n_k("league.draftlog.text.5b170d3c")
          : p.status === 'overseas'
            ? __i18n_k("league.draftlog.text.98a07411")
            : p.status === 'military'
              ? __i18n_k("league.draftlog.text.285374d7")
              : p.teamId
                ? shortName(s, p.teamId)
                : __i18n_k("league.draftlog.text.3e2ba13a");
      return {
        ...x,
        club: shortName(s, x.teamId),
        now,
        inLeague: !!p,
        seasons: major.filter((c) => (c.bat?.g ?? 0) + (c.pit?.g ?? 0) > 0).length,
        games: major.reduce((a, c) => a + Math.max(c.bat?.g ?? 0, c.pit?.g ?? 0), 0),
        war: Math.round(major.reduce((a, c) => a + c.war, 0) * 10) / 10,
      };
    });
}

// ── Before the draft: the prospects in the news ──────────────────────────────────────────────────

/** When the papers write about this year's class (month-day), once each. */
const WATCH = { race: '04-20', spotlight: '06-20', top10: '08-12' } as const;

/** What stands out about a prospect, in a phrase. */
function highlight(p: Player): string {
  const r = p.amateur.record;
  if (isPitcher(p)) return p.velocity ? __i18n_k("league.draftlog.text.c36e31c4", { velo: p.velocity }) : typeof r.era === 'number' ? __i18n_k("league.draftlog.text.19080598", { era: (r.era as number).toFixed(2) }) : '';
  return typeof r.avg === 'number' && typeof r.ops === 'number' ? __i18n_k("league.draftlog.text.7c857760", { avg: (r.avg as number).toFixed(3).replace(/^0/, ''), ops: (r.ops as number).toFixed(3).replace(/^0/, '') }) : '';
}
const who = (p: Player) => __i18n_k("league.draftlog.text.491e5fdd", { name: p.name, from: p.education.school, pos: positionLabel(p) });

/** The draft class in the papers through the season (the user's game only, like the combine). */
export function draftWatchDay(s: LeagueState, date: string) {
  if (!s.user || s.phase !== 'regular') return;
  const due = (Object.entries(WATCH) as [keyof typeof WATCH, string][]).filter(([k, md]) => date >= `${s.year}-${md}` && !s.marketDone?.includes(`${s.year}-watch-${k}`));
  if (!due.length) return;
  const cls = draftClass(s.seed, s.year).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank);
  for (const [kind] of due) {
    (s.marketDone ??= []).push(`${s.year}-watch-${kind}`);
    const id = `draft-watch-${s.year}-${kind}`;
    if (kind === 'race') {
      const top = cls.slice(0, 3);
      if (top.length < 3) continue;
      addNews(s, {
        id,
        date,
        kind: 'month',
        title: __i18n_k("league.draftlog.text.122888e6", { year: s.year, name: top[0]!.name }),
        body: [
          __i18n_k("league.draftlog.text.df0d0ff9", { a: who(top[0]!), b: who(top[1]!), c: who(top[2]!) }),
          ...top.map((p) => {
            const h = highlight(p);
            return h ? __i18n_k("league.draftlog.text.49261c89", { name: p.name, h }) : '';
          }),
          __i18n_k("league.draftlog.text.37aa2a3e"),
        ]
          .filter(Boolean)
          .join(' '),
        quotes: [],
        facts: { year: s.year, first: top[0]!.name },
        players: [],
      });
    } else if (kind === 'spotlight') {
      // A name from the summer tournaments: someone outside the top three with an award to his name.
      const pool = cls.slice(3, 20).filter((p) => p.amateur.awards.length);
      if (!pool.length) continue;
      const p = pool[Math.floor(hashUnit(`${s.seed}|watch|${s.year}`) * pool.length)]!;
      addNews(s, {
        id,
        date,
        kind: 'month',
        title: __i18n_k("league.draftlog.text.48c78a3c", { name: p.name }),
        body: [
          __i18n_k("league.draftlog.text.85f2dc92", { name: iga(p.name), path: p.education.pathText, pos: positionLabel(p), award: p.amateur.awards[0]! }),
          highlight(p) ? __i18n_k("league.draftlog.text.05d07dad", { h: highlight(p) }) : '',
          p.scouting.strength ? __i18n_k("league.draftlog.text.39258a98", { text: p.scouting.strength }) : '',
        ]
          .filter(Boolean)
          .join(' '),
        quotes: [],
        facts: { name: p.name, rank: p.amateur.draftRank },
        players: [],
      });
    } else {
      const top = cls.slice(0, 10);
      if (!top.length) continue;
      addNews(s, {
        id,
        date,
        kind: 'month',
        title: __i18n_k("league.draftlog.text.294a1e55", { n: top.length }),
        body: __i18n_k("league.draftlog.text.6fb429d3", {
          list: top.map((p, i) => __i18n_k("league.draftlog.text.ea4bd226", { n: i + 1, who: who(p) })).join(', '),
        }),
        quotes: [],
        facts: { year: s.year, top: top.map((p) => p.name).join(', ') },
        detail: top.map((p, i) => [`${i + 1}. ${p.name}`, p.education.pathText, positionLabel(p), highlight(p), p.amateur.awards.slice(0, 2).join(' · ')].filter(Boolean).join(' · ')),
        players: [],
      });
    }
  }
}
