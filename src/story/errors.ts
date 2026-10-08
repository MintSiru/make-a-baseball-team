import { k as __i18n_k } from '../i18n/index';
/* What a failed API call means for the player, the same way for every provider: the error kind, a short
   Korean explanation with the status code, and how long the server asked us to wait. */
import type { StoryError, StoryFailure } from './types';

/** Seconds to wait from Retry-After (seconds or a date), retry-after-ms, or Google's RetryInfo in the body. */
export function retryAfterOf(headers: Headers | null | undefined, body?: unknown): number | undefined {
  const ms = Number(headers?.get('retry-after-ms'));
  if (ms > 0) return Math.ceil(ms / 1000);
  const h = headers?.get('retry-after');
  if (h) {
    const sec = Number(h);
    if (Number.isFinite(sec) && sec >= 0) return Math.ceil(sec);
    const until = Date.parse(h) - Date.now();
    if (until > 0) return Math.ceil(until / 1000);
  }
  const details = (body as { error?: { details?: { retryDelay?: string }[] } } | undefined)?.error?.details;
  for (const d of Array.isArray(details) ? details : []) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(d?.retryDelay ?? '');
    if (m) return Math.ceil(Number(m[1]));
  }
  return undefined;
}

export const BUSY_STATUS = [500, 502, 503, 504, 529];

/** The kind of failure for an HTTP status. */
export function errorOf(status: number): StoryError {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate';
  if (BUSY_STATUS.includes(status)) return 'busy';
  if (status === 400 || status === 404) return 'invalid';
  return 'unknown';
}

/** A failure the player can act on. `kind` overrides what the status alone says (a 429 that is a spent
    quota, a 400 that is a bad key); `daily` marks a quota that refills tomorrow; `detail` is the provider's
    own short message, shown for requests it refused. */
export function failure(status: number, opts: { kind?: StoryError; daily?: boolean; retryAfter?: number; detail?: string } = {}): StoryFailure {
  const error = opts.kind ?? errorOf(status);
  const wait = opts.retryAfter ? __i18n_k("story.errors.failure.wait.b90e0983", { retryAfter: opts.retryAfter }) : __i18n_k("story.errors.failure.wait.c4529ba3");
  const detail = opts.detail ? ` (${opts.detail.slice(0, 120)})` : '';
  const message: Record<StoryError, string> = {
    auth: __i18n_k("story.errors.message.auth.2342147c", { status: status }),
    rate: __i18n_k("story.errors.message.rate.aeb92071", { status: status, wait: wait }),
    quota: opts.daily
      ? __i18n_k("story.errors.message.quota.4221ee17", { status: status })
      : __i18n_k("story.errors.message.quota.c0f826d5", { status: status }),
    busy: __i18n_k("story.errors.message.busy.65759cb4", { status: status, wait: wait }),
    invalid: __i18n_k("story.errors.message.invalid.7d1ab974", { status: status, detail: detail }),
    refusal: __i18n_k("story.errors.message.refusal.02cad08b"),
    network: __i18n_k("story.errors.message.network.8128cbeb"),
    unknown: __i18n_k("story.errors.message.unknown.6ccc4152", { status: status, detail: detail }),
  };
  return { ok: false, error, message: message[error], ...(opts.retryAfter ? { retryAfter: opts.retryAfter } : {}) };
}

/** Reads a failed response's JSON body (or nothing) without throwing. */
export async function bodyOf(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
