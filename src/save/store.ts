import { k as __i18n_k } from '../i18n/index';
/* Where saves live: IndexedDB in the browser (localStorage's ~5MB is too small for decades of league
   history), memory as a fallback and for tests. Stores the serialized save (gzip-packed in IndexedDB since V0.14) and validates on read. */
import { gunzipText, packText } from './compress';
import { parseSave, serializeSave, type SaveFile } from './format';

export interface SaveSummary {
  slot: string;
  seed: string;
  savedAt: string;
}

export interface SaveStore {
  readonly kind: 'indexedDB' | 'memory';
  get(slot: string): Promise<SaveFile | null>;
  put(slot: string, save: SaveFile): Promise<void>;
  remove(slot: string): Promise<void>;
  list(): Promise<SaveSummary[]>;
  /** Copies a slot as stored (no parsing), e.g. to keep an old-version save before it is carried forward. */
  copy(from: string, to: string): Promise<void>;
}

interface Row {
  slot: string;
  seed: string;
  savedAt: string;
  /** The save as text (before V0.14, or where the browser cannot compress). */
  text?: string;
  /** The save packed with gzip (V0.14): about a fifth of the text. */
  gz?: Uint8Array;
}

/** A row to store: packed when the browser can (and the packing checks out), else plain. */
async function rowOf(slot: string, save: SaveFile): Promise<Row> {
  const text = serializeSave(save);
  const gz = await packText(text);
  return { slot, seed: save.seed, savedAt: save.savedAt, ...(gz ? { gz } : { text }) };
}
const textOf = async (row: Row) => (row.gz ? gunzipText(row.gz) : (row.text ?? ''));

const summaryOf = ({ slot, seed, savedAt }: Row): SaveSummary => ({ slot, seed, savedAt });
const byNewest = (a: SaveSummary, b: SaveSummary) => b.savedAt.localeCompare(a.savedAt);

export function memoryStore(): SaveStore {
  const rows = new Map<string, Row>();
  return {
    kind: 'memory',
    get: async (slot) => {
      const row = rows.get(slot);
      return row ? parseSave(row.text ?? '') : null;
    },
    put: async (slot, save) => {
      rows.set(slot, { slot, seed: save.seed, savedAt: save.savedAt, text: serializeSave(save) });
    },
    remove: async (slot) => {
      rows.delete(slot);
    },
    list: async () => [...rows.values()].map(summaryOf).sort(byNewest),
    copy: async (from, to) => {
      const row = rows.get(from);
      if (row) rows.set(to, { ...row, slot: to });
    },
  };
}

const DB_VERSION = 1;
const STORE = 'saves';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function indexedDbStore(name = 'kbo-expansion', factory: IDBFactory = indexedDB): Promise<SaveStore> {
  const open = factory.open(name, DB_VERSION);
  open.onupgradeneeded = () => {
    if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'slot' });
  };
  const db = await request(open);
  const store = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    kind: 'indexedDB',
    get: async (slot) => {
      const row = (await request(store('readonly').get(slot))) as Row | undefined;
      return row ? parseSave(await textOf(row)) : null;
    },
    put: async (slot, save) => {
      const row = await rowOf(slot, save);
      await request(store('readwrite').put(row));
    },
    remove: async (slot) => {
      await request(store('readwrite').delete(slot));
    },
    list: async () => ((await request(store('readonly').getAll())) as Row[]).map(summaryOf).sort(byNewest),
    copy: async (from, to) => {
      const row = (await request(store('readonly').get(from))) as Row | undefined;
      if (row) await request(store('readwrite').put({ ...row, slot: to }));
    },
  };
}

/** IndexedDB when the browser allows it (some block it for file:// pages or private windows), else memory. */
export async function openStore(): Promise<SaveStore> {
  try {
    if (typeof indexedDB !== 'undefined') return await indexedDbStore();
  } catch {
    // Fall through to memory: the game still runs, it just cannot keep progress after closing.
  }
  return memoryStore();
}

// ── The autosave and its backups (1.4.1) ─────────────────────────────────────────────────────────

export const AUTO_SLOT = 'auto';
/** Earlier autosaves, newest first: the autosave is copied behind them every few minutes of play and before a
    different game takes its place, so one bad moment never costs the whole game. */
export const BACKUP_SLOTS = ['auto-1', 'auto-2', 'auto-3'];
/** An autosave that could not be opened, set aside so it is never copied over a good backup. */
export const DAMAGED_SLOT = 'auto-damaged';
/** The autosave as it was before a backup was restored over it. */
export const UNDO_SLOT = 'auto-before-restore';
export const BACKUP_EVERY = 5 * 60_000;

/** Moves each backup one step back and copies the autosave in front, as stored. */
export async function rotateBackups(st: SaveStore) {
  for (let i = BACKUP_SLOTS.length - 1; i > 0; i--) await st.copy(BACKUP_SLOTS[i - 1]!, BACKUP_SLOTS[i]!);
  await st.copy(AUTO_SLOT, BACKUP_SLOTS[0]!);
}

export interface Backup {
  slot: string;
  savedAt: string;
  /** Where the game stood ("2028 정규시즌"), and our club's name (none in a spectator league). */
  at: string;
  club: string | null;
  /** Why it cannot be restored (null: it can). */
  problem: string | null;
}

const PHASE_LABEL: Record<string, string> = { regularSeason: __i18n_k("save.store.pHASE_LABEL.regularSeason.b4070ed2"), postseason: __i18n_k("save.store.pHASE_LABEL.postseason.a0f7a345"), offseason: __i18n_k("save.store.pHASE_LABEL.offseason.1d568cfb") };

/** The backups there are, newest first, each opened and checked. */
export async function backupsOf(st: SaveStore): Promise<Backup[]> {
  const rows = (await st.list()).filter((r) => BACKUP_SLOTS.includes(r.slot) || r.slot === UNDO_SLOT || r.slot.startsWith('backup-'));
  const out: Backup[] = [];
  for (const row of rows) {
    try {
      const save = await st.get(row.slot);
      const snap = save?.snapshot;
      if (!snap) continue;
      const state = snap.state as { user?: { teamId: string } | null; teams?: { id: string; name: string }[] };
      const club = state.user ? (state.teams?.find((t) => t.id === state.user!.teamId)?.name ?? null) : null;
      out.push({ slot: row.slot, savedAt: row.savedAt, at: `${snap.at.year} ${PHASE_LABEL[snap.at.phase] ?? ''}`.trim(), club, problem: null });
    } catch (e) {
      out.push({ slot: row.slot, savedAt: row.savedAt, at: '', club: null, problem: e instanceof Error ? e.message : String(e) });
    }
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Puts a backup in the autosave's place (keeping what was there), for the next start to open. */
export async function restoreBackup(st: SaveStore, slot: string) {
  if (slot === UNDO_SLOT) {
    // Undoing a restore: the two swap places.
    await st.copy(UNDO_SLOT, 'auto-swap');
    await st.copy(AUTO_SLOT, UNDO_SLOT);
    await st.copy('auto-swap', AUTO_SLOT);
    await st.remove('auto-swap');
    return;
  }
  await st.copy(AUTO_SLOT, UNDO_SLOT);
  await st.copy(slot, AUTO_SLOT);
}

/** Set while the page is about to reload into a restored game: nothing may write the autosave over it. */
export const autosaveHold = { on: false };

/** Sets an autosave that cannot be opened aside, so the next save does not copy it over a good backup. */
export async function setAsideDamaged(st: SaveStore) {
  await st.copy(AUTO_SLOT, DAMAGED_SLOT);
  await st.remove(AUTO_SLOT);
}
