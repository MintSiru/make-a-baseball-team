/* Runs the heavy work off the page: building a league (eleven seasons) and long advances. Every reply carries the
   id of its request (1.4.1), so the page never takes one request's league for another's. */
import { apply, type Action } from '../league/actions';
import { createLeague } from '../league/history';
import type { LeagueState } from '../league/state';

export type WorkerRequest = { id: number } & ({ type: 'create'; seed: string } | { type: 'apply'; state: LeagueState; action: Action });
export type WorkerReply = { id: number } & ({ type: 'progress'; year: number } | { type: 'done'; state: LeagueState } | { type: 'error'; message: string });

const post = (m: WorkerReply) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  try {
    if (m.type === 'create') post({ id: m.id, type: 'done', state: createLeague(m.seed, (year) => post({ id: m.id, type: 'progress', year })) });
    else post({ id: m.id, type: 'done', state: apply(m.state, m.action) });
  } catch (err) {
    post({ id: m.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
