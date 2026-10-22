import { k as __i18n_k } from '../i18n/index';
/* 2.0.38 (the user's request): managers and coaches age and retire. Each winter, before the clubs settle their staff,
   every head (our club's too) grows a year older in the trade: a young one (45 or under) now and then gets better at
   it, an old one (66 on) now and then loses a step. From 60 he may retire — more likely each year, sure at 75, half as
   likely while his contract still runs. A club's retiring head is replaced: another club hires at once; ours is
   covered by an interim until the winter's staff decision, which then asks us for the post. Our retirements make the
   news and a pop-up; another club's when it is the manager or a former player of note. Interims are left alone. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { alumnusHired, isLegend } from './alumni';
import { eunneun, iga } from './josa';
import { addNews } from './news';
import { makeStaff, STAFF_LABELS, STAFF_ROLES, staffOf } from './staff';
import { STAFF_DEAL } from './staffdeals';
import type { LeagueState, StaffMember, StaffRole } from './state';

export const STAFF_AGE = {
  /** Retirement: from this age, the chance a winter, its rise a year, the most, the age he surely goes, and the
      factor while his contract runs. */
  from: 60,
  base: 0.06,
  perYear: 0.06,
  max: 0.85,
  last: 75,
  underContract: 0.5,
  /** Rating drift a winter: young and improving, old and fading (one five-point step). */
  grow: { until: 45, chance: 0.3 },
  fade: { from: 66, chance: 0.3 },
};

/** His chance of retiring this winter. */
export function retireChance(m: StaffMember, year: number): number {
  const A = STAFF_AGE;
  if (m.interim || m.age < A.from) return 0;
  if (m.age >= A.last) return 1;
  const x = Math.min(A.max, A.base + (m.age - A.from) * A.perYear);
  return m.until > year ? x * A.underContract : x;
}

const shortOf = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? '';

/** The winter's turn for every club's heads (called before the clubs settle their staff). */
export function staffAgeWinter(s: LeagueState, year: number) {
  for (const t of s.teams) {
    if (!s.clubs?.[t.id]) continue;
    const staff = staffOf(s, t.id);
    for (const role of STAFF_ROLES) {
      const m = staff[role];
      if (!m || m.interim) continue;
      const r = rng(`${s.seed}|staff-age|${year}|${t.id}|${role}`);
      const A = STAFF_AGE;
      if (m.age <= A.grow.until && r() < A.grow.chance) m.rating = Math.min(80, m.rating + 5);
      else if (m.age >= A.fade.from && r() < A.fade.chance) m.rating = Math.max(20, m.rating - 5);
      if (r() < retireChance(m, year)) retire(s, t.id, role, m, year);
    }
  }
}

function retire(s: LeagueState, teamId: TeamId, role: StaffRole, m: StaffMember, year: number) {
  const ours = teamId === s.user?.teamId;
  const club = s.clubs![teamId]!;
  const date = `${year}-10-18`;
  if (ours) {
    // An interim until the staff decision, which asks for the post (its deal ends this winter).
    const interim = makeStaff(s, role, `${teamId}-${role}-retire-${year}`, year, STAFF_DEAL.interimQuality, { club: null });
    club.staff![role] = { ...interim, playerId: undefined, club: undefined, fame: undefined, id: `st-${teamId}-${role}-retire-${year}`, until: year, interim: true, since: year + 1, years: undefined, bonus: undefined, ...(role === 'manager' ? { style: m.style ?? interim.style } : {}) };
  } else {
    const hire = makeStaff(s, role, `${teamId}-${role}-${year}-retire`, year, 0, { club: teamId });
    if (role === 'manager' && teamId === s.twelve?.teamId) hire.style = s.twelve.manager;
    club.staff![role] = hire;
    alumnusHired(s, teamId, hire, `${year}-10-25`);
  }
  (club.retiredStaff ??= []).push({ name: m.name, role, age: m.age, year, ...(m.playerId ? { playerId: m.playerId } : {}) });
  if (!s.user) return;
  const short = shortOf(s, teamId);
  const legend = isLegend(m);
  if (!ours && role !== 'manager' && !legend) return;
  const title = __i18n_k("league.staffage.text.b85d4318", { club: short, role: STAFF_LABELS[role], name: m.name, age: m.age });
  const body = ours
    ? __i18n_k("league.staffage.text.f6510043", { club: short, role: STAFF_LABELS[role], name: eunneun(m.name) })
    : __i18n_k("league.staffage.text.769e4caf", { club: short, role: STAFF_LABELS[role], name: iga(m.name), age: m.age });
  addNews(s, { id: `staff-retire-${year}-${teamId}-${role}`, date, kind: 'interview', title, body, quotes: [], facts: { club: short, role: STAFF_LABELS[role], name: m.name, age: m.age }, players: m.playerId ? [m.playerId] : [], ...(ours ? { mine: true } : {}) });
  if (ours) {
    // The same id as the article's, so it is one pop-up.
    addAlert(s, { id: `staff-retire-${year}-${teamId}-${role}`, date, kind: 'retire', title, lines: [body], tone: 'bad' });
    (s.user.log ??= []).push({ year, text: title });
  }
}
