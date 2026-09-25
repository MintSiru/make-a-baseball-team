/* Where saves live: IndexedDB in the browser (localStorage's ~5MB is too small for decades of league
   history), memory as a fallback and for tests. Stores the serialized text and validates on read. */
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
  text: string;
}

const summaryOf = ({ slot, seed, savedAt }: Row): SaveSummary => ({ slot, seed, savedAt });
const byNewest = (a: SaveSummary, b: SaveSummary) => b.savedAt.localeCompare(a.savedAt);

export function memoryStore(): SaveStore {
  const rows = new Map<string, Row>();
  return {
    kind: 'memory',
    get: async (slot) => {
      const row = rows.get(slot);
      return row ? parseSave(row.text) : null;
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
      return row ? parseSave(row.text) : null;
    },
    put: async (slot, save) => {
      const row: Row = { slot, seed: save.seed, savedAt: save.savedAt, text: serializeSave(save) };
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
