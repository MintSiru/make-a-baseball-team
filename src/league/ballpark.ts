/* Ballpark projects (V0.6, RULES.md §13). In the winter the user's club can
   - expand its ballpark (+3,000 seats, up to 25,000; the club's share 150억, ready next season),
   - move the fences (in: more home runs, out: fewer; 15억, next season),
   - build a new 22,000-seat ballpark with the city (the club prepays 25 years of use, 400억, as
     Samsung (500억) and KIA (300억) did; it opens three seasons later).
   Projects are paid from the fund up front: the owner's support covers operations, not buildings. */
import type { LeagueState, StadiumProject } from './state';
import { clubState } from './fans';
import { parkFactor } from './clubs';
import { BALLPARK as B } from './tuning';

export type ProjectKind = 'expand' | 'fencesIn' | 'fencesOut' | 'newPark';

export interface ProjectOption {
  kind: ProjectKind;
  label: string;
  cost: number;
  opens: number;
  note: string;
  /** Why it cannot start now. */
  blocked: string | null;
}

export function projectOptions(s: LeagueState): ProjectOption[] {
  const u = s.user;
  if (!u) return [];
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const next = s.phase === 'offseason' ? (s.offseason?.year ?? s.year) + 1 : s.year + 1;
  const busy = (u.projects ?? []).some((p) => p.opens >= next);
  const planned = u.settings.stadium !== 'existing' && (u.projects ?? []).every((p) => p.kind !== 'newPark') && team.stadium.capacity < 15_000;
  const cap = team.stadium.capacity;
  const park = team.stadium.park ?? parkFactor(team.id);
  const common = (cost: number) => (busy ? '진행 중인 공사가 있습니다.' : s.phase !== 'offseason' ? '공사는 비시즌에만 시작할 수 있습니다.' : cost > u.fund ? '구단 자금이 부족합니다.' : null);
  return [
    {
      kind: 'expand',
      label: `증축 (+${B.expandSeats.toLocaleString('ko-KR')}석)`,
      cost: B.expandCost,
      opens: next,
      note: `${cap.toLocaleString('ko-KR')}석 → ${(cap + B.expandSeats).toLocaleString('ko-KR')}석`,
      blocked: cap + B.expandSeats > B.maxSeats ? `${B.maxSeats.toLocaleString('ko-KR')}석보다 크게 늘릴 수 없습니다.` : common(B.expandCost),
    },
    {
      kind: 'fencesIn',
      label: '펜스 당기기',
      cost: B.fencesCost,
      opens: next,
      note: `홈런이 늘어나는 구장 (구장 계수 ${park.toFixed(2)} → ${(park + B.fencesStep).toFixed(2)})`,
      blocked: park + B.fencesStep > B.parkMax ? '더 당길 수 없습니다.' : common(B.fencesCost),
    },
    {
      kind: 'fencesOut',
      label: '펜스 밀기',
      cost: B.fencesCost,
      opens: next,
      note: `홈런이 줄어드는 구장 (구장 계수 ${park.toFixed(2)} → ${(park - B.fencesStep).toFixed(2)})`,
      blocked: park - B.fencesStep < B.parkMin ? '더 밀 수 없습니다.' : common(B.fencesCost),
    },
    {
      kind: 'newPark',
      label: `신구장 건설 (${B.newSeats.toLocaleString('ko-KR')}석)`,
      cost: B.newCost,
      opens: next + B.newYears - 1,
      note: `지자체와 함께 짓고 구단이 25년 사용료를 미리 냅니다. ${next + B.newYears - 1}년 개장`,
      blocked: planned ? '이미 신구장 계획이 있습니다.' : cap >= B.newSeats ? '지금 구장이 더 큽니다.' : (u.projects ?? []).some((p) => p.kind === 'newPark' && p.opens >= next) ? '신구장을 짓고 있습니다.' : common(B.newCost),
    },
  ];
}

/** Starts a project: pays from the fund now; it takes effect when it opens. */
export function startProject(s: LeagueState, kind: ProjectKind) {
  const u = s.user;
  if (!u) throw new Error('구단이 없습니다.');
  const o = projectOptions(s).find((x) => x.kind === kind);
  if (!o) throw new Error('알 수 없는 공사입니다.');
  if (o.blocked) throw new Error(o.blocked);
  const year = s.offseason?.year ?? s.year;
  u.fund -= o.cost;
  u.ledger.push({ year, label: `구장 공사 · ${o.label}`, amount: -o.cost, capital: true });
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const park = team.stadium.park ?? parkFactor(team.id);
  const project: StadiumProject =
    kind === 'expand'
      ? { kind: 'expand', label: o.label, opens: o.opens, cost: o.cost, seats: team.stadium.capacity + B.expandSeats }
      : kind === 'newPark'
        ? { kind: 'newPark', label: o.label, opens: o.opens, cost: o.cost, seats: B.newSeats }
        : { kind: 'fences', label: o.label, opens: o.opens, cost: o.cost, park: Math.round((park + (kind === 'fencesIn' ? B.fencesStep : -B.fencesStep)) * 100) / 100 };
  (u.projects ??= []).push(project);
  (u.log ??= []).push({ year, text: `${o.label} 시작 (${Math.round(o.cost / 10000)}억, ${o.opens}년 시즌부터)` });
}

/** Projects that finish before `season` change the ballpark. */
export function openProjects(s: LeagueState, season: number) {
  const u = s.user;
  if (!u?.projects) return;
  const team = s.teams.find((t) => t.id === u.teamId)!;
  for (const p of u.projects) {
    if (p.opens !== season) continue;
    if (p.kind === 'fences') team.stadium = { ...team.stadium, park: p.park };
    else if (p.seats) {
      const name = p.kind === 'newPark' ? u.newStadiumName?.trim() || `${team.region} 신구장` : team.stadium.name;
      team.stadium = { ...team.stadium, name, capacity: p.seats, size: p.seats >= 20_000 ? 'large' : 'medium', ...(p.kind === 'newPark' ? { ownership: 'longTermOperation' as const, park: undefined } : {}) };
      // A new or bigger ballpark brings people in for a while.
      clubState(s, u.teamId).interest += p.kind === 'newPark' ? B.newParkBuzz : B.expandBuzz;
    }
    (u.log ??= []).push({ year: season - 1, text: `${p.label} 완료: ${season} 시즌부터 적용` });
  }
}
