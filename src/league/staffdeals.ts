import { k as __i18n_k } from '../i18n/index';
/* Staff contracts in detail (1.8.0, from the 1.7 feedback: 감독/코치 계약 세분화). A KBO manager signs for two to
   three years as "3년 총액 21억 (계약금 5억 · 연봉 5억)"; coaches sign for a year or two on salary alone. The club
   now chooses the length when it hires or renews (a manager one to four years, a head coach one to three), a
   manager's deal carries a signing bonus paid at once, and at any time the club can extend a head whose contract
   is in its last season (a raise for a good one) or dismiss him: the rest of his pay is still owed, and an interim
   (대행) takes the post until the next winter's staff decision. AI clubs' heads get the same terms on paper. */
import type { LeagueState, StaffMember, StaffRole } from './state';
import { addNews } from './news';
import { iga, wagwa } from './josa';
import { makeStaff, staffOf, STAFF_LABELS } from './staff';
import { eok as money } from './fa';
import { legendFired } from './alumni';

export const STAFF_DEAL = {
  years: { manager: [1, 2, 3, 4], head: [1, 2, 3] },
  /** A manager's signing bonus: this share of a season's salary for each contract year. */
  bonusShare: 0.35,
  /** An extension's raise: a good head (65+) asks more. */
  raise: 0.05,
  raiseGood: 0.1,
  /** How much worse the interim is than a proper hire. */
  interimQuality: -6,
} as const;

export const yearsFor = (role: StaffRole): readonly number[] => (role === 'manager' ? STAFF_DEAL.years.manager : STAFF_DEAL.years.head);
export const defaultYears = (role: StaffRole) => (role === 'manager' ? 3 : 2);
/** A manager's signing bonus for a deal of `years` (만 원); coaches sign for salary alone. */
export const signingBonus = (role: StaffRole, salary: number, years: number) => (role === 'manager' ? Math.round((salary * STAFF_DEAL.bonusShare * years) / 1000) * 1000 : 0);

/** The season being played, or the one just finished in the winter. */
const seasonNow = (s: LeagueState) => (s.offseason ? s.offseason.year : s.year);

/** His contract in a line: "2027 취임 · 3년 총액 21억 (계약금 5억 · 연봉 5억) · 2029시즌까지" (amounts as `fmt` writes them). */
export function staffTerms(m: StaffMember, fmt: (manwon: number) => string = money): string {
  if (m.interim) return __i18n_k("league.staffdeals.text.3ad8c73c", { until: m.until });
  const years = m.years ?? null;
  const total = years ? m.salary * years + (m.bonus ?? 0) : null;
  const deal = years && total ? (m.bonus ? __i18n_k("league.staffdeals.text.c9564808", { years, total: fmt(total), bonus: fmt(m.bonus), salary: fmt(m.salary) }) : __i18n_k("league.staffdeals.text.325de140", { years, salary: fmt(m.salary) })) : __i18n_k("league.staffdeals.text.f72ca661", { salary: fmt(m.salary) });
  return [m.since ? __i18n_k("league.staffdeals.text.8ecb2402", { since: m.since }) : null, deal, __i18n_k("league.staffdeals.text.3e551f4d", { until: m.until })].filter(Boolean).join(' · ');
}

/** Why he cannot be extended now, or null. */
export function extendProblem(s: LeagueState, role: StaffRole): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.staffdeals.text.e837c83d");
  const m = staffOf(s, u.teamId)[role];
  if (m.interim) return __i18n_k("league.staffdeals.text.88482097");
  if (m.until - seasonNow(s) > 1) return __i18n_k("league.staffdeals.text.9d261813");
  if (m.until < seasonNow(s) || (s.offseason && m.until <= s.offseason.year)) return __i18n_k("league.staffdeals.text.c26ea4ab");
  return null;
}

/** The raise he asks for an extension. */
export const extensionSalary = (m: StaffMember) => Math.round((m.salary * (1 + (m.rating >= 65 ? STAFF_DEAL.raiseGood : STAFF_DEAL.raise))) / 1000) * 1000;

/** Extends him by `years` from the end of his contract, on a raise (a manager's bonus paid now). */
export function extendStaff(s: LeagueState, role: StaffRole, years: number) {
  const problem = extendProblem(s, role);
  if (problem) throw new Error(problem);
  if (!yearsFor(role).includes(years)) throw new Error(__i18n_k("league.staffdeals.text.b4f97ce4"));
  const u = s.user!;
  const m = staffOf(s, u.teamId)[role];
  const salary = extensionSalary(m);
  const bonus = signingBonus(role, salary, years);
  m.salary = salary;
  m.until += years;
  m.years = years;
  m.bonus = bonus;
  const year = seasonNow(s);
  if (bonus) {
    u.fund -= bonus;
    u.ledger.push({ year, label: __i18n_k("league.staffdeals.text.b381fdab", { role: STAFF_LABELS[role], name: m.name }), amount: -bonus });
  }
  (u.log ??= []).push({ year, text: __i18n_k("league.staffdeals.text.6be6a14d", { role: STAFF_LABELS[role], name: wagwa(m.name), years, salary: money(salary), until: m.until }) });
}

/** What dismissing him would still cost: the rest of this season's pay and every later season of his contract. */
export function dismissalCost(s: LeagueState, role: StaffRole): number {
  const m = staffOf(s, s.user!.teamId)[role];
  const now = seasonNow(s);
  const share = s.phase === 'regular' && !s.offseason && s.schedule.length ? Math.max(0, (s.schedule.length - s.next) / s.schedule.length) : 0;
  return Math.round(m.salary * share + m.salary * Math.max(0, m.until - now));
}

/** Why he cannot be dismissed now, or null. */
export function fireProblem(s: LeagueState, role: StaffRole): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.staffdeals.text.e837c83d");
  if (s.pending) return __i18n_k("league.staffdeals.text.55e22a98");
  if (staffOf(s, u.teamId)[role].interim) return __i18n_k("league.staffdeals.text.88482097");
  return null;
}

/** Dismisses him: his remaining pay is owed (dead money), an interim takes over until the next staff decision. */
export function fireStaff(s: LeagueState, role: StaffRole) {
  const problem = fireProblem(s, role);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const club = s.clubs![u.teamId]!;
  const m = staffOf(s, u.teamId)[role];
  const now = seasonNow(s);
  const share = s.phase === 'regular' && !s.offseason && s.schedule.length ? Math.max(0, (s.schedule.length - s.next) / s.schedule.length) : 0;
  const label = __i18n_k("league.staffdeals.text.ab400851", { role: STAFF_LABELS[role], name: m.name });
  if (share) (u.deadMoney ??= []).push({ season: now, amount: Math.round(m.salary * share), label });
  for (let y = now + 1; y <= m.until; y++) (u.deadMoney ??= []).push({ season: y, amount: m.salary, label });
  const date = s.schedule[s.next]?.date ?? `${now}-11-25`;
  legendFired(s, u.teamId, m, date);
  const interim = makeStaff(s, role, `${u.teamId}-${role}-interim-${date}`, now - 1, STAFF_DEAL.interimQuality, { club: null });
  club.staff![role] = { ...interim, playerId: undefined, club: undefined, fame: undefined, id: `st-${u.teamId}-${role}-interim-${date}`, until: now, interim: true, since: now, years: undefined, bonus: undefined, ...(role === 'manager' ? { style: m.style ?? interim.style } : {}) };
  const team = s.teams.find((t) => t.id === u.teamId)!.short;
  (u.log ??= []).push({ year: now, text: __i18n_k("league.staffdeals.text.060949bc", { role: STAFF_LABELS[role], name: m.name, interim: interim.name }) });
  if (role === 'manager')
    addNews(s, {
      id: `fire-${m.id}-${date}`,
      date,
      kind: 'interview',
      title: __i18n_k("league.staffdeals.text.c99c6378", { club: team, name: m.name, interim: interim.name }),
      body: __i18n_k("league.staffdeals.text.d26acc74", { club: iga(team), name: m.name, left: Math.max(0, m.until - now) + (share ? 1 : 0), interim: interim.name }),
      quotes: [],
      facts: { manager: m.name, interim: interim.name },
      players: [],
      mine: true,
    });
}
