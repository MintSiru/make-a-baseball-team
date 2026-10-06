/* What the club knows of a player's hidden side (1.1.0, from the 1.0 feedback): its coaches' read of its own players and
   its scouts' read of everyone else's, amateurs included. Each covers the growth type, injury proneness and the six
   traits of traits.ts, with how sure the staff are.

   How close a read comes to the truth depends on who reads (the scouting director for other clubs' players; for ours
   the farm or the hitting/pitching coach on growth and learning, the manager on character, the medical staff on the
   body), on how long he has been watched (seasons with us, or in the league: a pro's record is public), and on the
   difficulty. Each read's error is fixed per club, player and trait and shrinks as the read improves, so a report
   does not flicker from one look to the next: it settles toward the truth. Coaches see their players every day and
   read them better than scouts read anyone. Only the user's club reads; the AI clubs go by the public report. */
import { hashUnit } from '../draftroom';
import type { GrowthType, Player, TeamId } from '../model/types';
import { ageIn, isPitcher } from './players';
import type { LeagueState, StaffRole } from './state';
import { GROWTH_LABELS, GROWTH_NOTES, GROWTH_ORDER, TRAIT_LABELS, traitsOf, type TraitKey } from './traits';
import { COMBINE, DIFFICULTY } from './tuning';

export type ReadKey = 'growth' | 'injury' | TraitKey;

export interface TraitRead {
  key: ReadKey;
  label: string;
  /** What the staff say, or null when they cannot tell yet. */
  text: string | null;
  /** 1 (low) … 5 (high) for a bar; for 논란성 and 부상 high is bad. Growth: 1 초조숙 … 5 초만성. */
  level: number | null;
  sure: '높음' | '보통' | '낮음';
}

export interface TraitReport {
  by: 'coach' | 'scout';
  /** Who signs it ("스카우트 팀장 김OO"). */
  staff: string;
  reads: TraitRead[];
  /** The reads that stand out, in a line each. */
  notes: string[];
  /** Personality in a few words: the label and the traits the staff are surest of. */
  character: string;
  /** The growth type's meaning, when the staff have a read on it. */
  growthNote: string | null;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const LEVELS = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];
const levelOf = (v: number) => (v >= 80 ? 5 : v >= 62 ? 4 : v >= 38 ? 3 : v >= 20 ? 2 : 1);

/** Injury proneness on the same 1–99 scale (Draft Room draws 0.05–0.16; surgeries add, up to 0.2). */
const injuryScale = (risk: number) => clamp(((risk - 0.05) / 0.12) * 100, 1, 99);
const INJURY_TEXT = ['강철 체력', '튼튼한 편', '보통', '잔부상이 잦은 편', '부상이 잦음'];
const CONTROVERSY_TEXT = ['걱정 없음', '모범적', '보통', '구설수 조심', '사생활 관리 필요'];
const controversyLevel = (v: number) => (v >= 58 ? 5 : v >= 44 ? 4 : v >= 26 ? 3 : v >= 14 ? 2 : 1);

/** Which of our staff read which trait. */
const READER: Record<ReadKey, (p: Player, year: number) => StaffRole> = {
  growth: (p, y) => (ageIn(p, y) <= 24 ? 'farm' : isPitcher(p) ? 'pitching' : 'hitting'),
  genius: (p) => (isPitcher(p) ? 'pitching' : 'hitting'),
  work: (p, y) => (ageIn(p, y) <= 24 ? 'farm' : isPitcher(p) ? 'pitching' : 'hitting'),
  mental: () => 'manager',
  leadership: () => 'manager',
  loyalty: () => 'manager',
  controversy: () => 'manager',
  injury: () => 'medical',
};

const ROLE_TITLE: Record<StaffRole, string> = {
  manager: '감독',
  hitting: '타격코치',
  pitching: '투수코치',
  fielding: '수비코치',
  farm: '육성 총괄',
  scouting: '스카우트 팀장',
  medical: '트레이닝 파트장',
  analytics: '전력분석 팀장',
};

/** Seasons the club has had him (any level), or the seasons a pro has been in the league. */
function watched(s: LeagueState, p: Player, teamId: TeamId, ours: boolean): number {
  if (ours) return new Set(p.career.filter((c) => c.teamId === teamId).map((c) => c.year)).size + (s.phase === 'regular' || s.phase === 'postseason' ? 0.5 : 0);
  return p.status === 'amateur' ? 0 : Math.min(4, new Set(p.career.filter((c) => !c.level).map((c) => c.year)).size) * 0.5;
}

/** 0 (a guess) … 1 (the truth). */
function accuracy(s: LeagueState, p: Player, key: ReadKey, teamId: TeamId, ours: boolean, rating: number): number {
  const years = watched(s, p, teamId, ours);
  const difficulty = s.user ? DIFFICULTY.scoutEdge[s.user.settings.difficulty] / 2 : 0;
  let a = 0.2 + ((rating - 50) / 30) * 0.25 + Math.min(3, years) * 0.12 + (ours ? 0.15 : 0) + difficulty;
  // A pro's body shows in his injury record; a veteran's growth type is plain from his career.
  if (key === 'injury' && (p.injuries?.length ?? 0) > 0) a += 0.15;
  if (key === 'growth' && ageIn(p, s.year) >= 30) a = Math.max(a, 0.9);
  // A prospect we brought in for a workout and an interview (1.3.0, combine.ts).
  if (!ours && Object.values(s.user?.workouts ?? {}).some((ids) => ids.includes(p.id))) a += COMBINE.workoutRead;
  return clamp(a, 0.05, 0.95);
}

/** The fixed error of one read, −1 … +1. */
const error = (s: LeagueState, teamId: TeamId, p: Player, key: ReadKey) => hashUnit(`${s.seed}|read|${teamId}|${p.id}|${key}`) * 2 - 1;

const sureOf = (a: number): TraitRead['sure'] => (a >= 0.7 ? '높음' : a >= 0.45 ? '보통' : '낮음');

/** The user's club's report on a player, or null without a club. */
export function traitReport(s: LeagueState, p: Player): TraitReport | null {
  const u = s.user;
  if (!u) return null;
  const teamId = u.teamId;
  const ours = p.teamId === teamId;
  const staff = s.clubs?.[teamId]?.staff ?? {};
  const t = traitsOf(p);
  const reads: TraitRead[] = [];
  const read = (key: ReadKey) => {
    const role: StaffRole = ours ? READER[key](p, s.year) : 'scouting';
    const a = accuracy(s, p, key, teamId, ours, staff[role]?.rating ?? 50);
    return { a, e: error(s, teamId, p, key) * (1 - a) };
  };
  {
    const { a, e } = read('growth');
    const i = clamp(Math.round(GROWTH_ORDER.indexOf(t.growth) + e * 2.4), 0, 4);
    reads.push({ key: 'growth', label: '성장 타입', text: a < 0.15 ? null : GROWTH_LABELS[GROWTH_ORDER[i]!], level: a < 0.15 ? null : i + 1, sure: sureOf(a) });
  }
  {
    const { a, e } = read('injury');
    const v = clamp(injuryScale(p.hidden.injuryRisk) + e * 45, 1, 99);
    const level = levelOf(v);
    reads.push({ key: 'injury', label: '부상 빈도', text: INJURY_TEXT[level - 1]!, level, sure: sureOf(a) });
  }
  for (const key of ['genius', 'work', 'mental', 'leadership', 'loyalty', 'controversy'] as TraitKey[]) {
    const { a, e } = read(key);
    const v = clamp(t[key] + e * 45, 1, 99);
    const level = key === 'controversy' ? controversyLevel(v) : levelOf(v);
    const text = key === 'controversy' ? CONTROVERSY_TEXT[level - 1]! : LEVELS[level - 1]!;
    reads.push({ key, label: TRAIT_LABELS[key], text: a < 0.1 ? null : text, level: a < 0.1 ? null : level, sure: sureOf(a) });
  }
  const by = ours ? 'coach' : 'scout';
  const signer = ours ? staff.manager : staff.scouting;
  return {
    by,
    staff: `${ROLE_TITLE[ours ? 'manager' : 'scouting']} ${signer?.name ?? ''}`.trim(),
    reads,
    notes: notesOf(reads),
    character: characterOf(p.personality, reads),
    growthNote: (() => {
      const g = reads[0]!;
      return g.text ? GROWTH_NOTES[GROWTH_ORDER[g.level! - 1] as GrowthType] : null;
    })(),
  };
}

/** The reads that stand out. */
function notesOf(reads: TraitRead[]): string[] {
  const at = (k: ReadKey) => reads.find((r) => r.key === k);
  const out: string[] = [];
  const hi = (k: ReadKey, n = 5) => (at(k)?.level ?? 0) >= n;
  const lo = (k: ReadKey, n = 1) => (at(k)?.level ?? 3) <= n;
  if (hi('genius')) out.push('천재형: 배우는 속도가 남다릅니다.');
  if (hi('work')) out.push('연습벌레: 성장이 빠르고 노쇠가 늦습니다.');
  else if (lo('work')) out.push('훈련 태도에 아쉬움이 있습니다.');
  if (hi('mental', 4)) out.push('큰 경기에 강합니다.');
  else if (lo('mental', 2)) out.push('큰 경기에서 흔들리는 편입니다.');
  if (hi('leadership', 4)) out.push('더그아웃의 리더감입니다.');
  if (hi('loyalty', 5)) out.push('구단에 대한 애정이 큽니다.');
  else if (lo('loyalty')) out.push('조건과 기회를 따라 움직일 타입입니다.');
  if (hi('controversy', 4)) out.push('사생활에서 구설수가 생길 수 있습니다.');
  if (hi('injury', 4)) out.push('몸 관리에 신경 써야 합니다.');
  return out;
}

/** The personality's label and two traits the staff are surest of, in words. */
function characterOf(personality: string, reads: TraitRead[]): string {
  const WORDS: Partial<Record<ReadKey, [string, string]>> = {
    work: ['연습벌레', '훈련에 소홀함'],
    mental: ['강심장', '긴장을 많이 함'],
    leadership: ['리더형', '조용한 편'],
    loyalty: ['의리파', '실리파'],
    genius: ['천재형', '느리게 배움'],
  };
  const picks = reads
    .filter((r) => WORDS[r.key] && r.level != null && r.level !== 3 && r.sure !== '낮음' && (r.level >= 4 || r.level <= 2))
    .sort((a, b) => Math.abs(b.level! - 3) - Math.abs(a.level! - 3))
    .slice(0, 2)
    .map((r) => WORDS[r.key]![r.level! >= 4 ? 0 : 1]);
  return [personality || '파악 중', ...picks].join(' · ');
}
