import { k as __i18n_k } from '../i18n/index';
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
  const common = (cost: number) => (busy ? __i18n_k("league.ballpark.projectOptions.common.a68f7d40") : s.phase !== 'offseason' ? __i18n_k("league.ballpark.projectOptions.common.df97ea07") : cost > u.fund ? __i18n_k("league.ballpark.projectOptions.common.2ffbf119") : null);
  return [
    {
      kind: 'expand',
      label: __i18n_k("league.ballpark.projectOptions.label.5d3212d6", { value: B.expandSeats.toLocaleString('ko-KR') }),
      cost: B.expandCost,
      opens: next,
      note: __i18n_k("league.ballpark.projectOptions.note.163bcfa3", { value: cap.toLocaleString('ko-KR'), value2: (cap + B.expandSeats).toLocaleString('ko-KR') }),
      blocked: cap + B.expandSeats > B.maxSeats ? __i18n_k("league.ballpark.projectOptions.blocked.b238d74e", { value: B.maxSeats.toLocaleString('ko-KR') }) : common(B.expandCost),
    },
    {
      kind: 'fencesIn',
      label: __i18n_k("league.ballpark.projectOptions.label.657e34d5"),
      cost: B.fencesCost,
      opens: next,
      note: __i18n_k("league.ballpark.projectOptions.note.4c8b1cfd", { value: park.toFixed(2), value2: (park + B.fencesStep).toFixed(2) }),
      blocked: park + B.fencesStep > B.parkMax ? __i18n_k("league.ballpark.projectOptions.blocked.e90ea2e6") : common(B.fencesCost),
    },
    {
      kind: 'fencesOut',
      label: __i18n_k("league.ballpark.projectOptions.label.439824a8"),
      cost: B.fencesCost,
      opens: next,
      note: __i18n_k("league.ballpark.projectOptions.note.fda72cc0", { value: park.toFixed(2), value2: (park - B.fencesStep).toFixed(2) }),
      blocked: park - B.fencesStep < B.parkMin ? __i18n_k("league.ballpark.projectOptions.blocked.e3128968") : common(B.fencesCost),
    },
    {
      kind: 'newPark',
      label: __i18n_k("league.ballpark.projectOptions.label.b3041d23", { value: B.newSeats.toLocaleString('ko-KR') }),
      cost: B.newCost,
      opens: next + B.newYears - 1,
      note: __i18n_k("league.ballpark.projectOptions.note.e1639571", { value: next + B.newYears - 1 }),
      blocked: planned ? __i18n_k("league.ballpark.projectOptions.blocked.a335d518") : cap >= B.newSeats ? __i18n_k("league.ballpark.projectOptions.blocked.2b425661") : (u.projects ?? []).some((p) => p.kind === 'newPark' && p.opens >= next) ? __i18n_k("league.ballpark.projectOptions.blocked.908d3d51") : common(B.newCost),
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
  u.ledger.push({ year, label: __i18n_k("league.ballpark.startProject.label.a30190fe", { label: o.label }), amount: -o.cost, capital: true });
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const park = team.stadium.park ?? parkFactor(team.id);
  const project: StadiumProject =
    kind === 'expand'
      ? { kind: 'expand', label: o.label, opens: o.opens, cost: o.cost, seats: team.stadium.capacity + B.expandSeats }
      : kind === 'newPark'
        ? { kind: 'newPark', label: o.label, opens: o.opens, cost: o.cost, seats: B.newSeats }
        : { kind: 'fences', label: o.label, opens: o.opens, cost: o.cost, park: Math.round((park + (kind === 'fencesIn' ? B.fencesStep : -B.fencesStep)) * 100) / 100 };
  (u.projects ??= []).push(project);
  (u.log ??= []).push({ year, text: __i18n_k("league.ballpark.startProject.text.08543e62", { label: o.label, value: Math.round(o.cost / 10000), opens: o.opens }) });
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
      const name = p.kind === 'newPark' ? u.newStadiumName?.trim() || __i18n_k("league.ballpark.openProjects.name.577eaf4f", { region: team.region }) : team.stadium.name;
      team.stadium = { ...team.stadium, name, capacity: p.seats, size: p.seats >= 20_000 ? 'large' : 'medium', ...(p.kind === 'newPark' ? { ownership: 'longTermOperation' as const, park: undefined } : {}) };
      // A new or bigger ballpark brings people in for a while.
      clubState(s, u.teamId).interest += p.kind === 'newPark' ? B.newParkBuzz : B.expandBuzz;
    }
    (u.log ??= []).push({ year: season - 1, text: __i18n_k("league.ballpark.openProjects.text.5377a7a2", { label: p.label, season: season }) });
  }
}
