/* League-side player helpers: ages, the values clubs judge players by (public scouting only), yearly
   draft pools, and foreign players. */
import { generateDraftPool, isPitcherRole, overall, rng, toGrade, type DraftProspect, type Role, type Tools } from '../draftroom';
import { ageOn, fromDraftProspect } from '../model/player';
import { assignPosition } from '../model/position';
import type { Player } from '../model/types';

export const ageIn = (p: Player, year: number) => ageOn(p.birthday, `${year}-04-01`);
export const isPitcher = (p: Player) => isPitcherRole(p.role);

/** Hitting value from public tools (defense handled by position). */
export const batValue = (t: Tools) => 0.3 * (t.contact ?? 30) + 0.3 * (t.power ?? 30) + 0.22 * (t.eye ?? 30) + 0.1 * (t.speed ?? 30) + 0.08 * (t.defense ?? 30);

// How much the glove counts at each position. Draft Room's overall weighs a catcher's defense at 48%,
// which, used for roster decisions, slowly pushes sluggers out of the league.
const GLOVE: Record<string, number> = { C: 0.3, SS: 0.28, '2B': 0.2, CF: 0.2, '3B': 0.14, RF: 0.1, LF: 0.06, '1B': 0.04 };
const hitterScore = (t: Tools, position: string | null) => {
  const w = GLOVE[position ?? '1B'] ?? 0.1;
  return batValue(t) * (1 - w) + (t.defense ?? 30) * w;
};

/** A club's view of a player now: overall grade for pitchers, bat plus positional glove for hitters. */
export const currentValue = (p: Player) => (isPitcherRole(p.role) ? p.scouting.current : hitterScore(p.scouting.tools, p.position));
/** The same view of what he will become. */
export const futureValue = (p: Player) => (isPitcherRole(p.role) ? p.scouting.futureValue : Math.max(currentValue(p), hitterScore(p.scouting.futureTools, p.position)));

/** What a club weighs when keeping or cutting: current value, blended with future value for young players. */
export function keepValue(p: Player, year: number): number {
  const age = ageIn(p, year);
  const w = age <= 23 ? 0.5 : age <= 26 ? 0.3 : age <= 28 ? 0.12 : 0;
  return currentValue(p) * (1 - w) + futureValue(p) * w;
}
export const pitchValue = (t: Tools, role: Role) => overall(t, role === 'SP' ? 'SP' : 'RP');
export const starterValue = (t: Tools) => overall(t, 'SP') + ((t.stamina ?? 40) - 45) * 0.25;

const DRAFT_ROOM_YEAR = 2026;

function shiftDate<T extends string | null>(date: T, years: number): T {
  if (!date) return date;
  const [y, rest] = [Number(date.slice(0, 4)), date.slice(4)];
  // Keep Feb 29 valid in non-leap years.
  const shifted = `${y + years}${rest}`;
  return (rest === '-02-29' && !isLeap(y + years) ? `${y + years}-02-28` : shifted) as T;
}
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A Draft Room prospect moved to another draft year: every date shifts, ability is unchanged. */
export function shiftProspect(p: DraftProspect, years: number): DraftProspect {
  if (!years) return p;
  return {
    ...p,
    birthday: shiftDate(p.birthday, years),
    history: p.history.map((h) => ({ ...h, start: shiftDate(h.start, years), end: shiftDate(h.end, years) })),
  };
}

export const poolSeed = (seed: string, draftYear: number) => (draftYear === DRAFT_ROOM_YEAR ? seed : `${seed}|draft|${draftYear}`);

/** The prospects of the draft held in September of `draftYear`, as league amateurs. */
export function draftClass(seed: string, draftYear: number): Player[] {
  const ps = poolSeed(seed, draftYear);
  const pool = generateDraftPool(ps);
  return pool.players.map((p) => fromDraftProspect(shiftProspect(p, draftYear - DRAFT_ROOM_YEAR), draftYear, ps));
}

// ── Foreign players ──────────────────────────────────────────────────────────────────────────────
// Names are common given/family names put together at random, written the way KBO rosters spell them.
const WEST_GIVEN = '제이크 라이언 카일 브랜든 타일러 코디 딜런 에릭 케빈 저스틴 조던 마이클 알렉스 대니얼 트레버 오스틴 네이선 숀 콜 잭 매트 루크 헌터 체이스 가렛'.split(' ');
const WEST_FAMILY = '밀러 존슨 윌리엄스 브라운 데이비스 윌슨 테일러 앤더슨 토머스 무어 마틴 잭슨 톰프슨 화이트 해리스 클라크 워커 홀 영 앨런 라이트 킹 스콧 그린 베이커 애덤스 넬슨 캠벨 파커 에번스'.split(' ');
const LATIN_GIVEN = '호세 카를로스 미겔 라파엘 안드레스 헥터 루이스 후안 페드로 라몬 에두아르도 프란시스코'.split(' ');
const LATIN_FAMILY = '로드리게스 곤잘레스 에르난데스 페레스 산체스 라미레스 토레스 플로레스 리베라 고메스 크루스 모랄레스 오르티스 레예스 메디나'.split(' ');
const JP_GIVEN = '쇼타 다이키 유토 가이토 료 하야토 겐타 소마 다쿠야 유마 렌 하루토'.split(' ');
const JP_FAMILY = '다나카 사토 스즈키 다카하시 와타나베 이토 야마모토 나카무라 고바야시 가토 요시다 야마다 마쓰모토 이노우에'.split(' ');
const TW_GIVEN = '즈웨이 위안 하오 청 쥔 이팅 원제 자하오'.split(' ');
const TW_FAMILY = '린 천 황 장 리우 우 차이 양'.split(' ');

const pickFrom = <T>(xs: T[], r: () => number) => xs[Math.floor(r() * xs.length)]!;
const normal = (r: () => number) => (r() + r() + r() - 1.5) / 1.5;
const clampGrade = (n: number) => Math.max(20, Math.min(80, n));

export interface ForeignSpec {
  kind: 'pitcher' | 'hitter';
  asiaQuota: boolean;
}

/** A foreign player signing for `season`. Mature ability: potential equals current. */
export function makeForeign(seed: string, id: string, season: number, spec: ForeignSpec): Player {
  const r = rng(`${seed}|foreign|${id}`);
  const nationality = spec.asiaQuota ? (r() < 0.7 ? '일본' : r() < 0.67 ? '호주' : '대만') : r() < 0.66 ? '미국' : pickFrom(['베네수엘라', '도미니카공화국', '쿠바', '파나마', '멕시코'], r);
  const [given, family] =
    nationality === '일본'
      ? [JP_GIVEN, JP_FAMILY]
      : nationality === '대만'
        ? [TW_GIVEN, TW_FAMILY]
        : nationality === '미국' || nationality === '호주'
          ? [WEST_GIVEN, WEST_FAMILY]
          : [LATIN_GIVEN, LATIN_FAMILY];
  const name = nationality === '대만' ? `${pickFrom(family, r)}${pickFrom(given, r)}` : `${pickFrom(given, r)} ${pickFrom(family, r)}`;
  const age = spec.asiaQuota ? 24 + Math.floor(r() * 7) : 26 + Math.floor(r() * 7);
  const birthday = `${season - age - 1}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
  const q = spec.asiaQuota ? -4 : 0; // Asia-quota signings are cheaper and a notch below
  let role: Role, tools: Tools;
  if (spec.kind === 'pitcher') {
    const starter = spec.asiaQuota ? r() < 0.35 : r() < 0.92;
    role = starter ? 'SP' : 'RP';
    tools = {
      stuff: clampGrade(60 + q + normal(r) * 5),
      command: clampGrade(55 + q + normal(r) * 6),
      breaking: clampGrade(56 + q + normal(r) * 6),
      stamina: clampGrade((starter ? 62 : 45) + normal(r) * 6),
    };
  } else {
    role = r() < 0.55 ? 'IF' : 'OF';
    tools = {
      contact: clampGrade(58 + q + normal(r) * 6),
      power: clampGrade(64 + q + normal(r) * 6),
      eye: clampGrade(55 + q + normal(r) * 6),
      speed: clampGrade(44 + normal(r) * 9),
      defense: clampGrade(47 + normal(r) * 8),
    };
  }
  const graded = Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, toGrade(v! + normal(r) * 3)])) as Tools;
  const current = toGrade(overall(graded, role));
  const throwsLeft = r() < 0.3,
    bats = r() < 0.3 ? '좌' : r() < 0.05 ? '양' : '우';
  const level = spec.asiaQuota ? (nationality === '일본' ? 'NPB' : nationality === '호주' ? 'ABL' : 'CPBL') : '트리플A';
  return {
    id,
    name,
    birthday,
    birthplace: nationality,
    height: 180 + Math.floor(r() * 16),
    weight: 82 + Math.floor(r() * 22),
    throws: throwsLeft ? '좌' : '우',
    bats,
    role,
    position: assignPosition(role, graded, r()),
    archetype: spec.asiaQuota ? '아시아쿼터' : spec.kind === 'pitcher' ? '외국인 투수' : '외국인 타자',
    personality: '',
    velocity: spec.kind === 'pitcher' ? Math.round(146 + ((tools.stuff ?? 55) - 55) * 0.4 + normal(r) * 1.5) : null,
    twoWay: false,
    origin: { kind: 'foreign', pathway: '외국인', entryCategory: 'foreign', nationality, asiaQuota: spec.asiaQuota },
    education: { qualification: `${level} 출신`, school: level, schoolTier: '', region: nationality, pathText: `${nationality} · ${level}`, history: [] },
    amateur: { record: { kind: spec.kind, games: 0 }, awards: [], draftRank: 0 },
    status: 'active',
    teamId: null,
    contract: null,
    service: { creditedSeasons: 0, carriedDays: 0, military: 'exempt' },
    hidden: { current: tools, potential: { ...tools }, growthCurve: 'normal', developmentRate: 1, observerBias: normal(r) * 2, injuryRisk: 0.08 },
    scouting: {
      season,
      tools: graded,
      futureTools: graded,
      current,
      futureValue: current,
      floor: Math.max(20, current - 5),
      ceiling: current,
      uncertainty: '보통',
      tags: ['즉전감'],
      strength: '',
      weakness: '',
    },
    proSince: season,
    career: [],
  };
}

export const isForeign = (p: Player) => p.origin.kind === 'foreign';
