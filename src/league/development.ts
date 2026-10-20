import { k as __i18n_k } from '../i18n/index';
/* 2.0.28 (the user's request): the autumn and winter for the prospects, as KBO clubs run them.

   - The fall instructional league (가을 교육리그): after the regular season the club sends up to twelve of its futures
     and reserve players, 25 or younger, to a few weeks of games in Miyazaki — NPB's 피닉스 리그, where KBO clubs go
     every October. A line of games each, and a little growth.
   - A winter in Australia (호주 유학): up to three prospects spend the ABL season (November to February) on loan to an
     Australian club. More games against older players, more growth, a small chance of an injury.
   - The wrap-up camp abroad (해외 마무리캠프): every November the club takes its young players somewhere warm —
     Okinawa (practice games with NPB clubs), Guam (conditioning), Taiwan (games with CPBL clubs), California (a
     data-driven pitching and hitting lab) — or stays at home for nothing. Each player 27 or younger grows a little in
     what the camp works on.

   The money comes from the club's fund; the user's club only (AI clubs go too, but the game does not keep it). The
   records are kept on the player (his records tab: league/amateur.ts and the records tab) and the gains go into his
   ability as a training trip's do (training.ts). Game assumptions throughout. */
import { rng, TOOL_LABELS, type AmateurRecord, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { drawnRecord } from './amateur';
import { addNews } from './news';
import { rescout } from './offseason';
import { ageIn, isForeign, isPitcher } from './players';
import { splitRecord } from './hsevents';
import type { Decision, LeagueState } from './state';
import { TRAINING as T } from './tuning';

export type CampSite = 'home' | 'okinawa' | 'guam' | 'taiwan' | 'california';

export const DEV = {
  fall: { max: 12, maxAge: 25, cost: 300, levelGap: 4, gain: 0.9, hitterGames: [12, 16], pitcherGames: [4, 6] },
  abl: { max: 3, maxAge: 26, cost: 1_500, levelGap: 8, gain: 1.8, risk: 0.05, hitterGames: [30, 40], pitcherGames: [10, 14] },
  camp: { maxAge: 27, gain: 0.6 },
};

export const CAMP_SITES: Record<CampSite, { name: () => string; cost: number; pitcher: ToolKey[]; hitter: ToolKey[]; note: () => string; conditioning?: boolean }> = {
  home: { name: () => __i18n_k("league.development.text.1db17b1e"), cost: 0, pitcher: ['command'], hitter: ['contact'], note: () => __i18n_k("league.development.text.c41c80ab") },
  okinawa: { name: () => __i18n_k("league.development.text.dcb4c74c"), cost: 25_000, pitcher: ['breaking', 'command'], hitter: ['contact', 'eye'], note: () => __i18n_k("league.development.text.9da8b672") },
  guam: { name: () => __i18n_k("league.development.text.0ba20aab"), cost: 18_000, pitcher: ['stamina'], hitter: ['speed', 'defense'], note: () => __i18n_k("league.development.text.3016871b"), conditioning: true },
  taiwan: { name: () => __i18n_k("league.development.text.27645634"), cost: 15_000, pitcher: ['command'], hitter: ['contact', 'power'], note: () => __i18n_k("league.development.text.76b189d4") },
  california: { name: () => __i18n_k("league.development.text.9cf8e230"), cost: 30_000, pitcher: ['stuff', 'breaking'], hitter: ['power', 'eye'], note: () => __i18n_k("league.development.text.3f302cca") },
};
export const CAMP_IDS = Object.keys(CAMP_SITES) as CampSite[];

/** ABL clubs a prospect is loaned to. */
const ABL_CLUBS = () => [__i18n_k("league.development.text.233d5ec0"), __i18n_k("league.development.text.a1f2248b"), __i18n_k("league.development.text.ec82d49e"), __i18n_k("league.development.text.b9e98834"), __i18n_k("league.development.text.24268cd4"), __i18n_k("league.development.text.3d1614e2")];

export interface DevLine {
  /** The season it belongs to (the autumn after it, the winter before the next). */
  year: number;
  kind: 'fall' | 'abl';
  team: string;
  record: AmateurRecord;
  gains: Partial<Record<ToolKey, number>>;
  injury?: string;
}

/** The season the autumn and winter follow (the offseason's year, or this one once the regular season is over). */
export const devYear = (s: LeagueState) => (s.offseason ? s.offseason.year : s.year);
const seasonOver = (s: LeagueState) => s.phase === 'postseason' || s.phase === 'offseason';

/** Who may go: his club's futures and reserve players (not on the first team), young enough, fit, not abroad. */
export function devCandidates(s: LeagueState, kind: 'fall' | 'abl'): Player[] {
  const u = s.user;
  if (!u) return [];
  const r = s.rosters[u.teamId];
  const year = devYear(s);
  const max = kind === 'fall' ? DEV.fall.maxAge : DEV.abl.maxAge;
  return [...(r?.futures ?? []), ...(r?.third ?? [])]
    .map((id) => s.players[id]!)
    .filter((p) => p && p.status === 'active' && !isForeign(p) && !s.injuries[p.id] && !s.away?.[p.id] && ageIn(p, year + 1) <= max);
}

export function checkDev(s: LeagueState, kind: 'fall' | 'abl', ids: PlayerId[]): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.development.text.23b5d156");
  if (!seasonOver(s)) return __i18n_k("league.development.text.17f768d2");
  if (kind === 'abl' && s.phase !== 'offseason') return __i18n_k("league.development.text.e19b69d8");
  const year = devYear(s);
  if ((kind === 'fall' ? u.dev?.fall : u.dev?.abl) === year) return __i18n_k("league.development.text.75edbde0");
  const max = kind === 'fall' ? DEV.fall.max : DEV.abl.max;
  if (!ids.length) return __i18n_k("league.development.text.b1b73e32");
  if (ids.length > max) return __i18n_k("league.development.text.2fbd84ef", { max });
  const ok = new Set(devCandidates(s, kind).map((p) => p.id));
  if (ids.some((id) => !ok.has(id))) return __i18n_k("league.development.text.caafd3f8");
  const cost = ids.length * (kind === 'fall' ? DEV.fall.cost : DEV.abl.cost);
  if (u.fund < cost) return __i18n_k("league.development.text.428500a2");
  return null;
}

/** Growth in the given tools, toward his potential (a little past it at most), as a training trip gives it. */
function grow(p: Player, keys: ToolKey[], base: number, year: number, r: () => number): Partial<Record<ToolKey, number>> {
  const age = ageIn(p, year + 1);
  const ageK = T.age.find(([a]) => age <= a)![1];
  const gains: Partial<Record<ToolKey, number>> = {};
  keys.forEach((k, i) => {
    const cur = p.hidden.current[k];
    if (cur == null) return;
    const pot = p.hidden.potential[k] ?? cur;
    const want = base * ageK * (i === 0 ? 1 : T.secondary) * (0.3 + r() * 1);
    const g = Math.round(Math.max(0, Math.min(want, Math.max(0, pot - cur) + T.overPotential)) * 10) / 10;
    if (g <= 0) return;
    const now = Math.min(80, cur + g);
    p.hidden.current[k] = now;
    if (now > pot) p.hidden.potential[k] = now;
    gains[k] = Math.round((now - cur) * 10) / 10;
  });
  return gains;
}

const gainText = (gains: Partial<Record<ToolKey, number>>) =>
  Object.entries(gains)
    .map(([k, g]) => `${TOOL_LABELS[k as ToolKey] ?? k} +${g!.toFixed(1)}`)
    .join(', ');

/** The tools a stint works on: a pitcher's command and breaking ball, a hitter's contact and eye, his weakest first. */
function focusOf(p: Player): ToolKey[] {
  const keys: ToolKey[] = isPitcher(p) ? ['command', 'breaking', 'stuff'] : ['contact', 'eye', 'power', 'defense'];
  return [...keys].sort((a, b) => (p.hidden.current[a] ?? 99) - (p.hidden.current[b] ?? 99)).slice(0, 2);
}

/** His line there: what he is now against a level a few grades above the amateurs, for the games he played. */
function stintLine(p: Player, kind: 'fall' | 'abl', year: number): AmateurRecord {
  const D = kind === 'fall' ? DEV.fall : DEV.abl;
  const r = rng(`dev|${kind}|${year}|${p.id}`);
  const [lo, hi] = isPitcher(p) ? D.pitcherGames : D.hitterGames;
  const games = lo! + Math.floor(r() * (hi! - lo! + 1));
  const season = drawnRecord(p, Math.max(25, p.scouting.current - D.levelGap), `dev|${kind}|${year}|${p.id}|season`);
  const total = Number(season.games) || games;
  // Scaled to his games there (the season drawn as an amateur's, cut or stretched to its length).
  const [part] = splitRecord(season, [Math.min(games, total), Math.max(1, total - Math.min(games, total))], `dev|${kind}|${year}|${p.id}|split`);
  return part!;
}

/** Sends them: the games played, the growth, the bill, the news. */
export function sendDev(s: LeagueState, kind: 'fall' | 'abl', ids: PlayerId[]) {
  const problem = checkDev(s, kind, ids);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const year = devYear(s);
  const D = kind === 'fall' ? DEV.fall : DEV.abl;
  const cost = ids.length * D.cost;
  u.fund -= cost;
  u.ledger.push({ year, label: kind === 'fall' ? __i18n_k("league.development.text.50b31bae") : __i18n_k("league.development.text.1f84460a"), amount: -cost });
  (u.dev ??= {})[kind] = year;
  const lines: string[] = [];
  for (const id of ids) {
    const p = s.players[id]!;
    const r = rng(`dev|${kind}|${year}|${id}|growth`);
    const record = stintLine(p, kind, year);
    const gains = grow(p, focusOf(p), D.gain, year, r);
    rescout(p, year + 1, Math.max(0, year + 1 - p.proSince), r);
    const team = kind === 'fall' ? __i18n_k("league.development.text.7a65a34f") : ABL_CLUBS()[Math.floor(r() * ABL_CLUBS().length)]!;
    const line: DevLine = { year, kind, team, record, gains };
    if (kind === 'abl' && r() < DEV.abl.risk) {
      line.injury = isPitcher(p) ? __i18n_k("league.development.text.46268499") : __i18n_k("league.development.text.1028c937");
      const days = 14 + Math.floor(r() * 21);
      // Hurt in February: out into spring camp.
      if (!s.injuries[p.id]) s.injuries[p.id] = { until: `${year + 1}-03-${String(Math.min(28, Math.floor(days / 2))).padStart(2, '0')}`, days, onList: false, part: line.injury };
    }
    (p.devLog ??= []).push(line);
    const g = gainText(gains);
    lines.push(`${p.name} (${team})${g ? ` · ${g}` : ''}${line.injury ? ` · ${line.injury}` : ''}`);
  }
  const date = kind === 'fall' ? `${year}-11-10` : `${year + 1}-02-15`;
  const title = kind === 'fall' ? __i18n_k("league.development.text.d985e27a", { n: ids.length }) : __i18n_k("league.development.text.db5124d7", { n: ids.length });
  addAlert(s, { id: `dev-${kind}-${year}`, date, kind: 'season', title, lines, players: ids });
  addNews(s, { id: `dev-${kind}-${year}`, date, kind: 'interview', title, body: lines.join(' / '), quotes: [], facts: { n: ids.length }, players: ids, mine: true });
}

export function checkCamp(s: LeagueState, site: CampSite): string | null {
  const u = s.user;
  if (!u) return __i18n_k("league.development.text.23b5d156");
  if (s.phase !== 'offseason') return __i18n_k("league.development.text.e2e21c28");
  if (u.dev?.camp?.year === devYear(s)) return __i18n_k("league.development.text.6738bf92");
  if (u.fund < CAMP_SITES[site].cost) return __i18n_k("league.development.text.428500a2");
  return null;
}

/** The wrap-up camp: every young player of the club a little better in what the camp works on. */
export function holdCamp(s: LeagueState, site: CampSite) {
  const problem = checkCamp(s, site);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const year = devYear(s);
  const C = CAMP_SITES[site];
  u.fund -= C.cost;
  if (C.cost) u.ledger.push({ year, label: __i18n_k("league.development.text.752375ba", { place: C.name() }), amount: -C.cost });
  const base = DEV.camp.gain * (site === 'home' ? 0.5 : 1);
  const ids = ['active', 'futures', 'third'].flatMap((k) => (s.rosters[u.teamId] as unknown as Record<string, PlayerId[]>)[k] ?? []);
  let grew = 0;
  const best: [string, number][] = [];
  for (const id of ids) {
    const p = s.players[id];
    if (!p || isForeign(p) || p.status !== 'active' || ageIn(p, year + 1) > DEV.camp.maxAge) continue;
    const r = rng(`camp|${year}|${site}|${id}`);
    const gains = grow(p, isPitcher(p) ? C.pitcher : C.hitter, base, year, r);
    const sum = Object.values(gains).reduce((a, b) => a + (b ?? 0), 0);
    if (sum > 0) grew++;
    best.push([p.name, sum]);
    if (C.conditioning) (p.life ??= {}).conditioned = year + 1;
  }
  u.dev = { ...(u.dev ?? {}), camp: { year, site, players: grew } };
  const top = best.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
  const title = __i18n_k("league.development.text.87a9edad", { place: C.name(), n: grew });
  const lines = [C.note(), ...(top.length ? [__i18n_k("league.development.text.9eaf6756", { names: top.join(', ') })] : [])];
  addAlert(s, { id: `camp-${year}`, date: `${year}-11-25`, kind: 'season', title, lines, tone: 'good' });
  addNews(s, { id: `camp-${year}`, date: `${year}-11-25`, kind: 'interview', title, body: lines.join(' '), quotes: [], facts: { players: grew }, players: [], mine: true });
}

/* 2.0.32 (the user's request): the three as stages of the winter of their own, like the salary talks or the free-agent
   market — decisions after the November national team and the sponsor: the fall league, then Australia, then the
   wrap-up camp. Each comes up when it has not been held this year (sent from the training tab already, it is passed
   over) and someone can go; not going is an answer too, and the scouts' when the decision is left to them (a club
   that does not choose spends nothing). */
export const DEV_STAGES = ['devFall', 'devAbl', 'wrapUp'] as const;
export type DevStage = (typeof DEV_STAGES)[number];

/** The next of the three this winter, after `after` (from the first without it). */
export function devDecision(s: LeagueState, after?: DevStage): Decision | null {
  const u = s.user;
  if (!u || s.phase !== 'offseason') return null;
  const year = devYear(s);
  for (const stage of DEV_STAGES.slice(after ? DEV_STAGES.indexOf(after) + 1 : 0)) {
    if (stage === 'wrapUp') {
      if (u.dev?.camp?.year !== year) return { kind: 'wrapUp' };
      continue;
    }
    const kind = stage === 'devFall' ? 'fall' : 'abl';
    if ((kind === 'fall' ? u.dev?.fall : u.dev?.abl) === year) continue;
    const candidates = devCandidates(s, kind);
    if (candidates.length && u.fund >= DEV[kind].cost) return { kind: stage as 'devFall' | 'devAbl', candidates: candidates.map((p) => p.id), max: DEV[kind].max, cost: DEV[kind].cost };
  }
  return null;
}

/** The scouts' picks, for the recommendation: the highest future grades (the youngest among equals), as many as the
    places and the fund allow. */
export function devSuggestion(s: LeagueState, kind: 'fall' | 'abl'): PlayerId[] {
  const u = s.user;
  if (!u) return [];
  const year = devYear(s);
  const D = DEV[kind];
  const n = Math.min(D.max, Math.floor(Math.max(0, u.fund) / D.cost));
  return devCandidates(s, kind)
    .sort((a, b) => b.scouting.futureValue - a.scouting.futureValue || ageIn(a, year) - ageIn(b, year))
    .slice(0, n)
    .map((p) => p.id);
}

/** The scouts' place for the camp, for the recommendation: the dearest the club can easily afford (a quarter of its
    fund at most), at home otherwise. */
export function campSuggestion(s: LeagueState): CampSite {
  const fund = s.user?.fund ?? 0;
  return [...CAMP_IDS].filter((id) => !checkCamp(s, id) && CAMP_SITES[id].cost <= fund / 4).sort((a, b) => CAMP_SITES[b].cost - CAMP_SITES[a].cost)[0] ?? 'home';
}
