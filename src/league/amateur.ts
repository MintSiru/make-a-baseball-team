import { k as __i18n_k } from '../i18n/index';
/* A prospect's road to the draft, stage by stage (2.0.27, the user's request: his high school, college, independent
   or foreign-league years and what he did there, easy to see).

   Draft Room keeps where he played (`education.history`) and one record, the last stage's. The stages before it get a
   line of their own here, drawn the way Draft Room draws an amateur record from what he was then (a few grade points
   younger for each stage back) — for the screen only: nothing in the game reads them. And the pathways that came back
   from abroad get names that say where from ("해외 유턴 · MLB"), rather than "마이너 복귀" for a player who never
   played in the KBO. */
import Catalog from '../draftroom/catalog.js';
import { hashUnit, isPitcherRole, rng, type AmateurRecord, type HistoryEntry } from '../draftroom';
import type { Player } from '../model/types';
import { schoolEvents, splitRecord, youthTeam, type HsEventKind } from './hsevents';
import { isNorthern } from './north';
import { northSchoolEvents } from './northevents';
import { poolSeed } from './players';

type Prospect = Pick<Player, 'id' | 'role' | 'scouting' | 'education' | 'amateur' | 'origin'>;

interface Institution {
  id: string;
  kind: string;
  level?: string;
  country?: string;
}
const BY_ID = (Catalog as unknown as { byId: Record<string, Institution> }).byId;

export type StageKind = 'highSchool' | 'college' | 'juniorCollege' | 'independent' | 'overseasAmateur' | 'overseasIndependent' | 'mlb' | 'minors' | 'overseasLeague';

export interface Stage {
  kind: StageKind;
  /** What the stage was ("고교", "마이너리그 AAA", "일본 NPB 2군"…). */
  label: string;
  name: string;
  /** "2021.03 – 2024.02", or to now. */
  period: string;
  status: string;
  note: string;
  record: AmateurRecord;
  /** The record Draft Room kept (the last stage), or one drawn for the screen. */
  kept: boolean;
  /** 2.0.28: a high school's or college's last year there, event by event (hsevents.ts), and his national youth team
      (U-18, U-23) that year — games outside his school's record. */
  events?: { kind: HsEventKind; label: string; result: string; record: AmateurRecord }[];
  youth?: { kind: HsEventKind; label: string; result: string; record: AmateurRecord };
}

const LEVEL_LABEL: Record<string, () => string> = {
  MLB: () => __i18n_k("league.amateur.text.2d1fb3e2"),
  AAA: () => __i18n_k("league.amateur.text.d3d09dd3"),
  AA: () => __i18n_k("league.amateur.text.7c7a1366"),
  A: () => __i18n_k("league.amateur.text.d3e7e9e7"),
  CPBL: () => __i18n_k("league.amateur.text.52a4697f"),
  LMB: () => __i18n_k("league.amateur.text.960d7a44"),
  ABL: () => __i18n_k("league.amateur.text.0ab06d47"),
};

function stageOf(e: HistoryEntry, pathway = ''): { kind: StageKind; label: string } {
  const inst = BY_ID[e.institutionId];
  const kind = inst?.kind ?? e.kind;
  if (kind === 'overseas-pro') {
    const level = inst?.level ?? '';
    if (level === 'MLB') return { kind: 'mlb', label: LEVEL_LABEL.MLB!() };
    if (level === 'A' || level === 'AA' || level === 'AAA') return { kind: 'minors', label: LEVEL_LABEL[level]!() };
    return { kind: 'overseasLeague', label: LEVEL_LABEL[level]?.() ?? __i18n_k("league.amateur.text.95cb57b4", { country: inst?.country ?? '', level }) };
  }
  if (kind === 'overseas-independent') return { kind: 'overseasIndependent', label: __i18n_k("league.amateur.text.9f77082e", { country: inst?.country ?? '' }) };
  if (kind === 'overseas-college' || kind === 'overseas-hs') return { kind: 'overseasAmateur', label: kind === 'overseas-hs' ? __i18n_k("league.amateur.text.48703547", { country: inst?.country ?? '' }) : __i18n_k("league.amateur.text.d03ab931", { country: inst?.country ?? '' }) };
  if (kind === 'independent') return { kind: 'independent', label: __i18n_k("league.amateur.text.9f31907e") };
  if (kind === 'college' || kind === 'college2') return kind === 'college2' || pathway === '2년제' ? { kind: 'juniorCollege', label: __i18n_k("league.amateur.text.c8f601ff") } : { kind: 'college', label: __i18n_k("league.amateur.text.22aa6019") };
  return { kind: 'highSchool', label: kind === 'hs-club' ? __i18n_k("league.amateur.text.f310065f") : __i18n_k("league.amateur.text.7da7f481") };
}

const month = (iso: string | null) => (iso ? iso.slice(0, 7).replace('-', '.') : __i18n_k("league.amateur.text.001e4be2"));

/** A line for an earlier stage, as Draft Room draws one (prospects.js amateurRecord), from what he was then. */
export function drawnRecord(p: Prospect, ready: number, key: string): AmateurRecord {
  const r = rng(key);
  const t = p.scouting.tools;
  const normal = () => {
    const u = Math.max(1e-9, r());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  if (isPitcherRole(p.role)) {
    const control = t.command ?? 45;
    const games = 9 + Math.floor(r() * 15);
    const outs = Math.round((p.role === 'SP' ? 24 + r() * 45 : 12 + r() * 23) * 3);
    const ip = outs / 3;
    const er = Math.max(2, Math.round((ip * (7.3 - ready * 0.09 + normal() * 0.8)) / 9));
    return { kind: 'pitcher', games, outs, er, era: round((er * 9) / ip, 2), k: Math.round(ip * (0.6 + ready / 105)), bb: Math.round(ip * (0.67 - control / 170)), wins: Math.min(games, Math.round(games * Math.max(0.05, (7 - (er * 9) / ip) / 20))) };
  }
  const power = t.power ?? 40,
    speed = t.speed ?? 40,
    eye = t.eye ?? 45;
  const games = 20 + Math.floor(r() * 22);
  const ab = games * (3 + Math.floor(r() * 2));
  const hits = Math.round(ab * Math.min(0.455, Math.max(0.21, 0.2 + ready * 0.0026 + normal() * 0.045)));
  const bb = Math.round(ab * (0.07 + eye / 1000));
  const hr = Math.min(hits, Math.round(ab * Math.max(0.001, (power - 25) / 850) * r()));
  const doubles = Math.min(hits - hr, Math.round(hits * 0.18));
  const triples = Math.min(hits - hr - doubles, Math.floor(r() * 3));
  return {
    kind: 'hitter',
    games,
    ab,
    pa: ab + bb,
    hits,
    bb,
    hr,
    doubles,
    triples,
    avg: round(hits / ab, 3),
    ops: round((hits + bb) / (ab + bb) + (hits + doubles + 2 * triples + 3 * hr) / ab, 3),
    sb: Math.round(((Math.max(0, speed - 25) * games) / 140) * r()),
    rbi: Math.round(hits * 0.3 + hr),
    runs: Math.round((hits + bb) * 0.4),
  };
}

/** His stages, first to last, each with its record (a high school's split by its events; `seed`: the league's, so a
    draft class's school results are the ones its awards name). */
export function careerStages(p: Prospect, seed?: string): Stage[] {
  const history = p.education.history ?? [];
  if (!history.length) return [];
  const last = history.length - 1;
  const north = isNorthern(p);
  return history.map((e, i) => {
    const { kind, label } = stageOf(e, p.origin.pathway);
    const kept = i === last;
    // A few grade points younger for each stage back (a little noise, the same every time).
    const back = last - i;
    const ready = Math.max(25, p.scouting.current - back * 6 + Math.round((hashUnit(`${p.id}|stage-ready|${i}`) - 0.5) * 6));
    const record = kept ? p.amateur.record : drawnRecord(p, ready, `${p.id}|stage|${i}`);
    const stage: Stage = { kind, label, name: e.name, period: `${month(e.start)} – ${month(e.end)}`, status: e.status, note: e.note, record, kept };
    const inst = BY_ID[e.institutionId];
    const school = inst && (inst.kind === 'high-school' || inst.kind === 'hs-club');
    const college = inst?.kind === 'college' || inst?.kind === 'college2';
    if (school || college) {
      // His last season there (a year that ends in the winter counts as the season before).
      const end = e.end ?? `${p.origin.draftYear ?? new Date().getFullYear()}-12-31`;
      const year = Number(end.slice(0, 4)) - (Number(end.slice(5, 7)) <= 2 ? 1 : 0);
      const draftYear = p.origin.kind === 'draftClass' ? p.origin.draftYear : undefined;
      // 통일 한국: a northern school's year comes from the north's class (players.ts withNorth) and its own circuit.
      const n = north ? '|north' : '';
      const at = kept && seed && draftYear ? `${poolSeed(seed, draftYear)}${n}` : `${seed ?? p.id}|school-year|${year}${n}`;
      const events = north ? northSchoolEvents(e.name, at) : schoolEvents(e.institutionId, kept && seed && draftYear ? { poolSeed: at } : { key: at });
      if (events.length) {
        const parts = splitRecord(record, events.map((x) => x.games), `${p.id}|school-split|${i}`);
        stage.events = events.map((x, j) => ({ kind: x.kind, label: x.label, result: x.result, record: parts[j]! }));
      }
      // The youth team: his award says so for the year the scouts saw; before it, the better ones now and then.
      const level = school ? 'U-18' : 'U-23';
      const award = school ? __i18n_k('draftroom.prospects.generatePool.67a28002') : __i18n_k('draftroom.prospects.generatePool.f45e2ce3');
      // (A northern player's years before he was drafted may be from before the unification: his award only.)
      const picked = kept ? p.amateur.awards.includes(award) : !north && ready >= 50 && hashUnit(`${p.id}|youth|${i}`) < 0.3;
      if (picked) {
        const pitcher = record.kind === 'pitcher';
        const y = youthTeam(level, year, `${p.id}|${i}`, pitcher);
        const season = drawnRecord(p, ready, `${p.id}|youth-season|${i}`);
        const [part] = splitRecord(season, [y.games, Math.max(1, Number(season.games) - y.games)], `${p.id}|youth-split|${i}`);
        stage.youth = { kind: y.kind, label: y.label, result: y.result, record: part! };
      }
    }
    return stage;
  });
}

/** The pathway as the screen names it: where a returnee came back from, and the plainer names for the rest. */
export function pathwayLabel(p: Pick<Player, 'origin' | 'education'>): string {
  const path = p.origin.pathway;
  const returning = path === 'MLB 경험 복귀' || path === '마이너 복귀' || path === '해외리그 복귀' || path === '해외독립 복귀';
  if (!returning) return path === '독립구단' ? __i18n_k("league.amateur.text.9f31907e") : path;
  const lastStage = p.education.history?.at(-1);
  const stage = lastStage ? stageOf(lastStage) : null;
  if (path === 'MLB 경험 복귀') return __i18n_k("league.amateur.text.86d618bb");
  if (path === '마이너 복귀') return __i18n_k("league.amateur.text.c711a880");
  if (path === '해외독립 복귀') return __i18n_k("league.amateur.text.385294a9");
  return __i18n_k("league.amateur.text.07add7be", { league: stage?.kind === 'overseasLeague' ? stage.label : __i18n_k("league.amateur.text.7d87d544") });
}
