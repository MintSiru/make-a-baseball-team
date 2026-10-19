import { k as __i18n_k } from '../i18n/index';
/* Ballpark projects (V0.6, RULES.md §13). In the winter the user's club can
   - expand its ballpark (+3,000 seats, up to 40,000 since 1.8.1; the club's share 150억, ready next season),
   - 2.0.2: rebuild its fences in the layout editor (layout.ts: each zone's distance and height, priced by the metre,
     ready next season; before 2.0.2 the fences moved in or out a step at a time),
   - build a new 22,000-seat ballpark with the city (the club prepays 25 years of use, 400억, as
     Samsung (500억) and KIA (300억) did; it opens three seasons later).
   Projects are paid from the fund up front: the owner's support covers operations, not buildings. */
import type { LeagueState, StadiumProject } from './state';
import { clubState } from './fans';
import { BALLPARK as B } from './tuning';
import { checkLayout, homeRunFactor, layoutCost, layoutOf, type ParkLayout } from './layout';

export type ProjectKind = 'expand' | 'layout' | 'newPark' | 'dome';

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
      kind: 'newPark',
      label: __i18n_k("league.ballpark.projectOptions.label.b3041d23", { value: B.newSeats.toLocaleString('ko-KR') }),
      cost: B.newCost,
      opens: next + B.newYears - 1,
      note: __i18n_k("league.ballpark.projectOptions.note.e1639571", { value: next + B.newYears - 1 }),
      blocked: planned ? __i18n_k("league.ballpark.projectOptions.blocked.a335d518") : cap >= B.newSeats ? __i18n_k("league.ballpark.projectOptions.blocked.2b425661") : (u.projects ?? []).some((p) => p.kind === 'newPark' && p.opens >= next) ? __i18n_k("league.ballpark.projectOptions.blocked.908d3d51") : common(B.newCost),
    },
    // 2.0.25 (the user's request): a dome.
    {
      kind: 'dome',
      label: __i18n_k("league.ballpark.text.01f40aa1", { seats: B.domeSeats.toLocaleString('ko-KR') }),
      cost: B.domeCost,
      opens: next + B.domeYears - 1,
      note: __i18n_k("league.ballpark.text.15b22bf3", { opens: next + B.domeYears - 1 }),
      blocked: team.stadium.size === 'dome' ? __i18n_k("league.ballpark.text.bb64c0a7") : (u.projects ?? []).some((p) => (p.kind === 'newPark' || p.kind === 'dome') && p.opens >= next) ? __i18n_k("league.ballpark.projectOptions.blocked.908d3d51") : common(B.domeCost),
    },
  ];
}

/** 2.0.2: rebuilding the fences to `layout` (the editor): what it costs, when it opens, its home-run factor, and why it
    cannot start now. */
export function layoutOption(s: LeagueState, layout: ParkLayout): ProjectOption & { now: ParkLayout; factor: { from: number; to: number } } {
  const u = s.user!;
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const now = layoutOf(team);
  const next = s.phase === 'offseason' ? (s.offseason?.year ?? s.year) + 1 : s.year + 1;
  const busy = (u.projects ?? []).some((p) => p.opens >= next);
  const cost = layoutCost(now, layout);
  const blocked = checkLayout(layout) ?? (cost === 0 ? __i18n_k("league.ballpark.text.2e952b61") : busy ? __i18n_k("league.ballpark.projectOptions.common.a68f7d40") : s.phase !== 'offseason' ? __i18n_k("league.ballpark.projectOptions.common.df97ea07") : cost > u.fund ? __i18n_k("league.ballpark.projectOptions.common.2ffbf119") : null);
  return { kind: 'layout', label: __i18n_k("league.ballpark.text.766c7278"), cost, opens: next, note: __i18n_k("league.ballpark.text.db11260d", { from: homeRunFactor(now).toFixed(2), to: homeRunFactor(layout).toFixed(2) }), blocked, now, factor: { from: homeRunFactor(now), to: homeRunFactor(layout) } };
}

/** Starts a project: pays from the fund now; it takes effect when it opens. */
export function startProject(s: LeagueState, kind: ProjectKind, layout?: ParkLayout) {
  const u = s.user;
  if (!u) throw new Error('구단이 없습니다.');
  const o = kind === 'layout' ? (layout ? layoutOption(s, layout) : null) : projectOptions(s).find((x) => x.kind === kind);
  if (!o) throw new Error('알 수 없는 공사입니다.');
  if (o.blocked) throw new Error(o.blocked);
  const year = s.offseason?.year ?? s.year;
  u.fund -= o.cost;
  u.ledger.push({ year, label: __i18n_k("league.ballpark.startProject.label.a30190fe", { label: o.label }), amount: -o.cost, capital: true });
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const project: StadiumProject =
    kind === 'expand'
      ? { kind: 'expand', label: o.label, opens: o.opens, cost: o.cost, seats: team.stadium.capacity + B.expandSeats }
      : kind === 'newPark' || kind === 'dome'
        ? { kind, label: o.label, opens: o.opens, cost: o.cost, seats: kind === 'dome' ? B.domeSeats : B.newSeats }
        : { kind: 'layout', label: o.label, opens: o.opens, cost: o.cost, layout: { dist: [...layout!.dist], wall: [...layout!.wall] } };
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
    else if (p.kind === 'layout' && p.layout) {
      const { park: _old, ...rest } = team.stadium;
      team.stadium = { ...rest, layout: p.layout };
    }
    else if (p.seats) {
      const built = p.kind === 'newPark' || p.kind === 'dome';
      const name = p.kind === 'dome' ? u.newStadiumName?.trim() || __i18n_k("league.ballpark.text.0cece9d0", { region: team.region }) : p.kind === 'newPark' ? u.newStadiumName?.trim() || __i18n_k("league.ballpark.openProjects.name.577eaf4f", { region: team.region }) : team.stadium.name;
      // 2.0.25: a dome stays a dome when it is expanded.
      const size = p.kind === 'dome' || (p.kind === 'expand' && team.stadium.size === 'dome') ? 'dome' : p.seats >= 20_000 ? 'large' : 'medium';
      team.stadium = { ...team.stadium, name, capacity: p.seats, size, ...(built ? { ownership: 'longTermOperation' as const, park: undefined, layout: undefined } : {}) };
      // A new or bigger ballpark brings people in for a while.
      clubState(s, u.teamId).interest += p.kind === 'dome' ? B.domeBuzz : p.kind === 'newPark' ? B.newParkBuzz : B.expandBuzz;
    }
    (u.log ??= []).push({ year: season - 1, text: __i18n_k("league.ballpark.openProjects.text.5377a7a2", { label: p.label, season: season }) });
  }
}
