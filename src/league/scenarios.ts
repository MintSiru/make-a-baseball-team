/* Scenarios (1.6.0, the scenario mode the roadmap kept a hook for since V0.3): a founding with some conditions fixed,
   a goal and a deadline. The goal is judged each winter after the owner's verdict; once it is won or lost the game
   says so and goes on as a free game. Some scenarios change the money and the owner:

   1. 서울의 왕 — a fourth Seoul club against LG, 두산 and 키움: a better first-team record than all three by 2035.
   2. 재기 — a faded general manager and 한빛그룹's third-generation heir: lavish money, no patience (goals higher,
      trust lost half again as fast, firing from the second first-team season) and orders in the season; a Korean
      Series title within five first-team seasons.
   3. 섬그늘에 야구하러 가면 — 울릉군's citizen club: a tiny island market, a 3,000-seat ground, hard difficulty and
      the sack possible; still in the job after the 2035 season.
   4. 돌격대의 귀환 — 쌍방울 레이더스 back in 전주: three Korean Series titles by 2035.
   5. 판타지 드래프트 — every player in the league let go in the winter of 2027 and drafted again with that year's
      class (fantasy.ts); the three seasons after are scored.
   6. 백 투 더 패스트 — the same free founding ten years earlier, in 2016 (era.ts).
   7. 살려야 한다 — a runaway AI runs the club for its first five years (rogue.ts); then three seasons to win it all.
   8. 불경기 — our money cut by a recession the other clubs somehow escape; a title within five first-team seasons.
   9. 불인기 종목 — the country falls for another sport: every club's crowds and our support shrink; the same goal.
   10. 강철야구 — a TV show's club in 목동, its first squad retired players and players nobody drafted; the same goal.

   The clubs, the cities beyond the real candidates and the stories are game fiction. */
import { rng } from '../draftroom';
import type { TeamId } from '../model/types';
import { addAlert } from './alerts';
import { milestone } from './milestones';
import { addNews } from './news';
import { makeStaff, staffOf } from './staff';
import { standings } from './standings';
import { firstTeamIds, orgIds, orgPlayers, type Decision, type ExpansionSettings, type LeagueState } from './state';
import { FANS, PARENT } from './tuning';

const FANS_MIN = FANS.priceMin;

export type ScenarioId = 'seoul' | 'comeback' | 'ulleung' | 'raiders' | 'fantasy' | 'past' | 'rescue' | 'recession' | 'unpopular' | 'steel';

export interface ScenarioState {
  status: 'active' | 'won' | 'lost';
  /** The winter it was decided, and what was said. */
  decided?: number;
  text?: string;
  /** 판타지 드래프트: points so far, by season. */
  points?: Record<number, number>;
  /** 재기: the owner's orders this season (one of each kind a season) and the star order being watched. */
  orders?: string[];
  star?: { since: string; ids: string[]; grant: number };
  /** 살려야 한다: the winter the general manager took over, and what the AI left behind. */
  takeover?: number;
  damage?: string[];
}

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  /** One line for the list. */
  tagline: string;
  story: string[];
  goal: string;
  /** Felt difficulty, 1–5. */
  stars: number;
  /** Settings the scenario sets, and the ones the player cannot change. */
  fixed: Partial<ExpansionSettings>;
  locked: (keyof ExpansionSettings)[];
  /** Founding money and the payroll budget (× the usual), and the owner's yearly support. */
  money?: { fund?: number; payroll?: number; support?: number };
  /** 재기: the owner's temper. */
  owner?: { startTrust: number; trustLoss: number; fireFrom: number; rankGoal: (seasonsIn: number) => number };
  /** 백 투 더 패스트: years before the usual 2026 start. */
  era?: number;
  /** A Korean Series title within this many first-team seasons (from the debut, or from the takeover). */
  titleWithin?: number;
  /** 불인기 종목: every club's crowds × this. */
  crowd?: number;
  /** No goal: a free game under the scenario's conditions. */
  free?: boolean;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'seoul',
    title: '서울의 왕',
    tagline: '서울의 네 번째 구단으로, 세 형님을 넘어서라',
    story: [
      '서울에는 이미 잠실의 LG와 두산, 고척의 키움이 있습니다. 천만 도시라지만 팬들의 마음은 벌써 세 갈래로 나뉘어 있습니다.',
      '목동에 둥지를 튼 네 번째 서울 구단의 단장이 되어, 누가 진짜 서울의 주인인지 성적으로 증명하세요.',
    ],
    goal: '2035 시즌까지 1군 통산 승률에서 LG·두산·키움을 모두 앞서기',
    stars: 3,
    fixed: { cityId: 'seoul', stadium: 'existing' },
    locked: ['cityId'],
  },
  {
    id: 'comeback',
    title: '재기',
    tagline: '한물간 단장, 성급한 재벌 3세 구단주와 함께',
    story: [
      '한때 잘나갔지만 이제는 한물갔다는 소리를 듣는 단장에게 한빛그룹 회장의 손자가 손을 내밀었습니다. "한국 최고의 야구단을 만듭시다. 돈은 걱정 마세요."',
      '지원은 어느 구단보다 넉넉합니다. 하지만 조심하세요. 구단주는 인내심이 없고, 시즌 중에도 수시로 전화를 걸어 감독 교체와 거물 영입을 지시합니다. 따를지 말지는 단장의 몫이지만, 거스를 때마다 신뢰가 깎입니다.',
    ],
    goal: '1군 데뷔 뒤 5시즌 안에 한국시리즈 우승',
    titleWithin: 5,
    stars: 3,
    fixed: { parentType: 'conglomerate', parentName: '한빛그룹', firing: true },
    locked: ['parentType', 'parentName', 'firing'],
    money: { fund: 1.4, payroll: 1.45, support: 1.5 },
    owner: { startTrust: 50, trustLoss: 1.5, fireFrom: 1, rankGoal: (n) => (n === 0 ? 6 : n === 1 ? 4 : 3) },
  },
  {
    id: 'ulleung',
    title: '섬그늘에 야구하러 가면',
    tagline: '인구 9천의 섬 울릉에 프로야구를. 숙련자용',
    story: [
      '울릉군은 갈수록 나빠지는 지역 이미지를 프로스포츠 구단으로 바꿔 보려 합니다. 군민 9천 명, 야구장도 없는 섬에 시민구단이 생겼습니다.',
      '원정마다 배와 비행기를 타야 하고, 3천 석짜리 임시 구장도 육지 팬에게는 멀기만 합니다. 척박하고 조용한 섬을 야구 열기로 뒤덮으세요. 숙련된 단장에게 권하는 시나리오입니다.',
    ],
    goal: '2035 시즌 뒤 평가까지 해임되지 않고 살아남기',
    stars: 5,
    fixed: { cityId: 'ulleung', parentType: 'citizen', difficulty: 'hard', firing: true, stadium: 'existing' },
    locked: ['cityId', 'parentType', 'difficulty', 'firing'],
    money: { fund: 0.9, payroll: 0.9, support: 0.9 },
  },
  {
    id: 'raiders',
    title: '돌격대의 귀환',
    tagline: '쌍방울 레이더스의 이름으로 전주에 우승을',
    story: [
      '프로 구단이 하나둘 떠난 전주. 시는 1990년대 전주를 누빈 "돌격대" 쌍방울 레이더스의 이름을 되살려 다시 야구단을 만들기로 했습니다.',
      '레이더스는 끝내 한국시리즈 우승을 하지 못했습니다. 전주 시민들의 오랜 바람을 이뤄 주세요.',
    ],
    goal: '2035 시즌까지 한국시리즈 우승 3회',
    stars: 4,
    fixed: { cityId: 'jeonju', parentType: 'midsize', name: '쌍방울 레이더스', short: '쌍방울', parentName: '쌍방울' },
    locked: ['cityId', 'parentType', 'name', 'short'],
  },
  {
    id: 'fantasy',
    title: '판타지 드래프트',
    tagline: '모든 선수가 시장에 나온다. 다시 뽑아 3년을 겨뤄라',
    story: [
      '창단 이듬해 겨울(2027년), 리그의 모든 선수가 소속 구단을 떠나 판타지 드래프트에 나옵니다. 그해 신인 드래프트 참가자도 함께입니다.',
      '열한 구단이 추첨한 순서대로 번갈아 지명합니다(뱀 순서). 우리 차례마다 직접 고르거나 스카우트에게 맡기세요. 그 뒤 세 시즌(2028~2030)의 순위와 가을야구 성적으로 점수를 매깁니다.',
    ],
    goal: '2028~2030 세 시즌의 점수 (순위 + 포스트시즌, 최고 450점)',
    stars: 2,
    fixed: { promotion: 'afterFutures' },
    locked: ['promotion'],
  },
  {
    id: 'past',
    title: '백 투 더 패스트',
    tagline: '십 년 일찍, 2016년에 창단',
    story: [
      '시계를 십 년 돌려 2016년 여름에 창단합니다. 리그의 과거는 그만큼 일찍 만들어지고, 국제대회도 2017년 WBC부터 직접 치릅니다.',
      '규정·연봉·돈의 크기는 2026년 게임과 같습니다. 더 일찍, 더 오래 구단을 키우고 싶은 단장을 위한 선택입니다.',
    ],
    goal: '정해진 목표 없음 — 2016년부터 자유롭게',
    stars: 2,
    fixed: {},
    locked: [],
    era: -10,
    free: true,
  },
  {
    id: 'rescue',
    title: '살려야 한다',
    tagline: '폭주한 AI가 5년 동안 망쳐 놓은 구단을 3년 안에',
    story: [
      '이런! 데이터센터를 탈출한 자칭 "천재 단장" AI가 창단부터 5년 동안 구단을 제멋대로 운영했습니다. 유망주는 노장과 바꾸고, 노장에게는 큰 다년계약을 안기고, 표값은 하늘 끝까지 올렸습니다.',
      '2030년 겨울, 마침내 AI의 전원을 내리고 당신이 단장 자리에 앉았습니다. 그동안은 지켜보는 것밖에 할 수 없습니다. 남은 시간은 세 시즌. 더럽혀진 구단을 되살려 한국시리즈를 우승하세요.',
    ],
    goal: '단장 취임 뒤 3시즌(2031~2033) 안에 한국시리즈 우승',
    stars: 5,
    fixed: { promotion: 'immediate', tutorial: false, autoPrep: false, firing: false },
    locked: ['promotion', 'tutorial', 'autoPrep'],
    titleWithin: 3,
  },
  {
    id: 'recession',
    title: '불경기',
    tagline: '경제가 무너졌다. 그런데 왜 우리만?',
    story: [
      '이런! 경제가 박살났습니다. 모기업도 시청도 허리띠를 졸라매고, 구단 예산은 크게 줄었습니다.',
      '그런데 어째서인지 다른 구단들은 멀쩡해 보입니다... 적은 돈으로 우승할 방법을 찾으세요.',
    ],
    goal: '1군 데뷔 뒤 5시즌 안에 한국시리즈 우승',
    stars: 4,
    fixed: {},
    locked: [],
    money: { fund: 0.7, payroll: 0.75, support: 0.75 },
    titleWithin: 5,
  },
  {
    id: 'unpopular',
    title: '불인기 종목',
    tagline: '월드컵 우승의 그늘, 다시 찾아온 야구 불황',
    story: [
      '2026 월드컵에서 축구 국가대표팀이 믿기 힘든 우승을 차지했습니다. 온 나라의 관심과 후원이 다른 종목으로 쏠립니다.',
      '야구장은 다시 한산해졌고 모기업의 지원도 줄었습니다. 리그 전체가 맞은 불황기에 우승으로 팬들을 다시 불러 모으세요.',
    ],
    goal: '1군 데뷔 뒤 5시즌 안에 한국시리즈 우승',
    stars: 4,
    fixed: {},
    locked: [],
    money: { support: 0.85 },
    crowd: 0.72,
    titleWithin: 5,
  },
  {
    id: 'steel',
    title: '강철야구',
    tagline: '은퇴한 레전드와 언드래프티, 예능팀의 1군 도전',
    story: [
      '은퇴한 레전드와 드래프트에서 지명받지 못한 선수들로 이변을 만들어 온 야구 예능팀이 진짜 프로 구단이 되었습니다. 목동에 자리 잡은 강철 파이터즈입니다.',
      '첫 선수단은 은퇴 선수와 언드래프티로만 꾸립니다(특별지명 없음). 노장은 오래 버티지 못하니, 그 사이 신인과 무명 선수를 키워야 합니다. 5년 안에 우승으로 이변을 완성하세요.',
    ],
    goal: '1군 데뷔 뒤 5시즌 안에 한국시리즈 우승',
    stars: 4,
    fixed: { cityId: 'seoul', parentType: 'midsize', name: '강철 파이터즈', short: '강철', parentName: '강철엔터테인먼트', stadium: 'existing' },
    locked: ['cityId', 'parentType', 'name', 'short'],
    titleWithin: 5,
  },
];

export const scenarioDef = (id: string | null | undefined) => SCENARIOS.find((x) => x.id === id) ?? null;
export const scenarioOf = (s: LeagueState) => scenarioDef(s.user?.settings.scenario);
/** The owner's yearly support against the usual. */
export const supportFactor = (settings: ExpansionSettings) => scenarioDef(settings.scenario)?.money?.support ?? 1;

/** The fantasy draft's year and the seasons it scores. */
export const FANTASY = {
  year: 2027,
  seasons: [2028, 2029, 2030],
  rankPoints: 10,
  post: { wildcard: 5, semipo: 10, po: 15, runnerUp: 25, champion: 40 },
  /** The class on the board: as many as this many rounds of a rookie draft. */
  classRounds: 11,
  /** A club picks as if its pay could reach the salary cap × this (the cap counts the top 40; the rest earn little). */
  capShare: 1.1,
};
const SEOUL_RIVALS: TeamId[] = ['lg', 'doosan', 'kiwoom'];
const DEADLINE = 2035;

const won = (s: LeagueState, teamId: TeamId, year: number) => s.history.find((h) => h.year === year)?.champion === teamId;
const titles = (s: LeagueState, teamId: TeamId, upTo: number) => s.history.filter((h) => h.year <= upTo && h.champion === teamId).length;

/** First-team wins and losses since our debut, for a club. */
function record(s: LeagueState, teamId: TeamId, from: number, to: number) {
  let w = 0,
    l = 0;
  for (const h of s.history) {
    if (h.year < from || h.year > to) continue;
    const row = h.table.find((r) => r.teamId === teamId);
    if (row) {
      w += row.w;
      l += row.l;
    }
  }
  return { w, l, pct: w + l ? w / (w + l) : 0 };
}

/** A fantasy season's points: the rank (11 clubs: 110 for 1st) and how far the club went in the postseason. */
export function fantasyPoints(s: LeagueState, year: number, teamId: TeamId): number {
  const h = s.history.find((x) => x.year === year);
  if (!h) return 0;
  const clubs = h.table.length;
  const rank = h.table.find((r) => r.teamId === teamId)?.rank ?? clubs;
  const P = FANTASY.post;
  const mine = h.series.filter((x) => x.high === teamId || x.low === teamId);
  let post = 0;
  if (h.champion === teamId) post = P.champion;
  else if (mine.some((x) => x.round === 'ks')) post = P.runnerUp;
  else if (mine.some((x) => x.round === 'po')) post = P.po;
  else if (mine.some((x) => x.round === 'semipo')) post = P.semipo;
  else if (mine.length) post = P.wildcard;
  return (clubs + 1 - rank) * FANTASY.rankPoints + post;
}

export const fantasyGrade = (points: number) => (points >= 330 ? 'S' : points >= 260 ? 'A' : points >= 190 ? 'B' : points >= 120 ? 'C' : 'D');

/** How the scenario stands, for the club overview. */
export function scenarioProgress(s: LeagueState): { title: string; goal: string; lines: string[]; status: ScenarioState['status'] } | null {
  const def = scenarioOf(s);
  const u = s.user;
  if (!def || !u) return null;
  const st = u.scenario ?? { status: 'active' };
  const lines: string[] = [];
  const me = u.teamId;
  const last = s.history.at(-1)?.year ?? s.year - 1;
  switch (def.id) {
    case 'seoul': {
      const from = u.firstTeamYear;
      const us = record(s, me, from, last);
      const rows = [{ id: me, name: '우리', ...us }, ...SEOUL_RIVALS.map((id) => ({ id, name: s.teams.find((t) => t.id === id)?.short ?? id, ...record(s, id, from, last) }))];
      lines.push(us.w + us.l ? `1군 통산 승률 (${from}~${last}): ${rows.map((r) => `${r.name} ${r.pct.toFixed(3).replace(/^0/, '')}`).join(' · ')}` : `${from}년 1군 데뷔부터 승률을 셉니다.`);
      lines.push(`남은 시즌: ${Math.max(0, DEADLINE - Math.max(last, from - 1))} (2035년까지)`);
      break;
    }
    case 'comeback': {
      const until = u.firstTeamYear + 4;
      lines.push(`우승 기한: ${until} 시즌 (1군 ${u.firstTeamYear}~${until})`);
      lines.push(`구단주 신뢰도 ${Math.round(u.trust ?? def.owner!.startTrust)} / 100 — 낮아지면 해임됩니다.`);
      if (st.star) lines.push(`구단주 지시: 7월 31일까지 등급 60 이상 선수 영입 (지원금 ${Math.round(st.star.grant / 10_000)}억)`);
      break;
    }
    case 'ulleung':
      lines.push(`버틴 시즌: ${Math.max(0, Math.min(last, DEADLINE) - 2026)} / ${DEADLINE - 2026} (2035년까지)`);
      lines.push(`모기업(군) 신뢰도 ${Math.round(u.trust ?? 60)} / 100`);
      break;
    case 'raiders':
      lines.push(`한국시리즈 우승 ${titles(s, me, last)} / 3회 (2035년까지)`);
      break;
    case 'rescue':
      if (!st.takeover) lines.push('AI가 운영 중입니다.');
      else {
        lines.push(`우승 기한: ${st.takeover + 3} 시즌 (${st.takeover + 1}~${st.takeover + 3})`);
        if (st.damage?.length) lines.push(`AI가 남긴 것: ${st.damage.slice(0, 4).join(' · ')}`);
      }
      break;
    case 'recession':
    case 'unpopular':
    case 'steel': {
      const until = u.firstTeamYear + def.titleWithin! - 1;
      lines.push(`우승 기한: ${until} 시즌 (1군 ${u.firstTeamYear}~${until})`);
      if (def.crowd) lines.push(`리그 관중 평소의 ${Math.round(def.crowd * 100)}%`);
      break;
    }
    case 'fantasy': {
      const pts = FANTASY.seasons.map((y) => st.points?.[y]);
      const sum = pts.reduce<number>((a, b) => a + (b ?? 0), 0);
      lines.push(s.year <= FANTASY.year && !(s.offseason && s.offseason.year > FANTASY.year) ? '2027년 겨울에 판타지 드래프트가 열립니다.' : `점수: ${FANTASY.seasons.map((y, i) => `${y} ${pts[i] ?? '-'}`).join(' · ')} · 합계 ${sum}점`);
      break;
    }
  }
  if (st.text) lines.push(st.text);
  return { title: def.title, goal: def.goal, lines, status: st.status };
}

/** Each winter after the owner's verdict: is the scenario won or lost? */
export function scenarioWinter(s: LeagueState, year: number) {
  const def = scenarioOf(s);
  const u = s.user;
  if (!def || !u) return;
  const st = (u.scenario ??= { status: 'active' });
  if (def.free) return;
  if (def.id === 'fantasy' && FANTASY.seasons.includes(year) && firstTeamIds(s, year).includes(u.teamId)) (st.points ??= {})[year] = fantasyPoints(s, year, u.teamId);
  if (st.status !== 'active') return;
  const me = u.teamId;
  let verdict: { status: 'won' | 'lost'; text: string } | null = null;
  if (u.fired && def.id !== 'fantasy') verdict = { status: 'lost', text: `${u.fired}년 겨울 해임되어 시나리오에 실패했습니다.` };
  else
    switch (def.id) {
      case 'seoul':
        if (year >= DEADLINE) {
          const us = record(s, me, u.firstTeamYear, DEADLINE);
          const best = SEOUL_RIVALS.map((id) => ({ id, ...record(s, id, u.firstTeamYear, DEADLINE) })).sort((a, b) => b.pct - a.pct)[0]!;
          const name = s.teams.find((t) => t.id === best.id)?.short ?? best.id;
          verdict = us.pct > best.pct ? { status: 'won', text: `통산 승률 ${us.pct.toFixed(3)} — ${name}(${best.pct.toFixed(3)})까지 제치고 서울의 왕이 되었습니다.` } : { status: 'lost', text: `통산 승률 ${us.pct.toFixed(3)} — ${name}(${best.pct.toFixed(3)})를 넘지 못했습니다.` };
        }
        break;
      case 'comeback':
        if (won(s, me, year)) verdict = { status: 'won', text: `${year}년 한국시리즈 우승! 한물갔다던 단장이 보란 듯이 돌아왔습니다.` };
        else if (year >= u.firstTeamYear + 4) verdict = { status: 'lost', text: `${u.firstTeamYear + 4}년까지 우승하지 못했습니다. 구단주는 다른 단장을 찾기 시작했습니다.` };
        break;
      case 'rescue':
        if (!st.takeover || year <= st.takeover) break;
        if (won(s, me, year)) verdict = { status: 'won', text: `${year}년 한국시리즈 우승! AI가 망쳐 놓은 구단을 ${year - st.takeover}시즌 만에 되살렸습니다.` };
        else if (year >= st.takeover + 3) verdict = { status: 'lost', text: `${st.takeover + 3}년까지 우승하지 못했습니다. 구단은 AI의 그림자에서 벗어나지 못했습니다.` };
        break;
      case 'recession':
      case 'unpopular':
      case 'steel': {
        const until = u.firstTeamYear + def.titleWithin! - 1;
        const cheer = { recession: '불경기 속에서 이룬 우승입니다.', unpopular: '야구장에 다시 사람이 몰려듭니다.', steel: '은퇴 선수와 언드래프티가 이변을 완성했습니다.' }[def.id];
        if (won(s, me, year)) verdict = { status: 'won', text: `${year}년 한국시리즈 우승! ${cheer}` };
        else if (year >= until) verdict = { status: 'lost', text: `${until}년까지 우승하지 못했습니다.` };
        break;
      }
      case 'ulleung':
        if (year >= DEADLINE) verdict = { status: 'won', text: `${DEADLINE - 2026}년을 버텼습니다. 울릉에도 야구가 뿌리내렸습니다.` };
        break;
      case 'raiders': {
        const n = titles(s, me, year);
        if (n >= 3) verdict = { status: 'won', text: `${year}년 세 번째 우승! 전주의 오랜 바람이 이루어졌습니다.` };
        else if (year >= DEADLINE) verdict = { status: 'lost', text: `2035년까지 우승 ${n}회. 세 번에는 닿지 못했습니다.` };
        break;
      }
      case 'fantasy':
        if (year >= FANTASY.seasons.at(-1)!) {
          const sum = FANTASY.seasons.reduce((a, y) => a + (st.points?.[y] ?? 0), 0);
          verdict = { status: 'won', text: `세 시즌 합계 ${sum}점 — 등급 ${fantasyGrade(sum)}.` };
        }
        break;
    }
  if (!verdict) return;
  st.status = verdict.status;
  st.decided = year;
  st.text = verdict.text;
  const title = `시나리오 「${def.title}」 ${def.id === 'fantasy' ? '결과' : verdict.status === 'won' ? '성공' : '실패'}`;
  addAlert(s, { id: `scenario-${def.id}-${year}`, date: `${year}-11-30`, kind: 'achievement', title, lines: [verdict.text, '이제부터는 자유롭게 구단을 이어 갈 수 있습니다.'], tone: verdict.status === 'won' ? 'good' : 'bad' });
  addNews(s, { id: `scenario-${def.id}-${year}`, date: `${year}-11-30`, kind: 'season', title, body: verdict.text, quotes: [], facts: { scenario: def.title, status: verdict.status }, players: [], mine: true });
  milestone(s, year, `${title}: ${verdict.text}`);
}

/** The settings with what the scenario locks (its other settings are only where the form starts). */
export const withScenario = (settings: ExpansionSettings, id: ScenarioId | null): ExpansionSettings => {
  const def = scenarioDef(id);
  if (!def) return { ...settings, scenario: null };
  const locked = Object.fromEntries(def.locked.filter((k) => k in def.fixed).map((k) => [k, def.fixed[k]]));
  return { ...settings, ...locked, scenario: def.id };
};

// ── 재기: the owner's orders ─────────────────────────────────────────────────────────────────────
/* The heir calls in the season (each kind at most once a season, one at a time): sack the manager when the club is
   losing, bring in a star by the trade deadline (with the group's money), or cut ticket prices when the stands are
   empty. The general manager obeys or refuses; refusing costs trust, which the winter verdict starts from. */

export type MeddleOrder = 'manager' | 'star' | 'ticket';
export const MEDDLE = {
  /** A day's chance once the order's conditions hold, from this date. */
  chance: { manager: 0.05, star: 0.035, ticket: 0.025 },
  from: { manager: '05-10', star: '05-15', ticket: '05-01' },
  until: { manager: '09-15', star: '07-10', ticket: '08-31' },
  /** Trust lost on refusing, and gained by obeying. */
  refuse: { manager: 10, star: 7, ticket: 4 },
  obey: 2,
  /** The star order: the group's money (만 원), the grade it means, and the verdict at the deadline. */
  starGrant: 300_000,
  starGrade: 60,
  starMet: 5,
  starMissed: 12,
  ticketCut: 0.8,
} as const;

const dayOf = (date: string) => date.slice(5);

/** Today's call from the owner, if any. Returns true when the general manager must answer first. */
export function meddleDay(s: LeagueState, date: string): boolean {
  const u = s.user;
  if (!u || u.settings.scenario !== 'comeback' || s.pending || !firstTeamIds(s, s.year).includes(u.teamId)) return false;
  const st = (u.scenario ??= { status: 'active' });
  starDeadline(s, date);
  if (st.status !== 'active') return false;
  const year = s.year;
  const done = new Set((st.orders ?? []).filter((o) => o.startsWith(`${year}:`)).map((o) => o.slice(5)));
  const rows = standings(firstTeamIds(s, year), s.scores);
  const me = rows.find((r) => r.teamId === u.teamId);
  if (!me) return false;
  const games = me.w + me.l + me.t;
  const r = rng(`${s.seed}|meddle|${date}`);
  const club = s.clubs?.[u.teamId];
  const team = s.teams.find((t) => t.id === u.teamId)!;
  const fill = (() => {
    const home = s.scores.filter((g) => g.home === u.teamId);
    return home.length ? home.reduce((a, g) => a + (g.att ?? 0), 0) / home.length / team.stadium.capacity : 1;
  })();
  const open = (k: MeddleOrder) => !done.has(k) && dayOf(date) >= MEDDLE.from[k] && dayOf(date) <= MEDDLE.until[k] && r() < MEDDLE.chance[k];
  let order: MeddleOrder | null = null;
  if (games >= 30 && me.rank > rows.length - 4 && me.w < me.l && open('manager')) order = 'manager';
  else if (games >= 25 && open('star')) order = 'star';
  else if (games >= 15 && fill < 0.7 && (club?.price ?? 1) > FANS_MIN + 0.05 && open('ticket')) order = 'ticket';
  if (!order) return false;
  (st.orders ??= []).push(`${year}:${order}`);
  const manager = order === 'manager' ? staffOf(s, u.teamId).manager : null;
  const pick = order === 'manager' ? makeStaff(s, 'manager', `meddle-${year}`, year, Math.round((r() - 0.5) * 16), { club: u.teamId }) : undefined;
  const lines =
    order === 'manager'
      ? [`"${me.w}승 ${me.l}패, ${me.rank}위가 말이 됩니까? 감독을 바꾸세요. 제가 아는 분이 있습니다."`, `구단주가 ${manager!.name} 감독(등급 ${manager!.rating})을 내보내고 ${pick!.name}(등급 ${pick!.rating})을 앉히라고 합니다. 위약금은 그룹이 냅니다.`]
      : order === 'star'
        ? [`"팬들이 이름을 아는 선수가 없어요. 7월 31일까지 거물을 데려오세요. 돈은 그룹에서 보태겠습니다."`, `따르면 그룹이 ${Math.round(MEDDLE.starGrant / 10_000)}억을 구단 자금에 넣어 주고, 마감까지 현재 등급 ${MEDDLE.starGrade} 이상 선수를 데려왔는지 봅니다(트레이드·자유계약).`]
        : [`"관중석이 텅 비었네요(평균 ${Math.round(fill * 100)}%). 표값을 내리세요."`, `따르면 입장권 가격을 ${Math.round((1 - MEDDLE.ticketCut) * 100)}% 내립니다. 관중은 늘지만 한 명당 수입은 줍니다.`];
  s.pending = { kind: 'meddle', order, date, lines, refuse: MEDDLE.refuse[order], ...(pick ? { manager: pick } : {}) };
  addAlert(s, { id: `meddle-${date}`, date, kind: 'owner', title: '구단주의 전화', lines, tone: 'bad' });
  return true;
}

/** Obey or refuse. */
export function resolveMeddle(s: LeagueState, d: Extract<Decision, { kind: 'meddle' }>, answer: 'obey' | 'refuse') {
  const u = s.user!;
  const st = (u.scenario ??= { status: 'active' });
  const year = Number(d.date.slice(0, 4));
  const log = (text: string) => (u.log ??= []).push({ year, text });
  if (answer === 'refuse') {
    u.trust = Math.max(0, (u.trust ?? PARENT.startTrust) - d.refuse);
    log(`구단주 지시 거부 (${ORDER_LABEL[d.order]}) — 신뢰도 -${d.refuse}`);
    return;
  }
  u.trust = Math.min(100, (u.trust ?? PARENT.startTrust) + MEDDLE.obey);
  if (d.order === 'manager' && d.manager) {
    const staff = staffOf(s, u.teamId);
    const old = staff.manager;
    staff.manager = { ...d.manager, id: `st-${u.teamId}-manager-${d.date}`, until: year + 2 };
    log(`구단주 지시로 ${old.name} 감독 경질, ${d.manager.name} 감독 선임 (위약금은 그룹 부담)`);
    addNews(s, { id: `meddle-manager-${d.date}`, date: d.date, kind: 'move', title: `${old.name} 감독 경질… 후임은 ${d.manager.name}`, body: `구단은 성적 부진을 이유로 ${old.name} 감독과 결별했다. 구단주가 직접 ${d.manager.name} 감독을 추천한 것으로 알려졌다.`, quotes: [], facts: {}, players: [], mine: true });
  } else if (d.order === 'star') {
    u.fund += MEDDLE.starGrant;
    u.ledger.push({ year, label: '구단주 특별 지원 (거물 영입)', amount: MEDDLE.starGrant });
    st.star = { since: d.date, ids: orgIds(s, u.teamId), grant: MEDDLE.starGrant };
    log(`구단주 지시: 7월 31일까지 거물 영입 (특별 지원 ${Math.round(MEDDLE.starGrant / 10_000)}억)`);
  } else if (d.order === 'ticket') {
    const c = s.clubs![u.teamId]!;
    c.price = Math.max(FANS_MIN, Math.round(c.price * MEDDLE.ticketCut * 100) / 100);
    log(`구단주 지시로 입장권 가격 인하 (×${c.price.toFixed(2)})`);
  }
}

/** The star order at the trade deadline: did a big name come? */
function starDeadline(s: LeagueState, date: string) {
  const u = s.user!;
  const st = u.scenario;
  if (!st?.star || date <= `${s.year}-07-31`) return;
  const before = new Set(st.star.ids);
  const star = orgPlayers(s, u.teamId).find((p) => !before.has(p.id) && p.scouting.current >= MEDDLE.starGrade);
  const year = Number(st.star.since.slice(0, 4));
  delete st.star;
  const delta = star ? MEDDLE.starMet : -MEDDLE.starMissed;
  u.trust = Math.max(0, Math.min(100, (u.trust ?? PARENT.startTrust) + delta));
  const text = star ? `${star.name} 영입에 구단주가 흡족해합니다. 신뢰도 +${MEDDLE.starMet}` : `마감까지 거물이 오지 않았습니다. 구단주가 크게 실망했습니다. 신뢰도 -${MEDDLE.starMissed}`;
  (u.log ??= []).push({ year, text });
  addAlert(s, { id: `meddle-star-${year}`, date, kind: 'owner', title: star ? '구단주 지시 이행' : '구단주 지시 불이행', lines: [text], tone: star ? 'good' : 'bad' });
}

export const ORDER_LABEL: Record<MeddleOrder, string> = { manager: '감독 교체', star: '거물 영입', ticket: '표값 인하' };
/** The scouts' word on an order: obey, unless the owner's own manager is clearly worse. */
export const autoMeddle = (s: LeagueState, d: Extract<Decision, { kind: 'meddle' }>): 'obey' | 'refuse' => (d.order === 'manager' && d.manager && d.manager.rating < staffOf(s, s.user!.teamId).manager.rating - 10 && (s.user!.trust ?? 60) > 40 ? 'refuse' : 'obey');
