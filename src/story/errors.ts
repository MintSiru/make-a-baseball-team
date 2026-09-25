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
  const wait = opts.retryAfter ? `약 ${opts.retryAfter}초 뒤에` : '잠시 뒤에';
  const detail = opts.detail ? ` (${opts.detail.slice(0, 120)})` : '';
  const message: Record<StoryError, string> = {
    auth: `API 키를 확인하세요 (${status}).`,
    rate: `요청이 몰려 사용 한도(분당 요청·토큰)에 걸렸습니다 (${status}). ${wait} 다시 시도하세요.`,
    quota: opts.daily
      ? `오늘 쓸 수 있는 요청을 다 썼습니다 (${status}). 하루 한도는 다음 날 다시 채워지니 그때 쓰거나 제공자 사이트에서 등급·결제를 확인하세요.`
      : `계정의 사용 한도나 크레딧이 바닥났습니다 (${status}). 기다려도 풀리지 않으니 제공자 사이트에서 결제·한도를 확인하세요.`,
    busy: `제공자 서버가 혼잡하거나 잠시 멈췄습니다 (${status}). ${wait} 다시 시도하거나 다른 모델을 고르세요.`,
    invalid: `요청이 거절됐습니다 (${status}). 모델 이름을 확인하세요.${detail}`,
    refusal: '모델이 이 기사를 쓰지 않기로 했습니다.',
    network: '연결하지 못했습니다.',
    unknown: `API 오류 ${status}.${detail}`,
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
