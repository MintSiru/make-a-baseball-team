/* Save files. Like Draft Room, a save stores the seed and the user's decisions ("inputs") and the rest
   is recomputed. Unlike Draft Room, a league run for decades would take too long to replay from the
   start, so a save may also carry a snapshot taken at a season boundary; loading then replays only
   the inputs recorded after it. V0.1 has no decisions yet, so snapshots and inputs stay empty. */
import { RELEASE, SIM_VERSION } from '../core/version';
import { migrateState, MIGRATABLE } from './migrate';
import type { GameDate } from '../model/types';

export const SAVE_FORMAT = 'kbo-expansion-save';
export const SAVE_VERSION = 1;

export interface InputEntry {
  at: GameDate;
  kind: string;
  data: unknown;
}

export interface Snapshot {
  at: GameDate;
  state: unknown;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  sim: string;
  release: string;
  seed: string;
  savedAt: string;
  snapshot: Snapshot | null;
  inputs: InputEntry[];
  /** Set when the save came from an older simulation version and its snapshot was carried forward. */
  migratedFrom?: string;
}

export type SaveProblem = 'notSave' | 'newerFormat' | 'otherSim' | 'damaged';

export class SaveError extends Error {
  constructor(
    readonly problem: SaveProblem,
    message: string,
    readonly sim?: string,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

export function makeSave(seed: string, inputs: InputEntry[] = [], snapshot: Snapshot | null = null, now = new Date()): SaveFile {
  return { format: SAVE_FORMAT, version: SAVE_VERSION, sim: SIM_VERSION, release: RELEASE, seed, savedAt: now.toISOString(), snapshot, inputs };
}

const isDate = (x: unknown): x is GameDate =>
  typeof x === 'object' && x !== null && Number.isInteger((x as GameDate).year) && typeof (x as GameDate).phase === 'string';

/** Parses and checks a save. Refuses saves from another simulation version rather than replaying them differently. */
export function parseSave(text: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('notSave', '진행 파일이 아닙니다.');
  }
  const s = raw as Partial<SaveFile>;
  if (typeof s !== 'object' || s === null || s.format !== SAVE_FORMAT) throw new SaveError('notSave', '진행 파일이 아닙니다.');
  if (typeof s.version !== 'number' || s.version > SAVE_VERSION) throw new SaveError('newerFormat', '더 새 버전에서 만든 진행 파일입니다.');
  // An older snapshot is carried forward to the current rules (migrate.ts); anything else is refused
  // rather than silently replayed into a different history.
  const migrate = s.sim !== SIM_VERSION && MIGRATABLE.includes(String(s.sim)) && !s.inputs?.length && !!s.snapshot;
  if (s.sim !== SIM_VERSION && !migrate)
    throw new SaveError('otherSim', `다른 규칙(시뮬레이션 ${String(s.sim)})으로 만든 진행 파일이라 이어 할 수 없습니다.`, String(s.sim));
  const inputsOk = Array.isArray(s.inputs) && s.inputs.every((i) => isDate(i?.at) && typeof i.kind === 'string');
  const snapshotOk = s.snapshot === null || (typeof s.snapshot === 'object' && isDate(s.snapshot?.at));
  if (typeof s.seed !== 'string' || !s.seed || !inputsOk || !snapshotOk || typeof s.savedAt !== 'string')
    throw new SaveError('damaged', '진행 파일이 손상되었습니다.');
  if (migrate) {
    const from = String(s.sim);
    const state = (s.snapshot as Snapshot).state as { teams?: unknown; rosters?: unknown } | undefined;
    if (!state?.teams || !state.rosters) throw new SaveError('damaged', '진행 파일에 리그 상태가 없습니다.');
    try {
      migrateState(state, from);
    } catch {
      throw new SaveError('otherSim', `시뮬레이션 ${from}에서 만든 진행 파일을 옮기지 못했습니다.`, from);
    }
    return { ...(s as SaveFile), sim: SIM_VERSION, migratedFrom: from };
  }
  return s as SaveFile;
}

export const serializeSave = (save: SaveFile): string => JSON.stringify(save);
