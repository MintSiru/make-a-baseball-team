/* Runs the heavy work off the page: building a league (eleven seasons) and long advances. */
import { apply, type Action } from '../league/actions';
import { createLeague } from '../league/history';
import type { LeagueState } from '../league/state';

export type WorkerRequest = { type: 'create'; seed: string } | { type: 'apply'; state: LeagueState; action: Action };
export type WorkerReply = { type: 'progress'; year: number } | { type: 'done'; state: LeagueState } | { type: 'error'; message: string };

const post = (m: WorkerReply) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const m = e.data;
    if (m.type === 'create') post({ type: 'done', state: createLeague(m.seed, (year) => post({ type: 'progress', year })) });
    else post({ type: 'done', state: apply(m.state, m.action) });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
