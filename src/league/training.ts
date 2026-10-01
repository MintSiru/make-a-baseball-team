/* Short programmes at private training centres abroad (V0.10). The user's club sends a player in the winter (a
   programme before spring camp) or during the season (he leaves the roster for the programme, as KIA sent four
   pitchers to Japan in June 2026). Each centre works on different abilities; what he gains depends on his age,
   how far he is from his potential, luck and the club's analysts. The money comes from the club's fund.

   The centres are made up, each modelled on a kind of place KBO clubs really use (a data-driven pitching lab in
   Washington state, a hitting lab in Arizona, a conditioning campus in Florida, a biomechanics lab near Tokyo);
   see RULES.md §9. */
import { rng, TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { addAlert } from './alerts';
import { facilityLevel } from './facilities';
import { addNews } from './news';
import { rescout } from './offseason';
import { topVelocity } from './pitches';
import { ageIn, isForeign, isPitcher } from './players';
import { staffEdge, staffRating } from './staff';
import { moveTo, type LeagueState, type SiteId, type TrainingTrip } from './state';
import { TRAINING as T } from './tuning';

export interface Site {
  name: string;
  place: string;
  country: '미국' | '일본';
  /** Who it takes: pitchers, hitters or both. */
  who: 'pitcher' | 'hitter' | 'all';
  /** The tools it works on, main one first. */
  focus: { pitcher?: ToolKey[]; hitter?: ToolKey[] };
  weeks: number;
  /** Per player, fees, travel and a coach's share (만 원). */
  cost: number;
  /** Chance of a sore arm or a strain from the workload. */
  risk: number;
  /** Lowers his injury chance for the season (a conditioning programme). */
  conditioning?: boolean;
  note: string;
}

export const SITES: Record<SiteId, Site> = {
  seattle: {
    name: '시애틀 피칭 랩',
    place: '미국 워싱턴주',
    country: '미국',
    who: 'pitcher',
    focus: { pitcher: ['stuff', 'stamina'] },
    weeks: 6,
    cost: 6_000,
    risk: 0.05,
    note: '모션 캡처와 웨이티드 볼 프로그램으로 구속·구위를 끌어올리는 곳. 무리하면 팔꿈치·어깨에 탈이 나기도 함',
  },
  arizona: {
    name: '애리조나 배팅 랩',
    place: '미국 애리조나주',
    country: '미국',
    who: 'hitter',
    focus: { hitter: ['power', 'contact'] },
    weeks: 6,
    cost: 5_000,
    risk: 0.02,
    note: '배트 스피드와 발사각 데이터로 스윙을 고쳐 장타를 늘리는 곳',
  },
  florida: {
    name: '플로리다 퍼포먼스 센터',
    place: '미국 플로리다주',
    country: '미국',
    who: 'all',
    focus: { pitcher: ['stamina', 'command'], hitter: ['speed', 'defense'] },
    weeks: 6,
    cost: 4_500,
    risk: 0,
    conditioning: true,
    note: '근력·민첩성·체력 프로그램. 투수는 체력·제구, 야수는 주력·수비, 그 시즌 부상 위험도 줄어듦',
  },
  tokyo: {
    name: '도쿄 모션 베이스',
    place: '일본 지바현',
    country: '일본',
    who: 'all',
    focus: { pitcher: ['command', 'breaking'], hitter: ['eye', 'contact'] },
    weeks: 4,
    cost: 3_000,
    risk: 0.01,
    note: '바이오메카닉스 분석으로 투구·타격 동작을 다듬는 곳. 투수는 제구·변화구, 타자는 선구안·컨택. 가깝고 짧아 시즌 중에도 보내기 쉬움',
  },
};

export const SITE_IDS = Object.keys(SITES) as SiteId[];

/** The last day a programme can start in the season, as "8월 15일". */
export const lastStartText = T.lastStart
  .split('-')
  .map((x, i) => `${Number(x)}${i ? '일' : '월'}`)
  .join(' ');

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const nextDay = (s: LeagueState) => s.schedule[s.next]?.date ?? null;
const eok = (manwon: number) => `${Math.round(manwon / 1000) / 10}억`;

/** The season a programme booked now counts for, and whether it runs during the season. */
export function tripSeason(s: LeagueState): { season: number; inSeason: boolean } | null {
  if (s.phase === 'offseason') return { season: (s.offseason?.year ?? s.year) + 1, inSeason: false };
  const day = nextDay(s);
  if (s.phase === 'regular' && day && day.slice(5) <= T.lastStart) return { season: s.year, inSeason: true };
  return null;
}

export const onTrip = (s: LeagueState, id: PlayerId) => !!s.abroad?.[id];

/** The dates a programme booked now would run. */
export function tripDates(s: LeagueState, site: SiteId): { from: string; until: string } | null {
  const when = tripSeason(s);
  if (!when) return null;
  const from = when.inSeason ? nextDay(s)! : `${when.season - 1}-${T.winterStart}`;
  return { from, until: addDays(from, SITES[site].weeks * 7) };
}

/** Why he cannot go now, or null. */
export function checkTrip(s: LeagueState, id: PlayerId, site: SiteId): string | null {
  const u = s.user;
  const p = s.players[id];
  const S = SITES[site];
  if (!u || !p || p.teamId !== u.teamId) return '우리 선수가 아닙니다.';
  if (!S) return '연수지를 고르세요.';
  const when = tripSeason(s);
  if (!when) return s.phase === 'regular' ? `시즌 중 파견은 ${lastStartText}까지 떠날 때만 됩니다.` : '포스트시즌 중에는 보낼 수 없습니다.';
  if (p.status !== 'active') return '군 복무 중인 선수는 보낼 수 없습니다.';
  if (isForeign(p)) return '외국인 선수는 보내지 않습니다.';
  if (s.injuries[id] && !s.injuries[id]!.dtd) return '부상 중인 선수는 보낼 수 없습니다.';
  if (S.who === 'pitcher' && !isPitcher(p)) return `${S.name}은(는) 투수만 받습니다.`;
  if (S.who === 'hitter' && isPitcher(p)) return `${S.name}은(는) 타자만 받습니다.`;
  const trips = u.trips ?? [];
  if (trips.some((t) => t.id === id && t.season === when.season)) return '이번 시즌에 이미 연수를 다녀왔거나 가 있습니다.';
  if (when.inSeason) {
    if (Object.keys(s.abroad ?? {}).length >= T.seasonMax) return `시즌 중에는 한 번에 ${T.seasonMax}명까지 보낼 수 있습니다.`;
    if (s.away[id]) return '국가대표 소집이나 경조사 휴가 중입니다.';
  } else if (trips.filter((t) => t.season === when.season && !t.inSeason).length >= T.winterMax) return `겨울 연수는 ${T.winterMax}명까지입니다.`;
  if (S.cost > u.fund) return `구단 자금이 부족합니다 (필요 ${eok(S.cost)}).`;
  return null;
}

/** Sends him: the fund pays, and during the season he leaves the roster until he is back. */
export function sendTrip(s: LeagueState, id: PlayerId, site: SiteId) {
  const problem = checkTrip(s, id, site);
  if (problem) throw new Error(problem);
  const u = s.user!;
  const p = s.players[id]!;
  const S = SITES[site];
  const when = tripSeason(s)!;
  const dates = tripDates(s, site)!;
  const trip: TrainingTrip = { id, site, season: when.season, from: dates.from, until: dates.until, cost: S.cost, inSeason: when.inSeason };
  (u.trips ??= []).push(trip);
  u.fund -= S.cost;
  u.ledger.push({ year: when.inSeason ? s.year : when.season - 1, label: `해외 연수 · ${p.name} (${S.name})`, amount: -S.cost });
  if (when.inSeason) {
    (s.abroad ??= {})[id] = dates.until;
    moveTo(s, id, 'third');
  }
  (u.log ??= []).push({ year: when.inSeason ? s.year : when.season - 1, text: `${p.name}, ${S.place} ${S.name} ${S.weeks}주 연수 (${dates.from} ~ ${dates.until})` });
}

/** What a programme did for him. */
export function tripGains(s: LeagueState, p: Player, site: SiteId, season: number, r: () => number): Partial<Record<ToolKey, number>> {
  const keys = SITES[site].focus[isPitcher(p) ? 'pitcher' : 'hitter'] ?? [];
  // His velocity reading moves with his 구위 from here (as in the yearly development).
  if (p.velocity != null && p.hidden.current.stuff != null) p.velocityStuff ??= p.hidden.current.stuff;
  const age = ageIn(p, season);
  const ageK = T.age.find(([a]) => age <= a)![1];
  const lab = 1 + T.analytics * staffEdge(staffRating(s, p.teamId, 'analytics')) + facilityLevel(s, 'analytics') * 0.1;
  const gains: Partial<Record<ToolKey, number>> = {};
  keys.forEach((k, i) => {
    const cur = p.hidden.current[k];
    if (cur == null) return;
    const pot = p.hidden.potential[k] ?? cur;
    const want = T.gain * ageK * lab * (i === 0 ? 1 : T.secondary) * (0.25 + r() * 1.1);
    const g = Math.round(Math.max(0, Math.min(want, Math.max(0, pot - cur) + T.overPotential)) * 10) / 10;
    if (g <= 0) return;
    const now = Math.min(80, cur + g);
    p.hidden.current[k] = now;
    if (now > pot) p.hidden.potential[k] = now;
    gains[k] = Math.round((now - cur) * 10) / 10;
  });
  return gains;
}

/** Programmes over by `date`: he comes back with what he gained (or a sore arm), and the club hears about it. */
export function finishTrips(s: LeagueState, date: string) {
  const u = s.user;
  if (!u?.trips) return;
  for (const trip of u.trips) {
    if (trip.result || trip.until > date) continue;
    const p = s.players[trip.id];
    delete s.abroad?.[trip.id];
    if (!p || p.teamId !== u.teamId) {
      trip.result = { gains: {}, text: '연수 중 팀을 떠났습니다.' };
      continue;
    }
    const S = SITES[trip.site];
    const r = rng(`${s.seed}|trip|${trip.season}|${trip.id}|${trip.site}`);
    const before = topVelocity(p);
    const gains = tripGains(s, p, trip.site, trip.season, r);
    // His reports catch up with what the centre measured.
    rescout(p, trip.season, Math.max(0, trip.season - p.proSince), r);
    const after = topVelocity(p);
    let injury: string | undefined;
    if (r() < S.risk) {
      injury = isPitcher(p) ? (r() < 0.5 ? '팔꿈치 염증' : '어깨 통증') : '옆구리 근육 뭉침';
      const days = 14 + Math.floor(r() * 22);
      if (!s.injuries[p.id]) s.injuries[p.id] = { until: addDays(trip.until, days), days, onList: trip.inSeason, part: injury };
    }
    if (S.conditioning) (p.life ??= {}).conditioned = trip.season;
    const list = Object.entries(gains).map(([k, g]) => `${TOOL_LABELS[k as ToolKey] ?? k} +${g!.toFixed(1)}`);
    const velo = before != null && after != null && after > before ? `, 최고 구속 ${before}→${after}km` : '';
    const text = list.length ? `${list.join(', ')}${velo}` : '눈에 띄는 변화는 없었습니다';
    trip.result = { gains, ...(before != null && after != null ? { velocity: [before, after] as [number, number] } : {}), ...(injury ? { injury } : {}), text };
    const good = list.length > 0 && !injury;
    addAlert(s, {
      id: `trip-${trip.season}-${trip.id}`,
      date: trip.until,
      kind: 'season',
      title: `연수 복귀 · ${p.name}`,
      lines: [`${S.name}(${S.place}) ${S.weeks}주 연수를 마쳤습니다: ${text}.`, ...(injury ? [`훈련 막바지에 ${injury}이(가) 생겨 몇 주 쉬어야 합니다.`] : []), ...(S.conditioning ? ['이번 시즌 부상 위험이 조금 줄었습니다.'] : [])],
      tone: good ? 'good' : injury ? 'bad' : undefined,
      players: [p.id],
    });
    addNews(s, {
      id: `trip-${trip.season}-${trip.id}`,
      date: trip.until,
      kind: 'interview',
      title: `${p.name}, ${S.country} 연수 마치고 복귀`,
      body: `${p.name}이(가) ${S.place}의 ${S.name}에서 ${S.weeks}주 연수를 마쳤다. 구단 측정으로는 ${text}.${injury ? ` 다만 ${injury}으로 당분간 쉬어 간다.` : ''}`,
      quotes: [{ who: p.name, role: 'player', text: good ? '데이터로 제 몸을 보니 고칠 게 분명히 보였습니다. 바로 써먹겠습니다.' : '배운 걸 내 것으로 만드는 데 시간이 걸릴 것 같습니다.' }],
      facts: { player: p.name, site: S.name, place: S.place, weeks: S.weeks, result: text },
      players: [p.id],
      mine: true,
    });
  }
}
