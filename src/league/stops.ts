/* Stops at the moments that matter (1.6.0, from the 1.4 review): a run of days ("1주", "한 달", "정규시즌 끝까지")
   ends early when one of our regulars is out for three weeks or more, a week before the trade deadline, after our
   first first-team game, and when our place in the postseason is settled either way. Each is a setting (all on by
   default). A stop only ends the run: the days played are the same days, so the season itself does not change. */
import type { Player, PlayerId } from '../model/types';
import { KBO_2026 } from '../rules/kbo2026';
import { addAlert } from './alerts';
import { firstTeamIds, type LeagueState } from './state';
import { standings } from './standings';

export type StopKind = 'injury' | 'deadline' | 'debut' | 'race';
export const STOP_KINDS: StopKind[] = ['injury', 'deadline', 'debut', 'race'];
export const STOP_LABEL: Record<StopKind, string> = {
  injury: '주전이 3주 넘게 빠지는 부상',
  deadline: '트레이드 마감 1주 전',
  debut: '1군 첫 경기 직후',
  race: '가을야구 진출·탈락이 확정될 때',
};
/** Out this long or more stops the run. */
const LONG = 21;
/** The places that reach the postseason in one league. */
const SPOTS = 5;

export const stopsOf = (s: LeagueState): StopKind[] => s.user?.settings.stops ?? STOP_KINDS;

const deadlineWeek = (year: number) => {
  const [m, d] = KBO_2026.trade.deadline.split('-').map(Number);
  const t = new Date(Date.UTC(year, m! - 1, d! - 7));
  return t.toISOString().slice(0, 10);
};

/** A regular: on the first-team roster and among the better half of it. */
function regular(s: LeagueState, p: Player): boolean {
  const r = s.rosters[p.teamId!];
  return !!r?.active.includes(p.id) && p.scouting.current >= 50;
}

/** Where our club stands against the postseason line: 'in', 'out' or still open. */
export function raceState(s: LeagueState): 'in' | 'out' | null {
  const u = s.user;
  if (!u || s.twelve?.format === 'two') return null;
  const ids = firstTeamIds(s, s.year);
  if (!ids.includes(u.teamId)) return null;
  const rows = standings(ids, s.scores);
  const left: Record<string, number> = {};
  for (let i = s.next; i < s.schedule.length; i++) {
    const g = s.schedule[i]!;
    left[g.home] = (left[g.home] ?? 0) + 1;
    left[g.away] = (left[g.away] ?? 0) + 1;
  }
  const me = rows.find((r) => r.teamId === u.teamId)!;
  const others = rows.filter((r) => r.teamId !== u.teamId);
  const myMax = me.w + (left[u.teamId] ?? 0);
  // In: at most four others can still reach our wins. Out: five others already have more than we can reach.
  if (others.filter((r) => r.w + (left[r.teamId] ?? 0) >= me.w).length < SPOTS) return 'in';
  if (others.filter((r) => r.w > myMax).length >= SPOTS) return 'out';
  return null;
}

/** Watches a run of days; call after each day: true when the run should stop there. */
export function watchStops(s: LeagueState): () => boolean {
  const u = s.user;
  const on = new Set(stopsOf(s));
  if (!u || !on.size || s.phase !== 'regular') return () => false;
  const hurt = new Set<PlayerId>(Object.keys(s.injuries));
  const race = raceState(s);
  const first = firstTeamIds(s, s.year).includes(u.teamId);
  const played = () => s.scores.filter((g) => g.home === u.teamId || g.away === u.teamId).length;
  const debutDue = on.has('debut') && first && s.year === u.firstTeamYear && played() === 0;
  return () => {
    const last = s.schedule[s.next - 1]?.date ?? '';
    const coming = s.schedule[s.next]?.date;
    if (on.has('injury')) {
      for (const [id, inj] of Object.entries(s.injuries)) {
        if (hurt.has(id)) continue;
        hurt.add(id);
        const p = s.players[id];
        if (inj.dtd || inj.days < LONG || p?.teamId !== u.teamId || !regular(s, p)) continue;
        addAlert(s, { id: `stop-injury-${id}-${last}`, date: last, kind: 'injury', title: `${p.name} 이탈 (${inj.part ?? '부상'})`, lines: [`복귀까지 약 ${Math.round(inj.days / 7)}주 (${inj.until} 예정). 라인업과 대체 선수를 살펴보세요.`], tone: 'bad', players: [id] });
        return true;
      }
    }
    if (on.has('deadline') && first && coming) {
      const week = deadlineWeek(s.year);
      if (last < week && coming >= week) {
        addAlert(s, { id: `stop-deadline-${s.year}`, date: last, kind: 'season', title: '트레이드 마감 1주 전', lines: [`7월 31일이 지나면 한국시리즈가 끝날 때까지 트레이드를 할 수 없습니다. 지금 순위와 선수단을 보고 보강할지, 미래를 볼지 정하세요.`] });
        return true;
      }
    }
    if (debutDue && played() > 0) {
      addAlert(s, { id: `stop-debut-${s.year}`, date: last, kind: 'achievement', title: '1군 데뷔전', lines: ['우리 구단의 첫 1군 경기가 끝났습니다. 경기 탭에서 기록을 볼 수 있습니다.'], tone: 'good' });
      return true;
    }
    if (on.has('race') && !race) {
      const now = raceState(s);
      if (now) {
        addAlert(s, { id: `stop-race-${s.year}`, date: last, kind: 'season', title: now === 'in' ? '가을야구 확정' : '가을야구 탈락 확정', lines: [now === 'in' ? '남은 경기에 상관없이 포스트시즌에 나갑니다. 순위 싸움과 투수 운용을 정하세요.' : '남은 경기에서 이겨도 5위 안에 들 수 없습니다. 유망주에게 기회를 줄 때입니다.'], tone: now === 'in' ? 'good' : 'bad' });
        return true;
      }
    }
    return false;
  };
}
