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
import { isForeign, isPitcher } from './players';
import { avg, era, obp, slg } from './stats';
import type { LeagueState } from './state';
import type { StandingRow } from './standings';
import { milestone, unlock } from './milestones';

export interface SeasonAwards {
  mvp: PlayerId | null;
  rookie: PlayerId | null;
  goldenGloves: { pos: string; id: PlayerId }[];
  titles: { label: string; id: PlayerId; value: string }[];
}

type Rec = { p: Player; c: SeasonRecord };

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
  title('타율', qBat, (r) => avg(b(r)), (r) => f3(avg(b(r))));
  title('홈런', hitters, (r) => b(r).hr, (r) => `${b(r).hr}개`);
  title('타점', hitters, (r) => b(r).rbi, (r) => `${b(r).rbi}`);
  title('득점', hitters, (r) => b(r).r, (r) => `${b(r).r}`);
  title('안타', hitters, (r) => b(r).h, (r) => `${b(r).h}개`);
  title('도루', hitters, (r) => b(r).sb, (r) => `${b(r).sb}개`);
  title('출루율', qBat, (r) => obp(b(r)), (r) => f3(obp(b(r))));
  title('장타율', qBat, (r) => slg(b(r)), (r) => f3(slg(b(r))));
  title('다승', pitchers, (r) => q(r).w, (r) => `${q(r).w}승`);
  title('평균자책점', qPit, (r) => era(q(r)), (r) => era(q(r)).toFixed(2), true);
  title('탈삼진', pitchers, (r) => q(r).k, (r) => `${q(r).k}개`);
  title('세이브', pitchers, (r) => q(r).sv, (r) => `${q(r).sv}개`);
  title('홀드', pitchers, (r) => q(r).hld, (r) => `${q(r).hld}개`);
  const decided = pitchers.filter((r) => q(r).w + q(r).l >= 10);
  title('승률', decided, (r) => q(r).w / (q(r).w + q(r).l), (r) => f3(q(r).w / (q(r).w + q(r).l)));

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
  const LABEL: Record<string, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', DH: '지명타자' };
  for (const pos of ['C', '1B', '2B', '3B', 'SS'] as FieldPos[]) {
    const top = best(hitters.filter((r) => posGames(r, pos) >= 60), (r) => r.c.war);
    if (top) goldenGloves.push({ pos: LABEL[pos]!, id: top.p.id });
  }
  const outfield = hitters
    .filter((r) => posGames(r, 'LF') + posGames(r, 'CF') + posGames(r, 'RF') >= 60)
    .sort((a, b2) => b2.c.war - a.c.war)
    .slice(0, 3);
  for (const r of outfield) goldenGloves.push({ pos: '외야수', id: r.p.id });
  const dh = best(hitters.filter((r) => posGames(r, 'DH') >= 60), (r) => r.c.war);
  if (dh) goldenGloves.push({ pos: LABEL.DH!, id: dh.p.id });

  return { mvp: mvp?.p.id ?? null, rookie: rookie?.p.id ?? null, goldenGloves, titles };
}

/** Writes the season's honours on the players. */
export function awardHonours(s: LeagueState, year: number, a: SeasonAwards) {
  const give = (id: PlayerId | null, text: string) => {
    const p = id ? s.players[id] : null;
    if (p) (p.honors ??= []).push(`${year} ${text}`);
  };
  give(a.mvp, 'MVP');
  give(a.rookie, '신인왕');
  for (const g of a.goldenGloves) give(g.id, `골든글러브 (${g.pos})`);
  for (const t of a.titles) give(t.id, `${t.label} 1위 (${t.value})`);
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

const HALL = { war: 65, warWithHonours: 55, honours: 5 };

/** A retiring player's career: enough WAR, or a strong career with major awards, enters the hall. */
export function hallOfFameCheck(s: LeagueState, p: Player, year: number) {
  const major = p.career.filter((c) => !c.level);
  const war = Math.round(major.reduce((a, c) => a + c.war, 0) * 10) / 10;
  const big = (p.honors ?? []).filter((h) => h.includes('MVP') || h.includes('골든글러브') || h.includes('신인왕')).length;
  if (war < HALL.war && !(war >= HALL.warWithHonours && big >= HALL.honours)) return;
  if (s.hallOfFame?.some((h) => h.id === p.id)) return;
  const bat = major.reduce((a, c) => ({ h: a.h + (c.bat?.h ?? 0), hr: a.hr + (c.bat?.hr ?? 0) }), { h: 0, hr: 0 });
  const pit = major.reduce((a, c) => ({ w: a.w + (c.pit?.w ?? 0), sv: a.sv + (c.pit?.sv ?? 0), outs: a.outs + (c.pit?.outs ?? 0) }), { w: 0, sv: 0, outs: 0 });
  const line = isPitcher(p) ? `${pit.w}승 ${pit.sv}세이브 ${ip(pit.outs)}이닝` : `${bat.h}안타 ${bat.hr}홈런`;
  (s.hallOfFame ??= []).push({ id: p.id, name: p.name, year, war, seasons: major.length, teams: [...new Set(major.map((c) => c.teamId))], line });
  if (s.user && major.filter((c) => c.teamId === s.user!.teamId).length >= 3) {
    unlock(s, 'hallOfFame', year, p.name);
    milestone(s, year, `${p.name} 명예의 전당 헌액`);
  }
}
