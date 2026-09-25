/* Talks to the league worker; falls back to running on the page when workers are unavailable
   (some browsers refuse workers for pages opened from file://). */
import { apply, type Action } from '../league/actions';
import { createLeague } from '../league/history';
import type { LeagueState } from '../league/state';
import type { WorkerReply, WorkerRequest } from '../worker/league.worker';
import LeagueWorker from '../worker/league.worker?worker&inline';

let worker: Worker | null | undefined;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new LeagueWorker();
  } catch {
    worker = null;
  }
  return worker;
}

function run(req: WorkerRequest, onProgress?: (year: number) => void): Promise<LeagueState> {
  const w = getWorker();
  if (!w) return Promise.resolve(req.type === 'create' ? createLeague(req.seed, onProgress) : apply(req.state, req.action));
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerReply>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m.year);
      else {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        if (m.type === 'done') resolve(m.state);
        else reject(new Error(m.message));
      }
    };
    const onError = (e: ErrorEvent) => {
      // A worker that cannot start (blocked in this browser): do the work here instead.
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      e.preventDefault();
      worker = null;
      resolve(req.type === 'create' ? createLeague(req.seed, onProgress) : apply(req.state, req.action));
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage(req);
  });
}

export const createInWorker = (seed: string, onProgress?: (year: number) => void) => run({ type: 'create', seed }, onProgress);
export const applyInWorker = (state: LeagueState, action: Action) => run({ type: 'apply', state, action });
/** Small steps run on the page: posting a 3MB state back and forth costs more than a day of games. */
export const applyHere = (state: LeagueState, action: Action) => apply(state, action);
