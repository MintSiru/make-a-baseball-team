/* Typed entry point to the ported Draft Room modules. Everything else in the game goes through here,
   so the untyped JS stays in one place. The types describe only the fields this game reads. */
import Prospects from './prospects.js';
import Grades from './grades.js';
import Tuning from './tuning.js';
import Biography from './biography.js';

export type Role = 'SP' | 'RP' | 'C' | 'IF' | 'OF';
export type PitchingTool = 'stuff' | 'command' | 'breaking' | 'stamina';
export type HittingTool = 'contact' | 'power' | 'speed' | 'defense' | 'eye';
export type ToolKey = PitchingTool | HittingTool;
export type Tools = Partial<Record<ToolKey, number>>;

export interface AmateurRecord {
  kind: 'pitcher' | 'hitter';
  games: number;
  [stat: string]: number | string | null;
}

export interface HistoryEntry {
  institutionId: string;
  name: string;
  kind: string;
  region: string;
  start: string;
  end: string | null;
  status: string;
  note: string;
}

/** A prospect as Draft Room generates it: hidden ability and public scouting in one object. */
export interface DraftProspect {
  id: string;
  rank: number;
  name: string;
  birthday: string;
  age: number;
  birthplace: string;
  birthRegion: string;
  height: number;
  weight: number;
  throwHand: '좌' | '우';
  batHand: '좌' | '우' | '양';
  role: Role;
  archetype: string;
  pathway: string;
  entryCategory: string;
  qualification: string;
  school: string;
  schoolTier: string;
  region: string;
  pathText: string;
  history: HistoryEntry[];
  personality: string;
  velocity: number | null;
  // Public scouting (20–80, five-point steps)
  tools: Tools;
  futureTools: Tools;
  ready: number;
  scoutCeiling: number;
  floorGrade: number;
  ceilingGrade: number;
  publicScore: number;
  uncertainty: string;
  pickTags: string[];
  strength: string;
  weakness: string;
  record: AmateurRecord;
  awards: string[];
  twoWay: boolean;
  proExperience: { level: string; [k: string]: unknown } | null;
  // Hidden ability (continuous)
  trueTools: Tools;
  potentialTools: Tools;
  growthCurve: 'early' | 'normal' | 'late';
  developmentRate: number;
  observerBias: number;
  risk: number;
}

export interface DraftPool {
  seed: string;
  players: DraftProspect[];
  byId: Record<string, DraftProspect>;
}

const P = Prospects as unknown as { generatePool(seed: string): DraftPool; POOL_SIZE: number; rng(seed: string): () => number; hash(s: string): number };
const G = Grades as unknown as {
  LABELS: Record<ToolKey, string>;
  ROLES: Record<Role, string>;
  WEIGHTS: Record<Role, Partial<Record<ToolKey, number>>>;
  overall(tools: Tools, role: Role): number;
  grade(n: number): number;
  observe(trueTools: Tools, role: Role, p: { observerBias: number }, yearIndex: number, r: () => number): { tools: Tools; ready: number };
};

const B = Biography as unknown as { DRAFT_DATE: string; DRAFT_YEAR: number };

/** Draft Room's pool is the 2027 KBO rookie draft, held in September 2026. Ages are counted on the draft date. */
export const DRAFT_ROOM_DRAFT_YEAR = B.DRAFT_YEAR;
export const DRAFT_ROOM_DRAFT_DATE = B.DRAFT_DATE;

export const generateDraftPool = (seed: string): DraftPool => P.generatePool(seed);
/** Draft Room's seeded PRNG: string seed → FNV-1a → mulberry32. */
export const rng = (seed: string): (() => number) => P.rng(seed);
/** FNV-1a hash of a string mapped to [0, 1). */
export const hashUnit = (s: string): number => P.hash(s) / 4294967296;

const SERVED_AT_DRAFT = (Tuning as unknown as { TUNING: { service: { servedAtDraft: Record<string, number> } } }).TUNING.service.servedAtDraft;
/** Whether the prospect finished military service before the draft, decided as Draft Room's career.create does. */
export const servedBeforeDraft = (poolSeed: string, p: DraftProspect): boolean =>
  rng(poolSeed + '-served-' + p.id)() < (SERVED_AT_DRAFT[p.pathway] ?? 0);
export const POOL_SIZE = P.POOL_SIZE;
export const TOOL_LABELS = G.LABELS;
export const ROLE_LABELS = G.ROLES;
export const PITCHING_TOOLS: PitchingTool[] = ['stuff', 'command', 'breaking', 'stamina'];
export const HITTING_TOOLS: HittingTool[] = ['contact', 'power', 'speed', 'defense', 'eye'];
export const isPitcherRole = (role: Role) => role === 'SP' || role === 'RP';
/** Draft Room's weighted overall for a role (continuous). */
export const overall = (tools: Tools, role: Role): number => G.overall(tools, role);
/** Rounds to a five-point public grade, 20–80. */
export const toGrade = (n: number): number => G.grade(n);
/** A scout's look at true ability: observer bias and noise shrink with pro years. */
export const observe = G.observe;
