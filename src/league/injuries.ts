/* Injuries (V0.7.7): what goes wrong, for how long, and what it leaves behind.

   Two kinds. A knock (타박상, 뭉침, 몸살) keeps a player out of the lineup for a few days while he stays
   registered; anything a week or longer takes him off the first team onto the injured list (RULES.md §7).
   The catalogue follows a KBO first team's season (RULES.md §7, S51: one club in 2021 — 50 time-loss
   injuries, 70% under a week, 16% three weeks or longer, trunk and back the most common) and the
   usual layoffs reported in KBO news: 옆구리 4~6주, 햄스트링 2~5주, 사구 골절 5~8주, 토미존 1년 이상.
   A major operation can change a player for good (a step slower after the knee or the Achilles, less
   life on the fastball after the labrum), makes him more fragile, and is the usual reason for a 4급
   military grade (military.ts). Surgery layoffs carry over the winter. */
import { rng, type ToolKey } from '../draftroom';
import type { InjuryRecord, Player, PlayerId } from '../model/types';
import type { TeamBox } from './engine/types';
import { addAlert } from './alerts';
import { iga, ro } from './josa';
import { addNews } from './news';
import { ageIn, isPitcher } from './players';
import { staffEdge, staffRating } from './staff';
import type { LeagueState, SeasonLine } from './state';
import { INJURY, STAFF, TRAINING } from './tuning';
import { facilityInjury, facilityRehab } from './facilities';

export interface InjuryType {
  part: string;
  weight: number;
  days: [number, number];
  surgery?: 'minor' | 'major';
  /** Lasting loss of hidden ability: [tool, most, least] grade points (negative). */
  effects?: [ToolKey, number, number][];
}

/** Injuries that take a pitcher off the first team (a week or longer). */
const PITCHER: InjuryType[] = [
  { part: '팔꿈치 염증', weight: 12, days: [10, 28] },
  { part: '어깨 염증', weight: 10, days: [14, 35] },
  { part: '옆구리 근육 손상', weight: 8, days: [21, 42] },
  { part: '허리 통증', weight: 7, days: [7, 21] },
  { part: '손가락 물집·손톱 손상', weight: 4, days: [7, 14] },
  { part: '햄스트링 손상', weight: 4, days: [14, 28] },
  { part: '광배근 손상', weight: 3, days: [28, 56] },
  { part: '팔꿈치 인대 손상 (재활)', weight: 4, days: [42, 90] },
  { part: '회전근개 손상 (재활)', weight: 3, days: [42, 90] },
  { part: '타구에 맞은 타박상', weight: 3, days: [7, 14] },
  { part: '타구에 맞아 골절', weight: 1, days: [42, 70] },
  { part: '팔꿈치 뼛조각 제거 수술', weight: 2.5, days: [60, 100], surgery: 'minor' },
  {
    part: '팔꿈치 인대 재건술 (토미존)',
    weight: 2.5,
    days: [365, 480],
    surgery: 'major',
    effects: [
      ['stuff', -3, 0],
      ['command', -3, 0],
    ],
  },
  {
    part: '어깨 관절와순 수술',
    weight: 0.8,
    days: [330, 450],
    surgery: 'major',
    effects: [
      ['stuff', -7, -3],
      ['command', -4, -1],
      ['stamina', -4, 0],
    ],
  },
  { part: '흉곽출구증후군 수술', weight: 0.3, days: [120, 180], surgery: 'minor' },
];

/** Injuries that take a position player off the first team. */
const HITTER: InjuryType[] = [
  { part: '옆구리 근육 손상', weight: 12, days: [21, 42] },
  { part: '허리 통증', weight: 12, days: [7, 21] },
  { part: '햄스트링 손상', weight: 12, days: [14, 35] },
  { part: '등 근육 손상', weight: 4, days: [14, 28] },
  { part: '고관절·사타구니 통증', weight: 5, days: [10, 28] },
  { part: '허벅지 근육 손상', weight: 4, days: [14, 28] },
  { part: '종아리 근육 손상', weight: 5, days: [14, 28] },
  { part: '손목 염좌', weight: 6, days: [10, 28] },
  { part: '손가락 인대 손상', weight: 4, days: [14, 35] },
  { part: '사구에 맞아 손 골절', weight: 6, days: [35, 60] },
  { part: '발목 염좌', weight: 6, days: [10, 28] },
  { part: '파울 타구에 맞아 발 골절', weight: 4, days: [35, 70] },
  { part: '무릎 염좌', weight: 5, days: [7, 21] },
  { part: '어깨 염증', weight: 3, days: [14, 28] },
  { part: '뇌진탕', weight: 2, days: [7, 14] },
  { part: '유구골 골절 수술', weight: 2, days: [35, 56], surgery: 'minor' },
  { part: '반월상 연골 수술', weight: 1.5, days: [60, 100], surgery: 'minor' },
  {
    part: '전방십자인대 재건술',
    weight: 0.8,
    days: [240, 330],
    surgery: 'major',
    effects: [
      ['speed', -7, -3],
      ['defense', -3, -1],
    ],
  },
  {
    part: '어깨 탈구 수술',
    weight: 0.8,
    days: [150, 210],
    surgery: 'major',
    effects: [
      ['defense', -2, 0],
      ['power', -2, 0],
    ],
  },
  {
    part: '아킬레스건 봉합술',
    weight: 0.4,
    days: [180, 270],
    surgery: 'major',
    effects: [
      ['speed', -9, -5],
      ['defense', -4, -2],
    ],
  },
  {
    part: '허리 디스크 수술',
    weight: 0.6,
    days: [90, 150],
    surgery: 'major',
    effects: [['power', -3, -1]],
  },
];

/** Knocks: out of the lineup for a few days, still registered. */
const KNOCKS = {
  pitcher: ['손가락 물집', '어깨 뭉침', '팔꿈치 뻐근함', '허리 뻐근함', '몸살'],
  hitter: ['사구 타박상', '파울 타구 타박상', '손가락 통증', '허리 뻐근함', '가벼운 발목 염좌', '햄스트링 뭉침', '몸살', '장염', '담 증세'],
};

export const INJURY_TYPES = { pitcher: PITCHER, hitter: HITTER };

const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);

/**
 * How likely this injury is for him. A major operation he has had before is much rarer the second time: a rebuilt
 * elbow ligament gives way again in about one MLB pitcher in eight over a career (RULES.md S71), and hardly ever
 * in the first two years; a third time is rarer still.
 */
export function injuryWeight(p: Player, t: InjuryType, date: string): number {
  if (t.surgery !== 'major') return t.weight;
  const before = (p.injuries ?? []).filter((x) => x.part === t.part);
  if (!before.length) return t.weight;
  const R = INJURY.repeat;
  const years = (Date.parse(date) - Date.parse(before.at(-1)!.date)) / (365 * 86400000);
  return t.weight * (years < R.within ? R.soon : R.later) * R.again ** (before.length - 1);
}

function pick(list: InjuryType[], r: () => number, weight: (t: InjuryType) => number = (t) => t.weight): InjuryType {
  let x = r() * list.reduce((a, t) => a + weight(t), 0);
  for (const t of list) if ((x -= weight(t)) < 0) return t;
  return list[list.length - 1]!;
}

/** Out of the lineup today for any reason (injured, a knock, the national team). */
export const sidelined = (s: LeagueState, id: PlayerId) => !!s.injuries[id] || !!s.away?.[id] || !!s.abroad?.[id];
/** Off the first team: on the injured list, in rehab or with the national team (a knock does not count). */
export const offRoster = (s: LeagueState, id: PlayerId) => {
  const i = s.injuries[id];
  return (!!i && !i.dtd) || !!s.away?.[id] || !!s.abroad?.[id];
};

/** A major operation's lasting mark on the player: hidden ability, and a little more fragile. */
function aftermath(p: Player, t: InjuryType, r: () => number) {
  for (const [tool, most, least] of t.effects ?? []) {
    const loss = Math.round(least + (most - least) * r());
    for (const tools of [p.hidden.current, p.hidden.potential]) {
      const v = tools[tool];
      if (v != null) tools[tool] = Math.max(20, v + loss);
    }
  }
  p.hidden.injuryRisk = Math.min(INJURY.maxRisk, p.hidden.injuryRisk + INJURY.riskAfterSurgery);
}

/**
 * Injuries from one side's game. Chances per appearance scale with the player's hidden risk, his age past
 * 30 and, for pitchers, a long outing; the club's head trainer lowers them and shortens layoffs (staff.ts).
 * Futures games (`level` 'futures') hurt a little less often and do not put anyone on the injured list.
 */
export function rollInjuries(s: LeagueState, box: TeamBox, date: string, r: () => number, line: (id: PlayerId, teamId: string) => SeasonLine, level: 'first' | 'futures' = 'first') {
  const pitches = new Map(box.pitching.map((x) => [x.id, x.pitches]));
  const ids = [...box.batting.map((b) => b.id), ...box.pitching.map((p) => p.id)];
  for (const id of ids) {
    const p = s.players[id]!;
    const u = r();
    if (s.injuries[id] || !p.teamId) continue;
    const pitcher = isPitcher(p);
    const starter = pitcher && p.role === 'SP' && (pitches.get(id) ?? 0) >= 50;
    const base = !pitcher ? INJURY.perGame.hitter : starter ? INJURY.perGame.starter : INJURY.perGame.reliever;
    const workload = pitcher ? Math.max(1, (pitches.get(id) ?? 0) / (starter ? 95 : 25)) : 1;
    const age = Math.max(0, ageIn(p, s.year) - INJURY.ageFrom);
    const medical = staffEdge(staffRating(s, p.teamId, 'medical'));
    // The user's grass and gym, and a conditioning programme abroad this season (V0.10; 1 for everyone else).
    const care = (1 - facilityInjury(s, p.teamId)) * (p.life?.conditioned === s.year ? TRAINING.conditioned : 1);
    const scale = (p.hidden.injuryRisk / INJURY.riskScale) * (1 + age * INJURY.perYearOver) * (1 - STAFF.injury * medical) * (level === 'futures' ? INJURY.futures : 1) * care;
    const serious = base * workload * scale;
    const knock = (pitcher ? INJURY.knock.pitcher : INJURY.knock.hitter) * scale;
    if (u >= serious + knock) continue;
    const r2 = rng(`${s.seed}|injury-part|${id}|${date}`);
    if (u >= serious) {
      // A knock: a few days out of the lineup (first team only; the futures squad just plays someone else).
      if (level !== 'first') continue;
      const list = KNOCKS[pitcher ? 'pitcher' : 'hitter'];
      const days = INJURY.knock.days[0] + Math.floor(r2() * (INJURY.knock.days[1] - INJURY.knock.days[0] + 1));
      s.injuries[id] = { until: addDays(date, days + 1), days, onList: false, dtd: true, part: list[Math.floor(r2() * list.length)]! };
      continue;
    }
    const t = pick(INJURY_TYPES[pitcher ? 'pitcher' : 'hitter'], r2, (x) => injuryWeight(p, x, date));
    const spread = (r2() + r2()) / 2;
    const quicker = STAFF.injuryDays * medical * (t.surgery === 'major' ? 0.5 : 1) + facilityRehab(s, p.teamId);
    const days = Math.max(7, Math.round((t.days[0] + (t.days[1] - t.days[0]) * spread) * (1 - quicker)));
    s.injuries[id] = { until: addDays(date, days), days, onList: level === 'first', part: t.part, ...(t.surgery ? { surgery: t.surgery } : {}) };
    const rec: InjuryRecord = { date, days, part: t.part, ...(level === 'futures' ? { futures: true } : {}), ...(t.surgery ? { surgery: t.surgery } : {}) };
    (p.injuries ??= []).push(rec);
    if (t.surgery === 'major') aftermath(p, t, r2);
    line(id, p.teamId).lost += days;
    if (p.teamId === s.user?.teamId && days >= INJURY.newsFrom) injuryNews(s, p, t, days, date, level);
  }
}

const ROLE: Record<string, string> = { SP: '선발투수', RP: '불펜투수', C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수' };
const weeks = (days: number) => (days >= 60 ? `${Math.round(days / 30)}개월` : `${Math.max(3, Math.round(days / 7))}주`);

/** Our player is out three weeks or longer: an article, and a pop-up for an operation that costs a season. */
function injuryNews(s: LeagueState, p: Player, t: InjuryType, days: number, date: string, level: 'first' | 'futures') {
  const team = s.teams.find((x) => x.id === p.teamId)!;
  const who = `${ROLE[isPitcher(p) ? p.role : (p.position ?? '')] ?? ''} ${p.name}`.trim();
  const back = addDays(date, days);
  const when = back.slice(0, 4) === date.slice(0, 4) ? `${Number(back.slice(5, 7))}월` : `${back.slice(0, 4)}년 ${Number(back.slice(5, 7))}월`;
  const surgery = t.surgery === 'major' ? ' 수술대에 오른다' : t.surgery ? ' 수술을 받는다' : '';
  addNews(s, {
    id: `injury-${p.id}-${date}`,
    date,
    kind: 'injury',
    title: `${team.short} ${p.name}, ${surgery ? `${t.part}…${surgery.trim()}` : `${ro(t.part)} 이탈`}`,
    body: `${team.name} ${iga(who)} ${level === 'futures' ? '퓨처스 경기에서 ' : ''}${t.part} 진단을 받았다. 복귀까지 ${weeks(days)}가량 걸릴 전망으로, ${when}쯤 돌아올 것으로 보인다.${t.surgery === 'major' ? ' 긴 재활이 필요한 큰 수술이다.' : ''}`,
    quotes: [],
    facts: { 선수: p.name, 구단: team.name, 부상: t.part, '예상 기간': `${days}일`, '복귀 예정': back, ...(t.surgery ? { 수술: t.surgery === 'major' ? '큰 수술' : '수술' } : {}) },
    players: [p.id],
    mine: true,
  });
  if (t.surgery === 'major')
    addAlert(s, {
      id: `injury-${p.id}-${date}`,
      date,
      kind: 'injury',
      title: `${p.name} ${t.part}`,
      lines: [`${who} · 복귀까지 약 ${weeks(days)} (${back} 예정)`, ...(p.service.military === 'pending' ? ['군 미필: 다음 병역판정에서 4급(사회복무요원) 이하가 나올 수 있습니다.'] : [])],
      tone: 'bad',
      players: [p.id],
    });
}

/** Long layoffs run over the winter: who is still out on opening day stays out (in rehab, off the list). */
export function carryOverInjuries(s: LeagueState, opening: string | undefined) {
  const kept: LeagueState['injuries'] = {};
  if (opening)
    for (const [id, inj] of Object.entries(s.injuries)) {
      const p = s.players[id];
      if (!inj.dtd && inj.until > opening && p?.teamId && p.status === 'active') kept[id] = { ...inj, onList: false };
    }
  s.injuries = kept;
}

/** Major operations in a player's history (the usual ground for a 4급 or 5급 military grade). */
export const majorSurgeries = (p: Player) => (p.injuries ?? []).filter((x) => x.surgery === 'major');

