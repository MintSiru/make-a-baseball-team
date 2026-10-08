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

type Job = { type: 'create'; seed: string; era?: number } | { type: 'apply'; state: LeagueState; action: Action };
let nextId = 0;

const here = (job: Job, onProgress?: (year: number) => void) => (job.type === 'create' ? createLeague(job.seed, onProgress, job.era ?? 0) : apply(job.state, job.action));

/** One request to the worker. Replies are matched by id (1.4.1): a league still being built for an earlier seed
    can finish first without answering this request. */
function run(job: Job, onProgress?: (year: number) => void): Promise<LeagueState> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => here(job, onProgress));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const done = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
    };
    const onMessage = (e: MessageEvent<WorkerReply>) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === 'progress') onProgress?.(m.year);
      else {
        done();
        if (m.type === 'done') resolve(m.state);
        else reject(new Error(m.message));
      }
    };
    const onError = (e: ErrorEvent) => {
      // A worker that cannot start (blocked in this browser): do the work here instead.
      done();
      e.preventDefault();
      worker = null;
      try {
        resolve(here(job, onProgress));
      } catch (err) {
        reject(err);
      }
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ id, ...job } as WorkerRequest);
  });
}

export const createInWorker = (seed: string, onProgress?: (year: number) => void, era = 0) => run({ type: 'create', seed, era }, onProgress);
export const applyInWorker = (state: LeagueState, action: Action) => run({ type: 'apply', state, action });
/** Small steps run on the page: posting a 3MB state back and forth costs more than a day of games. */
export const applyHere = (state: LeagueState, action: Action) => apply(state, action);
