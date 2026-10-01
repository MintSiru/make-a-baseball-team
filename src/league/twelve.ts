/* Twelve clubs (V0.9): the league format once the twelfth club (rival.ts) reaches the first team.

   One league of twelve keeps the 144 games: 14 against the club's natural rival (the user's club and the
   twelfth club are each other's) and 13 against the rest. Two leagues of six follow the 1999–2000 드림·매직리그
   (RULES.md §1, §9): more games inside the league, and a postseason in which each league's winner meets the
   other league's runner-up. The KBO has never had twelve clubs; the numbers are game assumptions. */
import { rng } from '../draftroom';
import type { Player, TeamId } from '../model/types';
import { TWELVE_CLUB_SCHEDULE as T } from '../rules/kbo2026';
import { salaryIn } from './contracts';
import { ageIn, currentValue, futureValue, isPitcher, keepValue } from './players';
import type { StandingRow } from './standings';
import { firstTeamIds, type GmStyle, type LeagueSide, type LeagueState, type SeasonSummary } from './state';

export const LEAGUE_NAMES: Record<LeagueSide, string> = { dream: '드림리그', magic: '매직리그' };

/** Neighbours among the ten existing clubs (잠실, 낙동강, 영호남, 경인, and the two left over). Game assumption. */
export const NATURAL_RIVALS: [TeamId, TeamId][] = [
  ['lg', 'doosan'],
  ['lotte', 'nc'],
  ['samsung', 'kia'],
  ['ssg', 'kt'],
  ['hanwha', 'kiwoom'],
];

/** Twelve clubs in the first team this season. */
export const twelveClubs = (s: LeagueState, year = s.year) => !!s.twelve && firstTeamIds(s, year).includes(s.twelve.teamId);

/** Two leagues this season (the sides are set when the twelve clubs first play). */
export const twoLeagues = (s: LeagueState, year = s.year) => s.twelve?.format === 'two' && twelveClubs(s, year) && !!s.twelve.leagues;

export const sideOf = (s: LeagueState, teamId: TeamId): LeagueSide | undefined => s.twelve?.leagues?.[teamId];

/**
 * The two leagues, set once before the first twelve-club season. The user's club and the twelfth club play in
 * the 드림리그 together; the other ten split by last season's table so both leagues get strong and weak clubs.
 */
export function assignLeagues(s: LeagueState): Record<TeamId, LeagueSide> {
  const tw = s.twelve!;
  const me = s.user?.teamId;
  const table = s.history.at(-1)?.table ?? [];
  const others = firstTeamIds(s)
    .filter((id) => id !== me && id !== tw.teamId)
    .sort((a, b) => (table.find((r) => r.teamId === a)?.rank ?? 99) - (table.find((r) => r.teamId === b)?.rank ?? 99) || a.localeCompare(b));
  const out: Record<TeamId, LeagueSide> = { [tw.teamId]: 'dream' };
  if (me) out[me] = 'dream';
  // The 드림리그's four others are spread down last season's table (2nd, 5th, 8th and 10th).
  const dream = new Set([1, 4, 7, 9, 0].slice(0, 6 - Object.keys(out).length));
  others.forEach((id, i) => (out[id] = dream.has(i) ? 'dream' : 'magic'));
  return out;
}

/** Each club's natural rival with twelve clubs: the user's club and the twelfth club, then the pairs above; any club
    left over is paired with another left over. */
export function rivalPairs(s: LeagueState, teams: TeamId[]): Map<TeamId, TeamId> {
  const pairs = new Map<TeamId, TeamId>();
  const link = (a: TeamId, b: TeamId) => {
    if (!teams.includes(a) || !teams.includes(b) || pairs.has(a) || pairs.has(b)) return;
    pairs.set(a, b);
    pairs.set(b, a);
  };
  if (s.user && s.twelve) link(s.user.teamId, s.twelve.teamId);
  for (const [a, b] of NATURAL_RIVALS) link(a, b);
  const left = [...teams].filter((id) => !pairs.has(id)).sort();
  for (let i = 0; i + 1 < left.length; i += 2) link(left[i]!, left[i + 1]!);
  return pairs;
}

/** Games between two clubs this season with twelve clubs, or undefined for the usual 10- and 11-club rules. */
export function twelveGames(s: LeagueState, teams: TeamId[], year: number): ((a: TeamId, b: TeamId) => number) | undefined {
  if (teams.length !== 12 || !s.twelve || !teams.includes(s.twelve.teamId)) return undefined;
  if (s.twelve.format === 'two' && s.twelve.leagues) {
    const leagues = s.twelve.leagues;
    const dream = teams.filter((id) => leagues[id] === 'dream');
    const magic = teams.filter((id) => leagues[id] !== 'dream');
    // Each club meets two of the other league one game more: a circulant, reshuffled every year.
    const r = rng(`${s.seed}|twelve-near|${year}`);
    const order = [...magic];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const near = new Set<string>();
    dream.forEach((d, i) => {
      for (let k = 0; k < T.two.nearOpponents; k++) {
        const m = order[(i + k) % order.length]!;
        near.add(`${d}|${m}`).add(`${m}|${d}`);
      }
    });
    return (a, b) => (leagues[a] === leagues[b] ? T.two.same : near.has(`${a}|${b}`) ? T.two.near : T.two.far);
  }
  const pairs = rivalPairs(s, teams);
  return (a, b) => (pairs.get(a) === b ? T.single.rival : T.single.other);
}

/** A standings table split by league, ranks and games behind recounted inside each (two leagues). */
export function leagueTables<R extends StandingRow>(table: R[], leagues: Record<TeamId, LeagueSide>): Record<LeagueSide, R[]> {
  const split = (side: LeagueSide) => {
    const rows = table.filter((r) => (leagues[r.teamId] ?? 'magic') === side).map((r) => ({ ...r }));
    const top = rows[0];
    rows.forEach((r, i) => {
      r.rank = i + 1;
      r.gb = top ? (top.w - r.w + (r.l - top.l)) / 2 : 0;
    });
    return rows;
  };
  return { dream: split('dream'), magic: split('magic') };
}

/** Whether a club reached the postseason in a finished season (any series it played). */
export const madePostseason = (summary: Pick<SeasonSummary, 'series' | 'table'>, teamId: TeamId) =>
  summary.series.length ? summary.series.some((x) => x.high === teamId || x.low === teamId) : (summary.table.find((r) => r.teamId === teamId)?.rank ?? 99) <= 5;

/** The user's season series against the twelfth club so far this season. */
export function seasonSeries(s: LeagueState): { w: number; l: number; t: number } {
  const out = { w: 0, l: 0, t: 0 };
  const me = s.user?.teamId,
    them = s.twelve?.teamId;
  if (!me || !them) return out;
  for (const g of s.scores) {
    if (!((g.home === me && g.away === them) || (g.home === them && g.away === me))) continue;
    const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
    if (mine > theirs) out.w++;
    else if (mine < theirs) out.l++;
    else out.t++;
  }
  return out;
}

/** Whether a game is the rivalry (the user's club against the twelfth club). */
export const isRivalry = (s: LeagueState, home: TeamId, away: TeamId) => {
  const me = s.user?.teamId,
    them = s.twelve?.teamId;
  return !!me && !!them && ((home === me && away === them) || (home === them && away === me));
};

// ── The twelfth club's front office ──────────────────────────────────────────────────────────────

export const GM_STYLES: Record<GmStyle, { label: string; note: string }> = {
  balanced: { label: '균형형', note: '다른 구단과 같은 기준으로 선수를 고름' },
  develop: { label: '육성형', note: '어리고 잠재력 큰 선수를 먼저 뽑고, FA에는 소극적' },
  winNow: { label: '윈나우', note: '당장 쓸 선수를 먼저 데려오고, FA에 큰돈을 씀' },
  moneyball: { label: '머니볼', note: '연봉 대비 가치와 선구안·제구를 보고, 나이 든 FA는 피함' },
};

/** The front-office style of a club: only the twelfth club has one of its own. */
export const gmOf = (s: LeagueState, teamId: TeamId): GmStyle | null => (s.twelve?.teamId === teamId ? s.twelve.gm : null);

/** How a front office ranks a player it could take (tryout, special draft, released players). */
export function gmValue(p: Player, next: number, gm: GmStyle): number {
  const age = ageIn(p, next);
  switch (gm) {
    case 'develop':
      return futureValue(p) * 0.75 + currentValue(p) * 0.25 - Math.max(0, age - 26) * 1.2;
    case 'winNow':
      return currentValue(p) * 0.85 + futureValue(p) * 0.15;
    case 'moneyball': {
      const pay = salaryIn(p, next) || salaryIn(p, next - 1);
      const eye = (isPitcher(p) ? p.scouting.tools.command : p.scouting.tools.eye) ?? 45;
      return keepValue(p, next) + (eye - 50) * 0.15 - (pay / 10000) * 0.6;
    }
    default:
      return keepValue(p, next);
  }
}

/** Draft weights (future, current) by style; the league's clubs draft 0.6 / 0.4. */
export const gmDraftWeights = (gm: GmStyle | null): [number, number] => (gm === 'develop' ? [0.8, 0.2] : gm === 'winNow' ? [0.4, 0.6] : [0.6, 0.4]);

/** In the free-agent market: how likely it goes after a player and how far it goes, by style and his age. */
export function gmAppetite(gm: GmStyle | null, age: number): { chance: number; need: number } {
  switch (gm) {
    case 'develop':
      return { chance: age <= 30 ? 0.7 : 0.4, need: 0.95 };
    case 'winNow':
      return { chance: 1.4, need: 1.06 };
    case 'moneyball':
      return { chance: age <= 30 ? 1 : 0.55, need: 0.93 };
    default:
      return { chance: 1, need: 1 };
  }
}
