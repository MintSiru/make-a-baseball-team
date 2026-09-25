/* Fact lines for articles (V0.7.1): what happened in a game, a month or a season, written as short
   public statements a language model can build a longer story from — starters' lines, the line score,
   the big bats, every scoring play in order with the outs and runners, late pitching changes, and the
   records afterwards. Nothing hidden (no true abilities); the play wording is the same the text relay
   shows. */
import type { StoredBox } from './boxscore';
import type { PlayEvent } from './engine/types';
import type { TeamId } from '../model/types';
import { halfLabel, playText } from './playtext';
import type { LeagueState } from './state';

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const ip = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
const DEC: Record<string, string> = { W: '승리투수', L: '패전투수', S: '세이브', H: '홀드' };

const OUTS = ['무사', '1사', '2사'];
const basesText = (b: [boolean, boolean, boolean]) => {
  const on = b.map((x, i) => (x ? `${i + 1}` : '')).filter(Boolean);
  return on.length === 0 ? '주자 없음' : on.length === 3 ? '만루' : `${on.join('·')}루`;
};

/** A club's record through `date` (wins, losses, ties). */
function recordThrough(s: LeagueState, teamId: TeamId, date: string) {
  let w = 0,
    l = 0,
    t = 0;
  for (const g of s.scores) {
    if (g.date > date || (g.home !== teamId && g.away !== teamId)) continue;
    const mine = g.home === teamId ? g.hs : g.as,
      theirs = g.home === teamId ? g.as : g.hs;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
    else t++;
  }
  return { w, l, t };
}

export function gameDetail(s: LeagueState, box: StoredBox, log?: PlayEvent[] | null): string[] {
  const name = (id: string) => s.players[id]?.name ?? '?';
  const clubs = [short(s, box.away), short(s, box.home)] as const;
  const home = s.teams.find((t) => t.id === box.home);
  const out: string[] = [];
  out.push(`${box.date} ${home?.stadium.name ?? ''}, 원정 ${clubs[0]} ${box.rhe[0][0]} : ${box.rhe[1][0]} 홈 ${clubs[1]}${box.innings > 9 ? ` (연장 ${box.innings}회)` : ''}${box.att ? `, 관중 ${box.att.toLocaleString('ko-KR')}명` : ''}`);
  out.push(`이닝별 득점 ${clubs[0]}: ${box.line[0].join(' ')} / ${clubs[1]}: ${box.line[1].join(' ')}`);
  out.push(`안타 ${clubs[0]} ${box.rhe[0][1]}개, ${clubs[1]} ${box.rhe[1][1]}개. 실책 ${clubs[0]} ${box.rhe[0][2]}개, ${clubs[1]} ${box.rhe[1][2]}개`);
  for (const i of [0, 1] as const) {
    const [sp, ...pen] = box.pit[i];
    if (sp) out.push(`${clubs[i]} 선발 ${name(sp[0])}: ${ip(sp[1])}이닝 ${sp[2]}피안타 ${sp[3]}실점(${sp[4]}자책) 볼넷·사구 ${sp[5]}개 삼진 ${sp[6]}개 투구 수 ${sp[8]}개${sp[9] ? ` (${DEC[sp[9]]})` : ''}`);
    for (const r of pen.filter((x) => x[9] || x[3] > 0 || x[1] >= 6)) out.push(`${clubs[i]} 구원 ${name(r[0])}: ${ip(r[1])}이닝 ${r[3]}실점 삼진 ${r[6]}개${r[9] ? ` (${DEC[r[9]]})` : ''}`);
    for (const b of box.bat[i].filter((x) => x[4] >= 2 || x[6] > 0 || x[5] >= 2 || x[11] > 0)) {
      const extra = [b[9] ? `2루타 ${b[9]}개` : '', b[10] ? `3루타 ${b[10]}개` : '', b[6] ? `홈런 ${b[6]}개` : '', b[11] ? `도루 ${b[11]}개` : ''].filter(Boolean).join(', ');
      out.push(`${clubs[i]} ${name(b[0])}: ${b[2]}타수 ${b[4]}안타 ${b[5]}타점 ${b[3]}득점${extra ? ` (${extra})` : ''}`);
    }
  }
  if (log?.length) {
    // Scoring plays in order, with the situation before the play; late pitching changes.
    let outs = 0,
      bases: [boolean, boolean, boolean] = [false, false, false],
      half = '';
    log.forEach((e, n) => {
      const h = halfLabel(e.i, e.top);
      if (h !== half) {
        half = h;
        outs = 0;
        bases = [false, false, false];
      }
      if (e.k === 'pitch') {
        if (e.i >= 7) out.push(`${h} ${playText(e, `${box.id}-${n}`, name)}`);
        return;
      }
      if (e.runs > 0) out.push(`${h} ${OUTS[outs] ?? '2사'} ${basesText(bases)}, ${playText(e, `${box.id}-${n}`, name)} → ${clubs[0]} ${e.score[0]} : ${e.score[1]} ${clubs[1]}`);
      outs = e.outs;
      bases = e.bases;
    });
  }
  for (const i of [0, 1] as const) {
    const r = recordThrough(s, i ? box.home : box.away, box.date);
    out.push(`${clubs[i]} 시즌 성적 ${r.w}승 ${r.l}패 ${r.t}무 (이 경기 포함)`);
  }
  return out;
}

/** A month of the user's club: every result, the record and the best in its box scores. */
export function monthDetail(s: LeagueState, teamId: TeamId, year: number, month: number): string[] {
  const me = short(s, teamId);
  const out: string[] = [];
  const games = s.scores.filter((g) => Number(g.date.slice(0, 4)) === year && Number(g.date.slice(5, 7)) === month && (g.home === teamId || g.away === teamId));
  for (const g of games) {
    const home = g.home === teamId;
    const mine = home ? g.hs : g.as,
      theirs = home ? g.as : g.hs;
    out.push(`${g.date.slice(5)} ${home ? '홈' : '원정'} ${short(s, home ? g.away : g.home)}전 ${mine}-${theirs} ${mine > theirs ? '승' : mine < theirs ? '패' : '무'}`);
  }
  // The month's best from the kept box scores.
  const bat = new Map<string, { ab: number; h: number; hr: number; rbi: number }>();
  const pit = new Map<string, { outs: number; er: number; k: number; w: number; sv: number }>();
  for (const b of Object.values(s.boxes ?? {})) {
    if (Number(b.date.slice(0, 4)) !== year || Number(b.date.slice(5, 7)) !== month) continue;
    if (b.home !== teamId && b.away !== teamId) continue;
    const i: 0 | 1 = b.home === teamId ? 1 : 0;
    for (const r of b.bat[i]) {
      const x = bat.get(r[0]) ?? { ab: 0, h: 0, hr: 0, rbi: 0 };
      x.ab += r[2];
      x.h += r[4];
      x.hr += r[6];
      x.rbi += r[5];
      bat.set(r[0], x);
    }
    for (const r of b.pit[i]) {
      const x = pit.get(r[0]) ?? { outs: 0, er: 0, k: 0, w: 0, sv: 0 };
      x.outs += r[1];
      x.er += r[4];
      x.k += r[6];
      x.w += r[9] === 'W' ? 1 : 0;
      x.sv += r[9] === 'S' ? 1 : 0;
      pit.set(r[0], x);
    }
  }
  const name = (id: string) => s.players[id]?.name ?? '?';
  const hitters = [...bat.entries()].filter(([, x]) => x.ab >= 30).sort((a, b) => b[1].h / b[1].ab - a[1].h / a[1].ab).slice(0, 3);
  for (const [id, x] of hitters) out.push(`${me} ${month}월 타자 ${name(id)}: ${x.ab}타수 ${x.h}안타 (타율 ${(x.h / x.ab).toFixed(3).replace(/^0/, '')}) 홈런 ${x.hr}개 ${x.rbi}타점`);
  const arms = [...pit.entries()].filter(([, x]) => x.outs >= 30).sort((a, b) => a[1].er / a[1].outs - b[1].er / b[1].outs).slice(0, 2);
  for (const [id, x] of arms) out.push(`${me} ${month}월 투수 ${name(id)}: ${ip(x.outs)}이닝 평균자책점 ${((27 * x.er) / x.outs).toFixed(2)} 삼진 ${x.k}개 ${x.w}승${x.sv ? ` ${x.sv}세이브` : ''}`);
  const last = games.at(-1);
  if (last) {
    const r = recordThrough(s, teamId, last.date);
    out.push(`${me} ${month}월 말 시즌 성적 ${r.w}승 ${r.l}패 ${r.t}무`);
  }
  return out;
}

/** A season of the user's club: the finish, the leaders, awards, crowds and the postseason. */
export function seasonDetail(s: LeagueState, teamId: TeamId, year: number): string[] {
  const me = short(s, teamId);
  const h = s.history.find((x) => x.year === year);
  const out: string[] = [];
  if (!h) return out;
  const row = h.table.find((r) => r.teamId === teamId);
  if (row) out.push(`${me} ${year} 정규시즌 ${row.rank}위, ${row.w}승 ${row.l}패 ${row.t}무 (승률 ${row.pct.toFixed(3).replace(/^0/, '')}), 득점 ${row.rs} 실점 ${row.ra}`);
  const top = h.table[0];
  if (top && top.teamId !== teamId) out.push(`정규시즌 1위 ${short(s, top.teamId)} (${top.w}승 ${top.l}패)`);
  for (const x of h.series.filter((x) => x.high === teamId || x.low === teamId)) {
    const round = { wildcard: '와일드카드', semipo: '준플레이오프', po: '플레이오프', ks: '한국시리즈' }[x.round];
    const opp = x.high === teamId ? x.low : x.high;
    const [mine, theirs] = x.high === teamId ? [x.highWins, x.lowWins] : [x.lowWins, x.highWins];
    out.push(`${round} ${short(s, opp)} 상대 ${mine}승 ${theirs}패, ${x.winner === teamId ? '통과' : '탈락'}`);
  }
  if (h.champion) out.push(`${year} 한국시리즈 우승 ${short(s, h.champion)}`);
  const recs = Object.values(s.players)
    .map((p) => ({ p, c: p.career.find((c) => c.year === year && !c.level && c.teamId === teamId) }))
    .filter((x): x is { p: (typeof x)['p']; c: NonNullable<(typeof x)['c']> } => !!x.c);
  for (const { p, c } of recs.filter((x) => x.c.bat && x.c.bat.pa >= 300).sort((a, b) => b.c.war - a.c.war).slice(0, 3)) {
    const b = c.bat!;
    out.push(`${me} 타자 ${p.name}: 타율 ${(b.ab ? b.h / b.ab : 0).toFixed(3).replace(/^0/, '')} 홈런 ${b.hr}개 ${b.rbi}타점 도루 ${b.sb}개 WAR ${c.war.toFixed(1)}`);
  }
  for (const { p, c } of recs.filter((x) => x.c.pit && x.c.pit.outs >= 150).sort((a, b) => b.c.war - a.c.war).slice(0, 3)) {
    const q = c.pit!;
    out.push(`${me} 투수 ${p.name}: ${q.w}승 ${q.l}패 ${q.sv}세이브 ${q.hld}홀드 ${ip(q.outs)}이닝 평균자책점 ${((27 * q.er) / Math.max(1, q.outs)).toFixed(2)} 삼진 ${q.k}개 WAR ${c.war.toFixed(1)}`);
  }
  const a = h.awards;
  if (a) {
    const ours = (id: string | null) => !!id && recs.some((x) => x.p.id === id);
    if (ours(a.mvp)) out.push(`MVP ${s.players[a.mvp!]!.name}`);
    if (ours(a.rookie)) out.push(`신인왕 ${s.players[a.rookie!]!.name}`);
    for (const g of a.goldenGloves.filter((g) => ours(g.id))) out.push(`골든글러브 ${g.pos} ${s.players[g.id]!.name}`);
    for (const t of a.titles.filter((t) => ours(t.id))) out.push(`${t.label} 1위 ${s.players[t.id]!.name} (${t.value})`);
  }
  const report = s.clubs?.[teamId]?.reports.find((r) => r.year === year);
  if (report?.homeGames) out.push(`홈 관중 ${report.fans.toLocaleString('ko-KR')}명, 경기당 ${Math.round(report.fans / report.homeGames).toLocaleString('ko-KR')}명, 매진 ${report.sellouts ?? 0}번`);
  return out;
}
