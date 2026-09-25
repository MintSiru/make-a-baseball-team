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
import type { TeamId } from '../model/types';
import type { LeagueState, StaffMember, StaffRole, ManagerStyle } from './state';
import { clubState } from './fans';
import { STAFF } from './tuning';

const names = DraftNames as unknown as { makeName: (r: () => number, used: Set<string>) => { name: string } };

export const STAFF_ROLES: StaffRole[] = ['manager', 'hitting', 'pitching', 'fielding', 'farm', 'scouting', 'medical', 'analytics'];

export const STAFF_LABELS: Record<StaffRole, string> = {
  manager: '감독',
  hitting: '타격코치',
  pitching: '투수코치',
  fielding: '수비·주루코치',
  farm: '퓨처스 감독',
  scouting: '스카우트 팀장',
  medical: '트레이닝 팀장',
  analytics: '전력분석 팀장',
};

export const STAFF_EFFECTS: Record<StaffRole, string> = {
  manager: '라인업·기용에서 선수를 더 정확히 봄, 운영 성향',
  hitting: '타자 능력 성장',
  pitching: '투수 능력 성장',
  fielding: '수비·주루 성장',
  farm: '24세 이하 2군 선수 성장',
  scouting: '아마추어 선수 평가 정확도',
  medical: '부상 빈도와 기간',
  analytics: '수비 위치 선정, 플래툰',
};

export const MANAGER_STYLES: Record<ManagerStyle, { label: string; note: string }> = {
  balanced: { label: '균형형', note: '특별한 성향 없음' },
  smallBall: { label: '작전형', note: '번트·도루를 더 자주' },
  youth: { label: '육성형', note: '젊은 선수에게 기회를 더' },
  quickHook: { label: '불펜 중시', note: '선발을 일찍 내림' },
  patient: { label: '선발 중시', note: '선발을 오래 끌고 감' },
};

const round5 = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));

/** Salary a staff member asks for (만 원 a year): rating and role. */
export function staffSalary(role: StaffRole, rating: number): number {
  const base = role === 'manager' ? STAFF.salary.manager : STAFF.salary.head;
  return Math.round((base * (0.6 + ((rating - 20) / 60) * 1.4)) / 1000) * 1000;
}

export function makeStaff(s: LeagueState, role: StaffRole, key: string, year: number, quality = 0): StaffMember {
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
  for (const role of STAFF_ROLES) c.staff[role] ??= makeStaff(s, role, `${teamId}-${role}-init`, s.year);
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
export function staffCandidates(s: LeagueState, role: StaffRole, year: number): StaffMember[] {
  return Array.from({ length: STAFF.candidates }, (_, i) => {
    const m = makeStaff(s, role, `market-${year}-${role}-${i}`, year, i === 0 ? 8 : i === 1 ? 3 : 0);
    return { ...m, id: `st-market-${year}-${role}-${i}` };
  });
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
      if (!fired && r() < STAFF.aiRenew && m.rating >= 45) {
        m.until = year + 2;
        continue;
      }
      s.clubs[t.id]!.staff![role] = makeStaff(s, role, `${t.id}-${role}-${year}`, year, r() * 10 - 3);
    }
    for (const m of Object.values(staff)) m.age++;
  }
}

/**
 * The user's own scouts' future grade for an amateur: the public report moved toward the truth by the
 * scouting director (a third of the way at 50, three fifths at 80).
 */
export function scoutView(s: LeagueState, p: { role: import('../draftroom').Role; scouting: { futureValue: number }; hidden: { potential: import('../draftroom').Tools } }): number | null {
  const u = s.user;
  if (!u) return null;
  const acc = Math.max(0, Math.min(STAFF.scoutMax, STAFF.scoutBase + STAFF.scoutSpan * staffEdge(staffRating(s, u.teamId, 'scouting'))));
  const truth = toGrade(overall(p.hidden.potential, p.role));
  return Math.max(20, Math.min(80, Math.round((p.scouting.futureValue + (truth - p.scouting.futureValue) * acc) / 5) * 5));
}
