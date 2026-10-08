import { k as __i18n_k } from '../i18n/index';
/* Staff (V0.6, RULES.md §13). Every club has eight department heads: the manager, hitting, pitching and
   fielding coaches, the futures (development) manager, the scouting director, the head trainer and the
   head of analytics. Each has a 20–80 rating shown in five-point steps, a salary and a contract. What
   they do, from 50 (league average, no effect) up or down:

   - hitting / pitching / fielding coach: how fast those abilities grow (±8% at 80 / 20)
   - futures manager: growth of players 24 and under who spent the year below the first team (±10%)
   - scouting director: how close the user's scouting view of amateurs gets to the truth
   - head trainer: injury chance (±15%) and length (±10%)
   - analytics: team defence (positioning) and the platoon edge in lineups
   - manager: reads players better (lineups lean on true ability) and has a style

   Salaries: managers 3–10억 a year (2025: most 3억–8억 base), department heads 1억–3억, plus the
   assistants' payroll per department (game estimate). */
import { overall, rng, toGrade } from '../draftroom';
import DraftNames from '../draftroom/names.js';
import type { PlayerId, TeamId } from '../model/types';
import { alumnusHired, alumnusStaff, legendFired, ownLegend, pickAlumnus } from './alumni';
import type { LeagueState, StaffMember, StaffRole, ManagerStyle } from './state';
import { clubState } from './fans';
import { ALUMNI, COMBINE, STAFF, DIFFICULTY } from './tuning';

const names = DraftNames as unknown as { makeName: (r: () => number, used: Set<string>) => { name: string } };

export const STAFF_ROLES: StaffRole[] = ['manager', 'hitting', 'pitching', 'fielding', 'farm', 'scouting', 'medical', 'analytics'];

export const STAFF_LABELS: Record<StaffRole, string> = {
  manager: __i18n_k("league.staff.sTAFF_LABELS.manager.daec431c"),
  hitting: __i18n_k("league.staff.sTAFF_LABELS.hitting.8a5c9a74"),
  pitching: __i18n_k("league.staff.sTAFF_LABELS.pitching.0b977195"),
  fielding: __i18n_k("league.staff.sTAFF_LABELS.fielding.526edd08"),
  farm: __i18n_k("league.staff.sTAFF_LABELS.farm.347796cf"),
  scouting: __i18n_k("league.staff.sTAFF_LABELS.scouting.5added0a"),
  medical: __i18n_k("league.staff.sTAFF_LABELS.medical.2ac3944c"),
  analytics: __i18n_k("league.staff.sTAFF_LABELS.analytics.b8d925c1"),
};

export const STAFF_EFFECTS: Record<StaffRole, string> = {
  manager: __i18n_k("league.staff.sTAFF_EFFECTS.manager.debae7ab"),
  hitting: __i18n_k("league.staff.sTAFF_EFFECTS.hitting.83397383"),
  pitching: __i18n_k("league.staff.sTAFF_EFFECTS.pitching.ab556c5f"),
  fielding: __i18n_k("league.staff.sTAFF_EFFECTS.fielding.3482de67"),
  farm: __i18n_k("league.staff.sTAFF_EFFECTS.farm.6360df79"),
  scouting: __i18n_k("league.staff.sTAFF_EFFECTS.scouting.63023a6f"),
  medical: __i18n_k("league.staff.sTAFF_EFFECTS.medical.df18d4af"),
  analytics: __i18n_k("league.staff.sTAFF_EFFECTS.analytics.6c6b3420"),
};

export const MANAGER_STYLES: Record<ManagerStyle, { label: string; note: string }> = {
  balanced: { label: __i18n_k("league.staff.balanced.label.81c84478"), note: __i18n_k("league.staff.balanced.note.759413c2") },
  smallBall: { label: __i18n_k("league.staff.smallBall.label.e53e3915"), note: __i18n_k("league.staff.smallBall.note.98cfe5b6") },
  youth: { label: __i18n_k("league.staff.youth.label.82ee1a8f"), note: __i18n_k("league.staff.youth.note.bb224171") },
  quickHook: { label: __i18n_k("league.staff.quickHook.label.10759c2a"), note: __i18n_k("league.staff.quickHook.note.25a12ff8") },
  patient: { label: __i18n_k("league.staff.patient.label.8af3ec49"), note: __i18n_k("league.staff.patient.note.0d736305") },
};

const round5 = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Salary a staff member asks for (만 원 a year): rating and role. */
export function staffSalary(role: StaffRole, rating: number): number {
  const base = role === 'manager' ? STAFF.salary.manager : STAFF.salary.head;
  return Math.round((base * (0.6 + ((rating - 20) / 60) * 1.4)) / 1000) * 1000;
}

/** A hire for `role`: since 1.4.0 often one of the league's retired players (alumni.ts), else a stranger. */
export function makeStaff(s: LeagueState, role: StaffRole, key: string, year: number, quality = 0, opts: { club?: TeamId | null; exclude?: Set<PlayerId> } = {}): StaffMember {
  const alumnus = pickAlumnus(s, role, key, year, opts.club ?? null, opts.exclude);
  if (alumnus) return alumnusStaff(s, alumnus, role, key, year, quality, staffSalary);
  const r = rng(`${s.seed}|staff|${key}`);
  const used = new Set(Object.values(s.clubs ?? {}).flatMap((c) => Object.values(c.staff ?? {}).map((m) => m!.name)));
  const rating = round5(50 + quality + (r() + r() + r() - 1.5) * 18);
  const age = role === 'manager' ? 45 + Math.floor(r() * 18) : 38 + Math.floor(r() * 22);
  const styles = Object.keys(MANAGER_STYLES) as ManagerStyle[];
  return {
    id: `st-${key}`,
    name: names.makeName(r, used).name,
    role,
    rating,
    age,
    salary: staffSalary(role, rating),
    until: year + 1 + Math.floor(r() * (role === 'manager' ? 3 : 2)),
    ...(role === 'manager' ? { style: styles[Math.floor(r() * styles.length)]! } : {}),
  };
}

/** Everyone the club employs (created on first use for a club without staff). */
export function staffOf(s: LeagueState, teamId: TeamId): Record<StaffRole, StaffMember> {
  const c = clubState(s, teamId);
  c.staff ??= {};
  for (const role of STAFF_ROLES) c.staff[role] ??= makeStaff(s, role, `${teamId}-${role}-init`, s.year, 0, { club: teamId });
  return c.staff as Record<StaffRole, StaffMember>;
}

export function staffRating(s: LeagueState, teamId: TeamId | null | undefined, role: StaffRole): number {
  if (!teamId || !s.clubs?.[teamId]) return 50;
  return s.clubs[teamId]!.staff?.[role]?.rating ?? 50;
}

/** −1 … +1 from a 20–80 rating. */
export const staffEdge = (rating: number) => (rating - 50) / 30;

/** Heads' salaries plus each department's assistants. */
export function staffCost(s: LeagueState, teamId: TeamId): number {
  if (!s.clubs?.[teamId]) return STAFF.departments * STAFF_ROLES.length + STAFF.salary.manager + STAFF.salary.head * 7;
  const heads = Object.values(staffOf(s, teamId)).reduce((a, m) => a + m.salary, 0);
  return heads + STAFF.departments * STAFF_ROLES.length;
}

/** Candidates for a role this winter (the same ones all winter). */
export function staffCandidates(s: LeagueState, role: StaffRole, year: number, taken = new Set<PlayerId>()): StaffMember[] {
  const club = s.user?.teamId ?? null;
  const list = Array.from({ length: STAFF.candidates }, (_, i) => {
    const m = makeStaff(s, role, `market-${year}-${role}-${i}`, year, i === 0 ? 8 : i === 1 ? 3 : 0, { club, exclude: taken });
    if (m.playerId) taken.add(m.playerId);
    return { ...m, id: `st-market-${year}-${role}-${i}` };
  });
  // 1.4.0: one of our own legends, free for the post, is always among the candidates.
  const legend = club && role !== 'medical' ? ownLegend(s, role, club, year, taken) : null;
  if (legend) {
    taken.add(legend.p.id);
    list.push({ ...alumnusStaff(s, legend, role, `market-${year}-${role}-legend`, year, 0, staffSalary), id: `st-market-${year}-${role}-legend` });
  }
  return list;
}

/**
 * AI clubs each winter: expiring staff re-sign or are replaced, and a manager whose club finished in
 * the bottom three may be let go.
 */
export function aiStaffWinter(s: LeagueState, year: number, table: { teamId: TeamId; rank: number }[]) {
  const r = rng(`${s.seed}|staff-ai|${year}`);
  for (const t of s.teams) {
    if (!s.clubs?.[t.id] || t.id === s.user?.teamId) continue;
    const staff = staffOf(s, t.id);
    const rank = table.find((x) => x.teamId === t.id)?.rank ?? 6;
    for (const role of STAFF_ROLES) {
      const m = staff[role];
      const fired = role === 'manager' && rank >= table.length - 2 && r() < STAFF.aiFireManager;
      if (m.until > year && !fired) continue;
      // 1.4.0: a franchise legend free for the post comes home in place of a renewal, half the time.
      const legend = role === 'medical' ? null : ownLegend(s, role, t.id, year);
      if (legend && rng(`${s.seed}|alumni-home|${t.id}|${role}|${year}`)() < ALUMNI.homePull) {
        const back = alumnusStaff(s, legend, role, `${t.id}-${role}-${year}-home`, year, 0, staffSalary);
        if (role === 'manager' && t.id === s.twelve?.teamId) back.style = s.twelve.manager;
        s.clubs[t.id]!.staff![role] = back;
        alumnusHired(s, t.id, back, `${year}-10-25`);
        continue;
      }
      // Since 1.4.0 a head past seventy steps down.
      if (!fired && r() < STAFF.aiRenew && m.rating >= 45 && m.age < ALUMNI.retireAge) {
        m.until = year + 2;
        continue;
      }
      if (fired) legendFired(s, t.id, m, `${year}-10-20`);
      const hire = makeStaff(s, role, `${t.id}-${role}-${year}`, year, r() * 10 - 3, { club: t.id });
      // The twelfth club hires managers of the style its front office chose (V0.9).
      if (role === 'manager' && t.id === s.twelve?.teamId) hire.style = s.twelve.manager;
      s.clubs[t.id]!.staff![role] = hire;
      alumnusHired(s, t.id, hire, `${year}-10-25`);
    }
  }
  // Everyone a year older, our club's staff too (1.4.0).
  for (const c of Object.values(s.clubs ?? {})) for (const m of Object.values(c.staff ?? {})) if (m) m.age++;
}

/**
 * The user's own scouts' future grade for an amateur: the public report moved toward the truth by the
 * scouting director (a third of the way at 50, three fifths at 80).
 */
export function scoutView(s: LeagueState, p: { id?: string; role: import('../draftroom').Role; scouting: { futureValue: number }; hidden: { potential: import('../draftroom').Tools } }): number | null {
  const u = s.user;
  if (!u) return null;
  const staff = Math.max(0, Math.min(STAFF.scoutMax, STAFF.scoutBase + STAFF.scoutSpan * staffEdge(staffRating(s, u.teamId, 'scouting'))));
  // A prospect we worked out (1.3.0) is read better.
  const worked = !!p.id && Object.values(u.workouts ?? {}).some((ids) => ids.includes(p.id!)) ? COMBINE.workoutRead : 0;
  const acc = Math.max(0, Math.min(1, staff + DIFFICULTY.scoutEdge[u.settings.difficulty] + worked));
  const truth = toGrade(overall(p.hidden.potential, p.role));
  return Math.max(20, Math.min(80, Math.round((p.scouting.futureValue + (truth - p.scouting.futureValue) * acc) / 5) * 5));
}
