import { k as __i18n_k } from '../i18n/index';
import { LEAGUE_NAMES, leagueTables, sidesOf } from './twelve';
/* Read-only views of the league for the screens. Everything here is public: scouting grades, results
   and contracts, never hidden ability. */
import { alumnusJob } from './alumni';
import { ROLE_LABELS } from '../draftroom';
import { publicView, type PublicPlayer } from '../model/player';
import { faOutlook, type FaOutlook } from './faclock';
import type { BatTotals, InjuryRecord, PitTotals, Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { emptySplit, type Splits } from './engine/types';
import { batDetail, pitDetail } from './savant';
import { addSituations } from './engine/situation';
import { exhibitionBox, exhibitionLeaders, exhibitionTable } from './exhibition';
import { averageVelocity, FASTBALL_LABELS, fastballOf, pitchGrades, pitchingLift, topVelocity, type FastballType } from './pitches';
import { POSITION_SHORT, positionGrades, secondaryPositions } from './positions';
import { halfLabel, playText } from './playtext';
import { salaryIn, usdTotal } from './contracts';
import { ageIn, isForeign, isPitcher } from './players';
import { currentStandings } from './season';
import { rulesFor } from '../rules/history';
import { halfTables } from './historic';
import type { StandingRow } from './standings';
import { SANGMU } from './futures';
import { cardFor, lineupFor, managerLean, penRoles, PEN_ROLE_LABELS, rotationFor } from './manager';
import { isDevelopment, type LeagueState } from './state';
import { captaincyLift } from './captains';
import { avg, babip, babipAllowed, batterWar, defensiveWar, era, eraMinus, fip, fipMinus, ip, leagueContext, obp, ops, per9, pitcherWar, rateContext, slg, whip, woba, wrcPlus, type RateContext } from './stats';
import { playerPark } from './venues';
import { addInto, emptyBat, emptyPit } from './state';
import { traitsOf } from './traits';
import { traitReport, type TraitReport } from './reports';
import { trackingOf } from './tracking';
import { addBatted, battedRates, battingProfile, emptyBatted, type BattingProfile } from './battedball';
import type { FieldPos } from './engine/types';
import { addField, emptyField, fieldingRuns, popTime, scoutedFielding, sprintSpeed, type FieldingRatings, type FieldTotals } from './fielding';
import { nationalBox, nationalLog, nationalName, nationalTeamName } from './nationalgames';

/** 리더십 from which a senior counts as a clubhouse leader. */
const LEADER = 68;

export const teamOf = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id);
export const shortName = (s: LeagueState, id: TeamId | null) => (id === SANGMU ? __i18n_k("league.views.shortName.d2a2ca0f") : id === 'dream' ? __i18n_k("league.views.shortName.c2c3ed38") : id === 'nanum' ? __i18n_k("league.views.shortName.ca6f7a21") : (teamOf(s, id)?.short ?? '-'));

export const positionLabel = (p: Pick<Player, 'role' | 'position'>) =>
  p.position ? ({ C: __i18n_k("league.views.positionLabel.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.views.positionLabel.sS.3e24c7f1"), LF: __i18n_k("league.views.positionLabel.lF.73836db2"), CF: __i18n_k("league.views.positionLabel.cF.56780b2a"), RF: __i18n_k("league.views.positionLabel.rF.a28a0ef8") } as const)[p.position] : ROLE_LABELS[p.role];

const fmt3 = (x: number) => x.toFixed(3).replace(/^0/, '');

export function standingsView(s: LeagueState) {
  return currentStandings(s).map((r) => {
    // Average home crowd: this season's gate, or last season's report in the winter.
    const gate = s.gate?.[r.teamId];
    const last = s.clubs?.[r.teamId]?.reports.at(-1);
    const crowd = gate?.games ? Math.round(gate.fans / gate.games) : last?.homeGames && last.year === s.year ? Math.round(last.fans / last.homeGames) : 0;
    return { ...r, name: teamOf(s, r.teamId)!.name, short: shortName(s, r.teamId), color: teamOf(s, r.teamId)!.color, games: r.w + r.l + r.t, crowd };
  });
}

/** 2.0.29 (the user's report): a club's line in the table — in two leagues (the board's or the twelve clubs'), its
    rank and games behind inside its own league, with that league's name and table; null when it is not in this year's
    table. */
export function clubStanding(s: LeagueState, teamId: TeamId) {
  const rows = standingsView(s);
  const sides = sidesOf(s);
  if (!sides) return { row: rows.find((r) => r.teamId === teamId) ?? null, league: null as string | null, table: rows };
  const side = sides[teamId] ?? 'magic';
  const table = leagueTables(rows, sides)[side];
  return { row: table.find((r) => r.teamId === teamId) ?? null, league: LEAGUE_NAMES[side] as string | null, table };
}

/** 1.9.7: the first and second halves' tables of a split season (a history game, 1982–1988), as the full table's rows;
    null in any other season. */
export function halfStandingsView(s: LeagueState) {
  if (!s.historical || !rulesFor(s.year).halves) return null;
  const full = standingsView(s);
  const row = (r: StandingRow) => {
    const f = full.find((x) => x.teamId === r.teamId)!;
    return { ...r, name: f.name, short: f.short, color: f.color, games: r.w + r.l + r.t, crowd: f.crowd };
  };
  return halfTables(s).map((t) => t.map(row)) as [typeof full, typeof full];
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
  const totals = seasonTotals(s);
  const rc = rateContext(totals.bat, totals.pit);
  return {
    batting: [
      { title: __i18n_k("league.views.batting.title.1eb19e0a"), rows: top(qualifiedBat, (x) => avg(x.line.bat), (x) => fmt3(avg(x.line.bat))) },
      { title: __i18n_k("league.views.batting.title.9162d3a3"), rows: top(bats, (x) => x.line.bat.hr, (x) => String(x.line.bat.hr)) },
      { title: __i18n_k("league.views.batting.title.fed1c588"), rows: top(bats, (x) => x.line.bat.rbi, (x) => String(x.line.bat.rbi)) },
      { title: 'OPS', rows: top(qualifiedBat, (x) => ops(x.line.bat), (x) => fmt3(ops(x.line.bat))) },
      { title: 'wRC+', rows: top(qualifiedBat, (x) => wrcPlus(x.line.bat, rc), (x) => String(wrcPlus(x.line.bat, rc))) },
      { title: __i18n_k("league.views.batting.title.91e54831"), rows: top(bats, (x) => x.line.bat.sb, (x) => String(x.line.bat.sb)) },
    ],
    pitching: [
      { title: __i18n_k("league.views.pitching.title.f0f9146b"), rows: top(qualifiedPit, (x) => era(x.line.pit), (x) => era(x.line.pit).toFixed(2), true) },
      { title: 'WHIP', rows: top(qualifiedPit, (x) => whip(x.line.pit), (x) => whip(x.line.pit).toFixed(2), true) },
      { title: 'FIP', rows: top(qualifiedPit, (x) => fip(x.line.pit, rc), (x) => fip(x.line.pit, rc).toFixed(2), true) },
      { title: __i18n_k("league.views.pitching.title.90e5e4d2"), rows: top(pits, (x) => x.line.pit.w, (x) => String(x.line.pit.w)) },
      { title: '세이브', rows: top(pits, (x) => x.line.pit.sv, (x) => String(x.line.pit.sv)) },
      { title: __i18n_k("league.views.pitching.title.9329045a"), rows: top(pits, (x) => x.line.pit.hld, (x) => String(x.line.pit.hld)) },
      { title: __i18n_k("league.views.pitching.title.3e23c769"), rows: top(pits, (x) => x.line.pit.k, (x) => String(x.line.pit.k)) },
    ],
    qualifying: { pa: Math.ceil(teamGames * 3.1), innings: teamGames },
  };
}

export function batLine(b: BatTotals | null) {
  if (!b || !b.pa) return '';
  return __i18n_k("league.views.batLine.a6e3db17", { g: b.g, fmt3: fmt3(avg(b)), hr: b.hr, rbi: b.rbi, fmt32: fmt3(ops(b)) });
}
export function pitLine(p: PitTotals | null) {
  if (!p || !p.g) return '';
  const extra = p.sv ? __i18n_k("league.views.pitLine.extra.addf22ee", { sv: p.sv }) : p.hld ? __i18n_k("league.views.pitLine.extra.dcf052c7", { hld: p.hld }) : '';
  return __i18n_k("league.views.pitLine.3998d0ad", { g: p.g, w: p.w, l: p.l, extra: extra, ip: ip(p.outs), value: era(p).toFixed(2) });
}

function statsFor(s: LeagueState, id: PlayerId, group: RosterGroup): { bat: BatTotals | null; pit: PitTotals | null; futures: boolean } {
  const first = s.lines[id];
  const minor = s.futures?.lines[id];
  if (group === 'active' || (!minor && first)) return { bat: first?.bat ?? null, pit: first?.pit ?? null, futures: false };
  return { bat: minor?.bat ?? null, pit: minor?.pit ?? null, futures: !!minor };
}

/** This season's futures line, marked as such. */
function futuresLine(s: LeagueState, id: PlayerId) {
  const f = s.futures?.lines[id];
  if (!f) return '';
  const p = s.players[id]!;
  const text = isPitcher(p) ? pitLine(f.pit) : batLine(f.bat);
  return text ? __i18n_k("league.views.futuresLine.b1dac68a", { text: text }) : '';
}

export type RosterGroup = 'active' | 'futures' | 'third' | 'military';

export function rosterView(s: LeagueState, teamId: TeamId) {
  const r = s.rosters[teamId]!;
  // On the first team only five pitchers start; the rest pitch in relief whatever their role.
  const rotationList = rotationFor(s, r.active);
  const rotation = new Set(rotationList.map((p) => p.id));
  const pen = penRoles(s, teamId, r.active.map((id) => s.players[id]!).filter((p) => isPitcher(p) && !rotation.has(p.id)));
  const u = s.user?.teamId === teamId ? s.user : null;
  const row = (id: PlayerId, group: RosterGroup) => {
    const p = s.players[id]!;
    const line = s.lines[id];
    const penRole = group === 'active' && isPitcher(p) && !rotation.has(id) ? pen[id] ?? 'MU' : null;
    const usage = group === 'active' && isPitcher(p) ? (rotation.has(id) ? __i18n_k("league.views.row.usage.a88271df") : PEN_ROLE_LABELS[penRole!]) : null;
    return {
      id,
      group,
      name: p.name,
      number: p.numberTeam === teamId ? (p.number ?? null) : null,
      foreign: isForeign(p),
      development: isDevelopment(p),
      /** 2.0.14: a two-way player (pitches and hits, twoway.ts). */
      twoWay: p.twoWay,
      /** 1.7.0: our captain ('C') or a vice-captain ('VC'). */
      captain: u?.captains?.captain === id ? ('C' as const) : u?.captains?.vice.includes(id) ? ('VC' as const) : null,
      pitcher: isPitcher(p),
      pos: usage ?? positionLabel(p),
      /** Hitters: other positions he handles (V0.7). */
      also: isPitcher(p) ? [] : secondaryPositions(s, p).map((x) => POSITION_SHORT[x]),
      /** A starter by role who pitches in relief on the first team. */
      starterInPen: !!penRole && p.role === 'SP',
      /** First-team relievers: the role in the bullpen, and whether the general manager set it. */
      penRole,
      penRoleSet: !!u?.penRoles?.[id],
      platoon: u?.platoon?.[id] ?? null,
      role: p.role,
      age: ageIn(p, s.year),
      hand: __i18n_k("league.views.row.hand.0fdaea08", { throws: p.throws, bats: p.bats }),
      grade: p.scouting.current,
      future: p.scouting.futureValue,
      /** 1.7.0: the draft-day expectation (the display setting "draft day only"). */
      draftGrade: p.origin.draftGrade ?? null,
      line: group === 'military' || group === 'active' ? (isPitcher(p) ? pitLine(line?.pit ?? null) : batLine(line?.bat ?? null)) : futuresLine(s, id) || (isPitcher(p) ? pitLine(line?.pit ?? null) : batLine(line?.bat ?? null)),
      /** This season's numbers: first team for the first team, futures (or 상무) below it. */
      stats: statsFor(s, id, group),
      salary: salaryIn(p, s.year),
      /** 1.8.0: when he reaches free agency (faclock.ts). */
      fa: faOutlook(s, p),
      /** Foreign players: the contract total in US dollars (bonus + salary + options). */
      usd: usdTotal(p.contract),
      injured: !!s.injuries[id] && !s.injuries[id]!.dtd,
      /** What is wrong and until when (V0.7.7): an injury or a knock that keeps him out for a few days. */
      injury: injuryNote(s.injuries[id]),
      knock: !!s.injuries[id]?.dtd,
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
  /** 2.0.15: the club (for its park factor). */
  teamId: TeamId;
  futures: boolean;
  age: number;
  days: number;
  bat: BatTotals | null;
  pit: PitTotals | null;
  war: number;
  current: boolean;
}

/** 2.0.3: his fielding by first-team season (from 2.0.3 on), with its runs and defensive WAR at his main position. */
function fieldingView(p: Player, major: CareerRow[]): PlayerCard['fielding'] {
  const all = emptyField();
  const seasons: NonNullable<PlayerCard['fielding']>['seasons'] = [];
  for (const r of major) {
    const f = r.bat?.fld;
    if (!f || !r.bat) continue;
    addField(all, f);
    const g = r.bat.posG ?? {};
    const pos = (Object.entries(g).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? p.position ?? 'DH') as FieldPos;
    seasons.push({ year: r.year, team: r.team, current: r.current, pos, f, runs: Math.round(fieldingRuns(f) * 10) / 10, dwar: defensiveWar(r.bat, pos) });
  }
  const catcher = p.position === 'C' || (p.alt ?? []).includes('C');
  return { parts: scoutedFielding(p), sprint: sprintSpeed(p), pop: catcher ? popTime(p) : null, seasons, career: seasons.length ? { f: all, runs: Math.round(fieldingRuns(all) * 10) / 10 } : null };
}

/** 2.0.1: the batted-ball rows of his first-team seasons (balls he hit, or a pitcher's balls hit off him). */
function battedView(p: Player, major: CareerRow[], pitcher: boolean): PlayerCard['batted'] {
  const all = emptyBatted();
  const seasons: PlayerCard['batted']['seasons'] = [];
  for (const r of major) {
    const t = pitcher ? r.pit?.bip : r.bat?.bip;
    const rates = battedRates(t);
    if (!t || !rates) continue;
    addBatted(all, t);
    seasons.push({ year: r.year, team: r.team, current: r.current, rates });
  }
  return { profile: pitcher ? null : battingProfile(p), seasons, career: battedRates(all) };
}

export function careerView(s: LeagueState, p: Player): CareerRow[] {
  const played = (c: { bat: BatTotals | null; pit: PitTotals | null }) => (c.bat?.g ?? 0) + (c.pit?.g ?? 0) > 0;
  const rows: CareerRow[] = p.career
    .filter(played)
    .map((c: SeasonRecord) => ({ year: c.year, team: shortName(s, c.teamId), teamId: c.teamId, futures: c.level === 'futures', age: c.age, days: c.days, bat: c.bat, pit: c.pit, war: c.war, current: false }));
  // 2.0.10: once the season is closed its record is in the career while its lines stay until the next season
  // starts; the season showed twice (and counted twice in the totals).
  const closed = (futures: boolean) => p.career.some((c) => c.year === s.year && (c.level === 'futures') === futures);
  const line = s.lines[p.id];
  if (line && played(line) && !closed(false)) rows.push({ year: s.year, team: shortName(s, line.teamId), teamId: line.teamId, futures: false, age: ageIn(p, s.year), days: line.days, bat: line.bat, pit: line.pit, war: NaN, current: true });
  const fline = s.futures?.lines[p.id];
  if (fline && played(fline) && !closed(true)) rows.push({ year: s.year, team: shortName(s, fline.teamId), teamId: fline.teamId, futures: true, age: ageIn(p, s.year), days: 0, bat: fline.bat, pit: fline.pit, war: NaN, current: true });
  return rows;
}

export interface PlayerCard {
  player: PublicPlayer;
  team: string;
  /** 1.8.0 (faclock.ts): when he reaches free agency. */
  fa: FaOutlook;
  age: number;
  salary: number;
  status: string;
  career: CareerRow[];
  /** First-team career totals (this season included) and seasons played. */
  totals: { bat: BatTotals | null; pit: PitTotals | null; war: number; seasons: number };
  highs: { label: string; value: string; year: number }[];
  /** Platoon splits: this season and career (first team). */
  splits: { season: Splits | null; career: Splits | null };
  velocity: { top: number; average: number } | null;
  pitches: ReturnType<typeof pitchGrades>;
  /** 2.0.6: each pitch's potential grade, and the grades of his pitches a season ago ("FB" the fastball). */
  pitchesFuture: Record<string, number>;
  pitchLast: { season: number; grades: Record<string, number> } | null;
  /** 1.9.3: his main fastball. */
  fastball: FastballType | null;
  tracking: import('./tracking').Tracking | null;
  /** 2.0.3 (fielding.ts): a hitter's fielding in parts as the scouts see it, his sprint speed and a catcher's pop time,
      and his fielding by season and in all with the runs and defensive WAR they make. */
  fielding: {
    parts: FieldingRatings;
    sprint: number;
    pop: number | null;
    seasons: { year: number; team: string; current: boolean; pos: string; f: FieldTotals; runs: number; dwar: number }[];
    career: { f: FieldTotals; runs: number } | null;
  } | null;
  /** 2.0.3: a pitcher's step from 극단적 땅볼 투수 (−2) to 극단적 뜬공 투수 (2) (pitches.ts pitchingLift). */
  pitchingLift: number | null;
  /** 2.0.1: his tendencies (hitters) and his first-team batted balls by season and in all (battedball.ts). */
  batted: { profile: BattingProfile | null; seasons: { year: number; team: string; current: boolean; rates: NonNullable<ReturnType<typeof battedRates>> }[]; career: ReturnType<typeof battedRates> };
  injuries: InjuryRecord[];
  /** Hitters: grade and first-team games at each position he can play. */
  positions: ReturnType<typeof positionGrades>;
  /** Our coaches' or scouts' read of his hidden side (1.1.0). */
  report: TraitReport | null;
}

const QUALIFY = { pa: 446, outs: 432 };

function careerHighs(rows: CareerRow[], pitcher: boolean) {
  const done = rows.filter((r) => !r.futures);
  const best = <T,>(label: string, pick: (r: CareerRow) => T | null, key: (x: T) => number, text: (x: T) => string, low = false) => {
    let top: { x: T; year: number } | null = null;
    for (const r of done) {
      const x = pick(r);
      if (x == null) continue;
      if (!top || (low ? key(x) < key(top.x) : key(x) > key(top.x))) top = { x, year: r.year };
    }
    return top && key(top.x) > 0 ? { label, value: text(top.x), year: top.year } : null;
  };
  const n = (x: number) => String(x);
  const out = pitcher
    ? [
        best('승', (r) => r.pit?.w ?? null, (x) => x, n),
        best('세이브', (r) => r.pit?.sv ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.9329045a"), (r) => r.pit?.hld ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.3e23c769"), (r) => r.pit?.k ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.639a1f2f"), (r) => r.pit?.outs ?? null, (x) => x, ip),
        best(__i18n_k("league.views.careerHighs.out.d705f9e8"), (r) => (r.pit && !r.current && r.pit.outs >= QUALIFY.outs ? r.pit : null), (x) => era(x), (x) => era(x).toFixed(2), true),
        best('WAR', (r) => (r.current ? null : r.war), (x) => x, (x) => x.toFixed(1)),
      ]
    : [
        best('안타', (r) => r.bat?.h ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.9162d3a3"), (r) => r.bat?.hr ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.fed1c588"), (r) => r.bat?.rbi ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.91e54831"), (r) => r.bat?.sb ?? null, (x) => x, n),
        best(__i18n_k("league.views.careerHighs.out.61a9dad7"), (r) => (r.bat && !r.current && r.bat.pa >= QUALIFY.pa ? r.bat : null), (x) => avg(x), (x) => fmt3(avg(x))),
        best(__i18n_k("league.views.careerHighs.out.76eee4c3"), (r) => (r.bat && !r.current && r.bat.pa >= QUALIFY.pa ? r.bat : null), (x) => ops(x), (x) => fmt3(ops(x))),
        best('WAR', (r) => (r.current ? null : r.war), (x) => x, (x) => x.toFixed(1)),
      ];
  return out.filter((x): x is NonNullable<typeof x> => !!x);
}

/** 2.0.30: the seasons gone by keep their situations on the player (`situ`), not on each season's record. */
function withSituations(splits: Splits | null, past: Record<string, number[]> | undefined): Splits | null {
  if (!past) return splits;
  const out: Splits = splits ?? { L: emptySplit(), R: emptySplit() };
  addSituations((out.X ??= {}), past);
  return out;
}

function sumSplits(list: (Splits | undefined)[]): Splits | null {
  const have = list.filter((x): x is Splits => !!x);
  if (!have.length) return null;
  const out: Splits = { L: emptySplit(), R: emptySplit() };
  for (const x of have) {
    addInto(out.L, x.L);
    addInto(out.R, x.R);
    if (x.S) addInto((out.S ??= emptySplit()), x.S);
    if (x.X) addSituations((out.X ??= {}), x.X);
  }
  return out;
}

export function playerCard(s: LeagueState, id: PlayerId): PlayerCard | null {
  const p = s.players[id];
  if (!p) return null;
  const status = p.status === 'military' ? __i18n_k("league.views.playerCard.status.78371556", { value: p.service.route === 'sangmu' ? __i18n_k("league.views.playerCard.status.d2a2ca0f") : p.service.route === 'social' ? __i18n_k("league.views.playerCard.status.f695b002") : __i18n_k("league.views.playerCard.status.519e09aa"), returnsOn: p.service.returnsOn }) : s.injuries[id] ? __i18n_k("league.views.playerCard.status.a3f7a2cf", { value: s.injuries[id]!.dtd ? __i18n_k("league.views.playerCard.status.7d657386") : __i18n_k("league.views.playerCard.status.501fb802"), injuryNote: injuryNote(s.injuries[id]) }) : p.status === 'retired' ? (alumnusJob(s, id) ? __i18n_k("league.views.playerCard.status.cfce3615", { alumnusJob: alumnusJob(s, id) }) : __i18n_k("league.views.playerCard.status.5b170d3c")) : p.status === 'overseas' ? __i18n_k("league.views.playerCard.status.fff34f4d") : p.status === 'freeAgent' ? __i18n_k("league.views.playerCard.status.d6b19ba5") : '';
  const career = careerView(s, p);
  const pitcher = isPitcher(p);
  const major = career.filter((r) => !r.futures);
  const bat = major.some((r) => r.bat) ? emptyBat() : null,
    pit = major.some((r) => r.pit) ? emptyPit() : null;
  for (const r of major) {
    if (bat && r.bat) addInto(bat, r.bat);
    if (pit && r.pit) addInto(pit, r.pit);
  }
  const side = (r: { bat: BatTotals | null; pit: PitTotals | null }) => (pitcher ? r.pit?.split : r.bat?.split);
  const line = s.lines[id];
  const top = topVelocity(p);
  return {
    player: publicView(p),
    team: teamOf(s, p.teamId)?.name ?? '-',
    fa: faOutlook(s, p),
    age: ageIn(p, s.year),
    salary: salaryIn(p, s.year),
    status,
    career,
    totals: { bat, pit, war: Math.round(major.filter((r) => !r.current).reduce((a, r) => a + r.war, 0) * 10) / 10, seasons: new Set(major.map((r) => r.year)).size },
    highs: careerHighs(career, pitcher),
    splits: { season: line ? (side(line) ?? null) : null, career: withSituations(sumSplits(major.map(side)), p.situ?.[pitcher ? 'pit' : 'bat']) },
    velocity: top == null ? null : { top, average: averageVelocity(p)! },
    pitches: pitchGrades(p),
    // 2.0.6 (the user's request): each pitch's potential and its change since last season.
    pitchesFuture: Object.fromEntries(pitchGrades(p, true).map((x) => [x.type, x.grade])),
    pitchLast: p.pitchLast ?? null,
    fastball: pitcher ? fastballOf(p) : null,
    // 2.0.0: his arm slot and what a tracking system reads off his pitches (tracking.ts).
    tracking: pitcher ? trackingOf(p) : null,
    batted: battedView(p, major, pitcher),
    fielding: pitcher ? null : fieldingView(p, major),
    pitchingLift: pitcher ? pitchingLift(p) : null,
    injuries: [...(p.injuries ?? [])].reverse(),
    positions: positionGrades(s, p),
    report: traitReport(s, p),
  };
}

export const rates = { avg, obp, slg, ops, era, ip, fmt3, whip, fip, babip, babipAllowed, wrcPlus, per9, woba, eraMinus, fipMinus };

/** League totals of the season being played (first team). */
export function seasonTotals(s: LeagueState) {
  const bat = emptyBat(),
    pit = emptyPit();
  for (const line of Object.values(s.lines)) {
    if (line.bat) addInto(bat, line.bat);
    if (line.pit) addInto(pit, line.pit);
  }
  return { bat, pit };
}

/** FIP and wRC+ constants for a season: this season's running totals, or a finished season's. */
export function rateContextFor(s: LeagueState, year: number): RateContext | null {
  const h = s.history.find((x) => x.year === year);
  if (h) return rateContext(h.totals.bat, h.totals.pit);
  if (year !== s.year) return null;
  const t = seasonTotals(s);
  return t.bat.pa ? rateContext(t.bat, t.pit) : null;
}

/** Every first-team player's line this season with detailed stats, for the sortable record table. */
export function seasonStats(s: LeagueState) {
  const t = seasonTotals(s);
  const rc = rateContext(t.bat, t.pit);
  const lg = leagueContext(t.bat, t.pit);
  const teamGames = Math.max(1, ...standingsView(s).map((r) => r.games));
  const batters = [],
    pitchers = [];
  for (const [id, line] of Object.entries(s.lines)) {
    const p = s.players[id];
    if (!p) continue;
    const base = { id, name: p.name, team: shortName(s, line.teamId), pos: positionLabel(p), age: ageIn(p, s.year) };
    const b = line.bat;
    if (b && b.pa > 0 && !isPitcher(p))
      batters.push({
        ...base,
        g: b.g, pa: b.pa, avg: avg(b), obp: obp(b), slg: slg(b), ops: ops(b), hr: b.hr, rbi: b.rbi, r: b.r, sb: b.sb, bb: b.bb, k: b.k,
        babip: babip(b), wrc: wrcPlus(b, rc, playerPark(s, line.teamId, s.year)), war: batterWar(b, p.position ?? 'DH', lg), qualified: b.pa >= teamGames * 3.1,
        // 2.0.4: the detail tab's numbers (savant.ts).
        x: batDetail(b, p.position ?? 'DH'),
      });
    const q = line.pit;
    if (q && q.g > 0)
      pitchers.push({
        ...base,
        g: q.g, gs: q.gs, w: q.w, l: q.l, sv: q.sv, hld: q.hld, outs: q.outs, era: era(q), whip: whip(q), fip: fip(q, rc), k: q.k, bb: q.bb,
        // 2.0.15: park-adjusted, 100 = average.
        eraMinus: eraMinus(q, rc, playerPark(s, line.teamId, s.year)), fipMinus: fipMinus(q, rc, playerPark(s, line.teamId, s.year)),
        k9: per9(q.k, q.outs), bb9: per9(q.bb, q.outs), babip: babipAllowed(q), war: pitcherWar(q, lg), qualified: q.outs >= teamGames * 3,
        x: pitDetail(q),
      });
  }
  return { batters, pitchers, qualifying: { pa: Math.ceil(teamGames * 3.1), innings: teamGames } };
}

// ── Box scores (V0.7) ─────────────────────────────────────────────────────────────────────────────

const POS_KO: Record<string, string> = { C: __i18n_k("league.views.pOS_KO.c.c6113c0f"), '1B': '1', '2B': '2', '3B': '3', SS: __i18n_k("league.views.pOS_KO.sS.71c706d6"), LF: '좌', CF: __i18n_k("league.views.pOS_KO.cF.43e88c0b"), RF: '우', DH: __i18n_k("league.views.pOS_KO.dH.0cb41994") };

/** 1.7.0: how a substitute came in. */
const SUB_KO: Record<string, string> = { PH: __i18n_k("league.views.text.4fe00bd7"), PR: __i18n_k("league.views.text.ac615d38"), DEF: __i18n_k("league.views.text.46160651") };

export function boxView(s: LeagueState, id: string) {
  // 2.0.16: or a national team's game (kept on its event); 2.0.30: or a spring game.
  const b = s.boxes?.[id] ?? nationalBox(s, id) ?? exhibitionBox(s, id);
  if (!b) return null;
  const name = (pid: string) => s.players[pid]?.name ?? nationalName(s, pid) ?? '?';
  const side = (i: 0 | 1) => {
    const teamId = i === 0 ? b.away : b.home;
    const nation = teamOf(s, teamId) ? undefined : nationalTeamName(s, teamId);
    return {
      teamId,
      name: teamOf(s, teamId)?.name ?? nation ?? (teamId === 'dream' ? __i18n_k("league.views.side.name.58e7ade7") : teamId === 'nanum' ? __i18n_k("league.views.side.name.6f46ad29") : teamId),
      short: nation ?? shortName(s, teamId),
      color: teamOf(s, teamId)?.color ?? (teamId === 'KOR' ? '#0f3b8c' : teamId === 'dream' ? '#2563eb' : teamId === 'nanum' ? '#dc2626' : '#888'),
      line: b.line[i],
      rhe: b.rhe[i],
      bat: (() => {
        // 1.7.0: substitutes ("PH:SS") bat in the slot of the man before them.
        let slot = 0;
        return b.bat[i].map(([pid, pos, ab, r, h, rbi, hr, bb, k, d, t, sb]) => {
          const [how, at] = pos.includes(':') ? (pos.split(':') as [string, string]) : [null, pos];
          if (!how) slot++;
          const posText = POS_KO[at] ?? at;
          return { id: pid, order: how ? null : slot, name: name(pid), pos: how ? `${SUB_KO[how] ?? how}${at === 'DH' && how === 'PH' ? '' : ` → ${posText}`}` : posText, sub: !!how, ab, r, h, rbi, hr, bb, k, d, t, sb };
        });
      })(),
      pit: b.pit[i].map(([pid, outs, h, r, er, bb, k, hr, pitches, dec]) => ({ id: pid, name: name(pid), ip: ip(outs), h, r, er, bb, k, hr, pitches, dec: ({ W: '승', L: '패', S: __i18n_k("league.views.dec.s.c5e4d00d"), H: __i18n_k("league.views.dec.h.10a4423a") } as Record<string, string>)[dec] ?? '' })),
    };
  };
  const log = s.pbp?.[id] ?? nationalLog(s, id);
  const plays = log?.map((ev, n) => ({ ev, text: playText(ev, `${id}-${n}`, name), half: halfLabel(ev.i, ev.top) }));
  return { id, date: b.date, innings: b.innings, att: b.att, away: side(0), home: side(1), plays: plays ?? null };
}

/** Games you can open: the user's this season, then the league's latest days (newest first). */
export function gameList(s: LeagueState) {
  const boxes = Object.values(s.boxes ?? {}).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const u = s.user?.teamId;
  const row = (b: (typeof boxes)[number]) => {
    const mine = u && (b.home === u || b.away === u);
    const us = b.home === u ? 1 : 0;
    const result = mine ? (b.rhe[us][0] > b.rhe[1 - us]![0] ? '승' : b.rhe[us][0] < b.rhe[1 - us]![0] ? '패' : __i18n_k("league.views.row.result.56c5af5b")) : '';
    return { id: b.id, date: b.date, away: shortName(s, b.away), home: shortName(s, b.home), as: b.rhe[0][0], hs: b.rhe[1][0], att: b.att, result, pbp: !!s.pbp?.[b.id], post: /-(wildcard|semipo|po|ks)-/.test(b.id) };
  };
  return {
    mine: u ? boxes.filter((b) => b.home === u || b.away === u).map(row) : [],
    recent: boxes.filter((b) => !u || (b.home !== u && b.away !== u)).map(row),
  };
}

/** 2.0.30: this spring's table (as the standings screen shows a table) and leaders, once a game has been played. */
export function exhibitionView(s: LeagueState) {
  const ex = s.exhibition;
  if (!ex || ex.year !== s.year || !ex.scores.length) return null;
  const rows = exhibitionTable(s).map((r) => ({ ...r, name: teamOf(s, r.teamId)?.name ?? r.teamId, short: shortName(s, r.teamId), color: teamOf(s, r.teamId)?.color ?? '#888', games: r.w + r.l + r.t, crowd: 0 }));
  const leaders = exhibitionLeaders(s, 3);
  const pick = (xs: typeof leaders.avg) => xs.map((x) => ({ ...x, club: shortName(s, x.teamId) }));
  return { year: ex.year, played: ex.scores.length, total: ex.games.length, done: !!ex.done, rows, avg: pick(leaders.avg), hr: pick(leaders.hr.filter((x) => x.value > 0)), era: pick(leaders.era) };
}

/** 2.0.30: this spring's games for the games screen, newest first (ours marked with the result). */
export function exhibitionGames(s: LeagueState) {
  const ex = s.exhibition;
  if (!ex || ex.year !== s.year) return [];
  const u = s.user?.teamId;
  return [...ex.scores]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .map((g) => {
      const mine = !!u && (g.home === u || g.away === u);
      const us = g.home === u ? g.hs : g.as,
        them = g.home === u ? g.as : g.hs;
      return { id: g.id, date: g.date, away: shortName(s, g.away), home: shortName(s, g.home), as: g.as, hs: g.hs, mine, pbp: !!s.pbp?.[g.id], result: mine ? (us > them ? '승' : us < them ? '패' : __i18n_k("league.views.row.result.56c5af5b")) : '' };
    });
}

/** 2.0.30 (the user's request): a draft prospect pitcher's pitches as his page shows them — his fastball, then the
    others with the scouts' grades now and later and how often he throws each. */
export function prospectPitches(p: Player) {
  if (p.role !== 'SP' && p.role !== 'RP') return null;
  const fb = fastballOf(p);
  const now = pitchGrades(p);
  const later = Object.fromEntries(pitchGrades(p, true).map((x) => [x.type, x.grade]));
  return {
    fastball: { type: fb, name: FASTBALL_LABELS[fb], usage: 1 - now.reduce((a, x) => a + x.usage, 0) },
    list: now.map((x) => ({ type: x.type, name: x.label, grade: x.grade, future: later[x.type], usage: x.usage })),
  };
}

// ── Lineup at a glance (V0.7) ─────────────────────────────────────────────────────────────────────

/** A pitcher's public grades for the lineup screen. */
const armGrades = (p: Player) => ({
  grade: p.scouting.current,
  tools: { stuff: p.scouting.tools.stuff ?? 0, command: p.scouting.tools.command ?? 0, breaking: p.scouting.tools.breaking ?? 0, stamina: p.scouting.tools.stamina ?? 0 },
  velocity: topVelocity(p),
});

/** Today's plan: the manager's lineup against a right- or left-handed starter, the rotation and the bullpen. */
/** "옆구리 근육 손상 · 5/20 복귀" (an old save's injury has no name). */
export function injuryNote(i: LeagueState['injuries'][string] | undefined): string {
  if (!i) return '';
  const back = __i18n_k("league.views.injuryNote.back.3b02c2ad", { number: Number(i.until.slice(5, 7)), number2: Number(i.until.slice(8, 10)), value: i.dtd ? '' : __i18n_k("league.views.injuryNote.back.3830a42c") });
  return [i.part, i.surgery ? __i18n_k("league.views.injuryNote.98a2b68d") : '', back].filter(Boolean).join(' · ');
}

export function lineupView(s: LeagueState, teamId: TeamId, vs: 'L' | 'R') {
  const r = s.rosters[teamId];
  if (!r) return null;
  const active = r.active;
  const player = (id: PlayerId) => s.players[id]!;
  const line = (id: PlayerId) => s.lines[id];
  // The manager's usual lineup (his style sets the order), and who sits out the club's next game.
  const { style, prefer } = managerLean(s, teamId);
  // The user's club: the general manager's fixed spots (V0.8).
  const card = cardFor(s, { teamId });
  const withCard = card ? { card: card[vs], places: card.places?.[vs], cardRest: card.rest } : {};
  const usual = lineupFor(s, active, prefer, false, vs, { style, ...withCard });
  const next = s.phase === 'regular' ? s.schedule.slice(s.next).find((g) => g.home === teamId || g.away === teamId) : undefined;
  const nextIds = next ? new Set(lineupFor(s, active, prefer, false, vs, { style, date: next.date, ...withCard }).map((b) => b.id)) : null;
  const resting = nextIds ? usual.filter((b) => !nextIds.has(b.id)).map((b) => ({ id: b.id, name: player(b.id).name, pos: b.pos, date: next!.date })) : [];
  const lineup = usual.map((b, i) => {
    const p = player(b.id);
    const bat = line(b.id)?.bat;
    const tl = p.scouting.tools;
    return {
      id: b.id,
      order: i + 1,
      pos: b.pos,
      fixed: card?.[vs][i]?.id === b.id || !!card?.places?.[vs].some((x) => x.id === b.id),
      name: p.name,
      number: p.numberTeam === teamId ? p.number : undefined,
      bats: p.bats,
      avg: bat?.ab ? avg(bat) : null,
      ops: bat?.pa ? ops(bat) : null,
      hr: bat?.hr ?? 0,
      grade: p.scouting.current,
      tools: { contact: tl.contact ?? 0, power: tl.power ?? 0, eye: tl.eye ?? 0, speed: tl.speed ?? 0, defense: tl.defense ?? 0 },
    };
  });
  const rotation = rotationFor(s, active, prefer, card?.rotation);
  const nextUp = s.rotation[teamId] ?? 0;
  const starters = rotation.map((p, i) => {
    const pit = line(p.id)?.pit;
    return { id: p.id, name: p.name, throws: p.throws, next: i === nextUp % Math.max(1, rotation.length), mine: !!card?.rotation.includes(p.id), era: pit?.outs ? era(pit) : null, w: pit?.w ?? 0, l: pit?.l ?? 0, ...armGrades(p) };
  });
  const inRotation = new Set(rotation.map((p) => p.id));
  const pen = active.map(player).filter((p) => isPitcher(p) && !inRotation.has(p.id));
  const roles = penRoles(s, teamId, pen);
  const order = ['CL', 'SU', 'HL', 'LO', 'LR', 'MU'];
  const bullpen = pen
    .map((p) => {
      const pit = line(p.id)?.pit;
      return { id: p.id, name: p.name, throws: p.throws, role: PEN_ROLE_LABELS[roles[p.id] ?? 'MU'], rank: order.indexOf(roles[p.id] ?? 'MU'), era: pit?.outs ? era(pit) : null, sv: pit?.sv ?? 0, hld: pit?.hld ?? 0, ...armGrades(p) };
    })
    .sort((a, b) => a.rank - b.rank);
  const starting = new Set(lineup.map((b) => b.id));
  const bench = active
    .map(player)
    .filter((p) => !isPitcher(p) && !starting.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, pos: positionLabel(p), bats: p.bats, injured: !!s.injuries[p.id], grade: p.scouting.current }));
  return { lineup, starters, bullpen, bench, resting, style };
}

// ── Record room and awards (V0.7) ─────────────────────────────────────────────────────────────────

type RecordRow = { id: PlayerId; name: string; team: string; year?: number; value: string; key: number };

/** The records room: single-season and career leaders; with `teamId` (2.0.5), a club's own — its seasons only, a
    career counting what he did for it — and its career average and ERA leaders. */
export function recordRoom(s: LeagueState, teamId?: TeamId) {
  const seasons: { p: Player; c: SeasonRecord }[] = [];
  for (const p of Object.values(s.players)) for (const c of p.career) if (!c.level && (!teamId || c.teamId === teamId)) seasons.push({ p, c });
  const top = (rows: RecordRow[], n: number, low = false) => rows.sort((a, b) => (low ? a.key - b.key : b.key - a.key)).slice(0, n);
  const season = (label: string, pick: (c: SeasonRecord, p: Player) => number | null, show: (v: number) => string, low = false) => ({
    label,
    rows: top(
      seasons.flatMap(({ p, c }) => {
        const v = pick(c, p);
        return v == null || (!low && v <= 0) ? [] : [{ id: p.id, name: p.name, team: shortName(s, c.teamId), year: c.year, value: show(v), key: v }];
      }),
      5,
      low,
    ),
  });
  const totals = new Map<PlayerId, { p: Player; bat: BatTotals; pit: PitTotals; war: number; last: TeamId }>();
  for (const { p, c } of seasons) {
    const t = totals.get(p.id) ?? { p, bat: emptyBat(), pit: emptyPit(), war: 0, last: c.teamId };
    if (c.bat) addInto(t.bat, c.bat);
    if (c.pit) addInto(t.pit, c.pit);
    t.war += c.war;
    t.last = c.teamId;
    totals.set(p.id, t);
  }
  // A pick of null leaves him off (short of a rate's bar); `low`: the smallest first.
  const career = (label: string, pick: (t: { bat: BatTotals; pit: PitTotals; war: number }) => number | null, show: (v: number) => string, low = false) => ({
    label,
    rows: top(
      [...totals.values()].flatMap((t) => {
        const v = pick(t);
        return v == null || (!low && v <= 0) ? [] : [{ id: t.p.id, name: t.p.name, team: shortName(s, t.last), value: show(v), key: v }];
      }),
      10,
      low,
    ),
  });
  const n = (v: number) => String(v);
  return {
    season: [
      season(__i18n_k("league.views.recordRoom.season.9162d3a3"), (c) => c.bat?.hr ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.fed1c588"), (c) => c.bat?.rbi ?? null, n),
      season('안타', (c) => c.bat?.h ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.91e54831"), (c) => c.bat?.sb ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.61a9dad7"), (c) => (c.bat && c.bat.pa >= 446 ? avg(c.bat) : null), fmt3),
      season('승', (c) => c.pit?.w ?? null, (v) => __i18n_k("league.views.recordRoom.season.00775c28", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.3e23c769"), (c) => c.pit?.k ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.9e0e4373"), (c) => (c.pit && c.pit.outs >= 432 ? era(c.pit) : null), (v) => v.toFixed(2), true),
      season('세이브', (c) => c.pit?.sv ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season(__i18n_k("league.views.recordRoom.season.9329045a"), (c) => c.pit?.hld ?? null, (v) => __i18n_k("league.views.recordRoom.season.6bef80d8", { v: v })),
      season('WAR', (c) => c.war, (v) => v.toFixed(1)),
    ],
    career: [
      career(__i18n_k("league.views.recordRoom.career.9162d3a3"), (t) => t.bat.hr, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career('안타', (t) => t.bat.h, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career(__i18n_k("league.views.recordRoom.career.fed1c588"), (t) => t.bat.rbi, n),
      career(__i18n_k("league.views.recordRoom.career.91e54831"), (t) => t.bat.sb, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career('승', (t) => t.pit.w, (v) => __i18n_k("league.views.recordRoom.career.00775c28", { v: v })),
      career(__i18n_k("league.views.recordRoom.career.3e23c769"), (t) => t.pit.k, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career('세이브', (t) => t.pit.sv, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career(__i18n_k("league.views.recordRoom.career.9329045a"), (t) => t.pit.hld, (v) => __i18n_k("league.views.recordRoom.career.6bef80d8", { v: v })),
      career('WAR', (t) => Math.round(t.war * 10) / 10, (v) => v.toFixed(1)),
      ...(teamId
        ? [
            // 2.0.5: rates over a long stay (2,000 plate appearances, 500 innings).
            career(__i18n_k("league.views.text.05617cd3"), (t) => (t.bat.pa >= 2000 ? avg(t.bat) : null), fmt3),
            career(__i18n_k("league.views.text.f0630841"), (t) => (t.pit.outs >= 1500 ? era(t.pit) : null), (v) => v.toFixed(2), true),
          ]
        : []),
    ],
  };
}

/** Every season's awards with names and clubs. */
export function awardsView(s: LeagueState) {
  const who = (id: PlayerId | null, year: number) => {
    if (!id) return null;
    const p = s.players[id];
    const c = p?.career.find((x) => x.year === year && !x.level);
    return { id, name: p?.name ?? '?', team: c ? shortName(s, c.teamId) : '' };
  };
  return [...s.history]
    .reverse()
    .filter((h) => h.awards)
    .map((h) => ({
      year: h.year,
      mvp: who(h.awards!.mvp, h.year),
      rookie: who(h.awards!.rookie, h.year),
      gg: h.awards!.goldenGloves.map((g) => ({ pos: g.pos, ...who(g.id, h.year)! })),
      defense: (h.awards!.defense ?? []).map((g) => ({ pos: g.pos, ...who(g.id, h.year)! })),
      titles: h.awards!.titles.map((t) => ({ label: t.label, value: t.value, ...who(t.id, h.year)! })),
    }));
}

// ── Clubhouse (V0.7) ──────────────────────────────────────────────────────────────────────────────

/** The clubhouse mood: recent results, the streak, leaders and mood-makers, injuries (display only). */
export function clubhouse(s: LeagueState, teamId: TeamId) {
  const games = s.scores.filter((g) => g.home === teamId || g.away === teamId).slice(-10);
  const res = games.map((g) => {
    const mine = g.home === teamId ? g.hs : g.as,
      theirs = g.home === teamId ? g.as : g.hs;
    return mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
  });
  const w = res.filter((x) => x === 'W').length,
    l = res.filter((x) => x === 'L').length;
  let streak = 0;
  const lastRes = res.at(-1);
  for (let i = res.length - 1; i >= 0 && res[i] === lastRes; i--) streak++;
  const roster = s.rosters[teamId]?.active.map((id) => s.players[id]!) ?? [];
  // Seniors with a leader's voice (1.1.0: 리더십, whatever the personality's label).
  const leaders = roster.filter((p) => traitsOf(p).leadership >= LEADER && ageIn(p, s.year) >= 28).length;
  const makers = roster.filter((p) => p.personality === '밝은 분위기 메이커').length;
  const hurt = Object.entries(s.injuries).filter(([id, i]) => !i.dtd && s.players[id]?.teamId === teamId).length;
  // 1.7.0: our captaincy (captains.ts).
  const cap = teamId === s.user?.teamId ? captaincyLift(s) : null;
  const score = (w + l ? (w / (w + l) - 0.5) * 2 : 0) + leaders * 0.08 + makers * 0.05 - hurt * 0.03 + (lastRes === 'W' ? 0.03 : lastRes === 'L' ? -0.03 : 0) * Math.min(streak, 6) + (cap?.lift ?? 0);
  const label = score >= 0.5 ? __i18n_k("league.views.clubhouse.label.a5d2fc54") : score >= 0.2 ? __i18n_k("league.views.clubhouse.label.5cd0d95b") : score > -0.2 ? __i18n_k("league.views.clubhouse.label.681592dc") : score > -0.5 ? __i18n_k("league.views.clubhouse.label.d6a40ea2") : __i18n_k("league.views.clubhouse.label.fef32446");
  const notes = [
    games.length ? __i18n_k("league.views.clubhouse.notes.0444399b", { w: w, l: l }) : __i18n_k("league.views.clubhouse.notes.74496d87"),
    streak >= 3 && lastRes !== 'T' ? __i18n_k("league.views.clubhouse.notes.6cd747c6", { streak: streak, value: lastRes === 'W' ? '승' : '패' }) : '',
    leaders ? __i18n_k("league.views.clubhouse.notes.9daf8a74", { leaders: leaders }) : __i18n_k("league.views.clubhouse.notes.acbbe47c"),
    makers ? __i18n_k("league.views.clubhouse.notes.0ca3f9fb", { makers: makers }) : '',
    hurt ? __i18n_k("league.views.clubhouse.notes.8b617938", { hurt: hurt }) : '',
    cap?.note ?? '',
  ].filter(Boolean);
  return { label, score, notes, form: res };
}

/**
 * A player's numbers at a glance (0.10.1, the free-agent list and the player search): this season so far once he
 * has played, else his last first-team season. Pitchers: ERA, innings and wins or saves/holds; hitters: average,
 * home runs and OPS.
 */
export function statLine(s: LeagueState, p: Player): { year: number; text: string; war: number | null } | null {
  const now = s.phase === 'regular' ? s.lines[p.id] : undefined;
  const nowUsed = now && (isPitcher(p) ? (now.pit?.outs ?? 0) > 0 : (now.bat?.pa ?? 0) > 0);
  const rec = nowUsed ? null : p.career.filter((c) => !c.level && (isPitcher(p) ? c.pit?.outs : c.bat?.pa)).at(-1);
  const bat = nowUsed ? now!.bat : rec?.bat;
  const pit = nowUsed ? now!.pit : rec?.pit;
  const year = nowUsed ? s.year : rec?.year;
  if (year == null) return null;
  if (isPitcher(p) && pit?.outs) {
    const pen = pit.sv + pit.hld >= 5 ? __i18n_k("league.views.statLine.pen.d10097ff", { sv: pit.sv, hld: pit.hld }) : __i18n_k("league.views.statLine.pen.4d31cd6a", { w: pit.w, l: pit.l });
    return { year, text: __i18n_k("league.views.statLine.text.d666ca12", { value: era(pit).toFixed(2), ip: ip(pit.outs), pen: pen }), war: rec?.war ?? null };
  }
  if (bat?.pa) return { year, text: __i18n_k("league.views.statLine.text.ff11568e", { fmt3: fmt3(avg(bat)), hr: bat.hr, fmt32: fmt3(ops(bat)) }), war: rec?.war ?? null };
  return null;
}
