/* Life off the field (V0.10): what happens to the user's players away from the game, and what fans think of every
   player.

   Events (the user's club only): a child is born or a family member dies (경조사 휴가: up to five days off the
   roster, counted as registered days — KBO 규정 since 2019), a hot or a cold spell, kindness to fans, a gift to
   charity, a row on social media, a small accident at home; in the winter a wedding, a gift, work on his own. 1.2.0
   added extra work after the game, a senior's advice to a young player, a commercial, a TV show, his home town in the
   stands, a row in the dugout (a clubhouse leader settles it sooner) and a veteran in the futures who wants out; the
   hidden traits pick who (trouble finds the troublemakers, good deeds the leaders and the loyal). They move his form
   for a while (grade points on his main tools in games), and the fans' fondness.

   Fondness (0–100) is worked out from the record for any player: seasons with his club, recent WAR there, a
   home-grown or home-town player, honours; events add to it. The best-loved sell shirts, and fans feel it when one
   of theirs leaves. */
import { hashUnit, rng } from '../draftroom';
import type { Player, PlayerId, TeamId } from '../model/types';
import { addAlert } from './alerts';
import { clubState } from './fans';
import { iga } from './josa';
import { addNews } from './news';
import { ageIn, isPitcher } from './players';
import { orgPlayers, type LeagueState } from './state';
import { FANS, LIFE as L } from './tuning';
import { traitsOf, troubleFactor } from './traits';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const short = (s: LeagueState, id: TeamId | null) => s.teams.find((t) => t.id === id)?.short ?? '';

// ── Fondness ─────────────────────────────────────────────────────────────────────────────────────

/** Whether he grew up where his club plays (its region, or the city of a new club). */
/** What the public sees of a player is enough (the profile shows these too). */
type Known = Omit<Player, 'hidden'>;

export function hometownOf(s: LeagueState, p: Known, teamId = p.teamId): boolean {
  const team = s.teams.find((t) => t.id === teamId);
  if (!team) return false;
  return team.region.split('·').some((x) => p.birthplace.startsWith(x)) || p.education.region === team.region;
}

/** How much the fans of his club like him, 0–100. */
export function fanAffinity(s: LeagueState, p: Known, teamId = p.teamId): number {
  if (!teamId) return 0;
  const F = L.fans;
  const here = p.career.filter((c) => !c.level && c.teamId === teamId);
  const recent = here.slice(-3);
  const weights = recent.map((_, i) => i + 1);
  const war = recent.length ? recent.reduce((a, c, i) => a + c.war * weights[i]!, 0) / weights.reduce((a, b) => a + b, 0) : 0;
  const homeGrown = p.origin.kind !== 'foreign' && !!p.origin.draftYear && p.career.filter((c) => !c.level).every((c) => c.teamId === teamId);
  const honors = (p.honors ?? []).length;
  const score =
    F.base +
    Math.min(F.seasons, here.length * F.perSeason) +
    clamp(war * F.perWar, F.war[0], F.war[1]) +
    (homeGrown && here.length ? F.homeGrown : 0) +
    (hometownOf(s, p, teamId) ? F.hometown : 0) +
    Math.min(F.honors, honors * F.perHonor) +
    (teamId === p.teamId ? (p.life?.fans ?? 0) : 0);
  return Math.round(clamp(score, 0, 100));
}

/** A club's best-loved players. */
export const favourites = (s: LeagueState, teamId: TeamId, n = 3) =>
  orgPlayers(s, teamId)
    .map((p) => ({ p, love: fanAffinity(s, p, teamId) }))
    .sort((a, b) => b.love - a.love)
    .slice(0, n);

/** The user's club's extra shirt sales from its three best-loved players (0 for every other club). */
export function favouritesMerch(s: LeagueState, teamId: TeamId): number {
  if (teamId !== s.user?.teamId) return 0;
  const top = favourites(s, teamId);
  if (!top.length) return 0;
  const avg = top.reduce((a, x) => a + x.love, 0) / top.length;
  return L.merch * clamp((avg - 40) / 60, 0, 1);
}

const adjustFans = (p: Player, by: number) => {
  const life = (p.life ??= {});
  life.fans = clamp((life.fans ?? 0) + by, -30, 30);
};

/**
 * One of the user's well-liked players leaves (traded, released, a free agent elsewhere): the club's fans' mood
 * drops with how much they liked him, and they say so.
 */
export function farewell(s: LeagueState, p: Player, from: TeamId, how: string, date = s.phase === 'regular' ? (s.schedule[Math.max(0, s.next - 1)]?.date ?? `${s.year}-04-01`) : `${s.year}-11-01`) {
  const u = s.user;
  if (!u || from !== u.teamId) return;
  const love = fanAffinity(s, p, from);
  if (love < L.farewell.from) return;
  const hit = L.farewell.most * ((love - L.farewell.from) / (100 - L.farewell.from) + 0.25);
  const c = clubState(s, from);
  c.interest = clamp(c.interest - hit, FANS.interestMin, FANS.interestMax);
  addNews(s, {
    date,
    kind: 'move',
    title: `팬들이 사랑한 ${p.name}, ${how}로 떠나`,
    body: `${short(s, from)} 팬들이 아끼던 ${iga(p.name)} ${how}로 팀을 떠난다(팬 호감도 ${love}). 구단 게시판과 SNS에는 아쉬움을 담은 글이 이어졌다.`,
    quotes: [{ who: '팬', role: 'fan', text: love >= 80 ? '이건 정말 받아들이기 힘들다' : '고마웠다, 어디서든 응원할게' }],
    facts: { player: p.name, fondness: love, how },
    players: [p.id],
    mine: true,
  });
}

// ── Family ───────────────────────────────────────────────────────────────────────────────────────

/** Married already when he came to us (by age, fixed per player), or married since. */
export function isMarried(s: LeagueState, p: Pick<Player, 'id' | 'birthday' | 'life'>, year = s.year): boolean {
  if (p.life?.married != null) return true;
  const age = year - Number(p.birthday.slice(0, 4));
  const chance = age >= 33 ? 0.8 : age >= 30 ? 0.6 : age >= 27 ? 0.3 : age >= 25 ? 0.12 : 0.03;
  return hashUnit(`${s.seed}|married|${p.id}`) < chance;
}

// ── Form ─────────────────────────────────────────────────────────────────────────────────────────

/** Grade points his main tools move in today's games. */
export const formOf = (p: Player, date: string) => (p.life?.form && p.life.form.until >= date ? p.life.form.delta : 0);

const setForm = (p: Player, delta: number, from: string, days: number, why: string) => {
  (p.life ??= {}).form = { delta, until: addDays(from, days), why };
};

const note = (p: Player, date: string, text: string, tone?: 'good' | 'bad') => {
  const life = (p.life ??= {});
  (life.events ??= []).push({ date, text, ...(tone ? { tone } : {}) });
  if (life.events.length > 12) life.events.splice(0, life.events.length - 12);
};

// ── Events in the season ─────────────────────────────────────────────────────────────────────────

type Kind = 'birth' | 'loss' | 'hot' | 'cold' | 'fanService' | 'charity' | 'row' | 'accident' | Extra;
/** 1.2.0: more of life, leaning on the hidden traits (traits.ts). */
type Extra = 'extraWork' | 'mentor' | 'commercial' | 'variety' | 'hometownCheer' | 'feud' | 'grumble';
const WEIGHTS = Object.entries(L.weights) as [Kind, number][];

const FAN_SERVICE = ['경기 뒤 1시간 넘게 사인을 해 줘', '병원에 있는 어린이 팬을 찾아가', '홈런 공을 주운 어린이 팬에게 배트를 선물해', '비 오는 날 우비를 입고 끝까지 팬 사인회를 지켜'];
const CHARITY = ['모교에 야구용품을', '지역 아동센터에 성금을', '소아암 환우를 위해 기부금을', '홈런 하나당 적립한 돈을 유소년 야구에'];
const ROWS = ['SNS 발언이 논란이 돼', '팬과의 말다툼 영상이 퍼져', '경기 중 행동이 비매너 논란을 불러'];
const ACCIDENTS = ['집에서 손가락을 베여', '가벼운 교통사고로 목 근육을 다쳐', '훈련 중 발목을 접질려'];
const FAMILY = ['부친상', '모친상', '조부상', '조모상'];
const EXTRA_WORK: Record<'pitcher' | 'hitter', string[]> = {
  pitcher: ['경기 뒤 불펜에서 공 50개를 더 던지며', '새벽 6시에 구장에 나와 투구 영상을 돌려 보며', '휴식일에도 나와 하체 훈련을 하며'],
  hitter: ['경기 뒤 특타를 자청해 배트를 300번 넘게 휘두르며', '새벽 6시에 구장에 나와 티 배팅을 하며', '휴식일에도 실내 연습장에서 스윙을 다듬으며'],
};
const COMMERCIALS = ['스포츠음료', '치킨 프랜차이즈', '지역 은행', '야구 게임', '아웃도어 브랜드'];
const SHOWS = ['예능 프로그램', '유튜브 야구 채널', '라디오 프로그램', '먹방 콘텐츠'];
const FEUDS = ['더그아웃에서 언성을 높이며', '수비 실책을 두고 말다툼을 벌이며', '훈련 방식을 두고 부딪히며'];

const pickOf = <T,>(xs: readonly T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;

/** Who an event can happen to. */
function eligible(s: LeagueState, kind: Kind, p: Player, year: number, date: string): boolean {
  const active = s.user ? s.rosters[s.user.teamId]!.active.includes(p.id) : false;
  const age = ageIn(p, year);
  if (p.status !== 'active' || s.injuries[p.id] || s.away[p.id] || s.abroad?.[p.id]) return false;
  switch (kind) {
    case 'birth':
      // Not again within two years of the last child.
      return isMarried(s, p, year) && age >= 25 && age <= 38 && year - (p.life?.lastBirth ?? -99) >= 2;
    case 'loss':
      return age >= 24;
    case 'hot':
    case 'cold':
      return active && !formOf(p, date);
    case 'fanService':
    case 'charity':
    case 'row':
      return active || age >= 25;
    case 'accident':
      return true;
    case 'extraWork':
      return active && traitsOf(p).work >= 60 && !formOf(p, date);
    case 'mentor':
      return active && age <= 24 && !formOf(p, date) && !!mentorFor(s, p, year);
    case 'commercial':
      return fanAffinity(s, p) >= 55;
    case 'variety':
      return age >= 22 && (active || fanAffinity(s, p) >= 45);
    case 'hometownCheer':
      return active && hometownOf(s, p);
    case 'feud':
      return active && age >= 21 && traitsOf(p).controversy >= 35;
    case 'grumble':
      // A veteran stuck in the futures who would rather play elsewhere.
      return !active && age >= 26 && traitsOf(p).loyalty < 40 && p.scouting.current >= 45;
  }
}

/** A senior on our first team with a leader's voice to take a young player aside. */
function mentorFor(s: LeagueState, young: Player, year: number): Player | undefined {
  const active = s.rosters[s.user!.teamId]!.active;
  return active
    .map((id) => s.players[id]!)
    .filter((q) => q.id !== young.id && ageIn(q, year) >= 30 && traitsOf(q).leadership >= 60 && isPitcher(q) === isPitcher(young))
    .sort((a, b) => traitsOf(b).leadership - traitsOf(a).leadership)[0];
}

/** How likely each eligible player is to be the one (1.2.0): trouble finds the troublemakers, good deeds the
    leaders and the loyal, extra work the hard workers. */
function leanOf(kind: Kind, p: Player): number {
  const t = traitsOf(p);
  switch (kind) {
    case 'row':
    case 'feud':
      return troubleFactor(p);
    case 'fanService':
    case 'charity':
      return 1 + Math.max(0, t.leadership - 50) / 50 + Math.max(0, t.loyalty - 50) / 50;
    case 'extraWork':
      return 1 + (t.work - 60) / 20;
    default:
      return 1;
  }
}

/**
 * One game day: now and then something happens to one of the user's players. Returns the player it happened to,
 * if any.
 */
export function lifeDay(s: LeagueState, date: string): PlayerId | null {
  const u = s.user;
  if (!u) return null;
  const r = rng(`${s.seed}|life|${date}`);
  if (r() >= L.daily) return null;
  const year = s.year;
  const people = orgPlayers(s, u.teamId);
  const total = WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  const kind = WEIGHTS.find(([, w]) => (x -= w) < 0)?.[0] ?? 'hot';
  const pool = people.filter((p) => eligible(s, kind, p, year, date));
  if (!pool.length) return null;
  const weights = pool.map((q) => leanOf(kind, q));
  let y = r() * weights.reduce((a, b) => a + b, 0);
  const p = pool[weights.findIndex((w) => (y -= w) < 0)] ?? pool.at(-1)!;
  const onFirst = s.rosters[u.teamId]!.active.includes(p.id);
  const main = isPitcher(p) ? '구위' : '타격감';
  let title = '',
    body = '',
    tone: 'good' | 'bad' | undefined;
  const quotes: { who: string; role: 'player' | 'fan' | 'manager'; text: string }[] = [];
  switch (kind) {
    case 'birth': {
      const life = (p.life ??= {});
      life.kids = (life.kids ?? 0) + 1;
      life.lastBirth = year;
      const days = L.leave.birth[0] + Math.floor(r() * (L.leave.birth[1] - L.leave.birth[0] + 1));
      const child = r() < 0.5 ? '득남' : '득녀';
      if (onFirst) s.away[p.id] = addDays(date, days - 1);
      setForm(p, L.form.baby, addDays(date, onFirst ? days : 0), 14, child);
      adjustFans(p, 3);
      title = `${p.name}, ${child}${life.kids > 1 ? ` (${life.kids}번째)` : ''}`;
      body = `${iga(p.name)} ${date.slice(5).replace('-', '월 ')}일 ${child}했다.${onFirst ? ` 경조사 휴가로 ${days}일 1군에서 빠지며, 이 기간도 등록일수로 인정된다.` : ''} 아빠가 된 뒤 힘이 난다는 '분유 버프'를 기대하는 팬이 많다.`;
      quotes.push({ who: p.name, role: 'player', text: '아이 얼굴을 보니 더 책임감이 생깁니다. 돌아가서 더 잘하겠습니다.' });
      tone = 'good';
      break;
    }
    case 'loss': {
      const days = L.leave.loss[0] + Math.floor(r() * (L.leave.loss[1] - L.leave.loss[0] + 1));
      const what = pickOf(FAMILY, r);
      if (onFirst) s.away[p.id] = addDays(date, days - 1);
      setForm(p, L.form.loss, addDays(date, onFirst ? days : 0), 10, what);
      adjustFans(p, 2);
      title = `${p.name}, ${what}`;
      body = `${iga(p.name)} ${what}을 당했다.${onFirst ? ` 경조사 휴가로 ${days}일 동안 1군에서 빠진다(등록일수 인정).` : ''} 구단과 동료들이 빈소를 찾았다.`;
      quotes.push({ who: '팬', role: 'fan', text: '마음 잘 추스르고 돌아오세요' });
      break;
    }
    case 'hot': {
      const days = 10 + Math.floor(r() * 6);
      setForm(p, L.form.hot, date, days, `${main} 절정`);
      title = `${p.name}, ${main} 절정`;
      body = `${p.name}의 ${main}이(가) 최고조다. 코칭스태프는 "요즘 컨디션이 가장 좋다"고 했다.`;
      tone = 'good';
      break;
    }
    case 'cold': {
      const days = 12 + Math.floor(r() * 9);
      setForm(p, L.form.cold, date, days, '슬럼프');
      title = `${p.name}, 깊은 슬럼프`;
      body = `${iga(p.name)} 슬럼프에 빠졌다. ${isPitcher(p) ? '공에 힘이 없고 제구가 흔들린다' : '타이밍이 맞지 않아 범타가 이어진다'}. 감독은 "곧 제 모습을 찾을 것"이라고 했다.`;
      tone = 'bad';
      break;
    }
    case 'fanService': {
      adjustFans(p, 4);
      title = `${p.name}의 팬 서비스 미담`;
      body = `${iga(p.name)} ${pickOf(FAN_SERVICE, r)} 팬들 사이에 화제가 됐다.`;
      quotes.push({ who: '팬', role: 'fan', text: '이래서 이 선수를 좋아한다' });
      tone = 'good';
      break;
    }
    case 'charity': {
      adjustFans(p, 5);
      title = `${p.name}, 기부로 훈훈`;
      body = `${iga(p.name)} ${pickOf(CHARITY, r)} 기부했다. 알려지지 않게 해 달라고 했지만 받은 곳에서 소식을 전했다.`;
      tone = 'good';
      break;
    }
    case 'row': {
      adjustFans(p, -6);
      setForm(p, L.form.row, date, 7, '구설');
      title = `${p.name}, 구설에 사과`;
      body = `${iga(p.name)} ${pickOf(ROWS, r)} 고개를 숙였다. 구단은 "선수에게 주의를 줬다"고 밝혔다.`;
      quotes.push({ who: '팬', role: 'fan', text: '실망이다, 행동으로 보여 줘라' });
      tone = 'bad';
      break;
    }
    case 'accident': {
      const days = 3 + Math.floor(r() * 5);
      const what = pickOf(ACCIDENTS, r);
      s.injuries[p.id] = { until: addDays(date, days + 1), days, onList: false, dtd: true, part: '일상 중 부상' };
      title = `${p.name}, ${days}일 안팎 결장`;
      body = `${iga(p.name)} ${what} ${days}일쯤 쉬어 간다. 큰 부상은 아니다.`;
      tone = 'bad';
      break;
    }
    case 'extraWork': {
      setForm(p, L.form.hot * 0.6, addDays(date, 2), 10, '특훈');
      adjustFans(p, 2);
      title = `${p.name}, 특훈 자청`;
      body = `${iga(p.name)} ${pickOf(EXTRA_WORK[isPitcher(p) ? 'pitcher' : 'hitter'], r)} 땀을 흘리고 있다. 코치진은 "말리지 않으면 쉬지를 않는다"며 웃었다.`;
      quotes.push({ who: p.name, role: 'player', text: '잘될 때 더 해 둬야 안 될 때 버틸 수 있습니다.' });
      tone = 'good';
      break;
    }
    case 'mentor': {
      const vet = mentorFor(s, p, year)!;
      setForm(p, L.form.hot * 0.8, date, 12, `${vet.name}의 조언`);
      adjustFans(vet, 2);
      note(vet, date, `후배 ${p.name}에게 조언`, 'good');
      title = `${p.name}, 선배 ${vet.name}의 조언에 반등`;
      body = `${iga(p.name)} ${vet.name}의 조언을 듣고 달라졌다. ${iga(vet.name)} ${isPitcher(p) ? '투구 템포와 마운드 위 마음가짐' : '타석에서의 노림수와 루틴'}을 짚어 줬다고 한다.`;
      quotes.push({ who: p.name, role: 'player', text: `${vet.name} 선배님이 하신 말씀을 매일 되새기고 있습니다.` });
      tone = 'good';
      break;
    }
    case 'commercial': {
      adjustFans(p, 3);
      title = `${p.name}, 광고 모델 발탁`;
      body = `${iga(p.name)} ${pickOf(COMMERCIALS, r)} 광고 모델이 됐다. 구단 상품 판매에도 도움이 될 전망이다.`;
      quotes.push({ who: '팬', role: 'fan', text: '광고 보고 바로 유니폼 샀다' });
      tone = 'good';
      break;
    }
    case 'variety': {
      adjustFans(p, 3);
      title = `${p.name}, ${pickOf(SHOWS, r)} 출연으로 화제`;
      body = `${iga(p.name)} 쉬는 날 출연한 방송이 화제가 됐다. 야구장 밖 모습에 새 팬이 늘었다는 평이다.`;
      quotes.push({ who: '팬', role: 'fan', text: '이렇게 웃긴 사람인 줄 몰랐다' });
      tone = 'good';
      break;
    }
    case 'hometownCheer': {
      adjustFans(p, 3);
      setForm(p, 1, date, 5, '고향 팬 응원');
      title = `${p.name}의 고향 팬들, 단체 응원`;
      body = `${p.name}의 고향 사람들이 버스를 빌려 야구장을 찾았다. 응원 현수막이 외야를 채웠다.`;
      quotes.push({ who: p.name, role: 'player', text: '어릴 때부터 저를 봐 주신 분들이라 더 힘이 났습니다.' });
      tone = 'good';
      break;
    }
    case 'feud': {
      const other = pickOf(
        s.rosters[u.teamId]!.active.filter((id) => id !== p.id).map((id) => s.players[id]!),
        r,
      );
      const leader = s.rosters[u.teamId]!.active.map((id) => s.players[id]!).find((q) => q !== p && q !== other && ageIn(q, year) >= 28 && traitsOf(q).leadership >= 70);
      const hit = leader ? L.form.row / 2 : L.form.row * 1.5;
      setForm(p, hit, date, 7, '불화');
      if (other && !formOf(other, date)) setForm(other, hit, date, 7, '불화');
      adjustFans(p, -2);
      title = `${p.name}, ${other?.name ?? '동료'}와 신경전`;
      body = `${iga(p.name)} ${other?.name ?? '동료'}와 ${pickOf(FEUDS, r)} 분위기가 얼어붙었다.${leader ? ` ${iga(leader.name)} 둘을 불러 이야기를 나눴고, 이튿날 둘은 웃으며 훈련했다.` : ' 감독이 직접 면담에 나섰다.'}`;
      tone = 'bad';
      break;
    }
    case 'grumble': {
      adjustFans(p, -1);
      title = `${p.name}, 출전 기회 아쉬움 토로`;
      body = `퓨처스에 머무는 ${iga(p.name)} 지인들에게 "1군에서 뛸 수 있는 곳이라면 어디든 가고 싶다"는 속내를 털어놓은 것으로 알려졌다.`;
      quotes.push({ who: '팬', role: 'fan', text: '기회 한번 줘 보자' });
      tone = 'bad';
      break;
    }
  }
  note(p, date, title, tone);
  addNews(s, { id: `life-${date}-${p.id}`, date, kind: 'interview', title, body, quotes, facts: { player: p.name, event: title }, players: [p.id], mine: true });
  // A pop-up only when it takes a first-team player out for a few days.
  if (onFirst && (kind === 'birth' || kind === 'loss' || kind === 'accident'))
    addAlert(s, { id: `life-${date}-${p.id}`, date, kind: 'life', title, lines: [body], ...(tone ? { tone } : {}), players: [p.id] });
  return p.id;
}

// ── The winter ───────────────────────────────────────────────────────────────────────────────────

const WORK: Record<'pitcher' | 'hitter', [import('../draftroom').ToolKey, string][]> = {
  pitcher: [
    ['stuff', '하체 근력을 키워 구속을 올리려'],
    ['command', '투구 동작을 다듬어 제구를 잡으려'],
    ['stamina', '체중을 늘리고 체력을 길러'],
  ],
  hitter: [
    ['power', '벌크업으로 장타를 늘리려'],
    ['contact', '레그킥을 줄여 정확도를 높이려'],
    ['speed', '체중을 줄여 몸을 가볍게 하려'],
  ],
};

/** The winter's events for the user's players: weddings, gifts, work on his own. */
export function lifeWinter(s: LeagueState, year: number) {
  const u = s.user;
  if (!u) return;
  const W = L.winter;
  for (const p of orgPlayers(s, u.teamId)) {
    if (p.status !== 'active') continue;
    const r = rng(`${s.seed}|life-winter|${year}|${p.id}`);
    const age = ageIn(p, year + 1);
    const date = `${year}-12-${String(5 + Math.floor(r() * 20)).padStart(2, '0')}`;
    if (!isMarried(s, p, year) && age >= 26 && age <= 33 && r() < W.marry) {
      (p.life ??= {}).married = year;
      adjustFans(p, 2);
      note(p, date, '결혼', 'good');
      addNews(s, { id: `wed-${year}-${p.id}`, date, kind: 'interview', title: `${p.name}, 백년가약`, body: `${iga(p.name)} ${date.slice(5).replace('-', '월 ')}일 결혼식을 올렸다. 동료들이 축가와 사회를 맡았다.`, quotes: [{ who: p.name, role: 'player', text: '가장으로서 더 단단한 시즌을 보내겠습니다.' }], facts: { player: p.name }, players: [p.id], mine: true });
    }
    if (r() < W.charity) {
      adjustFans(p, 4);
      note(p, date, '연말 기부', 'good');
      addNews(s, { id: `gift-${year}-${p.id}`, date, kind: 'interview', title: `${p.name}, 연말 기부`, body: `${iga(p.name)} ${pickOf(CHARITY, r)} 내놨다.`, quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
    }
    if (age <= 30 && r() < W.selfWork) {
      const [tool, how] = pickOf(WORK[isPitcher(p) ? 'pitcher' : 'hitter'], r);
      const cur = p.hidden.current[tool];
      if (cur != null) {
        const g = 1 + Math.round(r() * 10) / 10;
        p.hidden.current[tool] = Math.min(80, cur + g);
        if (p.hidden.current[tool]! > (p.hidden.potential[tool] ?? 0)) p.hidden.potential[tool] = p.hidden.current[tool];
        note(p, date, '비시즌 개인 훈련', 'good');
        addNews(s, { id: `work-${year}-${p.id}`, date, kind: 'interview', title: `${p.name}의 겨울`, body: `${iga(p.name)} ${how} 겨우내 개인 훈련에 매달렸다.`, quotes: [], facts: { player: p.name }, players: [p.id], mine: true });
      }
    }
  }
}
