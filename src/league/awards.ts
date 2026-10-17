import { k as __i18n_k } from '../i18n/index';
/* Awards and honours (V0.7). After every season:
   - titles (타이틀): batting average, home runs, RBIs, runs, hits, steals, on-base and slugging (qualified
     hitters: 3.1 PA per team game), wins, ERA (1 inning per team game), strikeouts, saves, holds and
     winning percentage (10 decisions),
   - MVP: the season's best WAR, with a nudge for a title-winning or first-place club (game stand-in
     for the writers' vote),
   - 신인왕: the best WAR among first-year players (under 60 first-team PA and 30 innings before this
     season, within five years of turning pro, not foreign) — the KBO rookie rules,
   - 골든글러브: at each position the best WAR with 60+ games there (pitchers: best pitching WAR;
     outfield three; designated hitter).
   Honours go on the players; the season summary keeps the list. Retired greats with enough career
   WAR enter the hall of fame (명예의 전당, a game feature: the KBO has none yet). */
import type { FieldPos } from './engine/types';
import type { BatTotals, PitTotals, Player, PlayerId, SeasonRecord, TeamId } from '../model/types';
import { isForeign, isPitcher, isReliever } from './players';
import { avg, era, obp, slg } from './stats';
import type { LeagueState } from './state';
import type { StandingRow } from './standings';
import { milestone, unlock } from './milestones';
import { hallAlert } from './alerts';
import { hashUnit } from '../draftroom';
import { positionGrades } from './positions';

export interface SeasonAwards {
  mvp: PlayerId | null;
  rookie: PlayerId | null;
  goldenGloves: { pos: string; id: PlayerId }[];
  /** 2.0.0 (the user's request): the fielding awards (수비상) — the pitcher, each position, and a utility player. */
  defense?: { pos: string; id: PlayerId }[];
  titles: { label: string; id: PlayerId; value: string }[];
}

type Rec = { p: Player; c: SeasonRecord };

/** 1.9.3: the titles' and two golden gloves' labels as stored in the award lists (nicknames.ts reads them back). */
const LABELS = {
  avg: __i18n_k("league.awards.computeAwards.1eb19e0a"),
  hr: __i18n_k("league.awards.computeAwards.9162d3a3"),
  rbi: __i18n_k("league.awards.computeAwards.fed1c588"),
  r: __i18n_k("league.awards.computeAwards.4b4a98b9"),
  h: '안타',
  obp: __i18n_k("league.awards.computeAwards.bb6ef1b2"),
  slg: __i18n_k("league.awards.computeAwards.7e66b88d"),
  pct: __i18n_k("league.awards.computeAwards.82cc030f"),
  ggC: __i18n_k("league.awards.lABEL.c.5f31470d"),
  ggSs: __i18n_k("league.awards.lABEL.sS.3e24c7f1"),
  ggOf: __i18n_k("league.awards.computeAwards.pos.7435120b"),
  sb: __i18n_k("league.awards.computeAwards.91e54831"),
  w: __i18n_k("league.awards.computeAwards.a6eedf9a"),
  era: __i18n_k("league.awards.computeAwards.f0f9146b"),
  k: __i18n_k("league.awards.computeAwards.3e23c769"),
  sv: '세이브',
  hld: __i18n_k("league.awards.computeAwards.9329045a"),
  ggPitcher: '투수',
  ggDh: __i18n_k("league.awards.lABEL.dH.8eba4676"),
} as const;
export const awardLabel = (code: string): string => (LABELS as Record<string, string>)[code] ?? code;

const f3 = (x: number) => x.toFixed(3).replace(/^0/, '');
const ip = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;

/** The season's first-team records, one per player (a player traded mid-season has one line here). */
function records(s: LeagueState, year: number): Rec[] {
  const out: Rec[] = [];
  for (const p of Object.values(s.players)) {
    const c = p.career.find((r) => r.year === year && !r.level);
    if (c) out.push({ p, c });
  }
  return out;
}

const best = <T,>(xs: T[], key: (x: T) => number, low = false): T | null => {
  let top: T | null = null;
  for (const x of xs) if (!top || (low ? key(x) < key(top) : key(x) > key(top))) top = x;
  return top;
};

export function computeAwards(s: LeagueState, year: number, table: StandingRow[], champion: TeamId | null): SeasonAwards {
  const recs = records(s, year);
  const games = Math.max(1, ...table.map((r) => r.w + r.l + r.t));
  const hitters = recs.filter((r) => r.c.bat && !isPitcher(r.p));
  const pitchers = recs.filter((r) => r.c.pit && isPitcher(r.p));
  const qBat = hitters.filter((r) => r.c.bat!.pa >= games * 3.1);
  const qPit = pitchers.filter((r) => r.c.pit!.outs >= games * 3);
  const b = (r: Rec) => r.c.bat as BatTotals;
  const q = (r: Rec) => r.c.pit as PitTotals;
  const titles: SeasonAwards['titles'] = [];
  const title = (label: string, xs: Rec[], key: (r: Rec) => number, show: (r: Rec) => string, low = false) => {
    const top = best(xs, key, low);
    if (top && (low || key(top) > 0)) titles.push({ label, id: top.p.id, value: show(top) });
  };
  title(__i18n_k("league.awards.computeAwards.1eb19e0a"), qBat, (r) => avg(b(r)), (r) => f3(avg(b(r))));
  title(__i18n_k("league.awards.computeAwards.9162d3a3"), hitters, (r) => b(r).hr, (r) => __i18n_k("league.awards.computeAwards.4d0c1e37", { hr: b(r).hr }));
  title(__i18n_k("league.awards.computeAwards.fed1c588"), hitters, (r) => b(r).rbi, (r) => `${b(r).rbi}`);
  title(__i18n_k("league.awards.computeAwards.4b4a98b9"), hitters, (r) => b(r).r, (r) => `${b(r).r}`);
  title('안타', hitters, (r) => b(r).h, (r) => __i18n_k("league.awards.computeAwards.13404308", { h: b(r).h }));
  title(__i18n_k("league.awards.computeAwards.91e54831"), hitters, (r) => b(r).sb, (r) => __i18n_k("league.awards.computeAwards.36fd46ee", { sb: b(r).sb }));
  title(__i18n_k("league.awards.computeAwards.bb6ef1b2"), qBat, (r) => obp(b(r)), (r) => f3(obp(b(r))));
  title(__i18n_k("league.awards.computeAwards.7e66b88d"), qBat, (r) => slg(b(r)), (r) => f3(slg(b(r))));
  title(__i18n_k("league.awards.computeAwards.a6eedf9a"), pitchers, (r) => q(r).w, (r) => __i18n_k("league.awards.computeAwards.305ee214", { w: q(r).w }));
  title(__i18n_k("league.awards.computeAwards.f0f9146b"), qPit, (r) => era(q(r)), (r) => era(q(r)).toFixed(2), true);
  title(__i18n_k("league.awards.computeAwards.3e23c769"), pitchers, (r) => q(r).k, (r) => __i18n_k("league.awards.computeAwards.3375a4db", { value: q(r).k }));
  title('세이브', pitchers, (r) => q(r).sv, (r) => __i18n_k("league.awards.computeAwards.6a1d27de", { sv: q(r).sv }));
  title(__i18n_k("league.awards.computeAwards.9329045a"), pitchers, (r) => q(r).hld, (r) => __i18n_k("league.awards.computeAwards.555e5500", { hld: q(r).hld }));
  const decided = pitchers.filter((r) => q(r).w + q(r).l >= 10);
  title(__i18n_k("league.awards.computeAwards.82cc030f"), decided, (r) => q(r).w / (q(r).w + q(r).l), (r) => f3(q(r).w / (q(r).w + q(r).l)));

  // MVP: WAR, a little more for a first-place or champion club and for titles won.
  const first = table.find((r) => r.rank === 1)?.teamId;
  const mvpScore = (r: Rec) => r.c.war + (r.c.teamId === first ? 0.5 : 0) + (r.c.teamId === champion ? 0.3 : 0) + titles.filter((t) => t.id === r.p.id).length * 0.2;
  const mvp = best(recs, mvpScore);

  // Rookie: first-year player by the KBO rule.
  const rookieOk = (r: Rec) => {
    if (isForeign(r.p) || year - r.p.proSince > 4) return false;
    const before = r.p.career.filter((c) => !c.level && c.year < year);
    return before.reduce((a, c) => a + (c.bat?.pa ?? 0), 0) < 60 && before.reduce((a, c) => a + (c.pit?.outs ?? 0), 0) < 90;
  };
  const rookie = best(recs.filter(rookieOk), (r) => r.c.war);

  // Golden gloves by position.
  const posGames = (r: Rec, pos: FieldPos) => r.c.bat?.posG?.[pos] ?? 0;
  const goldenGloves: SeasonAwards['goldenGloves'] = [];
  const pitcherGG = best(pitchers, (r) => r.c.war);
  if (pitcherGG) goldenGloves.push({ pos: '투수', id: pitcherGG.p.id });
  const LABEL: Record<string, string> = { C: __i18n_k("league.awards.lABEL.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("league.awards.lABEL.sS.3e24c7f1"), DH: __i18n_k("league.awards.lABEL.dH.8eba4676") };
  for (const pos of ['C', '1B', '2B', '3B', 'SS'] as FieldPos[]) {
    const top = best(hitters.filter((r) => posGames(r, pos) >= 60), (r) => r.c.war);
    if (top) goldenGloves.push({ pos: LABEL[pos]!, id: top.p.id });
  }
  const outfield = hitters
    .filter((r) => posGames(r, 'LF') + posGames(r, 'CF') + posGames(r, 'RF') >= 60)
    .sort((a, b2) => b2.c.war - a.c.war)
    .slice(0, 3);
  for (const r of outfield) goldenGloves.push({ pos: __i18n_k("league.awards.computeAwards.pos.7435120b"), id: r.p.id });
  const dh = best(hitters.filter((r) => posGames(r, 'DH') >= 60), (r) => r.c.war);
  if (dh) goldenGloves.push({ pos: LABEL.DH!, id: dh.p.id });

  return { mvp: mvp?.p.id ?? null, rookie: rookie?.p.id ?? null, goldenGloves, titles, defense: defenseAwards(s, hitters, pitchers, games) };
}

/** 2.0.0: the fielding awards (KBO 수비상 since 2023; a utility player as the major leagues have since 2022). Each
    position goes to the best glove there among those who played half the season at it (the scouts' fielding grade
    at the position, a little more for more games); the pitcher's to a qualified pitcher by his own fielding (a game
    estimate from his 제구 and athleticism, until the 2.0 plan's fourth stage measures it); the utility award to the
    best glove across three positions or more, 20 games or more at each. */
function defenseAwards(s: LeagueState, hitters: Rec[], pitchers: Rec[], games: number): { pos: string; id: PlayerId }[] {
  const out: { pos: string; id: PlayerId }[] = [];
  const posGames = (r: Rec, pos: FieldPos) => r.c.bat?.posG?.[pos] ?? 0;
  const gradeAt = (r: Rec) => Object.fromEntries(positionGrades(s, r.p).map((x) => [x.pos, x.grade])) as Partial<Record<string, number>>;
  const qualified = pitchers.filter((r) => (r.c.pit?.outs ?? 0) >= games * 3);
  const pitcherGlove = (r: Rec) => (r.p.scouting.tools.command ?? 50) * 0.4 + hashUnit(`pitcher-glove|${r.p.id}`) * 30 + Math.min(10, (r.c.pit?.outs ?? 0) / 90);
  const p = best(qualified, pitcherGlove);
  if (p) out.push({ pos: __i18n_k("league.awards.text.ef406667"), id: p.p.id });
  const NAMES: Record<string, string> = { C: __i18n_k("league.awards.text.5f31470d"), '1B': __i18n_k("league.awards.text.b68518b0"), '2B': __i18n_k("league.awards.text.833473d4"), '3B': __i18n_k("league.awards.text.bf8d493f"), SS: __i18n_k("league.awards.text.3e24c7f1"), LF: __i18n_k("league.awards.text.73836db2"), CF: __i18n_k("league.awards.text.56780b2a"), RF: __i18n_k("league.awards.text.a28a0ef8") };
  for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as FieldPos[]) {
    const top = best(
      hitters.filter((r) => posGames(r, pos) >= games / 2),
      (r) => (gradeAt(r)[pos] ?? 0) + posGames(r, pos) / 30,
    );
    if (top) out.push({ pos: NAMES[pos]!, id: top.p.id });
  }
  const multi = (r: Rec) => (['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as FieldPos[]).filter((pos) => posGames(r, pos) >= 20);
  const utility = best(
    hitters.filter((r) => multi(r).length >= 3 && !out.some((x) => x.id === r.p.id)),
    (r) => {
      const at = gradeAt(r);
      const list = multi(r);
      return list.reduce((a, pos) => a + (at[pos] ?? 0), 0) / list.length + list.length * 2;
    },
  );
  if (utility) out.push({ pos: __i18n_k("league.awards.text.51ab685b"), id: utility.p.id });
  return out;
}

/** Writes the season's honours on the players. */
export function awardHonours(s: LeagueState, year: number, a: SeasonAwards) {
  const give = (id: PlayerId | null, text: string) => {
    const p = id ? s.players[id] : null;
    if (p) (p.honors ??= []).push(`${year} ${text}`);
  };
  give(a.mvp, 'MVP');
  give(a.rookie, '신인왕');
  for (const g of a.goldenGloves) give(g.id, __i18n_k("league.awards.awardHonours.0d9ed90e", { pos: g.pos }));
  for (const g of a.defense ?? []) give(g.id, __i18n_k("league.awards.text.54980726", { pos: g.pos }));
  for (const t of a.titles) give(t.id, __i18n_k("league.awards.awardHonours.c6a60592", { label: t.label, value: t.value }));
}

// ── Hall of fame ──────────────────────────────────────────────────────────────────────────────────

export interface HallEntry {
  id: PlayerId;
  name: string;
  year: number;
  war: number;
  seasons: number;
  teams: TeamId[];
  line: string;
}

/** 1.9.9 (the user's request): a reliever's WAR is small, so the bullpen's bar is lower: WAR 40, or WAR 25 with 300
    saves and holds, or WAR 25 with three save or hold titles. */
const HALL = { war: 65, warWithHonours: 55, honours: 5, relieverWar: 40, relieverWarWithSaves: 25, relieverSaves: 300, relieverTitles: 3 };

/** 1.9.9: how many times he led the league in saves or holds. */
export const bullpenTitles = (s: Pick<LeagueState, 'history'>, id: PlayerId) => {
  const labels = [awardLabel('sv'), awardLabel('hld')];
  return s.history.reduce((a, h) => a + (h.awards?.titles.filter((t) => t.id === id && labels.includes(t.label)).length ?? 0), 0);
};

/** A retiring player's career: enough WAR, or a strong career with major awards, enters the hall. */
export function hallOfFameCheck(s: LeagueState, p: Player, year: number) {
  const major = p.career.filter((c) => !c.level);
  const war = Math.round(major.reduce((a, c) => a + c.war, 0) * 10) / 10;
  const big = (p.honors ?? []).filter((h) => h.includes('MVP') || h.includes('골든글러브') || h.includes('신인왕')).length;
  const saves = major.reduce((a, c) => a + (c.pit?.sv ?? 0) + (c.pit?.hld ?? 0), 0);
  const bullpen = isReliever(p) && (war >= HALL.relieverWar || (war >= HALL.relieverWarWithSaves && (saves >= HALL.relieverSaves || bullpenTitles(s, p.id) >= HALL.relieverTitles)));
  if (war < HALL.war && !(war >= HALL.warWithHonours && big >= HALL.honours) && !bullpen) return;
  if (s.hallOfFame?.some((h) => h.id === p.id)) return;
  const bat = major.reduce((a, c) => ({ h: a.h + (c.bat?.h ?? 0), hr: a.hr + (c.bat?.hr ?? 0) }), { h: 0, hr: 0 });
  const pit = major.reduce((a, c) => ({ w: a.w + (c.pit?.w ?? 0), sv: a.sv + (c.pit?.sv ?? 0), outs: a.outs + (c.pit?.outs ?? 0) }), { w: 0, sv: 0, outs: 0 });
  const line = isPitcher(p) ? __i18n_k("league.awards.hallOfFameCheck.line.06b1f0af", { w: pit.w, sv: pit.sv, ip: ip(pit.outs) }) : __i18n_k("league.awards.hallOfFameCheck.line.0d295302", { h: bat.h, hr: bat.hr });
  const entry = { id: p.id, name: p.name, year, war, seasons: major.length, teams: [...new Set(major.map((c) => c.teamId))], line };
  (s.hallOfFame ??= []).push(entry);
  hallAlert(s, p, entry);
  if (s.user && major.filter((c) => c.teamId === s.user!.teamId).length >= 3) {
    unlock(s, 'hallOfFame', year, p.name);
    milestone(s, year, __i18n_k("league.awards.hallOfFameCheck.e49320c0", { name: p.name }));
  }
}
