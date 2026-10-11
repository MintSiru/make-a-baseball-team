import { k as __i18n_k } from '../i18n/index';
/* The All-Star game (1.2.0, from the 1.0 feedback), the KBO's way (RULES.md §9, game assumptions on the dates).

   Two sides: 드림 올스타 (the clubs of SSG, 롯데, 삼성, 두산, KT) and 나눔 올스타 (LG, NC, KIA, 키움, 한화); a new club
   joins the smaller side (the eleventh 나눔, the twelfth 드림), and with two leagues the leagues are the sides.

   Every club puts up one candidate a spot — starting pitcher, middle reliever, closer, catcher, the four infield
   spots, three outfielders and a designated hitter — and the voting runs from early June to early July: the fans'
   ballots count 70%, the players' 30% (each as a share of the spot's votes). The fans vote for players who play
   well, whom they love and who play for clubs with many fans; the players vote on how well he plays. A tally comes
   out each week, and the twelve with the most at each spot on each side (three outfielders) are the 베스트12. The
   managers then add twelve more to each side from the best of the rest, so every club sends at least two.

   The game is played in the All-Star break at a ballpark that changes every year, the 홈런 레이스 the day before.
   Nothing counts: no records, no rest days, no injuries. The best player on the winning side is 미스터 올스타. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { compactBox, keepBox } from './boxscore';
import { simulateGame } from './engine/game';
import type { PitcherIn, PlayEvent, RelieverIn, TeamIn } from './engine/types';
import { clubState } from './fans';
import { eunneun, iga, ro } from './josa';
import { fanAffinity } from './life';
import { armIn, lineupFor, penRoles } from './manager';
import { addNews } from './news';
import { heroInterview } from './interviews';
import { isPitcher } from './players';
import { addInto, emptyBat, emptyPit, firstTeamIds, type LeagueState } from './state';
import { batterWar, leagueContext, pitcherWar } from './stats';
import { sideOf, twoLeagues } from './twelve';
import { ALL_STAR as A } from './tuning';

export type AllStarSide = 'dream' | 'nanum';
export const SIDES: AllStarSide[] = ['dream', 'nanum'];
export const SIDE_LABEL: Record<AllStarSide, string> = { dream: __i18n_k("league.allstar.sIDE_LABEL.dream.58e7ade7"), nanum: __i18n_k("league.allstar.sIDE_LABEL.nanum.6f46ad29") };
const DREAM = new Set(['ssg', 'lotte', 'samsung', 'doosan', 'kt']);

export type Spot = 'SP' | 'RP' | 'CL' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'OF' | 'DH';
export const SPOTS: Spot[] = ['SP', 'RP', 'CL', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
export const SPOT_LABEL: Record<Spot, string> = { SP: __i18n_k("league.allstar.sPOT_LABEL.sP.cd036b1a"), RP: __i18n_k("league.allstar.sPOT_LABEL.rP.b99cb270"), CL: __i18n_k("league.allstar.sPOT_LABEL.cL.b7ea46c0"), C: __i18n_k("league.allstar.sPOT_LABEL.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.allstar.sPOT_LABEL.sS.3e24c7f1"), OF: __i18n_k("league.allstar.sPOT_LABEL.oF.7435120b"), DH: __i18n_k("league.allstar.sPOT_LABEL.dH.8eba4676") };
/** Places at a spot on each side. */
export const SEATS: Record<Spot, number> = { SP: 1, RP: 1, CL: 1, C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, DH: 1 };

export interface AllStarCandidate {
  id: PlayerId;
  teamId: TeamId;
  side: AllStarSide;
  spot: Spot;
  /** Ballots so far. */
  fans: number;
  players: number;
}

export interface AllStarGame {
  boxId: string;
  date: string;
  host: TeamId;
  runs: Record<AllStarSide, number>;
  mvp: PlayerId | null;
  derby: { date: string; winner: PlayerId; rounds: { id: PlayerId; first: number; final?: number }[] };
}

export interface AllStarState {
  year: number;
  sides: Record<TeamId, AllStarSide>;
  candidates: AllStarCandidate[];
  /** The day the ballots were last counted, and the tallies published. */
  counted: string;
  tallies: string[];
  /** Our club ran a voting drive (its candidates draw more fan ballots from then on). */
  campaign?: boolean;
  /** The 베스트12 and the full squads. */
  elected?: PlayerId[];
  squads?: Record<AllStarSide, PlayerId[]>;
  game?: AllStarGame;
}

/** A finished year, kept for the history tab. */
export interface AllStarRecord {
  year: number;
  runs: Record<AllStarSide, number>;
  mvp: PlayerId | null;
  derby: PlayerId | null;
  host: TeamId;
  elected: PlayerId[];
}

const day = (year: number, md: string) => `${year}-${md}`;
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const name = (s: LeagueState, id: PlayerId) => s.players[id]?.name ?? '?';
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
/** The particle alone (이/가, 은/는) for the word. */
const particle = (word: string, f: (w: string) => string) => f(word).slice(word.length);
const names = (s: LeagueState, ids: PlayerId[]) => ids.map((id) => name(s, id)).join('·');

/** Which side each first-team club plays for this year. */
export function allStarSides(s: LeagueState): Record<TeamId, AllStarSide> {
  const ids = firstTeamIds(s);
  if (twoLeagues(s)) return Object.fromEntries(ids.map((id) => [id, sideOf(s, id) === 'dream' ? 'dream' : 'nanum']));
  const out: Record<TeamId, AllStarSide> = {};
  for (const id of ids) if (s.teams.find((t) => t.id === id)?.kind === 'existing') out[id] = DREAM.has(id) ? 'dream' : 'nanum';
  // New clubs: each to the side with fewer clubs (the 나눔 side first).
  for (const id of ids.filter((x) => !(x in out))) {
    const n = (side: AllStarSide) => Object.values(out).filter((x) => x === side).length;
    out[id] = n('nanum') <= n('dream') ? 'nanum' : 'dream';
  }
  return out;
}

// ── How good, how loved ──────────────────────────────────────────────────────────────────────────

/** This season's first-team value so far (WAR), from the lines. */
function seasonValue(s: LeagueState) {
  const bat = emptyBat(),
    pit = emptyPit();
  for (const l of Object.values(s.lines)) {
    if (l.bat) addInto(bat, l.bat);
    if (l.pit) addInto(pit, l.pit);
  }
  const lg = leagueContext(bat, pit);
  return (p: Player): number => {
    const l = s.lines[p.id];
    if (!l) return 0;
    if (isPitcher(p)) return l.pit ? pitcherWar(l.pit, lg) + (l.pit.sv + l.pit.hld * 0.5) * 0.03 : 0;
    return l.bat ? batterWar(l.bat, (p.position ?? 'DH') as never, lg) : 0;
  };
}

/** Each club's candidates: one a spot (three outfielders), from its first team and who has played. */
function nominate(s: LeagueState, sides: Record<TeamId, AllStarSide>): AllStarCandidate[] {
  const value = seasonValue(s);
  const out: AllStarCandidate[] = [];
  for (const [teamId, side] of Object.entries(sides)) {
    const roster = (s.rosters[teamId]?.active ?? []).map((id) => s.players[id]!).filter((p) => p.status === 'active');
    const used = new Set<PlayerId>();
    const best = (xs: Player[], n = 1) =>
      xs
        .filter((p) => !used.has(p.id))
        .sort((a, b) => value(b) + b.scouting.current / 40 - (value(a) + a.scouting.current / 40))
        .slice(0, n);
    const add = (spot: Spot, xs: Player[]) => {
      for (const p of xs) {
        used.add(p.id);
        out.push({ id: p.id, teamId, side, spot, fans: 0, players: 0 });
      }
    };
    const pitchers = roster.filter(isPitcher);
    const relievers = pitchers.filter((p) => p.role === 'RP');
    const roles = penRoles(s, teamId, relievers);
    add('SP', best(pitchers.filter((p) => p.role === 'SP')));
    add('CL', best(relievers.filter((p) => roles[p.id] === 'CL')).concat(relievers.some((p) => roles[p.id] === 'CL') ? [] : best(relievers)));
    add('RP', best(relievers));
    const hitters = roster.filter((p) => !isPitcher(p));
    for (const pos of ['C', '1B', '2B', '3B', 'SS'] as const) add(pos, best(hitters.filter((p) => p.position === pos)));
    add('OF', best(hitters.filter((p) => p.position === 'LF' || p.position === 'CF' || p.position === 'RF'), 3));
    add('DH', best(hitters));
  }
  return out;
}

/** Ballots a day: the fans' and the players'. */
function dailyBallots(s: LeagueState, a: AllStarState, c: AllStarCandidate, value: (p: Player) => number, meanPopularity: number): { fans: number; players: number } {
  const p = s.players[c.id]!;
  const war = Math.max(0, value(p));
  const club = Math.max(0.4, clubState(s, c.teamId).popularity / meanPopularity);
  const loved = fanAffinity(s, p, c.teamId) / 100;
  const star = Math.max(0, p.scouting.current - 45) / 30;
  // Some players simply draw votes (a face, a story); fixed for the year.
  const draw = 0.85 + hashUnit(`${s.seed}|allstar-draw|${s.year}|${c.id}`) * 0.3;
  const fans = A.fanBase * club ** A.clubPower * (A.fan.base + war * A.fan.war + loved * A.fan.loved + star * A.fan.star) * draw * (a.campaign && c.teamId === s.user?.teamId ? 1 + A.campaign.boost : 1);
  const players = A.playerBase * (A.player.base + war * A.player.war + star * A.player.star);
  return { fans, players };
}

/** Counts the ballots cast up to `date`. */
function count(s: LeagueState, a: AllStarState, date: string) {
  const days = Math.max(0, Math.round((Date.parse(date) - Date.parse(a.counted)) / 86400000));
  if (!days) return;
  const value = seasonValue(s);
  const pops = Object.keys(a.sides).map((id) => clubState(s, id).popularity);
  const mean = pops.reduce((x, y) => x + y, 0) / Math.max(1, pops.length);
  for (const c of a.candidates) {
    if (!s.players[c.id]) continue;
    const b = dailyBallots(s, a, c, value, mean);
    c.fans += Math.round(b.fans * days);
    c.players += Math.round(b.players * days);
  }
  a.counted = date;
}

export interface TallyRow extends AllStarCandidate {
  /** 70% of his share of the spot's fan ballots plus 30% of the players'. */
  score: number;
  rank: number;
}

/** The standings at each spot on each side, best first. */
export function tally(a: Pick<AllStarState, 'candidates'>): TallyRow[] {
  const out: TallyRow[] = [];
  for (const side of SIDES)
    for (const spot of SPOTS) {
      const xs = a.candidates.filter((c) => c.side === side && c.spot === spot);
      const fans = xs.reduce((t, c) => t + c.fans, 0) || 1,
        players = xs.reduce((t, c) => t + c.players, 0) || 1;
      const rows = xs
        .map((c) => ({ ...c, score: A.fanShare * (c.fans / fans) + (1 - A.fanShare) * (c.players / players), rank: 0 }))
        .sort((x, y) => y.score - x.score || y.fans - x.fans);
      rows.forEach((r, i) => (r.rank = i + 1));
      out.push(...rows);
    }
  return out;
}

// ── The calendar ─────────────────────────────────────────────────────────────────────────────────

/** A game day of the season: whatever of the All-Star calendar is due. Returns true when it did something. */
export function allStarDay(s: LeagueState, date: string): boolean {
  if (s.phase !== 'regular') return false;
  const year = s.year;
  const open = day(year, A.dates.open);
  if (date < open) return false;
  let a = s.allStar?.year === year ? s.allStar : null;
  if (!a) {
    const sides = allStarSides(s);
    a = s.allStar = { year, sides, candidates: nominate(s, sides), counted: open, tallies: [] };
    openNews(s, a, date);
  }
  let did = false;
  const close = day(year, A.dates.close);
  for (const t of A.dates.tallies.map((md: string) => day(year, md))) {
    if (date < t || a.tallies.includes(t) || t > close) continue;
    count(s, a, t);
    a.tallies.push(t);
    tallyNews(s, a, t);
    did = true;
  }
  if (date >= close && !a.elected) {
    count(s, a, close);
    elect(s, a, close);
    did = true;
  }
  const game = day(year, A.dates.game);
  if (date > game && a.squads && !a.game) {
    playAllStar(s, a, game);
    did = true;
  }
  return did;
}

/** The 베스트12 by the votes, then the managers' picks to fill each side. */
function elect(s: LeagueState, a: AllStarState, date: string) {
  const rows = tally(a);
  const elected: PlayerId[] = [];
  for (const side of SIDES) for (const spot of SPOTS) elected.push(...rows.filter((r) => r.side === side && r.spot === spot).slice(0, SEATS[spot]).map((r) => r.id));
  a.elected = elected;
  const value = seasonValue(s);
  const squads = {} as Record<AllStarSide, PlayerId[]>;
  for (const side of SIDES) {
    const mine = elected.filter((id) => a.candidates.find((c) => c.id === id)!.side === side);
    const clubs = Object.keys(a.sides).filter((id) => a.sides[id] === side);
    const pool = clubs
      .flatMap((id) => (s.rosters[id]?.active ?? []).map((pid) => s.players[pid]!))
      .filter((p) => p.status === 'active' && !s.injuries[p.id] && !mine.includes(p.id))
      .sort((x, y) => value(y) + y.scouting.current / 40 - (value(x) + x.scouting.current / 40));
    const squad = [...mine];
    const take = (p: Player) => squad.length < A.squad && !squad.includes(p.id) && squad.push(p.id);
    // Every club sends at least two.
    for (const id of clubs) for (const p of pool.filter((x) => x.teamId === id)) if (squad.filter((q) => s.players[q]!.teamId === id).length < 2) take(p);
    // Then half pitchers, half hitters, best first.
    const arms = () => squad.filter((id) => isPitcher(s.players[id]!)).length;
    for (const p of pool) if (isPitcher(p) ? arms() < A.squad / 2 : squad.length - arms() < A.squad / 2) take(p);
    for (const p of pool) take(p);
    squads[side] = squad;
  }
  a.squads = squads;
  for (const id of elected) (s.players[id]!.honors ??= []).push(__i18n_k("league.allstar.elect.05313858", { year: s.year }));
  electNews(s, a, date);
}

// ── The game ─────────────────────────────────────────────────────────────────────────────────────

const OF = new Set(['LF', 'CF', 'RF']);

/** A side's team for the game: the 베스트12 start, the rest come in from the bench and the bullpen. */
function sideTeam(s: LeagueState, a: AllStarState, side: AllStarSide, vs: 'L' | 'R'): TeamIn | null {
  const squad = a.squads![side].filter((id) => s.players[id] && !s.injuries[id]);
  const starters = a.elected!.filter((id) => squad.includes(id));
  const spotOf = (id: PlayerId) => a.candidates.find((c) => c.id === id)?.spot;
  // The elected outfielders: a centre fielder in centre, the others at the corners.
  const ofs = starters.filter((id) => spotOf(id) === 'OF').sort((x, y) => Number(s.players[y]!.position === 'CF') - Number(s.players[x]!.position === 'CF') || (s.players[y]!.scouting.tools.defense ?? 0) - (s.players[x]!.scouting.tools.defense ?? 0));
  const card = starters
    .filter((id) => !isPitcher(s.players[id]!))
    .map((id) => {
      const spot = spotOf(id);
      const pos = spot === 'OF' ? (['CF', 'RF', 'LF'] as const)[ofs.indexOf(id)]! : spot;
      return { id, pos } as { id: PlayerId; pos: 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH' };
    });
  const hitters = squad.filter((id) => !isPitcher(s.players[id]!));
  const lineup = lineupFor(s, hitters, () => 0, false, vs, { card });
  if (lineup.length < 9) return null;
  const arms = squad.map((id) => s.players[id]!).filter(isPitcher);
  const sp = arms.find((p) => spotOf(p.id) === 'SP' && starters.includes(p.id)) ?? arms.find((p) => p.role === 'SP') ?? arms[0];
  if (!sp) return null;
  const closer = arms.find((p) => starters.includes(p.id) && spotOf(p.id) === 'CL');
  const starter: PitcherIn = armIn(sp, A.pitchLimit.starter);
  const bullpen: RelieverIn[] = arms.filter((p) => p !== sp).map((p) => ({ ...armIn(p, A.pitchLimit.reliever), role: p === closer ? 'CL' : 'MU' }));
  return { teamId: side, lineup, starter, bullpen };
}

/** The home run race: the sluggers swing until they make their outs; the best two meet again. */
function derby(s: LeagueState, a: AllStarState, date: string): AllStarGame['derby'] | null {
  const hitters = SIDES.flatMap((side) => a.squads![side])
    .map((id) => s.players[id]!)
    .filter((p) => !isPitcher(p) && !s.injuries[p.id])
    .sort((x, y) => (s.lines[y.id]?.bat?.hr ?? 0) - (s.lines[x.id]?.bat?.hr ?? 0) || (y.scouting.tools.power ?? 0) - (x.scouting.tools.power ?? 0))
    .slice(0, A.derby.field);
  if (hitters.length < 2) return null;
  const r = rng(`${s.seed}|derby|${s.year}`);
  const swing = (p: Player) => {
    const chance = Math.max(A.derby.min, Math.min(A.derby.max, A.derby.base + ((p.hidden.current.power ?? 40) - 50) * A.derby.perPower));
    let hr = 0;
    for (let outs = 0; outs < A.derby.outs; ) if (r() < chance) hr++;
    else outs++;
    return hr;
  };
  const rounds = hitters.map((p) => ({ id: p.id, first: swing(p) } as { id: PlayerId; first: number; final?: number }));
  const top = [...rounds].sort((x, y) => y.first - x.first || (s.players[y.id]!.hidden.current.power ?? 0) - (s.players[x.id]!.hidden.current.power ?? 0)).slice(0, 2);
  for (const t of top) t.final = swing(s.players[t.id]!);
  const winner = [...top].sort((x, y) => y.final! - x.final! || y.first - x.first)[0]!.id;
  return { date, winner, rounds };
}

function playAllStar(s: LeagueState, a: AllStarState, date: string) {
  const ids = firstTeamIds(s);
  const host = [...ids].sort()[(s.year * 7) % ids.length]!;
  const homeSide = a.sides[host] ?? 'dream';
  const awaySide: AllStarSide = homeSide === 'dream' ? 'nanum' : 'dream';
  const d = derby(s, a, addDays(date, -1));
  const spOf = (side: AllStarSide) => s.players[a.squads![side].find((id) => a.candidates.find((c) => c.id === id && c.spot === 'SP') && a.elected!.includes(id)) ?? '']?.throws;
  const home = sideTeam(s, a, homeSide, spOf(awaySide) === '좌' ? 'L' : 'R');
  const away = sideTeam(s, a, awaySide, spOf(homeSide) === '좌' ? 'L' : 'R');
  if (!home || !away || !d) return;
  const boxId = `${s.year}-allstar`;
  const log: PlayEvent[] = [];
  const park = s.teams.find((t) => t.id === host)?.stadium.park ?? 1;
  const out = simulateGame({ gameId: boxId, home, away, maxInnings: 9, park }, rng(`${s.seed}|game|${boxId}`), log);
  const capacity = s.teams.find((t) => t.id === host)?.stadium.capacity ?? 20000;
  const box = compactBox(out, boxId, date, capacity);
  keepBox(s, box, log);
  const runs = { [homeSide]: out.home.runs, [awaySide]: out.away.runs } as Record<AllStarSide, number>;
  const winner: AllStarSide | null = runs.dream > runs.nanum ? 'dream' : runs.nanum > runs.dream ? 'nanum' : null;
  const mvp = mvpOf(s, out, winner === homeSide ? 'home' : winner === awaySide ? 'away' : null);
  a.game = { boxId, date, host, runs, mvp, derby: d };
  if (mvp) (s.players[mvp]!.honors ??= []).push(__i18n_k("league.allstar.playAllStar.c1465cfc", { year: s.year }));
  (s.allStarHistory ??= []).push({ year: s.year, runs, mvp, derby: d.winner, host, elected: a.elected! });
  gameNews(s, a, box.id);
}

/** The best day on the winning side (on either side after a tie): hits and runs driven in, a home run worth most. */
function mvpOf(s: LeagueState, out: ReturnType<typeof simulateGame>, side: 'home' | 'away' | null): PlayerId | null {
  const teams = side ? [out[side]] : [out.home, out.away];
  let best: { id: PlayerId; v: number } | null = null;
  for (const t of teams) {
    for (const b of t.batting) {
      const v = b.hr * 4 + b.h * 1.5 + b.rbi * 1.2 + b.r * 0.5 + b.sb * 0.5;
      if (!best || v > best.v) best = { id: b.id, v };
    }
    for (const p of t.pitching) {
      const v = (p.outs / 3) * 1.2 + p.k * 0.8 - p.r * 2;
      if (!best || v > best.v) best = { id: p.id, v };
    }
  }
  return best?.id ?? null;
}

// ── News ─────────────────────────────────────────────────────────────────────────────────────────

const ours = (s: LeagueState, ids: PlayerId[]) => ids.filter((id) => s.user && s.players[id]?.teamId === s.user.teamId);

function openNews(s: LeagueState, a: AllStarState, date: string) {
  if (!s.user) return;
  const mine = ours(s, a.candidates.map((c) => c.id));
  addNews(s, {
    id: `allstar-open-${a.year}`,
    date,
    kind: 'allstar',
    title: __i18n_k("league.allstar.openNews.title.b5280be5", { year: a.year }),
    body: __i18n_k("league.allstar.openNews.body.46b5acfc", { year: a.year, year2: a.year, number: Number(A.dates.close.slice(0, 2)), number2: Number(A.dates.close.slice(3)), value: mine.length ? __i18n_k("league.allstar.openNews.body.21873040", { names: names(s, mine), particle: particle(name(s, mine.at(-1)!), iga) }) : '' }),
    quotes: [],
    facts: { year: a.year, candidates: a.candidates.length },
    players: mine,
  });
}

function tallyNews(s: LeagueState, a: AllStarState, date: string) {
  if (!s.user) return;
  const rows = tally(a);
  const top = [...rows].sort((x, y) => y.fans - x.fans)[0];
  const n = a.tallies.length;
  const leaders = rows.filter((r) => r.rank <= SEATS[r.spot]);
  const mine = ours(s, leaders.map((r) => r.id));
  addNews(s, {
    id: `allstar-tally-${date}`,
    date,
    kind: 'allstar',
    title: __i18n_k("league.allstar.tallyNews.title.021ec4ae", { n: n, value: top ? __i18n_k("league.allstar.tallyNews.title.91c86468", { name: name(s, top.id) }) : '' }),
    body: __i18n_k("league.allstar.tallyNews.body.b5f18a27", { value: top ? __i18n_k("league.allstar.tallyNews.body.6764ab8e", { short: short(s, top.teamId), name: iga(name(s, top.id)), value: top.fans.toLocaleString('ko-KR') }) : '', value2: mine.length ? __i18n_k("league.allstar.tallyNews.body.4feaed00", { names: names(s, mine), particle: particle(name(s, mine.at(-1)!), eunneun) }) : ourBest(s, rows) }),
    quotes: [],
    facts: { tally: n, leader: top ? name(s, top.id) : '' },
    detail: SIDES.flatMap((side) => SPOTS.map((spot) => `${SIDE_LABEL[side]} ${SPOT_LABEL[spot]}: ${leaders.filter((r) => r.side === side && r.spot === spot).map((r) => `${name(s, r.id)}(${short(s, r.teamId)})`).join(', ')}`)),
    players: mine,
  });
}

/** Our candidate closest to a place, when none holds one. */
function ourBest(s: LeagueState, rows: TallyRow[]): string {
  const best = rows.filter((r) => r.teamId === s.user?.teamId).sort((x, y) => x.rank - SEATS[x.spot] - (y.rank - SEATS[y.spot]) || y.score - x.score)[0];
  return best ? __i18n_k("league.allstar.ourBest.3272bd9c", { value: SPOT_LABEL[best.spot], name: iga(name(s, best.id)), rank: best.rank }) : '';
}

function electNews(s: LeagueState, a: AllStarState, date: string) {
  if (!s.user) return;
  const mine = ours(s, a.elected!);
  const picked = ours(s, [...a.squads!.dream, ...a.squads!.nanum]).filter((id) => !mine.includes(id));
  const lines = [mine.length ? __i18n_k("league.allstar.electNews.lines.0498b138", { value: mine.map((id) => name(s, id)).join(', ') }) : '', picked.length ? __i18n_k("league.allstar.electNews.lines.f027e0d8", { value: picked.map((id) => name(s, id)).join(', ') }) : ''].filter(Boolean);
  addNews(s, {
    id: `allstar-elect-${a.year}`,
    date,
    kind: 'allstar',
    title: __i18n_k("league.allstar.electNews.title.20e93bc8", { year: a.year }),
    body: __i18n_k("league.allstar.electNews.body.9c0db210", { squad: A.squad, value: lines.length ? __i18n_k("league.allstar.electNews.body.7a9f4f35", { value: lines.join(' / ') }) : __i18n_k("league.allstar.electNews.body.c99d38e6") }),
    quotes: [],
    facts: { year: a.year, ours: mine.length + picked.length },
    detail: SIDES.map((side) => `${SIDE_LABEL[side]}: ${a.squads![side].map((id) => `${name(s, id)}(${short(s, s.players[id]!.teamId ?? '')})${a.elected!.includes(id) ? '★' : ''}`).join(', ')}`),
    players: [...mine, ...picked],
  });
  if (mine.length + picked.length)
    addAlert(s, { id: `allstar-elect-${a.year}`, date, kind: 'allstar', title: __i18n_k("league.allstar.electNews.title.6133b673", { value: mine.length + picked.length }), lines, tone: 'good', players: [...mine, ...picked] });
}

function gameNews(s: LeagueState, a: AllStarState, boxId: string) {
  if (!s.user) return;
  const g = a.game!;
  const win: AllStarSide | null = g.runs.dream > g.runs.nanum ? 'dream' : g.runs.nanum > g.runs.dream ? 'nanum' : null;
  const score = `${g.runs.dream}-${g.runs.nanum}`;
  const mvp = g.mvp ? s.players[g.mvp] : null;
  const derbyWinner = s.players[g.derby.winner];
  const mine = ours(s, [...(g.mvp ? [g.mvp] : []), g.derby.winner]);
  addNews(s, {
    id: `allstar-game-${a.year}`,
    date: g.date,
    kind: 'allstar',
    title: __i18n_k("league.allstar.gameNews.title.006e49f7", { year: a.year, value: win ? __i18n_k("league.allstar.gameNews.title.d4f578e1", { value: SIDE_LABEL[win] }) : __i18n_k("league.allstar.gameNews.title.ff1b1cbc"), value2: mvp ? __i18n_k("league.allstar.gameNews.title.19a2ec49", { name: mvp.name }) : '' }),
    body: __i18n_k("league.allstar.gameNews.body.49517a96", { short: short(s, g.host), year: a.year, value: win ? __i18n_k("league.allstar.gameNews.body.6ead9275", { value: iga(SIDE_LABEL[win]), value2: ro(win === 'dream' ? `${g.runs.dream}-${g.runs.nanum}` : `${g.runs.nanum}-${g.runs.dream}`) }) : __i18n_k("league.allstar.gameNews.body.8d9b8269", { score: ro(score) }), value2: mvp ? __i18n_k("league.allstar.gameNews.body.d0a5131b", { short: short(s, mvp.teamId ?? ''), name: iga(mvp.name) }) : '', value3: derbyWinner ? `${short(s, derbyWinner.teamId ?? '')} ${iga(derbyWinner.name)}` : '' }),
    quotes: [],
    facts: { year: a.year, dream: g.runs.dream, nanum: g.runs.nanum, mvp: mvp?.name ?? '', derby: derbyWinner?.name ?? '' },
    detail: g.derby.rounds.map((r) => __i18n_k("league.allstar.gameNews.detail.42208318", { name: name(s, r.id), first: r.first, value: r.final !== undefined ? __i18n_k("league.allstar.gameNews.detail.062b152b", { final: r.final }) : '' })),
    players: mine,
  });
  // 미스터 올스타 from our club talks to the reporters.
  const iv = g.mvp && mine.includes(g.mvp) ? heroInterview(s, g.mvp, g.date, { kind: 'allStarMvp' }, `allstar-${a.year}`) : null;
  if (iv) addNews(s, iv);
  if (mine.length) addAlert(s, { id: `allstar-game-${a.year}`, date: g.date, kind: 'allstar', title: mine.includes(g.mvp ?? '') ? __i18n_k("league.allstar.gameNews.title.12b95c36", { name: mvp!.name }) : __i18n_k("league.allstar.gameNews.title.809180e7", { name: derbyWinner!.name }), lines: [__i18n_k("league.allstar.gameNews.lines.ff106683", { dream: g.runs.dream, nanum: g.runs.nanum })], tone: 'good', players: mine });
  void boxId;
}

/** The season's All-Star picture for the screen: the standings, the squads, the game. */
export function allStarView(s: LeagueState) {
  const a = s.allStar?.year === s.year ? s.allStar : null;
  const open = day(s.year, A.dates.open),
    close = day(s.year, A.dates.close),
    game = day(s.year, A.dates.game);
  return {
    year: s.year,
    dates: { open, close, game },
    state: a,
    rows: a ? tally(a) : [],
    history: [...(s.allStarHistory ?? [])].reverse(),
  };
}

// ── Our voting drive ─────────────────────────────────────────────────────────────────────────────

/** Why our club cannot run a voting drive now, or null. */
export function checkCampaign(s: LeagueState): string | null {
  const u = s.user;
  const a = s.allStar?.year === s.year ? s.allStar : null;
  if (!u) return __i18n_k("league.allstar.checkCampaign.272add95");
  if (!a || a.elected) return __i18n_k("league.allstar.checkCampaign.0f1d621d");
  if (a.campaign) return __i18n_k("league.allstar.checkCampaign.d0875f36");
  if (!a.candidates.some((c) => c.teamId === u.teamId)) return __i18n_k("league.allstar.checkCampaign.c66e1ae2");
  if (u.fund < A.campaign.cost) return __i18n_k("league.allstar.checkCampaign.2ffbf119");
  return null;
}

/** A voting drive for our candidates (posters, the app, a players' video): fan ballots up from today. */
export function runCampaign(s: LeagueState, date: string) {
  if (checkCampaign(s)) return;
  const u = s.user!;
  const a = s.allStar!;
  // The ballots so far were cast without it.
  count(s, a, date);
  a.campaign = true;
  u.fund -= A.campaign.cost;
  u.ledger.push({ year: s.year, label: __i18n_k("league.allstar.runCampaign.label.f8654907"), amount: -A.campaign.cost });
  (u.log ??= []).push({ year: s.year, text: __i18n_k("league.allstar.runCampaign.text.f8654907") });
}
