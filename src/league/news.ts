/* News (V0.7). Articles about the user's club and the league's big moments, written from templates in
   Draft Room's sports-page style (short declarative sentences, speakers who sound like themselves).
   Every article keeps the public facts it was written from, so an optional language model can rewrite
   it later (story/); the template text is always there as the fallback. Wording draws from a hash of
   the article id, never from the simulation's random streams. */
import { hashUnit } from '../draftroom';
import type { StoredBox } from './boxscore';
import type { Player, PlayerId, TeamId } from '../model/types';
import { eulreul, eunneun, iga, wagwa } from './josa';
import { isPitcher } from './players';
import type { LeagueState } from './state';
import type { PlayEvent } from './engine/types';
import { gameDetail, monthDetail, seasonDetail } from './gamedetail';

export type NewsKind = 'game' | 'milestone' | 'month' | 'season' | 'award' | 'interview' | 'move';

export interface Quote {
  who: string;
  role: 'player' | 'manager' | 'fan' | 'gm';
  text: string;
}

export interface NewsItem {
  id: string;
  date: string;
  kind: NewsKind;
  title: string;
  body: string;
  quotes: Quote[];
  /** Public facts the article was written from (numbers and names only). */
  facts: Record<string, string | number>;
  /** Longer fact lines (V0.7.1): a game's scoring plays and lines, a month's results, a season's leaders. */
  detail?: string[];
  players: PlayerId[];
  /** A language model's version, when one wrote it (the template stays as the fallback). */
  ai?: { title: string; body: string; quotes: Quote[]; provider: string; model: string };
}

const KEEP = 250;

const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;
const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;

export function addNews(s: LeagueState, item: Omit<NewsItem, 'id'> & { id?: string }) {
  const news = (s.news ??= []);
  const id = item.id ?? `${item.date}-${item.kind}-${news.length}`;
  if (news.some((n) => n.id === id)) return;
  news.push({ ...item, id });
  if (news.length > KEEP) news.splice(0, news.length - KEEP);
}

// ── Voices ───────────────────────────────────────────────────────────────────────────────────────

/** What a player says after a big day, by personality (Draft Room's eight). */
const PLAYER_VOICE: Record<string, string[]> = {
  '차분한 노력파': ['준비한 대로 했을 뿐입니다. 내일도 똑같이 하겠습니다.', '특별한 건 없었습니다. 하던 걸 계속했습니다.'],
  '승부욕 강한 도전자': ['지는 건 정말 싫습니다. 오늘은 꼭 이기고 싶었어요.', '이런 순간을 기다렸습니다. 더 큰 경기에서도 해내고 싶습니다.'],
  '밝은 분위기 메이커': ['더그아웃 분위기가 좋으니까 저도 신이 났어요!', '팬분들 함성 들으니까 몸이 저절로 움직였습니다. 감사합니다!'],
  '분석을 즐기는 연구형': ['전력분석팀이 준 자료대로 노림수를 가졌습니다.', '상대 투수 패턴을 계속 봤는데 그 공이 올 거라고 생각했습니다.'],
  '책임감 강한 리더': ['제 기록보다 팀이 이긴 게 중요합니다. 후배들이 잘 버텨 줬습니다.', '고참으로서 해야 할 일을 했을 뿐입니다.'],
  '말보다 행동하는 실천형': ['말보다 경기로 보여 드리고 싶었습니다.', '할 말은 없습니다. 내일도 나가서 치겠습니다.'],
  '꾸준함을 믿는 성실형': ['하루하루 쌓은 게 오늘 나온 것 같습니다.', '루틴을 지킨 덕분입니다. 시즌은 기니까 들뜨지 않겠습니다.'],
  '큰 무대를 즐기는 대담형': ['큰 경기일수록 더 재밌어요. 떨리지 않았습니다.', '이런 무대 체질인 것 같습니다. 다음에도 저한테 오면 좋겠네요.'],
};
const PLAYER_DEFAULT = ['팀이 이겨서 기쁩니다.', '좋은 결과가 나와서 다행입니다.'];

const MANAGER_WIN = ['선수들이 끝까지 집중했다. 칭찬하고 싶다.', '준비한 대로 잘 풀렸다. 이 흐름을 이어 가겠다.', '어려운 경기였는데 선수들이 이겨 냈다.'];
const MANAGER_LOSS = ['오늘은 상대가 더 잘했다. 빨리 잊고 다음 경기를 준비하겠다.', '실책이 아쉬웠다. 선수들과 다시 이야기하겠다.', '투수 운용은 내 판단이었다. 책임은 나에게 있다.'];
const FANS_WIN = ['이 맛에 야구 본다', '오늘 직관 온 사람 승리', '분위기 탔다 이대로 가자', '끝까지 안 나가길 잘했다'];
const FANS_LOSS = ['내일은 이기자…', '불펜 좀 어떻게 해 봐', '그래도 끝까지 응원한다', '타선 언제 터지냐'];

export const playerQuote = (p: Player, key: string): Quote => ({ who: p.name, role: 'player', text: pick(PLAYER_VOICE[p.personality] ?? PLAYER_DEFAULT, key) });
const managerQuote = (s: LeagueState, teamId: TeamId, won: boolean, key: string): Quote => ({
  who: `${s.clubs?.[teamId]?.staff?.manager?.name ?? ''} 감독`.trim(),
  role: 'manager',
  text: pick(won ? MANAGER_WIN : MANAGER_LOSS, key),
});
/** Two different fan reactions. */
const fanQuotes = (won: boolean, key: string): Quote[] => {
  const lines = won ? FANS_WIN : FANS_LOSS;
  const a = Math.floor(hashUnit(`${key}-0`) * lines.length);
  const b = (a + 1 + Math.floor(hashUnit(`${key}-1`) * (lines.length - 1))) % lines.length;
  return [a, b].map((i) => ({ who: '팬', role: 'fan' as const, text: lines[i]! }));
};

// ── Game stories ─────────────────────────────────────────────────────────────────────────────────

/**
 * The most notable thing about the user's game, if anything (one article per game at most). With
 * `recap`, an ordinary game gets a plain recap too (the box score's "기사로 쓰기").
 */
export function gameNews(s: LeagueState, box: StoredBox, log?: PlayEvent[] | null, recap = false) {
  const u = s.user;
  if (!u || (box.home !== u.teamId && box.away !== u.teamId)) return;
  const us = box.home === u.teamId ? 1 : 0;
  const them = (1 - us) as 0 | 1;
  const [rs, rt] = [box.rhe[us][0], box.rhe[them][0]];
  const won = rs > rt;
  const opp = short(s, us ? box.away : box.home);
  const me = short(s, u.teamId);
  const key = box.id;
  const name = (id: PlayerId) => s.players[id]?.name ?? '?';
  const bat = box.bat[us],
    pit = box.pit[us];
  const hero = [...bat].sort((a, b) => b[6] * 3 + b[4] + b[5] - (a[6] * 3 + a[4] + a[5]))[0];
  const ace = pit[0];
  const facts: NewsItem['facts'] = { date: box.date, club: me, opponent: opp, runsFor: rs, runsAgainst: rt, result: won ? '승' : rs < rt ? '패' : '무', innings: box.innings };
  const walkOff = won && us === 1 && box.line[1].length === box.line[0].length && (box.line[1].at(-1) ?? 0) > 0;
  const noHit = box.rhe[them][1] === 0 && box.line[them].length >= 9;
  const multiHr = bat.find((b) => b[6] >= 2);
  const bigK = pit.find((p) => p[6] >= 10);
  const fourHits = bat.find((b) => b[4] >= 4);
  let title = '',
    body = '',
    star: PlayerId | null = null;
  if (noHit) {
    star = ace?.[0] ?? null;
    title = `${me}, ${opp} 상대로 노히트 노런`;
    body = `${iga(me)} ${box.date} ${opp}전에서 안타를 하나도 내주지 않았다. 선발 ${ace![1] >= 27 ? `${iga(name(ace![0]))} 9이닝을 혼자 막았다` : `${wagwa(name(ace![0]))} 불펜이 이어 던졌다`}. 삼진 ${pit.reduce((a, p) => a + p[6], 0)}개를 잡았다. 최종 스코어 ${rs}-${rt}.`;
  } else if (walkOff) {
    star = hero?.[0] ?? null;
    title = `${me}, ${opp}에 끝내기 승리`;
    body = `${iga(me)} ${box.innings}회말 끝내기로 ${eulreul(opp)} ${rs}-${rt}로 꺾었다. ${hero ? `${iga(name(hero[0]))} ${hero[4]}안타 ${hero[5]}타점으로 앞장섰다.` : ''}`;
  } else if (multiHr) {
    star = multiHr[0];
    title = `${name(multiHr[0])}, 한 경기 홈런 ${multiHr[6]}개`;
    body = `${iga(name(multiHr[0]))} ${opp}전에서 홈런 ${multiHr[6]}개를 쳤다. ${multiHr[5]}타점. ${eunneun(me)} ${rs}-${rt}로 ${won ? '이겼다' : rs < rt ? '졌다' : '비겼다'}.`;
  } else if (bigK) {
    star = bigK[0];
    title = `${name(bigK[0])}, 삼진 ${bigK[6]}개`;
    body = `${iga(name(bigK[0]))} ${opp} 타선을 상대로 ${Math.floor(bigK[1] / 3)}이닝 동안 삼진 ${bigK[6]}개를 잡았다. 실점 ${bigK[3]}. 팀은 ${rs}-${rt}로 ${won ? '이겼다' : rs < rt ? '졌다' : '비겼다'}.`;
  } else if (fourHits) {
    star = fourHits[0];
    title = `${name(fourHits[0])}, ${fourHits[4]}안타 맹타`;
    body = `${iga(name(fourHits[0]))} ${opp}전에서 ${fourHits[2]}타수 ${fourHits[4]}안타를 쳤다. ${eunneun(me)} ${rs}-${rt}로 ${won ? '이겼다' : rs < rt ? '졌다' : '비겼다'}.`;
  } else if (Math.abs(rs - rt) >= 9) {
    title = won ? `${me}, ${opp}에 ${rs}-${rt} 대승` : `${me}, ${opp}에 ${rs}-${rt} 대패`;
    body = won ? `${me} 타선이 ${opp} 마운드를 두들겼다. 안타 ${box.rhe[us][1]}개로 ${rs}점을 냈다.` : `${iga(me)} ${opp}에 ${rt}점을 내줬다. 마운드가 버티지 못했다.`;
    star = won ? (hero?.[0] ?? null) : null;
  } else if (box.innings >= 11 && won) {
    title = `${me}, 연장 ${box.innings}회 끝에 승리`;
    body = `${iga(me)} ${opp}전에서 ${box.innings}회까지 가는 접전 끝에 ${rs}-${rt}로 이겼다.`;
    star = hero?.[0] ?? null;
  } else if (recap) {
    const sp = pit[0];
    title = `${me}, ${opp}에 ${rs}-${rt} ${won ? '승리' : rs < rt ? '패배' : '무승부'}`;
    body = `${iga(me)} ${box.date} ${opp}전에서 ${rs}-${rt}로 ${won ? '이겼다' : rs < rt ? '졌다' : '비겼다'}. ${sp ? `선발 ${iga(name(sp[0]))} ${Math.floor(sp[1] / 3)}이닝 ${sp[3]}실점했다.` : ''} ${hero && hero[4] > 0 ? `타선에서는 ${iga(name(hero[0]))} ${hero[4]}안타 ${hero[5]}타점을 기록했다.` : ''}`.trim();
    star = won ? (hero?.[0] ?? null) : null;
  } else return;
  const quotes: Quote[] = [];
  if (star && s.players[star]) quotes.push(playerQuote(s.players[star]!, `${key}-p`));
  quotes.push(managerQuote(s, u.teamId, won, `${key}-m`), ...fanQuotes(won, `${key}-f`));
  if (star) facts.star = name(star);
  addNews(s, { id: `g-${box.id}`, date: box.date, kind: 'game', title, body, quotes, facts, detail: gameDetail(s, box, log), players: star ? [star] : [] });
}

/** The box score's "기사로 쓰기": the game's article, written now if it had none. */
export function gameRecap(s: LeagueState, boxId: string) {
  const box = s.boxes?.[boxId];
  if (box) gameNews(s, box, s.pbp?.[boxId], true);
}

/** Fact lines for an article written before V0.7.1, rebuilt while its game is still kept. */
export function detailFor(s: LeagueState, item: NewsItem): string[] | undefined {
  if (item.detail) return item.detail;
  if (item.kind === 'game' && item.id.startsWith('g-')) {
    const box = s.boxes?.[item.id.slice(2)];
    if (box) return gameDetail(s, box, s.pbp?.[box.id]);
  }
  return undefined;
}


// ── Milestones ──────────────────────────────────────────────────────────────────────────────────

const MARKS: { key: 'hr' | 'h' | 'w' | 'sv' | 'k'; label: string; steps: number[]; pitcher: boolean }[] = [
  { key: 'hr', label: '홈런', steps: [100, 200, 300, 400, 500], pitcher: false },
  { key: 'h', label: '안타', steps: [1000, 1500, 2000, 2500, 3000], pitcher: false },
  { key: 'w', label: '승', steps: [100, 150, 200], pitcher: true },
  { key: 'sv', label: '세이브', steps: [100, 200, 300, 400], pitcher: true },
  { key: 'k', label: '탈삼진', steps: [1000, 1500, 2000], pitcher: true },
];

/** Career totals crossing a round number today (first-team, the user's players). */
export function milestoneNews(s: LeagueState, date: string, ids: PlayerId[]) {
  for (const id of ids) {
    const p = s.players[id];
    const line = s.lines[id];
    if (!p || !line || p.teamId !== s.user?.teamId) continue;
    for (const m of MARKS) {
      if (m.pitcher !== isPitcher(p)) continue;
      const src = (c: { bat: import('../model/types').BatTotals | null; pit: import('../model/types').PitTotals | null }) =>
        m.pitcher ? ((c.pit as unknown as Record<string, number>)?.[m.key] ?? 0) : ((c.bat as unknown as Record<string, number>)?.[m.key] ?? 0);
      const before = p.career.filter((c) => !c.level).reduce((a, c) => a + src(c), 0);
      const total = before + src(line);
      for (const step of m.steps) {
        if (total < step || before >= step) continue;
        const done = s.news?.some((n) => n.id === `m-${id}-${m.key}-${step}`);
        if (done) continue;
        addNews(s, {
          id: `m-${id}-${m.key}-${step}`,
          date,
          kind: 'milestone',
          title: `${p.name}, 통산 ${step}${m.label}`,
          body: `${iga(p.name)} ${date} 통산 ${eulreul(`${step}${m.label}`)} 달성했다. ${p.proSince}년 데뷔.`,
          quotes: [playerQuote(p, `m-${id}-${step}`)],
          facts: { player: p.name, milestone: `${step} ${m.label}`, date },
          players: [id],
        });
      }
    }
  }
}

// ── Month and season ─────────────────────────────────────────────────────────────────────────────

/** At the first game day of a month: last month's record and the club's best hitter and pitcher. */
export function monthNews(s: LeagueState, date: string) {
  const u = s.user;
  if (!u) return;
  const month = Number(date.slice(5, 7));
  const prev = month - 1;
  if (prev < 3) return;
  const id = `month-${s.year}-${prev}`;
  if (s.news?.some((n) => n.id === id)) return;
  const games = s.scores.filter((g) => Number(g.date.slice(5, 7)) === prev && (g.home === u.teamId || g.away === u.teamId));
  if (!games.length) return;
  let w = 0,
    l = 0;
  for (const g of games) {
    const mine = g.home === u.teamId ? g.hs : g.as,
      theirs = g.home === u.teamId ? g.as : g.hs;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
  }
  const me = short(s, u.teamId);
  const rate = w + l ? w / (w + l) : 0;
  const tone = rate >= 0.6 ? '신바람' : rate >= 0.5 ? '순항' : rate >= 0.4 ? '제자리걸음' : '부진';
  addNews(s, {
    id,
    date,
    kind: 'month',
    title: `${me} ${prev}월 결산: ${w}승 ${l}패, ${tone}`,
    body: `${iga(me)} ${prev}월 ${games.length}경기에서 ${w}승 ${l}패를 거뒀다. ${rate >= 0.5 ? '다음 달에도 이 흐름을 이어 가는 게 과제다.' : '반등의 실마리를 찾아야 한다.'}`,
    quotes: fanQuotes(rate >= 0.5, id),
    facts: { month: prev, wins: w, losses: l, club: me },
    detail: monthDetail(s, u.teamId, s.year, prev),
    players: [],
  });
}

/** The season review for the user's club and the league's MVP story. */
export function seasonNews(s: LeagueState, year: number) {
  const h = s.history.find((x) => x.year === year);
  const u = s.user;
  if (!h) return;
  const date = `${year}-11-01`;
  if (h.awards?.mvp) {
    const p = s.players[h.awards.mvp];
    const c = p?.career.find((x) => x.year === year && !x.level);
    if (p && c)
      addNews(s, {
        id: `mvp-${year}`,
        date,
        kind: 'award',
        title: `${year} MVP ${p.name}`,
        body: `${short(s, c.teamId)} ${iga(p.name)} ${year} 정규시즌 MVP에 올랐다. WAR ${c.war.toFixed(1)}. ${c.bat ? `타율 ${(c.bat.ab ? c.bat.h / c.bat.ab : 0).toFixed(3).replace(/^0/, '')}, 홈런 ${c.bat.hr}개` : ''}${c.pit ? `${c.pit.w}승, 삼진 ${c.pit.k}개` : ''}.`,
        quotes: [playerQuote(p, `mvp-${year}`)],
        facts: { year, player: p.name, club: short(s, c.teamId), war: c.war },
        players: [p.id],
      });
  }
  if (!u) return;
  const row = h.table.find((r) => r.teamId === u.teamId);
  if (!row) return;
  const me = short(s, u.teamId);
  const champ = h.champion === u.teamId;
  const report = s.clubs?.[u.teamId]?.reports.find((r) => r.year === year);
  addNews(s, {
    id: `season-${year}`,
    date,
    kind: 'season',
    title: champ ? `${me}, ${year} 한국시리즈 우승` : `${me} ${year} 시즌 결산: ${row.rank}위`,
    body: `${iga(me)} ${year} 시즌을 ${row.w}승 ${row.l}패 ${row.t}무, ${row.rank}위로 마쳤다. ${champ ? '한국시리즈 정상에 올랐다.' : row.rank <= 5 ? '가을야구에 나갔다.' : '가을야구에는 닿지 못했다.'}${report?.homeGames ? ` 홈 관중은 경기당 ${Math.round(report.fans / report.homeGames).toLocaleString('ko-KR')}명.` : ''}`,
    quotes: [managerQuote(s, u.teamId, row.pct >= 0.5, `season-${year}`), ...fanQuotes(row.pct >= 0.5, `season-${year}`)],
    facts: { year, club: me, rank: row.rank, wins: row.w, losses: row.l, champion: champ ? '예' : '아니오' },
    detail: seasonDetail(s, u.teamId, year),
    players: [],
  });
}

// ── Interviews on request ────────────────────────────────────────────────────────────────────────

/** A short interview the general manager asks for: this season so far, in the player's own voice. */
export function interviewNews(s: LeagueState, id: PlayerId, date: string) {
  const p = s.players[id];
  if (!p) return;
  const line = s.lines[id];
  const key = `iv-${id}-${date}`;
  const good = line?.bat ? line.bat.pa > 30 && (line.bat.h + line.bat.bb) / Math.max(1, line.bat.pa) > 0.34 : line?.pit ? line.pit.outs > 30 && (27 * line.pit.er) / line.pit.outs < 4 : false;
  const q1 = good ? '요즘 컨디션이 좋아 보인다.' : '최근 흐름이 아쉽다.';
  const a1 = good ? pick(PLAYER_VOICE[p.personality] ?? PLAYER_DEFAULT, key) : pick(['잘 안 풀릴 때일수록 기본으로 돌아가려고 합니다.', '코치님들과 영상 보면서 계속 고치고 있습니다.', '제가 해야 할 몫을 못 하고 있어서 팀에 미안합니다.'], key);
  addNews(s, {
    id: key,
    date,
    kind: 'interview',
    title: `[인터뷰] ${p.name}`,
    body: `— ${q1}\n${a1}\n— 팬들에게 한마디.\n${pick(['늘 응원해 주셔서 감사합니다. 그라운드에서 보답하겠습니다.', '야구장 많이 찾아와 주세요. 더 좋은 경기 보여 드리겠습니다.', '끝까지 믿어 주시면 결과로 말씀드리겠습니다.'], `${key}-2`)}`,
    quotes: [],
    facts: { player: p.name, personality: p.personality, ...(line?.bat ? { pa: line.bat.pa, h: line.bat.h, hr: line.bat.hr } : {}), ...(line?.pit ? { outs: line.pit.outs, er: line.pit.er, k: line.pit.k } : {}) },
    detail: interviewDetail(s, p, date),
    players: [id],
  });
}

/** An interview's facts: the season so far, the last five games from the kept box scores, the record. */
function interviewDetail(s: LeagueState, p: Player, date: string): string[] {
  const out: string[] = [];
  const line = s.lines[p.id];
  const team = p.teamId ? short(s, p.teamId) : '';
  out.push(`${team} ${p.name}, ${p.personality}, ${p.proSince}년 데뷔`);
  const b = line?.bat,
    q = line?.pit;
  if (b?.pa) out.push(`올 시즌 ${b.g}경기 ${b.pa}타석 타율 ${(b.ab ? b.h / b.ab : 0).toFixed(3).replace(/^0/, '')} 홈런 ${b.hr}개 ${b.rbi}타점 도루 ${b.sb}개`);
  if (q?.outs) out.push(`올 시즌 ${q.g}경기 ${q.w}승 ${q.l}패 ${q.sv}세이브 ${q.hld}홀드 ${Math.floor(q.outs / 3)}이닝 평균자책점 ${((27 * q.er) / q.outs).toFixed(2)} 삼진 ${q.k}개`);
  const games = Object.values(s.boxes ?? {})
    .filter((x) => x.date <= date && (x.bat[0].some((r) => r[0] === p.id) || x.bat[1].some((r) => r[0] === p.id) || x.pit[0].some((r) => r[0] === p.id) || x.pit[1].some((r) => r[0] === p.id)))
    .sort((a, c) => c.date.localeCompare(a.date))
    .slice(0, 5);
  for (const g of games) {
    const side = g.bat[0].some((r) => r[0] === p.id) || g.pit[0].some((r) => r[0] === p.id) ? 0 : 1;
    const opp = short(s, side ? g.away : g.home);
    const br = g.bat[side].find((r) => r[0] === p.id);
    const pr = g.pit[side].find((r) => r[0] === p.id);
    if (br) out.push(`${g.date.slice(5)} ${opp}전 ${br[2]}타수 ${br[4]}안타 ${br[5]}타점${br[6] ? ` 홈런 ${br[6]}개` : ''}`);
    if (pr) out.push(`${g.date.slice(5)} ${opp}전 ${Math.floor(pr[1] / 3)}이닝 ${pr[3]}실점 삼진 ${pr[6]}개${pr[9] ? ` (${{ W: '승', L: '패', S: '세이브', H: '홀드' }[pr[9]]})` : ''}`);
  }
  for (const h of (p.honors ?? []).slice(-3)) out.push(`수상: ${h}`);
  return out;
}
