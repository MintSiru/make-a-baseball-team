/* Event alerts (V0.7.4): the moments the general manager should hear about right away — national team
   picks and results, how the free-agent market went, awards, the hall of fame, the season's end, the
   owner's verdict, postings and achievements. The screen shows new ones in a pop-up and keeps the list
   in the club's news. Only in a game with the player's club, and never part of the simulation. */
import type { Player, PlayerId, TeamId } from '../model/types';
import type { SeasonAwards } from './awards';
import type { InternationalEvent } from './international';
import type { LeagueState } from './state';

export type AlertKind = 'national' | 'fa' | 'award' | 'hall' | 'season' | 'owner' | 'posting' | 'achievement';

export interface Alert {
  id: string;
  date: string;
  kind: AlertKind;
  title: string;
  lines: string[];
  /** Good news for the club (a medal, a signing, an award) or bad (a loss). */
  tone?: 'good' | 'bad';
  players?: PlayerId[];
  seen?: boolean;
}

const KEEP = 80;

export function addAlert(s: LeagueState, a: Omit<Alert, 'seen'>) {
  if (!s.user) return;
  const list = (s.alerts ??= []);
  if (list.some((x) => x.id === a.id)) return;
  list.push(a);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

export const unseenAlerts = (s: LeagueState) => (s.alerts ?? []).filter((a) => !a.seen);

/** Marks alerts as read (all of them without `ids`). */
export function markAlertsSeen(s: LeagueState, ids?: string[]) {
  for (const a of s.alerts ?? []) if (!ids || ids.includes(a.id)) a.seen = true;
}

const short = (s: LeagueState, id: TeamId | null | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';
const won = (manwon: number) => {
  const eok = Math.floor(manwon / 10000),
    rest = manwon % 10000;
  return eok ? `${eok}억${rest ? ` ${rest.toLocaleString('ko-KR')}만` : ''}` : `${rest.toLocaleString('ko-KR')}만`;
};
const POS: Record<string, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' };
const posOf = (p: Player) => (p.position ? POS[p.position]! : p.role === 'SP' ? '선발투수' : '불펜투수');
const terms = (p: Player) => {
  const c = p.contract;
  return c?.salaries.length ? `${c.salaries.length}년 연 ${won(c.salaries[0]!.amount)}` : '';
};

// ── National team ────────────────────────────────────────────────────────────────────────────────

type Squad = { year: number; name: string; medal: boolean; squad: PlayerId[] };

/** The squad is named: which of our players go, and who could earn the military exemption. */
export function nationalPickAlert(s: LeagueState, e: InternationalEvent, entry: Squad, date: string) {
  const u = s.user;
  if (!u) return;
  const ours = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  if (!ours.length) return;
  const exempt = ours.filter((p) => p.service.military === 'pending' || p.service.military === 'serving');
  addAlert(s, {
    id: `intl-pick-${entry.year}`,
    date,
    kind: 'national',
    title: `국가대표 선발 · ${e.name}`,
    lines: [
      `대표팀 ${entry.squad.length}명 가운데 우리 선수 ${ours.length}명이 뽑혔습니다.`,
      ...ours.map((p) => `${p.name} (${posOf(p)}${p.service.military === 'pending' ? ', 미필' : ''})`),
      ...(exempt.length ? [`${e.kind === 'asianGames' ? '금메달' : '메달'}을 따면 미필 ${exempt.length}명이 병역 특례를 받습니다.`] : []),
      ...(e.dates ? [`대회 기간(${e.dates.from.slice(5)}~${e.dates.to.slice(5)})에는 팀을 떠납니다.`] : []),
    ],
    tone: 'good',
    players: ours.map((p) => p.id),
  });
}

/** The event is over: the result, and our players who earned the exemption. */
export function nationalResultAlert(s: LeagueState, e: InternationalEvent, entry: Squad, date: string) {
  const u = s.user;
  if (!u) return;
  const ours = entry.squad.map((id) => s.players[id]).filter((p): p is Player => !!p && p.teamId === u.teamId);
  const exempt = entry.medal ? ours.filter((p) => p.service.military === 'pending' || p.service.military === 'serving') : [];
  const medal = e.kind === 'asianGames' ? '금메달' : '메달';
  addAlert(s, {
    id: `intl-result-${entry.year}`,
    date,
    kind: 'national',
    title: `${e.name} ${entry.medal ? `${medal} 획득` : `${medal} 실패`}`,
    lines: [
      entry.medal ? `대표팀이 ${medal}을 땄습니다.` : `대표팀이 ${medal}을 따지 못했습니다.`,
      ...(ours.length ? [`우리 선수: ${ours.map((p) => p.name).join(', ')}`] : []),
      ...(exempt.length ? [`병역 특례(예술체육요원): ${exempt.map((p) => p.name).join(', ')}`] : entry.medal && ours.length ? ['우리 선수 가운데 병역 특례 대상(미필)은 없습니다.'] : []),
    ],
    tone: entry.medal ? 'good' : ours.length ? 'bad' : undefined,
    players: ours.map((p) => p.id),
  });
}

// ── The free-agent market ────────────────────────────────────────────────────────────────────────

/** After the market: our bids, our own free agents, and the league's biggest moves. */
export function faAlert(s: LeagueState, year: number, before: { id: PlayerId; from: TeamId }[], offers: Record<PlayerId, unknown>) {
  const u = s.user;
  if (!u || !before.length) return;
  const lines: string[] = [];
  let good = false,
    bad = false;
  for (const b of before) {
    const p = s.players[b.id];
    if (!p) continue;
    const to = p.teamId;
    if (b.id in offers && b.from !== u.teamId) {
      if (to === u.teamId) {
        lines.push(`영입 성공: ${p.name} (${short(s, b.from)}에서, ${terms(p)})`);
        good = true;
      } else {
        lines.push(`영입 실패: ${p.name} → ${to ? `${short(s, to)} (${terms(p)})` : '은퇴'}`);
        bad = true;
      }
    } else if (b.from === u.teamId) {
      if (to === u.teamId) lines.push(`잔류: ${p.name} (${terms(p)})`);
      else {
        lines.push(`이적: ${p.name} → ${to ? `${short(s, to)} (${terms(p)})` : '은퇴'}`);
        bad = true;
      }
    }
  }
  const big = before
    .map((b) => ({ b, p: s.players[b.id] }))
    .filter((x): x is { b: (typeof before)[number]; p: Player } => !!x.p && !!x.p.teamId && x.p.teamId !== x.b.from && x.p.teamId !== u.teamId && x.b.from !== u.teamId)
    .sort((a, c) => (c.p.contract?.salaries[0]?.amount ?? 0) - (a.p.contract?.salaries[0]?.amount ?? 0))
    .slice(0, 3);
  if (big.length) lines.push(`리그 대형 이적: ${big.map((x) => `${x.p.name} ${short(s, x.b.from)}→${short(s, x.p.teamId)} (${terms(x.p)})`).join(', ')}`);
  if (!lines.length) return;
  addAlert(s, { id: `fa-${year}`, date: `${year}-11-20`, kind: 'fa', title: `${year} FA 시장 결과`, lines, tone: good ? 'good' : bad ? 'bad' : undefined, players: before.map((b) => b.id) });
}

// ── Awards, the hall of fame, the season ─────────────────────────────────────────────────────────

export function awardAlert(s: LeagueState, year: number, a: SeasonAwards) {
  const u = s.user;
  if (!u) return;
  const teamOf = (id: PlayerId) => s.players[id]?.career.find((c) => c.year === year && !c.level)?.teamId;
  const who = (id: PlayerId) => `${s.players[id]?.name ?? ''} (${short(s, teamOf(id))})`;
  const ours = (id: PlayerId | null) => !!id && teamOf(id) === u.teamId;
  const lines: string[] = [];
  if (a.mvp) lines.push(`MVP: ${who(a.mvp)}${ours(a.mvp) ? ' — 우리 선수!' : ''}`);
  if (a.rookie) lines.push(`신인왕: ${who(a.rookie)}${ours(a.rookie) ? ' — 우리 선수!' : ''}`);
  const gg = a.goldenGloves.filter((g) => ours(g.id));
  if (gg.length) lines.push(`우리 골든글러브: ${gg.map((g) => `${s.players[g.id]?.name} (${g.pos})`).join(', ')}`);
  const titles = a.titles.filter((t) => ours(t.id));
  if (titles.length) lines.push(`우리 타이틀: ${titles.map((t) => `${t.label} ${s.players[t.id]?.name} (${t.value})`).join(', ')}`);
  if (!gg.length && !titles.length && !ours(a.mvp) && !ours(a.rookie)) lines.push('올해는 우리 선수가 상을 받지 못했습니다.');
  const mine = [a.mvp, a.rookie, ...gg.map((g) => g.id), ...titles.map((t) => t.id)].filter((id): id is PlayerId => ours(id));
  addAlert(s, { id: `awards-${year}`, date: `${year}-11-01`, kind: 'award', title: `${year} 시상식`, lines, tone: mine.length ? 'good' : undefined, players: [...new Set(mine)] });
}

export function hallAlert(s: LeagueState, p: Player, entry: { year: number; war: number; seasons: number; teams: TeamId[]; line: string }) {
  const u = s.user;
  if (!u) return;
  const ours = entry.teams.includes(u.teamId);
  addAlert(s, {
    id: `hof-${p.id}`,
    date: `${entry.year}-11-10`,
    kind: 'hall',
    title: `명예의 전당 헌액 · ${p.name}`,
    lines: [`통산 ${entry.seasons}시즌, WAR ${entry.war.toFixed(1)}, ${entry.line}`, `뛴 구단: ${entry.teams.map((t) => short(s, t)).join(', ')}${ours ? ' — 우리 구단 출신!' : ''}`, ...(p.honors ?? []).slice(-3)],
    tone: ours ? 'good' : undefined,
    players: [p.id],
  });
}

const ROUND: Record<string, string> = { wildcard: '와일드카드 결정전', semipo: '준플레이오프', po: '플레이오프', ks: '한국시리즈' };

/** The season is over: our finish and how far we went in the postseason. */
export function seasonAlert(s: LeagueState, year: number) {
  const u = s.user;
  const h = s.history.find((x) => x.year === year);
  if (!u || !h) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (!row) return;
  const ours = h.series.filter((x) => x.high === u.teamId || x.low === u.teamId);
  const last = ours.at(-1);
  const champ = h.champion === u.teamId;
  const post = champ ? '한국시리즈 우승!' : last ? `${ROUND[last.round]}에서 ${short(s, last.winner)}에 졌습니다 (${last.high === u.teamId ? last.highWins : last.lowWins}승 ${last.high === u.teamId ? last.lowWins : last.highWins}패).` : '포스트시즌에 나가지 못했습니다.';
  addAlert(s, {
    id: `season-${year}`,
    date: `${year}-11-01`,
    kind: 'season',
    title: champ ? `${year} 한국시리즈 우승!` : `${year} 시즌 종료 · ${row.rank}위`,
    lines: [`정규시즌 ${row.w}승 ${row.l}패 ${row.t}무, ${row.rank}위`, post, ...(h.champion && !champ ? [`우승: ${short(s, h.champion)}`] : [])],
    tone: champ || row.rank <= 5 ? 'good' : 'bad',
  });
}

export function ownerAlert(s: LeagueState, year: number, ev: { lines: { label: string; ok: boolean; text: string }[]; change: number; trust: number }) {
  addAlert(s, {
    id: `owner-${year}`,
    date: `${year}-11-01`,
    kind: 'owner',
    title: `${year} 모기업 평가`,
    lines: [...ev.lines.map((l) => `${l.ok ? '달성' : '미달'} · ${l.label}: ${l.text}`), `내년 예산 ${ev.change >= 0 ? '+' : ''}${Math.round(ev.change * 100)}%, 신뢰도 ${Math.round(ev.trust)}`],
    tone: ev.change >= 0 ? 'good' : 'bad',
  });
}

export function postingAlert(s: LeagueState, p: Player, teamId: TeamId, year: number, deal: { years: number; total: string; fee: string } | null) {
  if (teamId !== s.user?.teamId) return;
  addAlert(s, {
    id: `posting-${p.id}`,
    date: `${year}-11-10`,
    kind: 'posting',
    title: deal ? `${p.name}, 메이저리그 진출` : `${p.name}, 포스팅 불발`,
    lines: deal ? [`메이저리그 구단과 ${deal.years}년 ${deal.total}에 계약했습니다.`, `이적료 ${deal.fee}를 받습니다.`] : ['계약한 메이저리그 구단이 없어 팀에 남습니다.'],
    tone: deal ? 'good' : 'bad',
    players: [p.id],
  });
}

export function achievementAlert(s: LeagueState, id: string, label: string, note: string, date: string, detail: string) {
  addAlert(s, { id: `ach-${id}`, date, kind: 'achievement', title: `업적 달성 · ${label}`, lines: [note, ...(detail ? [detail] : [])], tone: 'good' });
}
