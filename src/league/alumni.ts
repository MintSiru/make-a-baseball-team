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
        return `${w}승${sv ? ` ${sv}세이브` : ''}`;
      })()
    : (() => {
        const h = rows.reduce((a, c) => a + (c.bat?.h ?? 0), 0),
          hr = rows.reduce((a, c) => a + (c.bat?.hr ?? 0), 0);
        return `${h}안타 ${hr}홈런`;
      })();
  const big = (p.honors ?? []).filter((h) => (h.includes('MVP') && !h.includes('올스타')) || h.includes('골든글러브')).length;
  const hall = s.hallOfFame?.some((h) => h.id === p.id);
  return `${short(s, m.club)} 출신${years ? ` (${years})` : ''} · ${totals} · WAR ${war.toFixed(1)}${big ? ` · MVP·골든글러브 ${big}회` : ''}${hall ? ' · 명예의 전당' : ''}`;
}

export const isLegend = (m: StaffMember | undefined) => !!m?.playerId && (m.fame ?? 0) >= A.legend;

const ROLE_WORD: Partial<Record<StaffRole, string>> = { manager: '감독', hitting: '타격코치', pitching: '투수코치', fielding: '수비·주루코치', farm: '퓨처스 감독', scouting: '스카우트 팀장', analytics: '전력분석 팀장' };

/** A club hired a former player: the article (a manager, or a legend in any post), and the fans when it is ours. */
export function alumnusHired(s: LeagueState, teamId: TeamId, m: StaffMember, date: string) {
  if (!m.playerId || !s.user) return;
  const ours = teamId === s.user.teamId;
  const legend = isLegend(m);
  if (m.role !== 'manager' && !legend) return;
  const home = m.club === teamId;
  const club = short(s, teamId);
  const word = ROLE_WORD[m.role] ?? '스태프';
  const title = home ? `${legend ? '레전드 ' : ''}${m.name}, 친정 ${club} ${ro(word)} 돌아오다` : `${legend ? '레전드 ' : ''}${m.name}, ${club} 새 ${word}`;
  addNews(s, {
    id: `alumni-hire-${teamId}-${m.role}-${m.playerId}-${date.slice(0, 4)}`,
    date,
    kind: 'move',
    title,
    body: `${iga(club)} ${home ? '팀의 상징이던' : '선수 출신'} ${eulreul(m.name)} ${ro(word)} 선임했다. 현역 시절 ${alumnusLine(s, m)}.${m.role === 'manager' ? ` 지도자로서의 평가는 ${m.rating}, 운영 성향은 선수 시절을 닮았다는 평이다.` : ''}`,
    quotes: [{ who: m.name, role: 'manager', text: home ? '선수로 받은 사랑을 이제는 지도자로 갚겠습니다.' : '새 팀에서 처음부터 다시 시작한다는 마음입니다.' }],
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
    lines: [alumnusLine(s, m), buzz ? '팬들의 기대가 커졌습니다.' : '선수 출신 지도자가 합류했습니다.'],
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
    title: `${short(s, teamId)}, 레전드 ${wagwa(`${m.name} 감독`)} 결별`,
    body: `${iga(short(s, teamId))} ${ours ? '계약 기간이 남은 ' : ''}${m.name} 감독을 내보냈다. 현역 시절 ${alumnusLine(s, m)}. 구단 게시판에는 아쉬움과 항의 글이 이어졌다.`,
    quotes: [{ who: '팬', role: 'fan', text: m.club === teamId ? '팀의 상징을 이렇게 보내다니' : '레전드에게 너무 짧은 시간이었다' }],
    facts: { name: m.name, club: short(s, teamId) },
    players: m.playerId ? [m.playerId] : [],
    ...(ours ? { mine: true } : {}),
  });
}

/** What a retired player does now, when he works for a club ("고래 타격코치"). */
export function alumnusJob(s: LeagueState, id: PlayerId): string | null {
  for (const [teamId, c] of Object.entries(s.clubs ?? {}))
    for (const m of Object.values(c.staff ?? {})) if (m?.playerId === id) return `${short(s, teamId)} ${ROLE_WORD[m.role] ?? '스태프'}`;
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
        title: `영구결번 ${number.number}번의 주인, 감독으로 홈 팬 앞에`,
        body: `${club}의 영구결번 ${number.number}번 ${boss.name} 감독이 감독으로 맞은 첫 홈경기에서 팬들에게 인사했다. 구장에는 현역 시절 응원가가 울려 퍼졌다.`,
        quotes: [{ who: boss.name, role: 'manager', text: '이 번호를 단 선수들이 다시 이 구장의 주인이 되도록 하겠습니다.' }],
        facts: { name: boss.name, number: number.number },
        players: [boss.playerId!],
        mine: true,
      });
    }
    if (mp) {
      // One old teammate a season, each once.
      const old = seasonCount(s, 'reunion') ? undefined : active.find((p) => !done.includes(`ever|reunion-${boss.playerId}-${p.id}`) && teammates(p, mp));
      if (old && once(`reunion-${boss.playerId}-${old.id}`, true) && once('reunion')) {
        setForm(old, A.reunion.delta, date, A.reunion.days, '옛 동료 감독의 신뢰');
        note(old, date, `옛 동료였던 ${boss.name} 감독과 감독·선수로 다시 만났다`, 'good');
        addNews(s, {
          id: `alumni-reunion-${s.year}-${old.id}`,
          date,
          kind: 'interview',
          title: `한때 동료, 이제는 감독과 선수 — ${wagwa(boss.name)} ${old.name}`,
          body: `${club} ${boss.name} 감독과 ${eunneun(old.name)} 현역 시절 한 팀에서 뛰었다. ${iga(old.name)} "감독님이 제 야구를 가장 잘 아는 분"이라며 웃었다.`,
          quotes: [{ who: old.name, role: 'player', text: '같이 뛸 때부터 배운 게 많았습니다. 이제 감독님께 결과로 보여 드려야죠.' }],
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
          title: `${boss.name} 감독, 친정 ${wagwa(short(s, opp))} 첫 맞대결`,
          body: `현역 시절 ${short(s, opp)}에서 뛰었던 ${club} ${boss.name} 감독이 오늘 친정팀을 상대한다. ${short(s, opp)} 팬들은 옛 스타를 박수로 맞았다.`,
          quotes: [{ who: boss.name, role: 'manager', text: '고마운 팀이지만 오늘은 이기러 왔습니다.' }],
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
          title: `한솥밥 먹던 두 사람, 감독으로 맞대결 — ${boss.name} 대 ${rival.name}`,
          body: `현역 시절 한 팀에서 뛰었던 ${club} ${boss.name} 감독과 ${short(s, opp)} ${rival.name} 감독이 오늘 처음 감독으로 만난다.`,
          quotes: [{ who: boss.name, role: 'manager', text: '경기 전에는 친구, 경기 중에는 적입니다.' }],
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
          title: run > 0 ? `'레전드 매직' ${club}, ${run}연승` : `${club} ${-run}연패, 레전드 감독도 고개 숙였다`,
          body:
            run > 0
              ? `${boss.name} 감독이 이끄는 ${iga(club)} ${run}연승을 달렸다. 팬들은 현역 시절의 ${eulreul(boss.name)} 떠올리며 열광하고 있다.`
              : `${iga(club)} ${-run}연패에 빠졌다. 레전드 ${boss.name} 감독을 향한 기대가 컸던 만큼 실망한 팬들의 목소리도 커졌다.`,
          quotes: [{ who: '팬', role: 'fan', text: run > 0 ? '역시 우리 레전드다' : '이름값만으로는 이길 수 없다' }],
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
    u.ledger.push({ year: s.year, label: `${coach.name} 감독 제재금`, amount: -A.protest.fine });
    addNews(s, {
      id: `alumni-protest-${date}`,
      date,
      kind: 'game',
      title: `${coach.name} 감독, 판정 항의로 퇴장`,
      body: `${club} ${coach.name} 감독이 판정에 거세게 항의하다 퇴장당했다. 현역 시절부터 승부욕으로 유명했던 그답다는 말도 나온다. KBO는 제재금 ${A.protest.fine}만 원을 부과했다.`,
      quotes: [{ who: coach.name, role: 'manager', text: '선수들을 지키려 한 행동이었습니다. 제재는 받아들이겠습니다.' }],
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
  setForm(pupil, A.lesson.delta, date, A.lesson.days, `${coach.name}의 원포인트 레슨`);
  const who = `${coach.name} ${ROLE_WORD[coach.role] ?? '코치'}`;
  note(pupil, date, `${who}에게 ${pitcher ? '투구' : '타격'} 원포인트 레슨을 받았다`, 'good');
  addNews(s, {
    id: `alumni-lesson-${date}-${pupil.id}`,
    date,
    kind: 'interview',
    title: `${who}의 원포인트 레슨, ${pupil.name} "감이 왔다"`,
    body: `선수 출신(${alumnusLine(s, coach)}) ${iga(who)} ${pupil.name}에게 직접 ${pitcher ? '투구 폼을' : '타격 자세를'} 짚어 줬다. ${iga(pupil.name)} "선수 시절 직접 해 본 분이라 말 한마디가 다르다"고 했다.`,
    quotes: [{ who: pupil.name, role: 'player', text: '작은 차이 하나로 느낌이 확 달라졌습니다.' }],
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
        ['홈런', rows.reduce((a, c) => a + (c.bat?.hr ?? 0), 0), (p) => careerOf(s, p, (c) => c.bat?.hr ?? 0)],
        ['안타', rows.reduce((a, c) => a + (c.bat?.h ?? 0), 0), (p) => careerOf(s, p, (c) => c.bat?.h ?? 0)],
      ];
  for (const [label, mark, of] of marks) {
    if (mark < (label === '안타' ? 300 : label === '세이브' ? 30 : label === '승' ? 30 : 50)) continue;
    for (const p of active) {
      if (isPitcher(p) !== isPitcher(mp) || of(p) <= mark) continue;
      // Once in his career, not every season.
      if (!once(`mark-${p.id}-${label}`, true)) continue;
      note(p, date, `통산 ${label}에서 ${boss.name} 감독의 현역 기록(${mark})을 넘어섰다`, 'good');
      addNews(s, {
        id: `alumni-mark-${p.id}-${label}`,
        date,
        kind: 'milestone',
        title: `제자가 스승을 넘다 — ${p.name}, ${boss.name} 감독의 통산 ${label} 기록 돌파`,
        body: `${iga(p.name)} 통산 ${label} ${of(p)}개로 ${boss.name} 감독의 현역 시절 기록(${mark})을 넘어섰다. ${eunneun(boss.name)} "내 기록은 깨지라고 있는 것"이라며 축하했다.`,
        quotes: [{ who: boss.name, role: 'manager', text: '제 기록을 넘은 게 제일 기쁩니다. 더 멀리 가길 바랍니다.' }],
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

