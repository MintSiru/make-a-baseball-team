/* The club's story (V0.7): a timeline of firsts and big moments, and achievements the general manager
   unlocks. Both are the user's club only and never touch the simulation. */
import type { StoredBox } from './boxscore';
import type { SeasonAwards } from './awards';
import type { LeagueState } from './state';

export interface Achievement {
  id: string;
  label: string;
  note: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'founded', label: '창단', note: '11번째 구단을 세웠다' },
  { id: 'firstWin', label: '첫 승', note: '1군 첫 승리' },
  { id: 'walkOff', label: '끝내기', note: '홈에서 끝내기 승리' },
  { id: 'noHitter', label: '노히트 노런', note: '상대에게 안타를 하나도 내주지 않은 경기' },
  { id: 'winning', label: '5할 승률', note: '승률 5할 이상 시즌' },
  { id: 'playoffs', label: '첫 가을야구', note: '포스트시즌 진출' },
  { id: 'pennant', label: '정규시즌 1위', note: '정규시즌 우승' },
  { id: 'champion', label: '한국시리즈 우승', note: '우승' },
  { id: 'dynasty', label: '왕조', note: '한국시리즈 3회 우승' },
  { id: 'mvp', label: 'MVP 배출', note: '우리 선수가 MVP' },
  { id: 'rookie', label: '신인왕 배출', note: '우리 선수가 신인왕' },
  { id: 'homegrown', label: '키운 스타', note: '우리가 뽑은 선수가 한 시즌 WAR 5 이상' },
  { id: 'crowd', label: '100만 관중', note: '한 시즌 홈 관중 100만 명' },
  { id: 'sellouts', label: '매진 행렬', note: '한 시즌 매진 30번' },
  { id: 'profit', label: '흑자 경영', note: '운영 결과 흑자 시즌' },
  { id: 'posting', label: '메이저리거 배출', note: '포스팅으로 메이저리그 진출' },
  { id: 'retiredNumber', label: '영구결번', note: '우리 구단의 영구결번' },
  { id: 'hallOfFame', label: '명예의 전당', note: '우리 구단 출신 명예의 전당 헌액' },
];

/** Adds a line to the club timeline (once per key). */
export function milestone(s: LeagueState, year: number, text: string, key?: string) {
  const u = s.user;
  if (!u) return;
  if (key && u.timeline?.some((t) => t.key === key)) return;
  (u.timeline ??= []).push({ year, text, ...(key ? { key } : {}) });
}

/** Unlocks an achievement (once) and notes it on the timeline. */
export function unlock(s: LeagueState, id: string, year: number, detail = '') {
  const u = s.user;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!u || !a || u.achievements?.some((x) => x.id === id)) return;
  (u.achievements ??= []).push({ id, year });
  milestone(s, year, `업적 달성: ${a.label}${detail ? ` (${detail})` : ''}`);
}

/** After each of the user's games: first win, walk-off, no-hitter. */
export function gameMoments(s: LeagueState, box: StoredBox) {
  const u = s.user;
  if (!u || (box.home !== u.teamId && box.away !== u.teamId)) return;
  const us = box.home === u.teamId ? 1 : 0;
  const them = 1 - us;
  const won = box.rhe[us][0] > box.rhe[them]![0];
  const year = Number(box.date.slice(0, 4));
  const opp = s.teams.find((t) => t.id === (us ? box.away : box.home))?.short ?? '';
  if (won) {
    if (!u.achievements?.some((x) => x.id === 'firstWin')) {
      unlock(s, 'firstWin', year, `${box.date} ${opp}전`);
      milestone(s, year, `${box.date} ${opp}전 1군 첫 승`, 'firstWin');
    }
    // Home team scoring the winning run in its last half inning.
    if (us === 1 && box.line[1].length === box.line[0].length && (box.line[1].at(-1) ?? 0) > 0) unlock(s, 'walkOff', year, `${box.date} ${opp}전`);
  }
  if (box.rhe[them]![1] === 0 && box.line[them]!.length >= 9) {
    unlock(s, 'noHitter', year, `${box.date} ${opp}전`);
    milestone(s, year, `${box.date} ${opp}전 노히트 노런`);
  }
}

/** After the season (accounts settled): the year's rank, postseason, awards, crowds and money. */
export function seasonMoments(s: LeagueState, year: number, awards: SeasonAwards | undefined) {
  const u = s.user;
  const h = s.history.find((x) => x.year === year);
  if (!u || !h) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (row) {
    if (row.pct >= 0.5) unlock(s, 'winning', year, `${row.w}승 ${row.l}패`);
    if (row.rank <= 5) {
      unlock(s, 'playoffs', year);
      milestone(s, year, `${year} 첫 포스트시즌 진출 (${row.rank}위)`, 'playoffs');
    }
    if (row.rank === 1) {
      unlock(s, 'pennant', year);
      milestone(s, year, `${year} 정규시즌 1위 (${row.w}승 ${row.l}패)`);
    }
  }
  if (h.champion === u.teamId) {
    unlock(s, 'champion', year);
    milestone(s, year, `${year} 한국시리즈 우승`);
    const titles = s.history.filter((x) => x.champion === u.teamId).length;
    if (titles >= 3) unlock(s, 'dynasty', year, `${titles}번째 우승`);
  }
  const name = (id: string | null) => (id ? s.players[id]?.name : null);
  const ours = (id: string | null) => !!id && s.players[id]?.career.find((c) => c.year === year && !c.level)?.teamId === u.teamId;
  if (awards && ours(awards.mvp)) {
    unlock(s, 'mvp', year, name(awards.mvp)!);
    milestone(s, year, `${name(awards.mvp)} ${year} MVP`);
  }
  if (awards && ours(awards.rookie)) {
    unlock(s, 'rookie', year, name(awards.rookie)!);
    milestone(s, year, `${name(awards.rookie)} ${year} 신인왕`);
  }
  for (const p of Object.values(s.players)) {
    const c = p.career.find((x) => x.year === year && !x.level && x.teamId === u.teamId);
    if (c && c.war >= 5 && p.origin.draftYear && p.career.every((x) => x.teamId === u.teamId)) unlock(s, 'homegrown', year, `${p.name} WAR ${c.war.toFixed(1)}`);
  }
  const report = s.clubs?.[u.teamId]?.reports.find((r) => r.year === year);
  if (report) {
    if (report.fans >= 1_000_000) unlock(s, 'crowd', year, `${report.fans.toLocaleString('ko-KR')}명`);
    if (report.operating >= 0 && report.homeGames) unlock(s, 'profit', year);
    if ((report.sellouts ?? 0) >= 30) unlock(s, 'sellouts', year, `${report.sellouts}번`);
  }
}
