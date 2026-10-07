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

export const SPOT_LABEL: Record<Spot, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', SP: '선발투수', RP: '불펜투수' };
const FIELD: Exclude<FieldPos, 'DH'>[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const FLOOR = 25;
const PER = 3;

const won = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 10_000).toFixed(1).replace(/\.0$/, '')}억` : `${Math.round(n).toLocaleString('ko-KR')}만`);
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
        title: `주전 ${worst.p.name} ${worst.days}일 결장`,
        facts: [
          `${SPOT_LABEL[spot] ?? '야수'} ${worst.p.name}(등급 ${worst.p.scouting.current}) · ${s.injuries[worst.p.id]!.part ?? '부상'} · ${s.injuries[worst.p.id]!.until.slice(5).replace('-', '/')} 복귀 예정`,
          next?.who ? `지금 그 자리 다음 선수: ${next.who.name}(등급 ${next.who.scouting.current})` : '그 자리를 맡을 선수가 마땅치 않습니다.',
          ...(out.length > 1 ? [`다른 주전 ${out.length - 1}명도 1주 넘게 빠져 있습니다.`] : []),
        ],
        options: [
          { label: '대체 선수 정하기', note: '퓨처스에서 올리거나 감독에게 맡김', go: { tab: 'club', view: 'squad' } },
          ...(spot in SPOT_LABEL ? [{ label: `${SPOT_LABEL[spot]} 찾기`, note: '트레이드·자유계약 — 연봉과 유망주가 듦', go: { tab: 'market' as const, view: 'search' as const, spot } }] : []),
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
        title: `가장 큰 약점: ${label}`,
        facts: [
          pitching
            ? `우리 ${label} 상위 5명 평균 등급 ${worst.ours} / 리그 평균 ${avg}`
            : worst.who
              ? `우리 ${label} ${worst.who.name}(등급 ${worst.ours}${lineOf(s, worst.who) ? `, ${lineOf(s, worst.who)}` : ''}) / 리그 주전 평균 ${avg}`
              : `우리 팀에 ${label}로 뛸 선수가 없습니다 (리그 주전 평균 ${avg})`,
          prospect ? `안에서 키우기: ${prospect.name}(만 ${ageIn(prospect, s.year)}세, 현재 ${prospect.scouting.current} · 미래 ${prospect.scouting.futureValue}) — 시간이 듦` : '안에서 키울 만한 유망주가 보이지 않습니다.',
          `밖에서 찾기: 다른 구단에 리그 평균보다 나은 ${label} ${others}명${best ? `, 자유계약 ${best.name}(등급 ${best.scouting.current}, 연 ${won(poolAsk(s, best))})` : ''}`,
        ],
        options: [
          { label: `${label} 찾기`, note: s.phase === 'regular' && date > `${s.year}-${KBO_2026.trade.deadline}` ? '트레이드는 마감 — 자유계약만' : '트레이드는 선수·지명권, 자유계약은 연봉', go: { tab: 'market', view: 'search', spot } },
          ...(prospect ? [{ label: `${prospect.name} 보기`, note: '출전 기회를 주면 빨리 큼', go: { tab: 'player' as const, id: prospect.id } }] : []),
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
        title: `외국인 자리 ${open}개가 비어 있습니다`,
        facts: [`외국인 ${used}명 / ${slots.regular + slots.asia}명 · 올해 교체 ${changes}번 남음`, '빈자리는 다른 구단 대비 큰 손해입니다.'],
        options: [{ label: '외국인 영입·교체', note: '신규는 100만 달러 상한 · 구단 자금', go: { tab: 'market', view: 'foreign' } }],
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
      title: `${payYear}년 연봉이 예산을 ${won(payroll - u.payrollBudget)} 넘었습니다`,
      facts: [`연봉 ${won(payroll)} / 예산 ${won(u.payrollBudget)}`, '넘은 만큼 모기업 평가가 나빠지고 구단 자금에서 메워야 합니다.'],
      options: [
        { label: '방출·자유계약', note: '남은 연봉은 그대로 냄', go: { tab: 'market', view: 'release' } },
        { label: '트레이드', note: '연봉을 받아 줄 구단은 선수·현금을 원함', go: { tab: 'market', view: 'trade' } },
      ],
      weight: 45 + Math.min(30, ((payroll - u.payrollBudget) / Math.max(1, u.payrollBudget)) * 200),
    });
  if (u.fund < 0)
    items.push({
      id: 'fund-negative',
      tone: 'warn',
      title: '구단 자금이 바닥났습니다',
      facts: [`구단 자금 ${won(u.fund)}`, '계약금·영입비를 낼 수 없고 모기업의 신뢰가 떨어집니다.'],
      options: [{ label: '구단 운영 보기', note: '티켓·마케팅·지출을 조정', go: { tab: 'club', view: 'office' } }],
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
        title: `모기업 목표 ${u.goals.rank}위 — 지금 ${row.rank}위`,
        facts: [`${row.games}경기 ${row.w}승 ${row.l}패${row.gb ? ` · 1위와 ${row.gb}경기 차` : ''}`, '시즌 뒤 평가가 다음 해 예산과 단장 신뢰를 움직입니다.'],
        options: [
          { label: '라인업 점검', note: '타순·수비·로테이션', go: { tab: 'club', view: 'lineup' } },
          { label: '보강 찾기', go: { tab: 'market', view: 'search' } },
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
        title: `트레이드 마감 ${left}일 전 — ${chase ? '가을야구 경쟁 중' : '가을야구가 멀어짐'}`,
        facts: [
          `${row.rank}위 · 5위 ${fifth.short}와 ${Math.abs(Math.round((fifth.pct - row.pct) * row.games))}승 차 안팎`,
          chase ? '부족한 자리를 지금 메우면 남은 두 달이 달라질 수 있습니다.' : '나이 든 선수를 유망주나 지명권으로 바꿔 내년을 준비할 때입니다.',
        ],
        options: [{ label: '트레이드', note: chase ? '유망주·지명권을 내줌' : '베테랑을 내주고 미래를 받음', go: { tab: 'market', view: 'trade' } }],
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
        title: `퓨처스의 ${best.p.name}, 1군에서 써 볼 만합니다`,
        facts: [
          `${SPOT_LABEL[best.spot]} · 등급 ${best.p.scouting.current}${best.starter ? ` — 1군 ${best.starter.name}(${best.starter.scouting.current})보다 높음` : ''}`,
          '1군 등록일수가 쌓이면 FA가 빨라지고 연봉 협상에서 더 받습니다.',
        ],
        options: [
          { label: '선수단에서 올리기', go: { tab: 'club', view: 'squad' } },
          { label: `${best.p.name} 보기`, go: { tab: 'player', id: best.p.id } },
        ],
        weight: 30 + best.over * 2,
      });
  }

  return items
    .filter((x) => x.weight >= FLOOR)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, PER);
}
