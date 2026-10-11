import { k as __i18n_k } from '../i18n/index';
/* The general manager's briefing (1.5.0, from the 1.4 review): the few things that matter most right now, each with
   what was seen, why it matters, what could be done about it at what cost, and a button to the screen that does
   it. Everything comes from what the club can see — scouting grades, the numbers, injuries, the books, the owner's
   goals — never from players' hidden abilities, and nothing here decides anything. */
import { KBO_2026 } from '../rules/kbo2026';
import type { FieldPos } from './engine/types';
import { today } from './entry';
import { projectedPayroll } from './expansion';
import { slotForeigners } from './foreigncap';
import { foreignSlots } from './manager';
import { ageIn, isPitcher } from './players';
import { firstTeamIds, orgPlayers, type LeagueState } from './state';
import { poolAsk } from './trade';
import { rates, standingsView } from './views';
import type { Player, PlayerId, TeamId } from '../model/types';

export type Spot = Exclude<FieldPos, 'DH'> | 'SP' | 'RP';

/** Where a choice is made. */
export type BriefGo =
  | { tab: 'club'; view: 'squad' | 'lineup' | 'office' }
  | { tab: 'market'; view: 'search' | 'trade' | 'release' | 'foreign'; spot?: Spot }
  | { tab: 'player'; id: PlayerId };

export interface BriefOption {
  label: string;
  /** What it costs or risks, in a phrase. */
  note?: string;
  go: BriefGo;
}

export interface BriefItem {
  id: string;
  tone: 'warn' | 'info' | 'good';
  title: string;
  /** What was seen and why it matters. */
  facts: string[];
  options: BriefOption[];
  /** How pressing (higher first); items under the floor stay out. */
  weight: number;
}

export const SPOT_LABEL: Record<Spot, string> = { C: __i18n_k("league.briefing.sPOT_LABEL.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.briefing.sPOT_LABEL.sS.3e24c7f1"), LF: __i18n_k("league.briefing.sPOT_LABEL.lF.73836db2"), CF: __i18n_k("league.briefing.sPOT_LABEL.cF.56780b2a"), RF: __i18n_k("league.briefing.sPOT_LABEL.rF.a28a0ef8"), SP: __i18n_k("league.briefing.sPOT_LABEL.sP.cd036b1a"), RP: __i18n_k("league.briefing.sPOT_LABEL.rP.ac3cc00a") };
const FIELD: Exclude<FieldPos, 'DH'>[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const FLOOR = 25;
const PER = 3;

const won = (n: number) => (Math.abs(n) >= 10_000 ? __i18n_k("league.briefing.won.db0fc332", { value: (n / 10_000).toFixed(1).replace(/\.0$/, '') }) : __i18n_k("league.briefing.won.cd1481f0", { value: Math.round(n).toLocaleString('ko-KR') }));
const fits = (p: Player, spot: Spot) => (spot === 'SP' || spot === 'RP' ? isPitcher(p) && p.role === spot : !isPitcher(p) && p.position === spot);
const playing = (p: Player) => p.status === 'active';
const hurt = (s: LeagueState, id: PlayerId, date: string) => {
  const i = s.injuries[id];
  return !!i && !i.dtd && i.until > date;
};

/** This season's line in a few numbers (the public record). */
function lineOf(s: LeagueState, p: Player): string {
  const l = s.lines[p.id];
  if (isPitcher(p)) return l?.pit?.outs ? `ERA ${rates.era(l.pit).toFixed(2)}` : '';
  return l?.bat?.pa ? `OPS ${rates.fmt3(rates.ops(l.bat))}` : '';
}

/** A club's grade at a spot: its best healthy player there (the top five starters, the top five relievers). */
function spotGrade(s: LeagueState, teamId: TeamId, spot: Spot, date: string): { grade: number; who: Player | null } {
  const pool = orgPlayers(s, teamId)
    .filter((p) => playing(p) && fits(p, spot) && !hurt(s, p.id, date))
    .sort((a, b) => b.scouting.current - a.scouting.current);
  if (spot === 'SP' || spot === 'RP') {
    const top = pool.slice(0, 5);
    return { grade: top.length ? Math.round(top.reduce((a, p) => a + p.scouting.current, 0) / Math.max(5, top.length)) : 20, who: top.at(-1) ?? null };
  }
  return { grade: pool[0]?.scouting.current ?? 20, who: pool[0] ?? null };
}

/** The briefing: up to three items, most pressing first. */
export function briefing(s: LeagueState): BriefItem[] {
  const u = s.user;
  if (!u || u.fired) return [];
  const me = u.teamId;
  const date = s.phase === 'regular' ? today(s) : `${s.year}-12-31`;
  const items: BriefItem[] = [];
  const clubs = firstTeamIds(s).filter((id) => id !== me);
  const inSeason = s.phase === 'regular' && firstTeamIds(s).includes(me);

  // Injured regulars.
  if (inSeason) {
    const org = orgPlayers(s, me).filter(playing);
    const hitters = org.filter((p) => !isPitcher(p)).sort((a, b) => b.scouting.current - a.scouting.current).slice(0, 9);
    const sp = org.filter((p) => isPitcher(p) && p.role === 'SP').sort((a, b) => b.scouting.current - a.scouting.current).slice(0, 5);
    const rp = org.filter((p) => isPitcher(p) && p.role === 'RP').sort((a, b) => b.scouting.current - a.scouting.current).slice(0, 3);
    const out = [...hitters, ...sp, ...rp]
      .filter((p) => hurt(s, p.id, date))
      .map((p) => ({ p, days: Math.round((Date.parse(s.injuries[p.id]!.until) - Date.parse(date)) / 86_400_000) }))
      .filter((x) => x.days >= 7)
      .sort((a, b) => b.days - a.days);
    const worst = out[0];
    if (worst) {
      const spot: Spot = isPitcher(worst.p) ? (worst.p.role as Spot) : ((worst.p.position ?? 'DH') as Spot);
      const next = spot in SPOT_LABEL ? spotGrade(s, me, spot, date) : null;
      items.push({
        id: `injury-${worst.p.id}`,
        tone: 'warn',
        title: __i18n_k("league.briefing.briefing.title.bde73e70", { name: worst.p.name, days: worst.days }),
        facts: [
          __i18n_k("league.briefing.briefing.facts.f7a70a51", { value: SPOT_LABEL[spot] ?? __i18n_k("league.briefing.briefing.facts.9dac0c64"), name: worst.p.name, current: worst.p.scouting.current, value2: s.injuries[worst.p.id]!.part ?? __i18n_k("league.briefing.briefing.facts.501fb802"), value3: s.injuries[worst.p.id]!.until.slice(5).replace('-', '/') }),
          next?.who ? __i18n_k("league.briefing.briefing.facts.32874697", { name: next.who.name, current: next.who.scouting.current }) : __i18n_k("league.briefing.briefing.facts.5bf839f2"),
          ...(out.length > 1 ? [__i18n_k("league.briefing.briefing.facts.2429e968", { value: out.length - 1 })] : []),
        ],
        options: [
          { label: __i18n_k("league.briefing.options.label.6896e07b"), note: __i18n_k("league.briefing.options.note.7d89c8c6"), go: { tab: 'club', view: 'squad' } },
          ...(spot in SPOT_LABEL ? [{ label: __i18n_k("league.briefing.options.label.4d8946b8", { value: SPOT_LABEL[spot] }), note: __i18n_k("league.briefing.options.note.c23a1586"), go: { tab: 'market' as const, view: 'search' as const, spot } }] : []),
        ],
        weight: 55 + Math.min(30, worst.days / 3) + Math.max(0, worst.p.scouting.current - (next?.who?.scouting.current ?? 20)),
      });
    }
  }

  // The weakest spot against the league, and what could fill it.
  if (clubs.length) {
    let worst: { spot: Spot; ours: number; league: number; who: Player | null } | null = null;
    for (const spot of [...FIELD, 'SP', 'RP'] as Spot[]) {
      const ours = spotGrade(s, me, spot, date);
      const league = clubs.reduce((a, id) => a + spotGrade(s, id, spot, date).grade, 0) / clubs.length;
      const gap = league - ours.grade;
      if (!worst || gap > worst.league - worst.ours) worst = { spot, ours: ours.grade, league, who: ours.who };
    }
    if (worst && worst.league - worst.ours >= 5) {
      const { spot } = worst;
      const avg = Math.round(worst.league);
      const mine = orgPlayers(s, me).filter((p) => playing(p) && fits(p, spot));
      const prospect = mine
        .filter((p) => p !== worst!.who && ageIn(p, s.year) <= 25 && p.scouting.futureValue >= avg)
        .sort((a, b) => b.scouting.futureValue - a.scouting.futureValue)[0];
      const others = Object.values(s.players).filter((p) => p.teamId && p.teamId !== me && playing(p) && fits(p, spot) && p.scouting.current >= avg + 5).length;
      const free = (s.pool ?? []).map((id) => s.players[id]!).filter((p) => p && fits(p, spot) && p.scouting.current >= worst!.ours + 5);
      const best = free.sort((a, b) => b.scouting.current - a.scouting.current)[0];
      const label = SPOT_LABEL[spot];
      const pitching = spot === 'SP' || spot === 'RP';
      items.push({
        id: `weak-${spot}`,
        tone: 'info',
        title: __i18n_k("league.briefing.briefing.title.bf9d4d56", { label: label }),
        facts: [
          pitching
            ? __i18n_k("league.briefing.briefing.facts.c9a23e96", { label: label, ours: worst.ours, avg: avg })
            : worst.who
              ? __i18n_k("league.briefing.briefing.facts.ceab4fb3", { label: label, name: worst.who.name, ours: worst.ours, value: lineOf(s, worst.who) ? `, ${lineOf(s, worst.who)}` : '', avg: avg })
              : __i18n_k("league.briefing.briefing.facts.cd2ca467", { label: label, avg: avg }),
          prospect ? __i18n_k("league.briefing.briefing.facts.1b9b8dac", { name: prospect.name, ageIn: ageIn(prospect, s.year), current: prospect.scouting.current, futureValue: prospect.scouting.futureValue }) : __i18n_k("league.briefing.briefing.facts.e7071735"),
          __i18n_k("league.briefing.briefing.facts.afe64a9e", { label: label, others: others, value: best ? __i18n_k("league.briefing.briefing.facts.00fafe48", { name: best.name, current: best.scouting.current, won: won(poolAsk(s, best)) }) : '' }),
        ],
        options: [
          { label: __i18n_k("league.briefing.options.label.4fdc1049", { label: label }), note: s.phase === 'regular' && date > `${s.year}-${KBO_2026.trade.deadline}` ? __i18n_k("league.briefing.options.note.c9708ec9") : __i18n_k("league.briefing.options.note.ca7714ff"), go: { tab: 'market', view: 'search', spot } },
          ...(prospect ? [{ label: __i18n_k("league.briefing.options.label.16fdf68b", { name: prospect.name }), note: __i18n_k("league.briefing.options.note.aa02397a"), go: { tab: 'player' as const, id: prospect.id } }] : []),
        ],
        weight: (worst.league - worst.ours) * 3,
      });
    }
  }

  // Open foreign places in the season.
  if (inSeason) {
    const slots = foreignSlots(s, me, s.year);
    const used = slotForeigners(s, me, s.year).length;
    const open = slots.regular + slots.asia - used;
    const changes = KBO_2026.foreign.replacementsPerSeason - (s.foreignChanges?.[me] ?? 0);
    if (open > 0 && changes > 0)
      items.push({
        id: 'foreign-open',
        tone: 'warn',
        title: __i18n_k("league.briefing.briefing.title.8692d011", { open: open }),
        facts: [__i18n_k("league.briefing.briefing.facts.14cf69ed", { used: used, value: slots.regular + slots.asia, changes: changes }), __i18n_k("league.briefing.briefing.facts.184404f9")],
        options: [{ label: __i18n_k("league.briefing.options.label.a00f6ed1"), note: __i18n_k("league.briefing.options.note.ac50115a"), go: { tab: 'market', view: 'foreign' } }],
        weight: 70,
      });
  }

  // Money.
  const payYear = s.phase === 'offseason' && s.offseason ? s.offseason.year + 1 : s.year;
  const payroll = projectedPayroll(s, me, payYear);
  if (payroll > u.payrollBudget)
    items.push({
      id: 'payroll-over',
      tone: 'warn',
      title: __i18n_k("league.briefing.briefing.title.d47ba9cf", { payYear: payYear, won: won(payroll - u.payrollBudget) }),
      facts: [__i18n_k("league.briefing.briefing.facts.3390601a", { won: won(payroll), won2: won(u.payrollBudget) }), __i18n_k("league.briefing.briefing.facts.5dd2fb46")],
      options: [
        { label: __i18n_k("league.briefing.options.label.e1df1ebf"), note: __i18n_k("league.briefing.options.note.3e669a26"), go: { tab: 'market', view: 'release' } },
        { label: __i18n_k("league.briefing.options.label.428749ee"), note: __i18n_k("league.briefing.options.note.4f6740e9"), go: { tab: 'market', view: 'trade' } },
      ],
      weight: 45 + Math.min(30, ((payroll - u.payrollBudget) / Math.max(1, u.payrollBudget)) * 200),
    });
  if (u.fund < 0)
    items.push({
      id: 'fund-negative',
      tone: 'warn',
      title: __i18n_k("league.briefing.briefing.title.f461f238"),
      facts: [__i18n_k("league.briefing.briefing.facts.2c61708c", { won: won(u.fund) }), __i18n_k("league.briefing.briefing.facts.c6ea5aa8")],
      options: [{ label: __i18n_k("league.briefing.options.label.d22c5d41"), note: __i18n_k("league.briefing.options.note.2160336b"), go: { tab: 'club', view: 'office' } }],
      weight: 80,
    });

  // The owner's goals, a month into the season.
  const row = standingsView(s).find((r) => r.teamId === me);
  if (inSeason && u.goals?.year === s.year && row && row.games >= 30) {
    const behind = row.rank - u.goals.rank;
    if (behind >= 2)
      items.push({
        id: 'goal-rank',
        tone: 'warn',
        title: __i18n_k("league.briefing.briefing.title.dde38b1e", { rank: u.goals.rank, rank2: row.rank }),
        facts: [__i18n_k("league.briefing.briefing.facts.3aa05999", { games: row.games, w: row.w, l: row.l, value: row.gb ? __i18n_k("league.briefing.briefing.facts.847855e7", { gb: row.gb }) : '' }), __i18n_k("league.briefing.briefing.facts.a2a513ee")],
        options: [
          { label: __i18n_k("league.briefing.options.label.c09d904f"), note: __i18n_k("league.briefing.options.note.842b3700"), go: { tab: 'club', view: 'lineup' } },
          { label: __i18n_k("league.briefing.options.label.9bde8db7"), go: { tab: 'market', view: 'search' } },
        ],
        weight: 30 + behind * 6,
      });
  }

  // The trade deadline in July: chase or build.
  if (inSeason && date.slice(5, 7) === '07' && row) {
    const table = standingsView(s);
    const fifth = table[Math.min(4, table.length - 1)]!;
    const chase = row.rank <= 5 || row.pct >= fifth.pct - 0.03;
    const left = Math.round((Date.parse(`${s.year}-${KBO_2026.trade.deadline}`) - Date.parse(date)) / 86_400_000);
    if (left >= 0)
      items.push({
        id: 'deadline',
        tone: 'info',
        title: __i18n_k("league.briefing.briefing.title.4f548af6", { left: left, value: chase ? __i18n_k("league.briefing.briefing.title.a48b92e9") : __i18n_k("league.briefing.briefing.title.9c6fa70b") }),
        facts: [
          __i18n_k("league.briefing.briefing.facts.5683c8af", { rank: row.rank, short: fifth.short, value: Math.abs(Math.round((fifth.pct - row.pct) * row.games)) }),
          chase ? __i18n_k("league.briefing.briefing.facts.c3c1814c") : __i18n_k("league.briefing.briefing.facts.87a94619"),
        ],
        options: [{ label: __i18n_k("league.briefing.options.label.428749ee"), note: chase ? __i18n_k("league.briefing.options.note.d104c488") : __i18n_k("league.briefing.options.note.808f5c4f"), go: { tab: 'market', view: 'trade' } }],
        weight: 45,
      });
  }

  // A futures player better than the one playing his spot.
  if (inSeason) {
    const futures = s.rosters[me]!.futures.map((id) => s.players[id]!).filter((p) => p && playing(p) && !hurt(s, p.id, date));
    let best: { p: Player; over: number; spot: Spot; starter: Player | null } | null = null;
    for (const p of futures) {
      const spot: Spot | null = isPitcher(p) ? (p.role as Spot) : (p.position ?? null);
      if (!spot) continue;
      const starter = spotGrade(s, me, spot, date);
      const over = p.scouting.current - starter.grade;
      if (over >= 5 && (!best || over > best.over)) best = { p, over, spot, starter: starter.who };
    }
    if (best)
      items.push({
        id: `ready-${best.p.id}`,
        tone: 'good',
        title: __i18n_k("league.briefing.briefing.title.5a14bb9a", { name: best.p.name }),
        facts: [
          __i18n_k("league.briefing.briefing.facts.0ee2aced", { value: SPOT_LABEL[best.spot], current: best.p.scouting.current, value2: best.starter ? __i18n_k("league.briefing.briefing.facts.65ad8bad", { name: best.starter.name, current: best.starter.scouting.current }) : '' }),
          __i18n_k("league.briefing.briefing.facts.a6ba250b"),
        ],
        options: [
          { label: __i18n_k("league.briefing.options.label.7e9a1852"), go: { tab: 'club', view: 'squad' } },
          { label: __i18n_k("league.briefing.options.label.16fdf68b", { name: best.p.name }), go: { tab: 'player', id: best.p.id } },
        ],
        weight: 30 + best.over * 2,
      });
  }

  return items
    .filter((x) => x.weight >= FLOOR)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, PER);
}
