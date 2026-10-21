import { k as __i18n_k } from '../i18n/index';
/* 2.0.36 (the user's request): trouble from the dugout and the front office, not only the players — the manager or a
   coach in a drunken brawl, hitting a player, taking money for playing time or abusing the clubhouse. Rare (a
   season's chance at our club each, SCANDAL.staff); the club lets him go for cause (no pay owed) and an interim takes
   the post until the winter's staff decisions, as when he is fired (staffdeals.ts). The fans' mood drops. The front
   office's kickbacks and players treated badly are the club's own trouble (scandals.ts). */
import { rng } from '../draftroom';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { iga, ro, wagwa } from './josa';
import { addNews } from './news';
import { makeStaff, staffOf, STAFF_LABELS } from './staff';
import { STAFF_DEAL } from './staffdeals';
import type { LeagueState, StaffRole } from './state';
import { SCANDAL as S } from './tuning';

export type StaffTrouble = keyof typeof S.staff.rates;
const KINDS = Object.keys(S.staff.rates) as StaffTrouble[];
/** Who it can be: the manager drinks as well as anyone; the coaches do the rest. */
const ROLES: Record<StaffTrouble, StaffRole[]> = {
  drunk: ['manager', 'hitting', 'pitching', 'fielding', 'farm'],
  assault: ['hitting', 'pitching', 'fielding', 'farm'],
  kickback: ['manager', 'farm', 'hitting', 'pitching'],
  abuse: ['manager', 'hitting', 'pitching', 'fielding', 'farm'],
};

/** A game day's chances. */
export function staffTroubleDay(s: LeagueState, date: string) {
  if (!s.user || s.phase !== 'regular') return;
  const r = rng(`${s.seed}|staff-trouble|${date}`);
  for (const kind of KINDS) if (r() < S.staff.rates[kind] / S.gameDays) staffTrouble(s, kind, date, r);
}

/** It happened (also for tests). */
export function staffTrouble(s: LeagueState, kind: StaffTrouble, date: string, r: () => number) {
  const u = s.user!;
  const club = s.teams.find((t) => t.id === u.teamId)!.short;
  const staff = staffOf(s, u.teamId);
  const role = ROLES[kind][Math.floor(r() * ROLES[kind].length)]!;
  const m = staff[role];
  const what = { drunk: __i18n_k("league.stafftrouble.text.af34a9e3"), assault: __i18n_k("league.stafftrouble.text.e6b87c5b"), kickback: __i18n_k("league.stafftrouble.text.af270683"), abuse: __i18n_k("league.stafftrouble.text.9d01d849") }[kind];
  const label = STAFF_LABELS[role];
  // Let go for cause: no pay owed; an interim until the winter.
  const now = s.year;
  const interim = makeStaff(s, role, `${u.teamId}-${role}-trouble-${date}`, now - 1, STAFF_DEAL.interimQuality, { club: null });
  s.clubs![u.teamId]!.staff![role] = { ...interim, playerId: undefined, club: undefined, fame: undefined, id: `st-${u.teamId}-${role}-trouble-${date}`, until: now, interim: true, since: now, years: undefined, bonus: undefined, ...(role === 'manager' ? { style: m.style ?? interim.style } : {}) };
  clubState(s, u.teamId).interest -= S.staff.mood[kind];
  const title = __i18n_k("league.stafftrouble.text.648308eb", { club, role: label, name: m.name, what: ro(what) });
  const body = __i18n_k("league.stafftrouble.text.02860fa7", { club: iga(club), what, role: label, name: wagwa(m.name), interim: interim.name });
  (u.log ??= []).push({ year: now, text: title });
  addNews(s, { id: `staff-trouble-${kind}-${date}`, date, kind: 'move', title, body, quotes: [{ who: __i18n_k("league.stafftrouble.text.724cc77d"), role: 'fan', text: __i18n_k("league.stafftrouble.text.59ff3ec4") }], facts: { club, role: label, name: m.name, what }, players: [], mine: true });
  addAlert(s, { id: `staff-trouble-${kind}-${date}`, date, kind: 'scandal', title, lines: [body], tone: 'bad' });
}
