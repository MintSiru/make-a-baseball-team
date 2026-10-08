import { k as __i18n_k } from '../i18n/index';
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
const LEVELS = [__i18n_k("league.reports.lEVELS.2db4b267"), '낮음', '보통', '높음', __i18n_k("league.reports.lEVELS.79138429")];
const levelOf = (v: number) => (v >= 80 ? 5 : v >= 62 ? 4 : v >= 38 ? 3 : v >= 20 ? 2 : 1);

/** Injury proneness on the same 1–99 scale (Draft Room draws 0.05–0.16; surgeries add, up to 0.2). */
const injuryScale = (risk: number) => clamp(((risk - 0.05) / 0.12) * 100, 1, 99);
const INJURY_TEXT = [__i18n_k("league.reports.iNJURY_TEXT.1db38f03"), __i18n_k("league.reports.iNJURY_TEXT.58150fdf"), '보통', __i18n_k("league.reports.iNJURY_TEXT.d4458811"), __i18n_k("league.reports.iNJURY_TEXT.52c0c240")];
const CONTROVERSY_TEXT = [__i18n_k("league.reports.cONTROVERSY_TEXT.608872ad"), __i18n_k("league.reports.cONTROVERSY_TEXT.b910f76d"), '보통', __i18n_k("league.reports.cONTROVERSY_TEXT.f0db19bc"), __i18n_k("league.reports.cONTROVERSY_TEXT.73eb039b")];
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
  manager: __i18n_k("league.reports.rOLE_TITLE.manager.daec431c"),
  hitting: __i18n_k("league.reports.rOLE_TITLE.hitting.8a5c9a74"),
  pitching: __i18n_k("league.reports.rOLE_TITLE.pitching.0b977195"),
  fielding: __i18n_k("league.reports.rOLE_TITLE.fielding.699fd8bb"),
  farm: __i18n_k("league.reports.rOLE_TITLE.farm.3eb6b31d"),
  scouting: __i18n_k("league.reports.rOLE_TITLE.scouting.5added0a"),
  medical: __i18n_k("league.reports.rOLE_TITLE.medical.13b601f9"),
  analytics: __i18n_k("league.reports.rOLE_TITLE.analytics.b8d925c1"),
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
    reads.push({ key: 'growth', label: __i18n_k("league.reports.traitReport.label.8e3405be"), text: a < 0.15 ? null : GROWTH_LABELS[GROWTH_ORDER[i]!], level: a < 0.15 ? null : i + 1, sure: sureOf(a) });
  }
  {
    const { a, e } = read('injury');
    const v = clamp(injuryScale(p.hidden.injuryRisk) + e * 45, 1, 99);
    const level = levelOf(v);
    reads.push({ key: 'injury', label: __i18n_k("league.reports.traitReport.label.ceba074c"), text: INJURY_TEXT[level - 1]!, level, sure: sureOf(a) });
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
  if (hi('genius')) out.push(__i18n_k("league.reports.notesOf.956c8b6e"));
  if (hi('work')) out.push(__i18n_k("league.reports.notesOf.b9a30c82"));
  else if (lo('work')) out.push(__i18n_k("league.reports.notesOf.bd86332a"));
  if (hi('mental', 4)) out.push(__i18n_k("league.reports.notesOf.e3de045c"));
  else if (lo('mental', 2)) out.push(__i18n_k("league.reports.notesOf.131e8fc3"));
  if (hi('leadership', 4)) out.push(__i18n_k("league.reports.notesOf.f2b13074"));
  if (hi('loyalty', 5)) out.push(__i18n_k("league.reports.notesOf.15837057"));
  else if (lo('loyalty')) out.push(__i18n_k("league.reports.notesOf.78db4b26"));
  if (hi('controversy', 4)) out.push(__i18n_k("league.reports.notesOf.ecb6db2a"));
  if (hi('injury', 4)) out.push(__i18n_k("league.reports.notesOf.5ae4d266"));
  return out;
}

/** The personality's label and two traits the staff are surest of, in words. */
function characterOf(personality: string, reads: TraitRead[]): string {
  const WORDS: Partial<Record<ReadKey, [string, string]>> = {
    work: [__i18n_k("league.reports.wORDS.work.542bf364"), __i18n_k("league.reports.wORDS.work.4f9b4f0c")],
    mental: [__i18n_k("league.reports.wORDS.mental.71ba4484"), __i18n_k("league.reports.wORDS.mental.ab7848ba")],
    leadership: [__i18n_k("league.reports.wORDS.leadership.3ff3f43a"), __i18n_k("league.reports.wORDS.leadership.20534e4e")],
    loyalty: [__i18n_k("league.reports.wORDS.loyalty.1ac710f5"), __i18n_k("league.reports.wORDS.loyalty.b8b60a9a")],
    genius: [__i18n_k("league.reports.wORDS.genius.5eee1e68"), __i18n_k("league.reports.wORDS.genius.3eda2649")],
  };
  const picks = reads
    .filter((r) => WORDS[r.key] && r.level != null && r.level !== 3 && r.sure !== '낮음' && (r.level >= 4 || r.level <= 2))
    .sort((a, b) => Math.abs(b.level! - 3) - Math.abs(a.level! - 3))
    .slice(0, 2)
    .map((r) => WORDS[r.key]![r.level! >= 4 ? 0 : 1]);
  return [personality || __i18n_k("league.reports.characterOf.6667d8b8"), ...picks].join(' · ');
}
