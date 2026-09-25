/* Read-only views of the league for the screens. Everything here is public: scouting grades, results
   and contracts, never hidden ability. */
import { ROLE_LABELS } from '../draftroom';
import { publicView, type PublicPlayer } from '../model/player';
import type { BatTotals, PitTotals, Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { salaryIn } from './contracts';
import { ageIn, isForeign, isPitcher } from './players';
import { currentStandings } from './season';
import { SANGMU } from './futures';
import { isDevelopment, type LeagueState } from './state';
import { avg, era, ip, obp, ops, slg } from './stats';

export const teamOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id);
export const shortName = (s: LeagueState, id: TeamId | null) => (id === SANGMU ? '상무' : (teamOf(s, id)?.short ?? '-'));

export const positionLabel = (p: Pick<Player, 'role' | 'position'>) =>
  p.position ? ({ C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' } as const)[p.position] : ROLE_LABELS[p.role];

const fmt3 = (x: number) => x.toFixed(3).replace(/^0/, '');

export function standingsView(s: LeagueState) {
  return currentStandings(s).map((r) => ({ ...r, name: teamOf(s, r.teamId)!.name, short: shortName(s, r.teamId), color: teamOf(s, r.teamId)!.color, games: r.w + r.l + r.t }));
}

export function lastDayScores(s: LeagueState) {
  const last = s.scores.at(-1)?.date;
  return last ? s.scores.filter((g) => g.date === last) : [];
}

type Leader = { id: PlayerId; name: string; team: string; value: string };

/** Top five in each category this season. Rate stats need the qualifying minimum (타석 3.1×경기, 이닝 1×경기). */
export function leaders(s: LeagueState) {
  const teamGames = Math.max(1, ...standingsView(s).map((r) => r.games));
  const entries = Object.entries(s.lines).map(([id, line]) => ({ p: s.players[id], line }));
  const bats = entries.filter((e): e is { p: Player; line: typeof e.line & { bat: BatTotals } } => !!e.p && !!e.line.bat && e.line.bat.pa > 0);
  const pits = entries.filter((e): e is { p: Player; line: typeof e.line & { pit: PitTotals } } => !!e.p && !!e.line.pit && e.line.pit.g > 0);
  const top = <T extends { p: Player; line: { teamId: TeamId } }>(xs: T[], key: (x: T) => number, show: (x: T) => string, asc = false): Leader[] =>
    [...xs]
      .sort((a, b) => (asc ? key(a) - key(b) : key(b) - key(a)))
      .slice(0, 5)
      .map((x) => ({ id: x.p.id, name: x.p.name, team: shortName(s, x.line.teamId), value: show(x) }));
  const qualifiedBat = bats.filter((x) => x.line.bat.pa >= teamGames * 3.1);
  const qualifiedPit = pits.filter((x) => x.line.pit.outs >= teamGames * 3);
  return {
    batting: [
      { title: '타율', rows: top(qualifiedBat, (x) => avg(x.line.bat), (x) => fmt3(avg(x.line.bat))) },
      { title: '홈런', rows: top(bats, (x) => x.line.bat.hr, (x) => String(x.line.bat.hr)) },
      { title: '타점', rows: top(bats, (x) => x.line.bat.rbi, (x) => String(x.line.bat.rbi)) },
      { title: 'OPS', rows: top(qualifiedBat, (x) => ops(x.line.bat), (x) => fmt3(ops(x.line.bat))) },
      { title: '도루', rows: top(bats, (x) => x.line.bat.sb, (x) => String(x.line.bat.sb)) },
    ],
    pitching: [
      { title: '평균자책점', rows: top(qualifiedPit, (x) => era(x.line.pit), (x) => era(x.line.pit).toFixed(2), true) },
      { title: '승리', rows: top(pits, (x) => x.line.pit.w, (x) => String(x.line.pit.w)) },
      { title: '세이브', rows: top(pits, (x) => x.line.pit.sv, (x) => String(x.line.pit.sv)) },
      { title: '홀드', rows: top(pits, (x) => x.line.pit.hld, (x) => String(x.line.pit.hld)) },
      { title: '탈삼진', rows: top(pits, (x) => x.line.pit.k, (x) => String(x.line.pit.k)) },
    ],
    qualifying: { pa: Math.ceil(teamGames * 3.1), innings: teamGames },
  };
}

export function batLine(b: BatTotals | null) {
  if (!b || !b.pa) return '';
  return `${b.g}경기 타율 ${fmt3(avg(b))} ${b.hr}홈런 ${b.rbi}타점 OPS ${fmt3(ops(b))}`;
}
export function pitLine(p: PitTotals | null) {
  if (!p || !p.g) return '';
  const extra = p.sv ? ` ${p.sv}세이브` : p.hld ? ` ${p.hld}홀드` : '';
  return `${p.g}경기 ${p.w}승 ${p.l}패${extra} ${ip(p.outs)}이닝 평균자책점 ${era(p).toFixed(2)}`;
}

/** This season's futures line, marked as such. */
function futuresLine(s: LeagueState, id: PlayerId) {
  const f = s.futures?.lines[id];
  if (!f) return '';
  const p = s.players[id]!;
  const text = isPitcher(p) ? pitLine(f.pit) : batLine(f.bat);
  return text ? `퓨처스 ${text}` : '';
}

export type RosterGroup = 'active' | 'futures' | 'third' | 'military';

export function rosterView(s: LeagueState, teamId: TeamId) {
  const r = s.rosters[teamId]!;
  const row = (id: PlayerId, group: RosterGroup) => {
    const p = s.players[id]!;
    const line = s.lines[id];
    return {
      id,
      group,
      name: p.name,
      foreign: isForeign(p),
      development: isDevelopment(p),
      pitcher: isPitcher(p),
      pos: positionLabel(p),
      age: ageIn(p, s.year),
      hand: `${p.throws}투${p.bats}타`,
      grade: p.scouting.current,
      future: p.scouting.futureValue,
      line: group === 'military' || group === 'active' ? (isPitcher(p) ? pitLine(line?.pit ?? null) : batLine(line?.bat ?? null)) : futuresLine(s, id) || (isPitcher(p) ? pitLine(line?.pit ?? null) : batLine(line?.bat ?? null)),
      salary: salaryIn(p, s.year),
      injured: !!s.injuries[id],
      away: !!s.away?.[id],
    };
  };
  const military = Object.values(s.players)
    .filter((p) => p.teamId === teamId && p.status === 'military')
    .map((p) => row(p.id, 'military'));
  const sortRows = (a: ReturnType<typeof row>, b: ReturnType<typeof row>) => Number(a.pitcher) - Number(b.pitcher) || b.grade - a.grade;
  return {
    active: r.active.map((id) => row(id, 'active')).sort(sortRows),
    futures: r.futures.map((id) => row(id, 'futures')).sort(sortRows),
    third: r.third.map((id) => row(id, 'third')).sort(sortRows),
    military: military.sort(sortRows),
  };
}

export interface CareerRow {
  year: number;
  team: string;
  futures: boolean;
  age: number;
  days: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
  war: number;
  current: boolean;
}

export function careerView(s: LeagueState, p: Player): CareerRow[] {
  const played = (c: { bat: BatTotals | null; pit: PitTotals | null }) => (c.bat?.g ?? 0) + (c.pit?.g ?? 0) > 0;
  const rows: CareerRow[] = p.career
    .filter(played)
    .map((c: SeasonRecord) => ({ year: c.year, team: shortName(s, c.teamId), futures: c.level === 'futures', age: c.age, days: c.days, bat: c.bat, pit: c.pit, war: c.war, current: false }));
  const line = s.lines[p.id];
  if (line && played(line)) rows.push({ year: s.year, team: shortName(s, line.teamId), futures: false, age: ageIn(p, s.year), days: line.days, bat: line.bat, pit: line.pit, war: NaN, current: true });
  const fline = s.futures?.lines[p.id];
  if (fline && played(fline)) rows.push({ year: s.year, team: shortName(s, fline.teamId), futures: true, age: ageIn(p, s.year), days: 0, bat: fline.bat, pit: fline.pit, war: NaN, current: true });
  return rows;
}

export interface PlayerCard {
  player: PublicPlayer;
  team: string;
  age: number;
  salary: number;
  status: string;
  career: CareerRow[];
}

export function playerCard(s: LeagueState, id: PlayerId): PlayerCard | null {
  const p = s.players[id];
  if (!p) return null;
  const status = p.status === 'military' ? `군 복무 중 (${p.service.route === 'sangmu' ? '상무' : p.service.route === 'social' ? '사회복무' : '현역'}, ${p.service.returnsOn} 전역)` : s.injuries[id] ? `부상 (${s.injuries[id]!.until} 복귀 예정)` : p.status === 'retired' ? '은퇴' : p.status === 'overseas' ? '해외 이적' : '';
  return { player: publicView(p), team: teamOf(s, p.teamId)?.name ?? '-', age: ageIn(p, s.year), salary: salaryIn(p, s.year), status, career: careerView(s, p) };
}

export const rates = { avg, obp, slg, ops, era, ip, fmt3 };
