/* Transaction news (V0.7.2): trades, releases and waivers, unattached signings, foreign replacements,
   postings, free-agent contracts and the second draft become articles, with each player's public record
   as fact lines for an optional language model. Written only in a game with the player's club (the
   generated history and a spectated league keep the transaction log only). The club's own moves are
   always written; between other clubs every trade, foreign replacement and posting deal, and A-grade
   free agents. Wording draws from a hash of the article id, never from the simulation's random streams. */
import { hashUnit, ROLE_LABELS } from '../draftroom';
import type { BatTotals, PitTotals, Player, PlayerId, TeamId } from '../model/types';
import { salaryIn } from './contracts';
import { today } from './entry';
import { usd } from './foreign';
import { recordThrough } from './gamedetail';
import { eulreul, eunneun, iga, ro, wagwa } from './josa';
import { addNews, type Quote } from './news';
import { ageIn, isForeign, isPitcher } from './players';
import { addInto, emptyBat, emptyPit, type LeagueState } from './state';
import { avg, era, obp, slg } from './stats';

export type Move =
  | { type: 'trade'; a: TeamId; b: TeamId; fromA: PlayerId[]; fromB: PlayerId[] }
  | { type: 'release'; teamId: TeamId; id: PlayerId; waiver: boolean; owed: number }
  | { type: 'claim'; teamId: TeamId; from: TeamId; id: PlayerId }
  | { type: 'pool'; teamId: TeamId; id: PlayerId; salary: number }
  /** `out` is passed whole: a foreign player with no first-team record leaves the player list. */
  | { type: 'foreign'; teamId: TeamId; out: Player; in: PlayerId; price: number }
  | { type: 'posting'; teamId: TeamId; id: PlayerId; deal: { years: number; total: number; fee: number } | null }
  | { type: 'fa'; from: TeamId; to: TeamId; id: PlayerId; years: number; annual: number; grade: string }
  | { type: 'secondDraft'; teamId: TeamId; from: TeamId; id: PlayerId; round: number };

const short = (s: LeagueState, id: TeamId) => s.teams.find((t) => t.id === id)?.short ?? id;
const pick = <T,>(xs: T[], key: string) => xs[Math.floor(hashUnit(key) * xs.length)]!;
const f3 = (x: number) => x.toFixed(3).replace(/^0/, '');
const innings = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
/** 만 원 as "1억 7,500만 원". */
const won = (manwon: number) => {
  const eok = Math.floor(manwon / 10000),
    rest = manwon % 10000;
  return `${eok ? `${eok}억${rest ? ' ' : ''}` : ''}${rest || !eok ? `${rest.toLocaleString('ko-KR')}만` : ''} 원`;
};
const POS: Record<string, string> = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' };
const posOf = (p: Player) => (p.position ? POS[p.position]! : ROLE_LABELS[p.role]);

const batLine = (b: BatTotals) => `${b.g}경기 타율 ${f3(avg(b))} 홈런 ${b.hr}개 ${b.rbi}타점 도루 ${b.sb}개 OPS ${f3(obp(b) + slg(b))}`;
const pitLine = (q: PitTotals) => `${q.g}경기 ${q.w}승 ${q.l}패${q.sv ? ` ${q.sv}세이브` : ''}${q.hld ? ` ${q.hld}홀드` : ''} ${innings(q.outs)}이닝 평균자책점 ${era(q).toFixed(2)} 삼진 ${q.k}개`;
const lineOf = (p: Player, c: { bat: BatTotals | null; pit: PitTotals | null }) => (isPitcher(p) ? (c.pit?.outs ? pitLine(c.pit) : null) : c.bat?.pa ? batLine(c.bat) : null);

/** A short record for the article body: this season so far, else his last first-team season. */
function recent(s: LeagueState, p: Player): string | null {
  const now = s.phase === 'regular' ? s.lines[p.id] : undefined;
  const cur = now ? lineOf(p, now) : null;
  if (cur) return `올 시즌 ${cur}`;
  const last = p.career.filter((c) => !c.level).at(-1);
  const prev = last ? lineOf(p, last) : null;
  return prev ? `${last!.year} 시즌 ${prev}` : null;
}

/** A player's public facts: who he is, this season, his last first-team season, his career, pay and honours. */
function playerFacts(s: LeagueState, p: Player, season: number): string[] {
  const out: string[] = [];
  const bg = p.origin.background;
  out.push(`${p.name}: ${ageIn(p, season)}세 ${posOf(p)}, ${p.throws}투${p.bats}타, ${isForeign(p) ? `${p.proSince}년 입단${bg ? `, 경력 ${bg.text}` : ''}` : `${p.proSince}년 데뷔`}`);
  const now = s.phase === 'regular' ? s.lines[p.id] : undefined;
  const cur = now ? lineOf(p, now) : null;
  if (cur) out.push(`${p.name} 올 시즌 1군 ${cur}`);
  const majors = p.career.filter((c) => !c.level);
  const last = majors.at(-1);
  const lastLine = last ? lineOf(p, last) : null;
  if (last && lastLine) out.push(`${p.name} ${last.year} 시즌 1군 (${short(s, last.teamId)}) ${lastLine}, WAR ${last.war.toFixed(1)}`);
  if (majors.length > 1) {
    const tot = { bat: majors.reduce((a, c) => (c.bat ? addInto(a, c.bat) : a), emptyBat()), pit: majors.reduce((a, c) => (c.pit ? addInto(a, c.pit) : a), emptyPit()) };
    const total = lineOf(p, tot);
    if (total) out.push(`${p.name} 1군 통산 ${majors.length}시즌 ${total}`);
  }
  if (!majors.length && !cur) {
    const fut = p.career.filter((c) => c.level === 'futures').at(-1);
    const futLine = fut ? lineOf(p, fut) : null;
    out.push(futLine ? `${p.name} 1군 기록 없음, ${fut!.year} 퓨처스 ${futLine}` : `${p.name} 1군 기록 없음`);
  }
  const pay = salaryIn(p, season);
  if (pay && !isForeign(p)) out.push(`${p.name} ${season}년 연봉 ${won(pay)}`);
  for (const h of (p.honors ?? []).slice(-3)) out.push(`${p.name} 수상: ${h}`);
  return out;
}

const clubFacts = (s: LeagueState, ids: TeamId[], date: string) =>
  s.phase === 'regular'
    ? ids.map((id) => {
        const r = recordThrough(s, id, date);
        return `${short(s, id)} 현재 ${r.w}승 ${r.l}패 ${r.t}무`;
      })
    : [];

const said = (x: Player, text: string): Quote => ({ who: x.name, role: 'player', text });
const managerOf = (s: LeagueState, teamId: TeamId) => `${s.clubs?.[teamId]?.staff?.manager?.name ?? ''} 감독`.trim();
const fans = (lines: string[], key: string): Quote[] => {
  const a = Math.floor(hashUnit(`${key}-f0`) * lines.length);
  const b = (a + 1 + Math.floor(hashUnit(`${key}-f1`) * (lines.length - 1))) % lines.length;
  return [a, b].map((i) => ({ who: '팬', role: 'fan' as const, text: lines[i]! }));
};

const MANAGER = {
  trade: ['필요한 자리를 채웠다. 바로 쓸 생각이다.', '좋은 선수를 보내는 건 아쉽지만 팀에 필요한 선택이었다.', '새로 온 선수가 분위기를 바꿔 주길 기대한다.'],
  release: ['함께 가지 못하게 돼 아쉽다. 어디서든 잘되길 바란다.', '팀 사정상 어쩔 수 없는 결정이었다.', '그동안 고생 많았다. 기회를 더 주지 못해 미안하다.'],
  signing: ['경험 있는 선수다. 빈자리를 메워 줄 것이다.', '몸 상태를 보고 바로 기용하겠다.'],
  foreign: ['남은 시즌 반등의 열쇠가 될 선수다.', '적응만 빨리 하면 충분히 통할 것이다.', '떠난 선수도 고생 많았다. 새 선수에게 기대가 크다.'],
};
const ARRIVAL = ['새 유니폼이 아직 어색하지만 빨리 적응하겠습니다.', '불러 주신 만큼 보답하겠습니다.', '전 팀 팬들께 감사드립니다. 여기서도 제 야구를 하겠습니다.'];
const STAY = ['남게 돼 기쁩니다. 계속 이 유니폼을 입고 뛰겠습니다.', '구단에서 믿어 주셔서 감사합니다. 보답하겠습니다.'];
const MLB = ['어릴 때부터 꿈꾸던 무대입니다. 응원해 주신 팬들께 감사드립니다.', '보내 주신 구단에 감사드립니다. 가서 부끄럽지 않게 뛰겠습니다.'];
const FANS = {
  trade: ['이 트레이드 누가 이긴 거냐', '보낸 선수 잘되길 바란다', '일단 결과로 말하자', '단장 결단 좋다'],
  release: ['그동안 고마웠다', '다른 팀 가서 잘됐으면', '아쉽지만 이해한다'],
  signing: ['환영합니다!', '이번 영입 기대된다', '빈자리 잘 메워 줘'],
  foreign: ['이번엔 제발 터져라', '떠난 선수도 수고 많았다', '영상 보니 기대된다'],
  leaving: ['가서 꼭 성공해라', '떠나는 건 아쉽지만 축하한다', '잘 가라, 고마웠다'],
  stay: ['남아 줘서 고맙다', '역시 우리 선수', '계속 같이 가자'],
};

/** Writes the article for a move (see the header for which ones). */
export function moveNews(s: LeagueState, m: Move, date = s.phase === 'regular' ? today(s) : `${s.year}-11-01`) {
  const u = s.user?.teamId;
  if (!u) return;
  const season = s.phase === 'regular' ? s.year : s.year + 1;
  const p = (id: PlayerId) => s.players[id];
  const names = (ids: PlayerId[]) => ids.map((id) => p(id)?.name ?? '').join('·');
  const base = { date, kind: 'move' as const };
  switch (m.type) {
    case 'trade': {
      const mine = m.a === u || m.b === u;
      const [A, B] = [short(s, m.a), short(s, m.b)];
      const id = `mv-trade-${date}-${[...m.fromA, ...m.fromB].join('-')}`;
      const everyone = [...m.fromA, ...m.fromB].map(p).filter((x): x is Player => !!x);
      const about = everyone.map((x) => {
        const r = recent(s, x);
        return `${eunneun(x.name)} ${ageIn(x, season)}세 ${posOf(x)}${r ? `로 ${r}` : '다'}.`;
      });
      // Seen from the user's club when it is part of the deal, else from the first club.
      const home = m.b === u ? m.b : m.a;
      const arriving = (home === m.a ? m.fromB : m.fromA).map(p).find((x): x is Player => !!x);
      addNews(s, {
        ...base,
        id,
        title: `${A}–${B}, ${names(m.fromA)}↔${names(m.fromB)} 트레이드`,
        body: `${iga(A)} ${B}에 ${eulreul(names(m.fromA))} 내주고 ${eulreul(names(m.fromB))} 받는 ${m.fromA.length}대${m.fromB.length} 트레이드를 했다.\n${about.join(' ')}`,
        quotes: [{ who: managerOf(s, home), role: 'manager', text: pick(MANAGER.trade, id) }, ...(arriving ? [said(arriving, pick(ARRIVAL, `${id}-a`))] : []), ...(mine ? fans(FANS.trade, id) : [])],
        facts: { type: '트레이드', date, clubA: A, clubB: B, [`${A} 보냄`]: names(m.fromA), [`${B} 보냄`]: names(m.fromB) },
        detail: [...everyone.flatMap((x) => playerFacts(s, x, season)), ...clubFacts(s, [m.a, m.b], date)],
        players: everyone.map((x) => x.id),
        mine,
      });
      return;
    }
    case 'release': {
      const x = p(m.id);
      if (!x || m.teamId !== u) return;
      const club = short(s, m.teamId);
      const id = `mv-release-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: m.waiver ? `${club}, ${x.name} 웨이버 공시` : `${club}, ${x.name} 방출`,
        body: `${iga(club)} ${ageIn(x, season)}세 ${posOf(x)} ${eulreul(x.name)} ${m.waiver ? '웨이버 공시했다. 일주일 안에 데려가는 구단이 없으면 자유계약선수가 된다.' : '방출했다. 자유계약선수로 새 팀을 찾는다.'}${r ? ` ${r}.` : ''}${m.owed ? ` 남은 연봉 ${won(m.owed)}은 ${iga(club)} 부담한다.` : ''}`,
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.release, id) }, ...fans(FANS.release, id)],
        facts: { type: m.waiver ? '웨이버 공시' : '방출', date, club, player: x.name, ...(m.owed ? { owed: won(m.owed) } : {}) },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'claim': {
      const x = p(m.id);
      if (!x || (m.teamId !== u && m.from !== u)) return;
      const [club, from] = [short(s, m.teamId), short(s, m.from)];
      const id = `mv-claim-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: `${club}, 웨이버로 ${x.name} 영입`,
        body: `${iga(club)} ${from}에서 웨이버 공시된 ${eulreul(x.name)} 데려갔다. 남은 계약도 함께 넘겨받는다.${r ? ` ${x.name}의 기록은 ${r}.` : ''}`,
        quotes: [said(x, pick(ARRIVAL, id))],
        facts: { type: '웨이버 영입', date, club, from, player: x.name },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'pool': {
      const x = p(m.id);
      if (!x || m.teamId !== u) return;
      const club = short(s, m.teamId);
      const id = `mv-pool-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: `${club}, 자유계약선수 ${x.name} 영입`,
        body: `${iga(club)} 자유계약선수 ${ageIn(x, season)}세 ${posOf(x)} ${eulreul(x.name)} 영입했다. 연봉은 ${won(m.salary)}.${r ? ` ${x.name}의 기록은 ${r}.` : ''}`,
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.signing, id) }, ...fans(FANS.signing, id)],
        facts: { type: '자유계약선수 영입', date, club, player: x.name, salary: won(m.salary) },
        detail: [...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id],
        mine: true,
      });
      return;
    }
    case 'foreign': {
      const x = p(m.in);
      if (!x) return;
      const mine = m.teamId === u;
      const club = short(s, m.teamId);
      const id = `mv-foreign-${date}-${m.out.id}`;
      const r = recent(s, m.out);
      const bg = x.origin.background;
      addNews(s, {
        ...base,
        id,
        title: `${club}, 외국인 교체… ${m.out.name} 떠나고 ${x.name} 합류`,
        body: `${iga(club)} 외국인 선수 ${eulreul(m.out.name)} 내보내고 ${eulreul(x.name)} 영입했다. ${eunneun(x.name)} ${ageIn(x, season)}세 ${posOf(x)}다.${bg ? ` 경력은 ${bg.text}.` : ''} 남은 시즌 몸값은 ${usd(m.price)}.${r ? ` ${m.out.name}의 기록은 ${r}.` : ''}`,
        quotes: [{ who: managerOf(s, m.teamId), role: 'manager', text: pick(MANAGER.foreign, id) }, ...(mine ? fans(FANS.foreign, id) : [])],
        facts: { type: '외국인 교체', date, club, out: m.out.name, in: x.name, price: usd(m.price) },
        detail: [...playerFacts(s, m.out, season), ...playerFacts(s, x, season), ...clubFacts(s, [m.teamId], date)],
        players: [x.id, ...(s.players[m.out.id] ? [m.out.id] : [])],
        mine,
      });
      return;
    }
    case 'posting': {
      const x = p(m.id);
      const mine = m.teamId === u;
      if (!x || (!m.deal && !mine)) return;
      const club = short(s, m.teamId);
      const id = `mv-posting-${date}-${m.id}`;
      const r = recent(s, x);
      const d = m.deal;
      addNews(s, {
        ...base,
        id,
        title: d ? `${x.name}, 메이저리그 ${d.years}년 ${usd(d.total)} 계약` : `${x.name}, 메이저리그 계약 불발… ${club} 잔류`,
        body: d
          ? `${club} ${iga(x.name)} 포스팅을 거쳐 메이저리그 구단과 ${d.years}년 ${usd(d.total)}에 계약했다. ${eunneun(club)} 이적료 ${usd(d.fee)}를 받는다.${r ? ` ${x.name}의 마지막 기록은 ${r}.` : ''}`
          : `${club} ${iga(x.name)} 포스팅으로 메이저리그 문을 두드렸지만 계약한 구단이 없었다. ${eunneun(x.name)} ${club}에 남는다.`,
        quotes: [said(x, d ? pick(MLB, id) : '아쉽지만 여기서 더 성장해서 다시 도전하겠습니다.'), ...(mine && d ? fans(FANS.leaving, id) : [])],
        facts: { type: '포스팅', date, club, player: x.name, ...(d ? { years: d.years, total: usd(d.total), fee: usd(d.fee) } : { result: '계약 불발' }) },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine,
      });
      return;
    }
    case 'fa': {
      const x = p(m.id);
      const mine = m.to === u || m.from === u;
      if (!x || (!mine && m.grade !== 'A')) return;
      const [to, from] = [short(s, m.to), short(s, m.from)];
      const stay = m.to === m.from;
      const id = `mv-fa-${date}-${m.id}`;
      const r = recent(s, x);
      const terms = `${m.years}년, 연 ${won(m.annual)}`;
      addNews(s, {
        ...base,
        id,
        title: stay ? `${to}, FA ${x.name} 잔류… ${terms}` : `FA ${x.name}, ${ro(to)} 이적… ${terms}`,
        body: `${m.grade}등급 FA ${iga(x.name)} ${stay ? `원소속 ${to}에 남는다` : `${eulreul(from)} 떠나 ${wagwa(to)} 계약했다`}. 조건은 ${terms}.${r ? ` ${x.name}의 기록은 ${r}.` : ''}${!stay ? ` ${eunneun(from)} 보상을 받는다.` : ''}`,
        quotes: [said(x, pick(stay ? STAY : ARRIVAL, id)), ...(mine ? fans(stay ? FANS.stay : m.from === u ? FANS.leaving : FANS.signing, id) : [])],
        facts: { type: 'FA 계약', date, player: x.name, grade: m.grade, from, to, years: m.years, annual: won(m.annual) },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine,
      });
      return;
    }
    case 'secondDraft': {
      const x = p(m.id);
      if (!x || (m.teamId !== u && m.from !== u)) return;
      const [club, from] = [short(s, m.teamId), short(s, m.from)];
      const id = `mv-2nd-${date}-${m.id}`;
      const r = recent(s, x);
      addNews(s, {
        ...base,
        id,
        title: m.teamId === u ? `${club}, 2차 드래프트 ${m.round}라운드 ${x.name} 지명` : `${x.name}, 2차 드래프트로 ${ro(club)} 이적`,
        body: `${iga(club)} 2차 드래프트 ${m.round}라운드에서 ${from} ${eulreul(x.name)} 지명했다. ${eunneun(x.name)} ${ageIn(x, season)}세 ${posOf(x)}다.${r ? ` 기록은 ${r}.` : ''}`,
        quotes: [said(x, pick(ARRIVAL, id))],
        facts: { type: '2차 드래프트', date, club, from, player: x.name, round: m.round },
        detail: playerFacts(s, x, season),
        players: [x.id],
        mine: true,
      });
      return;
    }
  }
}

