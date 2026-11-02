import { k as __i18n_k } from '../i18n/index';
/* Foreign staff (2.0.72, the user's request: 「외국인 코칭 스태프? (KBO 리그에서 뛰었던 선수들 또는 가상)」). A club may hire a
   foreign manager or coach: a former KBO foreign player back on the bench (alumni.ts: two or more first-team seasons
   here), or a coach with no KBO past — mostly American, then Japanese, now and then Latin American (staff.ts). He asks
   a little more (the move, the interpreter). Each foreign head over a foreign player's side — the manager, the
   pitching coach for a pitcher, the hitting coach for a hitter — helps that player settle in his first KBO season
   (adapt.ts), more so one who played here himself. A foreign manager, or a former foreign player coming back to his
   old club, makes the news. */
import type { TeamId } from '../model/types';
import { eulreul, iga, ro } from './josa';
import { addNews } from './news';
import type { LeagueState, StaffMember, StaffRole } from './state';
import { ALUMNI } from './tuning';

const F = ALUMNI.foreign;
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? '';

/** Adaptability a club's foreign staff add to one of its foreign players (0 without any). */
export function foreignStaffHelp(s: LeagueState, teamId: TeamId, pitcher: boolean): number {
  const staff = s.clubs?.[teamId]?.staff;
  if (!staff) return 0;
  let n = 0;
  for (const role of ['manager', pitcher ? 'pitching' : 'hitting'] as StaffRole[]) {
    const m = staff[role];
    if (m?.foreign) n += F.adapt + (m.playerId ? F.kbo : 0);
  }
  return Math.min(F.adaptMax, n);
}

/** The club's foreign heads now. */
export const foreignStaffOf = (s: LeagueState, teamId: TeamId): StaffMember[] => Object.values(s.clubs?.[teamId]?.staff ?? {}).filter((m): m is StaffMember => !!m?.foreign);

/** A club hired a foreign head: the article, unless the former-player article (alumni.ts) already told it. */
export function foreignHired(s: LeagueState, teamId: TeamId, m: StaffMember, date: string, opts: { told: boolean; word: string; line: string }) {
  if (!m.foreign || !s.user || opts.told) return;
  const ours = teamId === s.user.teamId;
  const club = short(s, teamId);
  const home = !!m.playerId && m.club === teamId;
  // A stranger as a coach is news only at our club; a former player only when he comes back to his old one.
  if (m.role !== 'manager' && !ours && !home) return;
  const title =
    m.role === 'manager'
      ? __i18n_k("league.foreignstaff.text.712738e9", { club, name: m.name })
      : home
        ? __i18n_k("league.foreignstaff.text.7cbd5b6f", { name: m.name, club, word: ro(opts.word) })
        : __i18n_k("league.foreignstaff.text.a557266d", { club, word: opts.word, name: m.name });
  const body = home
    ? __i18n_k("league.foreignstaff.text.ca905e37", { club: iga(club), name: eulreul(m.name), word: ro(opts.word), line: opts.line })
    : __i18n_k("league.foreignstaff.text.5260cf28", { club: iga(club), nation: m.foreign, name: eulreul(m.name), word: ro(opts.word) });
  addNews(s, {
    id: `foreign-staff-${teamId}-${m.role}-${m.id}-${date.slice(0, 4)}`,
    date,
    kind: 'move',
    title,
    body,
    quotes: [{ who: m.name, role: 'manager', text: home ? __i18n_k("league.foreignstaff.text.3c7d8520") : __i18n_k("league.foreignstaff.text.6bad5455") }],
    facts: { name: m.name, club, role: opts.word, nation: m.foreign },
    players: m.playerId ? [m.playerId] : [],
    ...(ours ? { mine: true } : {}),
  });
}
