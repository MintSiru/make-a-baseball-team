import { k as __i18n_k } from '../i18n/index';
/* Former players on the bench and in the front office (1.4.0, from the 1.3 feedback). When a club hires a manager, a
   coach, its scouting director or its head of analytics, the hire may be one of the league's retired players
   instead of a stranger — the more famous his career (WAR, MVPs and golden gloves, titles, the hall of fame, a
   retired number), the likelier, and a club leans to its own. A star is not a good coach by being a star: his
   rating leans on his work ethic and mind, a manager's on leadership; fame only raises what he asks. A former
   player manages the way he played (a base stealer runs, a starter lets starters go long, a closer pulls them).

   Our club's former-player manager and coaches bring days of their own (alumniDay): a lesson for a player of their
   side, the first game against the club he played for, a reunion with an old teammate on our roster, a player of
   ours passing the manager's own career mark, the fans riding a legend's streaks, a temper on the bench. Hiring a
   legend, or bringing one home, lifts the fans; letting one go stings. Everything is drawn on streams of its own. */
import { rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { eunneun, eulreul, iga, ro, wagwa } from './josa';
import { note, setForm } from './life';
import { addNews } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import type { LeagueState, ManagerStyle, StaffMember, StaffRole } from './state';
import { ALUMNI as A, FANS } from './tuning';
import { traitsOf } from './traits';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const round5 = (x: number) => Math.max(20, Math.min(80, Math.round(x / 5) * 5));
const short = (s: LeagueState, id: TeamId | null | undefined) => s.teams.find((t) => t.id === id)?.short ?? '';

/** A retired player a club could hire. */
export interface Alumnus {
  p: Player;
  fame: number;
  club: TeamId | null;
}

const firstTeam = (p: Player) => p.career.filter((c) => !c.level && ((c.bat?.g ?? 0) + (c.pit?.g ?? 0) > 0));

/** How famous his career was, 0–100. */
export function fameOf(s: LeagueState, p: Player): number {
  const F = A.fame;
  const war = firstTeam(p).reduce((a, c) => a + c.war, 0);
  let honours = 0;
  for (const h of p.honors ?? []) honours += h.includes('MVP') && !h.includes('올스타') ? F.mvp : h.includes('골든글러브') ? F.goldenGlove : h.includes('1위') ? F.title : F.other;
  const hall = s.hallOfFame?.some((h) => h.id === p.id) ? F.hall : 0;
  const number = s.teams.some((t) => t.retiredNumbers?.some((x) => x.playerId === p.id)) ? F.retiredNumber : 0;
  return Math.round(clamp(Math.max(0, war) * (isPitcher(p) ? F.pitcherWar : F.war) + honours + hall + number + p.service.creditedSeasons * F.season, 0, 100));
}

/** The club he played the most first-team seasons for. */
export function mainClub(p: Player): TeamId | null {
  const n = new Map<TeamId, number>();
  for (const c of firstTeam(p)) n.set(c.teamId, (n.get(c.teamId) ?? 0) + 1);
  let best: TeamId | null = null;
  for (const [id, k] of n) if (best === null || k > n.get(best)!) best = id;
  return best;
}

/** Former players working for some club now. */
export function employedAlumni(s: LeagueState): Set<PlayerId> {
  const out = new Set<PlayerId>();
  for (const c of Object.values(s.clubs ?? {})) for (const m of Object.values(c.staff ?? {})) if (m?.playerId) out.add(m.playerId);
  return out;
}

const side = (role: StaffRole): 'pitcher' | 'hitter' | 'any' | null =>
  role === 'pitching' ? 'pitcher' : role === 'hitting' || role === 'fielding' ? 'hitter' : role === 'medical' ? null : 'any';
const front = (role: StaffRole) => role === 'scouting' || role === 'analytics';
const ages = (role: StaffRole) => A.ages[role === 'manager' || role === 'farm' || role === 'scouting' || role === 'analytics' ? role : 'coach']!;

/** Retired players who could take `role` in the winter of `year`. */
export function alumniFor(s: LeagueState, role: StaffRole, year: number, exclude: Set<PlayerId> = new Set()): Alumnus[] {
  const want = side(role);
  if (!want) return [];
  const [lo, hi] = ages(role);
  const busy = employedAlumni(s);
  const out: Alumnus[] = [];
  for (const p of Object.values(s.players)) {
    if (p.status !== 'retired' || isForeign(p) || busy.has(p.id) || exclude.has(p.id)) continue;
    if ((p.life?.offenses?.fixing ?? 0) > 0) continue;
    if (want !== 'any' && (want === 'pitcher') !== isPitcher(p)) continue;
    const age = ageIn(p, year);
    if (age < lo || age > hi || !firstTeam(p).length) continue;
    out.push({ p, fame: fameOf(s, p), club: mainClub(p) });
  }
  return out;
}

const weightOf = (a: Alumnus, role: StaffRole, club: TeamId | null) => {
  const W = A.weight;
  const offenses = Object.values(a.p.life?.offenses ?? {}).some((n) => (n ?? 0) > 0);
  return (W.base + (a.fame / 100) ** 2 * W.fame * (front(role) ? W.front : 1)) * (club && a.club === club ? W.ownClub : 1) * (offenses ? W.offense : 1);
};

/** A former player for a hire, or null (a stranger is hired, as before 1.4.0). */
export function pickAlumnus(s: LeagueState, role: StaffRole, key: string, year: number, club: TeamId | null, exclude?: Set<PlayerId>): Alumnus | null {
  const pool = alumniFor(s, role, year, exclude);
  if (!pool.length) return null;
  const r = rng(`${s.seed}|alumni|${key}`);
  const ws = pool.map((a) => weightOf(a, role, club));
  const total = ws.reduce((a, b) => a + b, 0);
  const stranger = role === 'manager' ? A.stranger.manager : front(role) ? A.stranger.front : A.stranger.coach;
  if (r() >= (A.maxShare * total) / (total + stranger)) return null;
  let x = r() * total;
  return pool[ws.findIndex((w) => (x -= w) < 0)] ?? pool.at(-1)!;
}

/** The most famous legend of `club` free to take `role`, if any: clubs like to bring their own back. */
export function ownLegend(s: LeagueState, role: StaffRole, club: TeamId, year: number, exclude?: Set<PlayerId>): Alumnus | null {
  return alumniFor(s, role, year, exclude)
    .filter((a) => a.club === club && a.fame >= A.legend)
    .sort((a, b) => b.fame - a.fame || (a.p.id < b.p.id ? -1 : 1))[0] ?? null;
}

/** How a former player manages: the way he played, more often than not. */
function styleOf(p: Player, r: () => number): ManagerStyle {
  const styles: ManagerStyle[] = ['balanced', 'smallBall', 'youth', 'quickHook', 'patient'];
  if (r() >= 0.65) return styles[Math.floor(r() * styles.length)]!;
  const rows = firstTeam(p);
  if (isPitcher(p)) {
    const g = rows.reduce((a, c) => a + (c.pit?.g ?? 0), 0),
      gs = rows.reduce((a, c) => a + (c.pit?.gs ?? 0), 0);
    return gs >= g / 2 ? 'patient' : 'quickHook';
  }
  const sb = rows.reduce((a, c) => a + (c.bat?.sb ?? 0), 0);
  if (sb / Math.max(1, rows.length) >= 12) return 'smallBall';
  return traitsOf(p).leadership >= 60 ? 'youth' : 'balanced';
}

/** A former player as staff. */
export function alumnusStaff(s: LeagueState, a: Alumnus, role: StaffRole, key: string, year: number, quality: number, salaryOf: (role: StaffRole, rating: number) => number): StaffMember {
  const t = traitsOf(a.p);
  const r = rng(`${s.seed}|alumni-staff|${key}`);
  const L = A.lean;
  const lean = role === 'manager' ? (t.leadership - 50) * L.leadership + (t.mental - 50) * L.mental : (t.work - 50) * L.work + (t.mental - 50) * L.mental;
  const rating = round5(50 + quality + lean + (r() + r() + r() - 1.5) * L.spread);
  return {
    id: `st-${key}`,
    name: a.p.name,
    role,
    rating,
    age: ageIn(a.p, year),
    salary: Math.round((salaryOf(role, rating) * (1 + (a.fame / 100) * A.famePremium)) / 1000) * 1000,
    until: year + 1 + Math.floor(r() * (role === 'manager' ? 3 : 2)),
    ...(role === 'manager' ? { style: styleOf(a.p, r) } : {}),
    playerId: a.p.id,
    ...(a.club ? { club: a.club } : {}),
    fame: a.fame,
  };
}

/** His playing career in a line, for the staff screen and articles. */
export function alumnusLine(s: LeagueState, m: StaffMember): string {
  const p = m.playerId ? s.players[m.playerId] : undefined;
  if (!p) return '';
  const rows = firstTeam(p);
  const years = rows.length ? `${rows[0]!.year}~${rows.at(-1)!.year}` : '';
  const war = rows.reduce((a, c) => a + c.war, 0);
  const totals = isPitcher(p)
    ? (() => {
        const w = rows.reduce((a, c) => a + (c.pit?.w ?? 0), 0),
          sv = rows.reduce((a, c) => a + (c.pit?.sv ?? 0), 0);
        return __i18n_k("league.alumni.alumnusLine.totals.e9341832", { w: w, value: sv ? __i18n_k("league.alumni.alumnusLine.totals.addf22ee", { sv: sv }) : '' });
      })()
    : (() => {
        const h = rows.reduce((a, c) => a + (c.bat?.h ?? 0), 0),
          hr = rows.reduce((a, c) => a + (c.bat?.hr ?? 0), 0);
        return __i18n_k("league.alumni.alumnusLine.totals.0d295302", { h: h, hr: hr });
      })();
  const big = (p.honors ?? []).filter((h) => (h.includes('MVP') && !h.includes('올스타')) || h.includes('골든글러브')).length;
  const hall = s.hallOfFame?.some((h) => h.id === p.id);
  return __i18n_k("league.alumni.alumnusLine.6a9c72d7", { short: short(s, m.club), value: years ? ` (${years})` : '', totals: totals, value2: war.toFixed(1), value3: big ? __i18n_k("league.alumni.alumnusLine.96b20ec5", { big: big }) : '', value4: hall ? __i18n_k("league.alumni.alumnusLine.52ec09c3") : '' });
}

export const isLegend = (m: StaffMember | undefined) => !!m?.playerId && (m.fame ?? 0) >= A.legend;

const ROLE_WORD: Partial<Record<StaffRole, string>> = { manager: __i18n_k("league.alumni.rOLE_WORD.manager.daec431c"), hitting: __i18n_k("league.alumni.rOLE_WORD.hitting.8a5c9a74"), pitching: __i18n_k("league.alumni.rOLE_WORD.pitching.0b977195"), fielding: __i18n_k("league.alumni.rOLE_WORD.fielding.526edd08"), farm: __i18n_k("league.alumni.rOLE_WORD.farm.347796cf"), scouting: __i18n_k("league.alumni.rOLE_WORD.scouting.5added0a"), analytics: __i18n_k("league.alumni.rOLE_WORD.analytics.b8d925c1") };

/** A club hired a former player: the article (a manager, or a legend in any post), and the fans when it is ours. */
export function alumnusHired(s: LeagueState, teamId: TeamId, m: StaffMember, date: string) {
  if (!m.playerId || !s.user) return;
  const ours = teamId === s.user.teamId;
  const legend = isLegend(m);
  if (m.role !== 'manager' && !legend) return;
  const home = m.club === teamId;
  const club = short(s, teamId);
  const word = ROLE_WORD[m.role] ?? __i18n_k("league.alumni.alumnusHired.word.c6e93014");
  const title = home ? __i18n_k("league.alumni.alumnusHired.title.fcb1e09a", { value: legend ? __i18n_k("league.alumni.alumnusHired.title.03c12437") : '', name: m.name, club: club, word: ro(word) }) : __i18n_k("league.alumni.alumnusHired.title.6cf619cb", { value: legend ? __i18n_k("league.alumni.alumnusHired.title.03c12437") : '', name: m.name, club: club, word: word });
  addNews(s, {
    id: `alumni-hire-${teamId}-${m.role}-${m.playerId}-${date.slice(0, 4)}`,
    date,
    kind: 'move',
    title,
    body: __i18n_k("league.alumni.alumnusHired.body.683d5348", { club: iga(club), value: home ? __i18n_k("league.alumni.alumnusHired.body.bcd5726e") : __i18n_k("league.alumni.alumnusHired.body.be86217a"), name: eulreul(m.name), word: ro(word), alumnusLine: alumnusLine(s, m), value2: m.role === 'manager' ? __i18n_k("league.alumni.alumnusHired.body.3c391a2f", { rating: m.rating }) : '' }),
    quotes: [{ who: m.name, role: 'manager', text: home ? __i18n_k("league.alumni.quotes.text.62601dbb") : __i18n_k("league.alumni.quotes.text.60829979") }],
    facts: { name: m.name, club, role: word, fame: m.fame ?? 0 },
    players: [m.playerId],
    ...(ours ? { mine: true } : {}),
  });
  if (!ours) return;
  const c = clubState(s, teamId);
  const buzz = home && legend ? A.homecoming : legend ? A.legendHire : 0;
  if (buzz) c.interest = clamp(c.interest + buzz, FANS.interestMin, FANS.interestMax);
  addAlert(s, {
    id: `alumni-hire-${teamId}-${m.role}-${m.playerId}`,
    date,
    kind: 'move',
    title,
    lines: [alumnusLine(s, m), buzz ? __i18n_k("league.alumni.alumnusHired.lines.2bc98c23") : __i18n_k("league.alumni.alumnusHired.lines.30e6c913")],
    tone: 'good',
    players: [m.playerId],
  });
}

/** We let a legend manager go before his contract ran out: the fans take it hard. */
export function legendFired(s: LeagueState, teamId: TeamId, m: StaffMember, date: string) {
  if (!s.user || m.role !== 'manager' || !isLegend(m)) return;
  const ours = teamId === s.user.teamId;
  if (ours) {
    const c = clubState(s, teamId);
    const hit = A.firedLegend * (m.club === teamId ? 1.5 : 1);
    c.interest = clamp(c.interest - hit, FANS.interestMin, FANS.interestMax);
  }
  addNews(s, {
    id: `alumni-fired-${teamId}-${m.playerId}-${date.slice(0, 4)}`,
    date,
    kind: 'move',
    title: __i18n_k("league.alumni.legendFired.title.86faa2bc", { short: short(s, teamId), value: wagwa(__i18n_k("league.alumni.legendFired.title.da144412", { name: m.name })) }),
    body: __i18n_k("league.alumni.legendFired.body.0250acf4", { short: iga(short(s, teamId)), value: ours ? __i18n_k("league.alumni.legendFired.body.b45f0673") : '', name: m.name, alumnusLine: alumnusLine(s, m) }),
    quotes: [{ who: __i18n_k("league.alumni.quotes.who.724cc77d"), role: 'fan', text: m.club === teamId ? __i18n_k("league.alumni.quotes.text.5edaeb58") : __i18n_k("league.alumni.quotes.text.c63724ff") }],
    facts: { name: m.name, club: short(s, teamId) },
    players: m.playerId ? [m.playerId] : [],
    ...(ours ? { mine: true } : {}),
  });
}

/** What a retired player does now, when he works for a club ("고래 타격코치"). */
export function alumnusJob(s: LeagueState, id: PlayerId): string | null {
  for (const [teamId, c] of Object.entries(s.clubs ?? {}))
    for (const m of Object.values(c.staff ?? {})) if (m?.playerId === id) return __i18n_k("league.alumni.alumnusJob.8a09a2b5", { short: short(s, teamId), value: ROLE_WORD[m.role] ?? __i18n_k("league.alumni.alumnusJob.c6e93014") });
  return null;
}

// ── Days with our former-player staff ────────────────────────────────────────────────────────────

type Done = string[];
const doneOf = (s: LeagueState): Done => (s.user!.alumniDone ??= []);
/** This season's events of a kind so far. */
const seasonCount = (s: LeagueState, kind: string) => doneOf(s).filter((k) => k.startsWith(`${s.year}|${kind}`)).length;

/** Teammates once: the same club in the same first-team season. */
const teammates = (a: Player, b: Player) => {
  const seasons = new Set(firstTeam(a).map((c) => `${c.year}|${c.teamId}`));
  return firstTeam(b).some((c) => seasons.has(`${c.year}|${c.teamId}`));
};

/** Our club's game on a date, if any. */
const ourGame = (s: LeagueState, date: string) => {
  const me = s.user!.teamId;
  for (let i = s.next; i < s.schedule.length && s.schedule[i]!.date === date; i++) {
    const g = s.schedule[i]!;
    if (g.home === me || g.away === me) return g;
  }
  return null;
};

/** Our wins or losses in a row before today. */
function streak(s: LeagueState): number {
  const me = s.user!.teamId;
  let n = 0;
  for (let i = s.scores.length - 1; i >= 0; i--) {
    const g = s.scores[i]!;
    if (g.home !== me && g.away !== me) continue;
    const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
    if (mine === theirs) break;
    const w = mine > theirs ? 1 : -1;
    if (n !== 0 && Math.sign(n) !== w) break;
    n += w;
  }
  return n;
}

/** A day with our former-player manager and coaches (in the season, before the day's games). */
export function alumniDay(s: LeagueState, date: string) {
  const u = s.user;
  if (!u || s.phase !== 'regular' || !s.clubs?.[u.teamId]?.staff) return;
  const staff = s.clubs[u.teamId]!.staff!;
  const boss = staff.manager?.playerId ? staff.manager : undefined;
  const coaches = (['hitting', 'pitching', 'fielding', 'manager'] as StaffRole[]).map((r) => staff[r]).filter((m): m is StaffMember => !!m?.playerId);
  if (!coaches.length) return;
  const done = doneOf(s);
  const once = (key: string, ever = false) => {
    const k = ever ? `ever|${key}` : `${s.year}|${key}`;
    if (done.includes(k)) return false;
    done.push(k);
    // Season keys of past years are no longer needed; career marks stay.
    if (done.length > 300) done.splice(0, done.length, ...done.filter((x) => x.startsWith('ever|') || x.startsWith(`${s.year}|`)));
    return true;
  };
  const me = u.teamId;
  const club = short(s, me);
  const game = ourGame(s, date);
  const active = s.rosters[me]!.active.map((id) => s.players[id]!).filter(Boolean);

  // His first home game at a club that retired his number, and an old teammate on our roster.
  if (boss) {
    const mp = s.players[boss.playerId!];
    const number = s.teams.find((t) => t.id === me)?.retiredNumbers?.find((x) => x.playerId === boss.playerId);
    if (number && game && game.home === me && once(`ceremony-${boss.playerId}`, true)) {
      clubState(s, me).interest = clamp(clubState(s, me).interest + A.legendHire, FANS.interestMin, FANS.interestMax);
      addNews(s, {
        id: `alumni-ceremony-${s.year}-${boss.playerId}`,
        date,
        kind: 'move',
        title: __i18n_k("league.alumni.alumniDay.title.4430b71d", { number: number.number }),
        body: __i18n_k("league.alumni.alumniDay.body.029f0e06", { club: club, number: number.number, name: boss.name }),
        quotes: [{ who: boss.name, role: 'manager', text: __i18n_k("league.alumni.quotes.text.a4dc9c37") }],
        facts: { name: boss.name, number: number.number },
        players: [boss.playerId!],
        mine: true,
      });
    }
    if (mp) {
      // One old teammate a season, each once.
      const old = seasonCount(s, 'reunion') ? undefined : active.find((p) => !done.includes(`ever|reunion-${boss.playerId}-${p.id}`) && teammates(p, mp));
      if (old && once(`reunion-${boss.playerId}-${old.id}`, true) && once('reunion')) {
        setForm(old, A.reunion.delta, date, A.reunion.days, __i18n_k("league.alumni.alumniDay.06deee82"));
        note(old, date, __i18n_k("league.alumni.alumniDay.15900be5", { name: boss.name }), 'good');
        addNews(s, {
          id: `alumni-reunion-${s.year}-${old.id}`,
          date,
          kind: 'interview',
          title: __i18n_k("league.alumni.alumniDay.title.42806764", { name: wagwa(boss.name), name2: old.name }),
          body: __i18n_k("league.alumni.alumniDay.body.57c29877", { club: club, name: boss.name, name2: eunneun(old.name), name3: iga(old.name) }),
          quotes: [{ who: old.name, role: 'player', text: __i18n_k("league.alumni.quotes.text.b33fa877") }],
          facts: { manager: boss.name, player: old.name },
          players: [old.id, boss.playerId!],
          mine: true,
        });
      }
    }
    // The first game against the club he played for, and against an old teammate managing the other side.
    if (game) {
      const opp = game.home === me ? game.away : game.home;
      if (boss.club && boss.club === opp && once(`old-club-${boss.playerId}`)) {
        addNews(s, {
          id: `alumni-oldclub-${s.year}-${boss.playerId}`,
          date,
          kind: 'game',
          title: __i18n_k("league.alumni.alumniDay.title.e5ff22d6", { name: boss.name, short: wagwa(short(s, opp)) }),
          body: __i18n_k("league.alumni.alumniDay.body.3bb16eb1", { short: short(s, opp), club: club, name: boss.name, short2: short(s, opp) }),
          quotes: [{ who: boss.name, role: 'manager', text: __i18n_k("league.alumni.quotes.text.0be5b3ea") }],
          facts: { manager: boss.name, opponent: short(s, opp) },
          players: [boss.playerId!],
          mine: true,
        });
      }
      const rival = s.clubs?.[opp]?.staff?.manager;
      if (rival?.playerId && mp && s.players[rival.playerId] && teammates(mp, s.players[rival.playerId]!) && once(`old-mates-${rival.playerId}`)) {
        addNews(s, {
          id: `alumni-mates-${s.year}-${boss.playerId}-${rival.playerId}`,
          date,
          kind: 'game',
          title: __i18n_k("league.alumni.alumniDay.title.2e7686e6", { name: boss.name, name2: rival.name }),
          body: __i18n_k("league.alumni.alumniDay.body.c2f52d6f", { club: club, name: boss.name, short: short(s, opp), name2: rival.name }),
          quotes: [{ who: boss.name, role: 'manager', text: __i18n_k("league.alumni.quotes.text.1dbabd9b") }],
          facts: { manager: boss.name, rival: rival.name, opponent: short(s, opp) },
          players: [boss.playerId!, rival.playerId],
          mine: true,
        });
      }
    }
    // The fans and a legend's streaks.
    if (isLegend(boss)) {
      const run = streak(s);
      if (Math.abs(run) >= A.streak.games && once(`streak-${run > 0 ? 'w' : 'l'}`)) {
        const c = clubState(s, me);
        c.interest = clamp(c.interest + (run > 0 ? A.streak.buzz : -A.streak.buzz), FANS.interestMin, FANS.interestMax);
        addNews(s, {
          id: `alumni-streak-${s.year}-${run > 0 ? 'w' : 'l'}`,
          date,
          kind: 'game',
          title: run > 0 ? __i18n_k("league.alumni.alumniDay.title.dcef795b", { club: club, run: run }) : __i18n_k("league.alumni.alumniDay.title.2bd776f1", { club: club, value: -run }),
          body:
            run > 0
              ? __i18n_k("league.alumni.alumniDay.body.fdf55e8b", { name: boss.name, club: iga(club), run: run, name2: eulreul(boss.name) })
              : __i18n_k("league.alumni.alumniDay.body.741a0970", { club: iga(club), value: -run, name: boss.name }),
          quotes: [{ who: __i18n_k("league.alumni.quotes.who.724cc77d"), role: 'fan', text: run > 0 ? __i18n_k("league.alumni.quotes.text.33a53873") : __i18n_k("league.alumni.quotes.text.4256cea2") }],
          facts: { manager: boss.name, streak: run },
          players: [boss.playerId!],
          mine: true,
        });
      }
    }
    // A player of ours passes the manager's own career mark.
    if (mp) passMark(s, date, boss, mp, active, once);
  }

  // Now and then: a lesson, or the manager's temper.
  if (seasonCount(s, 'lesson') + seasonCount(s, 'protest') >= A.perSeason) return;
  const r = rng(`${s.seed}|alumni-day|${date}`);
  if (r() >= A.daily) return;
  const coach = coaches[Math.floor(r() * coaches.length)]!;
  const cp = s.players[coach.playerId!];
  if (!cp) return;
  if (coach.role === 'manager' && traitsOf(cp).controversy >= A.protest.controversy && r() < 0.35) {
    if (!game || !once(`protest-${s.year}`)) return;
    u.fund -= A.protest.fine;
    u.ledger.push({ year: s.year, label: __i18n_k("league.alumni.alumniDay.label.cd81573e", { name: coach.name }), amount: -A.protest.fine });
    addNews(s, {
      id: `alumni-protest-${date}`,
      date,
      kind: 'game',
      title: __i18n_k("league.alumni.alumniDay.title.4808aa1e", { name: coach.name }),
      body: __i18n_k("league.alumni.alumniDay.body.1af1ae98", { club: club, name: coach.name, fine: A.protest.fine }),
      quotes: [{ who: coach.name, role: 'manager', text: __i18n_k("league.alumni.quotes.text.d3041513") }],
      facts: { manager: coach.name, fine: A.protest.fine },
      players: [coach.playerId!],
      mine: true,
    });
    return;
  }
  const pitcher = isPitcher(cp);
  const pupils = active.filter((p) => isPitcher(p) === pitcher && !(p.life?.form && p.life.form.until >= date));
  if (!pupils.length) return;
  const pupil = pupils[Math.floor(r() * pupils.length)]!;
  if (!once(`lesson-${pupil.id}`)) return;
  setForm(pupil, A.lesson.delta, date, A.lesson.days, __i18n_k("league.alumni.alumniDay.3c11d2a4", { name: coach.name }));
  const who = __i18n_k("league.alumni.alumniDay.who.4013b6ab", { name: coach.name, value: ROLE_WORD[coach.role] ?? __i18n_k("league.alumni.alumniDay.who.95430629") });
  note(pupil, date, __i18n_k("league.alumni.alumniDay.184b74fa", { who: who, value: pitcher ? __i18n_k("league.alumni.alumniDay.b9b0fb00") : __i18n_k("league.alumni.alumniDay.74b03362") }), 'good');
  addNews(s, {
    id: `alumni-lesson-${date}-${pupil.id}`,
    date,
    kind: 'interview',
    title: __i18n_k("league.alumni.alumniDay.title.acad5848", { who: who, name: pupil.name }),
    body: __i18n_k("league.alumni.alumniDay.body.8ece2346", { alumnusLine: alumnusLine(s, coach), who: iga(who), name: pupil.name, value: pitcher ? __i18n_k("league.alumni.alumniDay.body.12c4dbd3") : __i18n_k("league.alumni.alumniDay.body.a4739061"), name2: iga(pupil.name) }),
    quotes: [{ who: pupil.name, role: 'player', text: __i18n_k("league.alumni.quotes.text.5875d620") }],
    facts: { coach: coach.name, player: pupil.name },
    players: [pupil.id, coach.playerId!],
    mine: true,
  });
}

/** A player of ours passes the manager's career mark in home runs, hits, wins or saves (his side's). */
function passMark(s: LeagueState, date: string, boss: StaffMember, mp: Player, active: Player[], once: (key: string, ever?: boolean) => boolean) {
  const rows = firstTeam(mp);
  const marks: [string, number, (p: Player) => number][] = isPitcher(mp)
    ? [
        ['승', rows.reduce((a, c) => a + (c.pit?.w ?? 0), 0), (p) => careerOf(s, p, (c) => c.pit?.w ?? 0)],
        ['세이브', rows.reduce((a, c) => a + (c.pit?.sv ?? 0), 0), (p) => careerOf(s, p, (c) => c.pit?.sv ?? 0)],
      ]
    : [
        [__i18n_k("league.alumni.passMark.marks.9162d3a3"), rows.reduce((a, c) => a + (c.bat?.hr ?? 0), 0), (p) => careerOf(s, p, (c) => c.bat?.hr ?? 0)],
        ['안타', rows.reduce((a, c) => a + (c.bat?.h ?? 0), 0), (p) => careerOf(s, p, (c) => c.bat?.h ?? 0)],
      ];
  for (const [label, mark, of] of marks) {
    if (mark < (label === '안타' ? 300 : label === '세이브' ? 30 : label === '승' ? 30 : 50)) continue;
    for (const p of active) {
      if (isPitcher(p) !== isPitcher(mp) || of(p) <= mark) continue;
      // Once in his career, not every season.
      if (!once(`mark-${p.id}-${label}`, true)) continue;
      note(p, date, __i18n_k("league.alumni.passMark.d857d600", { label: label, name: boss.name, mark: mark }), 'good');
      addNews(s, {
        id: `alumni-mark-${p.id}-${label}`,
        date,
        kind: 'milestone',
        title: __i18n_k("league.alumni.passMark.title.78b45750", { name: p.name, name2: boss.name, label: label }),
        body: __i18n_k("league.alumni.passMark.body.2c802b96", { name: iga(p.name), label: label, of: of(p), name2: boss.name, mark: mark, name3: eunneun(boss.name) }),
        quotes: [{ who: boss.name, role: 'manager', text: __i18n_k("league.alumni.quotes.text.b986ba7a") }],
        facts: { player: p.name, manager: boss.name, label, mark, now: of(p) },
        players: [p.id, boss.playerId!],
        mine: true,
      });
    }
  }
}

/** First-team career total so far, this season included. */
function careerOf(s: LeagueState, p: Player, pick: (c: { bat: Player['career'][number]['bat']; pit: Player['career'][number]['pit'] }) => number): number {
  const line = s.lines[p.id];
  return firstTeam(p).reduce((a, c) => a + pick(c), 0) + (line ? pick(line) : 0);
}

