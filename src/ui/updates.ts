/* 1.9.8 (the user's request): the update notes in the game — docs/CHANGELOG.md's table, bundled with the page, and
   which version this browser last opened (a pop-up shows what changed since, once). */
import changelog from '../../docs/CHANGELOG.md?raw';
import { RELEASE } from '../core/version';

export interface UpdateNote {
  version: string;
  /** The change log's line, without its Markdown (bold, code). */
  text: string;
}

/** Every version in the change log, newest first. */
export const UPDATE_NOTES: UpdateNote[] = changelog
  .split('\n')
  .map((line) => line.match(/^\|\s*\**([\d.]+)\**\s*\|\s*(.+?)\s*\|\s*$/))
  .filter((m): m is RegExpMatchArray => !!m)
  .map((m) => ({ version: m[1]!, text: m[2]!.replace(/\*\*/g, '').replace(/`/g, '') }));

const parts = (v: string) => v.split('.').map(Number);
/** a is newer than b. */
export function newer(a: string, b: string): boolean {
  const x = parts(a),
    y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

const SEEN = 'kbo-expansion-seen-release';

/** The notes this browser has not seen (newer than the version it last opened); none on a first visit, which is
    noted as seen. */
export function unseenNotes(): UpdateNote[] {
  try {
    const seen = localStorage.getItem(SEEN);
    if (!seen) {
      localStorage.setItem(SEEN, RELEASE);
      return [];
    }
    return UPDATE_NOTES.filter((n) => newer(n.version, seen) && !newer(n.version, RELEASE)).slice(0, 5);
  } catch {
    return [];
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN, RELEASE);
  } catch {
    /* private mode: shown again next time */
  }
}
