import { k as __i18n_k } from '../i18n/index';
/* Our players in the major leagues (1.7.0, from the 1.6 feedback: 포스팅으로 MLB에 진출한 선수 확인, MLB 성적 표시).
   A player who signs through the posting system (posting.ts) joins a big-league club, and each winter his season
   there is written into his record: games, the slash line and home runs, or innings, wins and ERA, and a WAR. How
   he does follows his ability against big-league play (a KBO grade of about 64 is a big-league regular), his age
   and luck; a player not good enough spends much of the year in triple-A. When his deal ends he may sign on
   elsewhere for another year; he stops when he comes home (returnees.ts) or ends his career abroad.
   The seasons are drawn from the player's id and the year alone, never the league's streams. */
import { hashUnit, overall, rng } from '../draftroom';
import type { MlbSeason, Player } from '../model/types';
import { ageIn, isPitcher } from './players';
import type { LeagueState } from './state';

export const MLB = {
  /** The KBO grade of a big-league regular. */
  par: 64,
  /** Grade points lost each year past 31. */
  aging: 1.5,
  /** Under this (grade − par) he spends most of the year in triple-A. */
  aaaBelow: -7,
  maxAge: 39,
};

export const MLB_CLUBS = [
  __i18n_k("league.mlb.text.433506b7"),
  __i18n_k("league.mlb.text.4d983536"),
  __i18n_k("league.mlb.text.a8131387"),
  __i18n_k("league.mlb.text.0edb4398"),
  __i18n_k("league.mlb.text.994db9aa"),
  __i18n_k("league.mlb.text.4ad6ee9b"),
  __i18n_k("league.mlb.text.682478b5"),
  __i18n_k("league.mlb.text.2c88953f"),
  __i18n_k("league.mlb.text.2117c5f5"),
  __i18n_k("league.mlb.text.936b0de1"),
  __i18n_k("league.mlb.text.6b492fd8"),
  __i18n_k("league.mlb.text.b383d0bc"),
  __i18n_k("league.mlb.text.22920928"),
  __i18n_k("league.mlb.text.be822f8d"),
  __i18n_k("league.mlb.text.64aaffe1"),
  __i18n_k("league.mlb.text.ae702200"),
  __i18n_k("league.mlb.text.d5fcffbe"),
  __i18n_k("league.mlb.text.260bbc7a"),
  __i18n_k("league.mlb.text.9ba9e328"),
  __i18n_k("league.mlb.text.7fd58e09"),
];

const clubFor = (id: string, from: number) => MLB_CLUBS[Math.floor(hashUnit(`mlb-club|${id}|${from}`) * MLB_CLUBS.length)]!;

/** He signs abroad (posting.ts): his deal and club. */
export function joinMlb(p: Player, posted: number, deal: { years: number; total: number }) {
  p.mlb = { posted, years: deal.years, total: deal.total, club: clubFor(p.id, posted), seasons: [] };
}

const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** 1.9.3: Japan's NPB, for players who go there (posting.ts, fa.ts): its regulars are a little below the majors'. */
export const NPB = {
  par: 58,
  aaaBelow: -7,
  maxAge: 38,
  /** Grade points a player gains against the minors (triple-A, NPB's 2군) over the top league. */
  minorsEdge: 8,
};

export const NPB_CLUBS = [
  __i18n_k("league.mlb.text.7d476897"),
  __i18n_k("league.mlb.text.4ebfb35b"),
  __i18n_k("league.mlb.text.aae5b516"),
  __i18n_k("league.mlb.text.414b89f1"),
  __i18n_k("league.mlb.text.b5037f42"),
  __i18n_k("league.mlb.text.76ebb3b3"),
  __i18n_k("league.mlb.text.3c89b402"),
  __i18n_k("league.mlb.text.e65262f3"),
  __i18n_k("league.mlb.text.844e5bfc"),
  __i18n_k("league.mlb.text.ec0d84a2"),
  __i18n_k("league.mlb.text.ebc71249"),
  __i18n_k("league.mlb.text.0b0fe876"),
];

const npbClubFor = (id: string, from: number) => NPB_CLUBS[Math.floor(hashUnit(`npb-club|${id}|${from}`) * NPB_CLUBS.length)]!;

/** He signs in Japan (1.9.3): his deal and club. */
export function joinNpb(p: Player, year: number, deal: { years: number; total: number }, via?: 'fa') {
  p.mlb = { posted: year, years: deal.years, total: deal.total, club: npbClubFor(p.id, year), seasons: [], league: 'npb', ...(via ? { via } : {}) };
}

/** A line for `share` of a full season at `rel` grade points over the league's regular. */
function line(p: Player, rel: number, share: number, r: () => number): Pick<MlbSeason, 'bat' | 'pit' | 'war'> {
  if (isPitcher(p)) {
    const starter = p.role === 'SP' && rel > -4;
    const era = clamp(4.2 - rel * 0.1 + normal(r) * 0.55, 1.6, 9);
    const g = Math.max(1, Math.round((starter ? 30 : 62) * share));
    const gs = starter ? g : 0;
    const outs = Math.round(starter ? g * (16 + rel * 0.25 + r() * 2) : g * 3.1);
    const ip = Math.floor(outs / 3) + (outs % 3) / 10;
    const decisions = starter ? g * 0.62 : g * 0.12;
    const winShare = clamp(0.5 + (4.2 - era) * 0.07, 0.2, 0.8);
    const w = Math.round(decisions * winShare),
      l = Math.round(decisions * (1 - winShare));
    const sv = !starter && rel > 5 ? Math.round(g * (0.35 + r() * 0.15)) : 0;
    const k = Math.round((outs / 27) * (8.4 + rel * 0.12 + normal(r) * 0.8));
    const war = Math.round(((outs / 3) * (4.6 - era) * 0.011 + (starter ? 0.3 : 0)) * 10) / 10;
    return { pit: { g, gs, ip, w, l, sv, era: Math.round(era * 100) / 100, k }, war };
  }
  const g = Math.max(1, Math.round(150 * share));
  const pa = Math.round(g * (rel < -7 ? 3 : 3.9));
  const t = p.hidden.current;
  const avg = clamp(0.243 + rel * 0.0025 + ((t.contact ?? 50) - 55) * 0.001 + normal(r) * 0.015, 0.12, 0.34);
  const obp = clamp(avg + 0.06 + ((t.eye ?? 50) - 50) * 0.0018 + normal(r) * 0.008, avg + 0.02, 0.46);
  const iso = clamp(0.135 + rel * 0.003 + ((t.power ?? 50) - 55) * 0.0025 + normal(r) * 0.02, 0.03, 0.3);
  const hr = Math.max(0, Math.round(pa * (iso * 0.18 + normal(r) * 0.004)));
  const rbi = Math.round(hr * 2.2 + pa * avg * 0.22);
  const sb = Math.max(0, Math.round(g * (((t.speed ?? 40) - 45) * 0.004 + r() * 0.05)));
  const ops = obp + avg + iso;
  // Runs above average from the OPS, and the regular's worth over a replacement (a .950 OPS season is about 5).
  const war = Math.round(((ops - 0.71) * pa * 0.022 + (pa / 600) * 1.8) * 10) / 10;
  return { bat: { g, pa, avg: round3(avg), obp: round3(obp), slg: round3(avg + iso), hr, rbi, sb }, war };
}

/** His season abroad in `year`, from his ability then. 1.9.3: in the majors or NPB (`npb`), and when he spends most
    of it in the minors (triple-A, NPB's 2군) his line there too; the WAR is the top league's. */
export function mlbSeason(p: Player, year: number, club: string, npb = false): MlbSeason {
  const L0 = npb ? NPB : MLB;
  const r = rng(`${npb ? 'npb' : 'mlb'}|${p.id}|${year}`);
  const age = ageIn(p, year);
  const rel = overall(p.hidden.current, p.role) - L0.par - Math.max(0, age - 31) * MLB.aging + normal(r) * 4;
  const aaa = rel < L0.aaaBelow;
  // How much of the year he spends in the top league.
  const share = aaa ? clamp(0.1 + (rel - L0.aaaBelow + 6) * 0.04 + r() * 0.1, 0.03, 0.35) : clamp(0.75 + rel * 0.03 + r() * 0.15, 0.4, 1);
  const top = line(p, rel, share, r);
  if (top.pit && aaa) top.pit.sv = 0;
  if (!aaa) return { year, club, ...top };
  const minors = line(p, rel + NPB.minorsEdge, Math.max(0.1, 0.9 - share), r);
  return { year, club, aaa: true, ...top, minors: { ...(minors.bat ? { bat: minors.bat } : {}), ...(minors.pit ? { pit: minors.pit } : {}) } };
}

/** Posted players abroad in the winter after `year`: last season's line, a new club after the deal. Idempotent. */
export function mlbWinter(s: LeagueState, year: number) {
  for (const p of Object.values(s.players)) {
    const m = p.mlb;
    if (!m || p.status !== 'overseas' || m.back !== undefined || m.ended !== undefined || year <= m.posted) continue;
    if (m.seasons.some((x) => x.year === year)) continue;
    const npb = m.league === 'npb';
    if (ageIn(p, year) > (npb ? NPB.maxAge : MLB.maxAge)) {
      m.ended = year - 1;
      continue;
    }
    // Past his deal: a one-year deal, often somewhere else.
    const club = year - m.posted > m.years && hashUnit(`mlb-move|${p.id}|${year}`) < 0.6 ? (npb ? npbClubFor(p.id, year) : clubFor(p.id, year)) : (m.seasons.at(-1)?.club ?? m.club);
    m.seasons.push(mlbSeason(p, year, club, npb));
  }
}

/** He has come home (returnees.ts) or retired abroad in the winter of `year`. */
export function leaveMlb(p: Player, year: number, how: 'back' | 'ended') {
  if (p.mlb && p.mlb.back === undefined && p.mlb.ended === undefined) p.mlb[how] = year;
}

/** Big-league totals: games, and the slash line or the pitching line. */
export function mlbTotals(p: Pick<Player, 'mlb' | 'role'>) {
  const seasons = p.mlb?.seasons ?? [];
  const war = Math.round(seasons.reduce((a, x) => a + x.war, 0) * 10) / 10;
  if (isPitcher(p)) {
    const t = { g: 0, outs: 0, w: 0, l: 0, sv: 0, er: 0, k: 0 };
    for (const x of seasons) {
      if (!x.pit) continue;
      const outs = Math.floor(x.pit.ip) * 3 + Math.round((x.pit.ip % 1) * 10);
      t.g += x.pit.g;
      t.outs += outs;
      t.w += x.pit.w;
      t.l += x.pit.l;
      t.sv += x.pit.sv;
      t.k += x.pit.k;
      t.er += (x.pit.era * outs) / 27;
    }
    return { seasons: seasons.length, war, pit: { g: t.g, ip: Math.floor(t.outs / 3) + (t.outs % 3) / 10, w: t.w, l: t.l, sv: t.sv, k: t.k, era: t.outs ? Math.round(((27 * t.er) / t.outs) * 100) / 100 : 0 } };
  }
  const t = { g: 0, pa: 0, h: 0, ob: 0, tb: 0, hr: 0, rbi: 0, sb: 0 };
  for (const x of seasons) {
    if (!x.bat) continue;
    const ab = x.bat.pa * 0.9;
    t.g += x.bat.g;
    t.pa += x.bat.pa;
    t.h += x.bat.avg * ab;
    t.tb += x.bat.slg * ab;
    t.ob += x.bat.obp * x.bat.pa;
    t.hr += x.bat.hr;
    t.rbi += x.bat.rbi;
    t.sb += x.bat.sb;
  }
  const ab = t.pa * 0.9;
  return { seasons: seasons.length, war, bat: { g: t.g, pa: t.pa, avg: ab ? round3(t.h / ab) : 0, obp: t.pa ? round3(t.ob / t.pa) : 0, slg: ab ? round3(t.tb / ab) : 0, hr: t.hr, rbi: t.rbi, sb: t.sb } };
}

/** Everyone the KBO has sent to the majors through the posting system, newest first. */
export function mlbView(s: LeagueState) {
  return Object.values(s.players)
    .filter((p) => p.mlb)
    .sort((a, b) => b.mlb!.posted - a.mlb!.posted || b.mlb!.total - a.mlb!.total)
    .map((p) => {
      const m = p.mlb!;
      const from = p.career.filter((c) => !c.level && c.year <= m.posted).at(-1)?.teamId;
      const club = from ? (s.teams.find((t) => t.id === from)?.short ?? from) : '';
      const status = m.back !== undefined ? (p.teamId ? __i18n_k("league.mlb.text.b2a2812a", { club: s.teams.find((t) => t.id === p.teamId)?.short ?? '' }) : __i18n_k("league.mlb.text.27473dab")) : m.ended !== undefined || p.status === 'retired' ? __i18n_k("league.mlb.text.5b170d3c") : m.league === 'npb' ? __i18n_k("league.mlb.text.120ad45f", { club: m.seasons.at(-1)?.club ?? m.club }) : __i18n_k("league.mlb.text.61a94fdb", { club: m.seasons.at(-1)?.club ?? m.club });
      return { id: p.id, name: p.name, pitcher: isPitcher(p), kboClub: club, kboTeamId: from ?? null, posted: m.posted, years: m.years, total: m.total, club: m.club, status, totals: mlbTotals(p), npb: m.league === 'npb' };
    });
}

/** Saves from before 1.7.0: posted players who signed abroad get their deal, club and seasons there. */
export function backfillMlb(s: LeagueState, dealYears: (p: Player) => number) {
  const last = s.offseason ? s.offseason.year : s.year - 1;
  for (const p of Object.values(s.players)) {
    const posted = p.service.postedIn;
    if (p.mlb || posted === undefined || p.origin.kind === 'foreign') continue;
    const home = p.career.filter((c) => !c.level && c.year > posted).map((c) => c.year);
    const firstHome = home.length ? Math.min(...home) : null;
    // Unsigned, he played for his club the next season.
    if (firstHome === posted + 1 || (firstHome === null && p.status !== 'overseas')) continue;
    const years = dealYears(p);
    joinMlb(p, posted, { years, total: Math.round((2_500_000 * Math.exp((p.scouting.current - 60) * 0.22) * years) / 250_000) * 250_000 });
    const to = firstHome === null ? last : firstHome - 1;
    for (let y = posted + 1; y <= to; y++) {
      const club = y - posted > years && hashUnit(`mlb-move|${p.id}|${y}`) < 0.6 ? clubFor(p.id, y) : (p.mlb!.seasons.at(-1)?.club ?? p.mlb!.club);
      p.mlb!.seasons.push(mlbSeason(p, y, club));
    }
    if (firstHome !== null) p.mlb!.back = firstHome - 1;
  }
}

/** 1.7.1: seasons written by 1.7.0 read again on the revised scale (it made a KBO star an MLB MVP every year). */
export function rescoreMlb(s: LeagueState) {
  for (const p of Object.values(s.players)) if (p.mlb) p.mlb.seasons = p.mlb.seasons.map((x) => mlbSeason(p, x.year, x.club, p.mlb!.league === 'npb'));
}
