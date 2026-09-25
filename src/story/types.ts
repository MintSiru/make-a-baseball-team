/* Story generation with a language model (V0.7, ROADMAP "LLM 연동 설계"). The game talks to one
   interface; each company's adapter turns a request into its own API call. Keys are the player's own
   and never enter the league state or save files. */
import type { Quote } from '../league/news';

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export interface StoryText {
  title: string;
  body: string;
  quotes: Quote[];
}

export interface StoryRequest {
  system: string;
  user: string;
  /** JSON schema of StoryText. */
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** Why an article could not be written. `rate`: too many requests or tokens for now (429). `quota`: the
    account's credit or usage limit is spent — waiting does not help. `busy`: the provider's servers are
    overloaded or down for a moment (500, 502, 503, 504, 529). */
export type StoryError = 'auth' | 'rate' | 'quota' | 'busy' | 'refusal' | 'network' | 'invalid' | 'unknown';

export type StoryFailure = { ok: false; error: StoryError; message: string; /** Seconds the server asked us to wait. */ retryAfter?: number };

export type StoryOutcome = { ok: true; text: StoryText; usage: { input: number; output: number } } | StoryFailure;

export interface StoryModel {
  id: ProviderId;
  label: string;
  /** Suggested model id (the player can type another or load the list). */
  defaultModel: string;
  generate(req: StoryRequest, key: string, model: string, fetchImpl?: typeof fetch): Promise<StoryOutcome>;
  listModels(key: string, fetchImpl?: typeof fetch): Promise<string[]>;
}

/** Parses and checks the JSON a model returned. */
export function parseStory(raw: string): StoryText | null {
  try {
    const x = JSON.parse(raw) as Partial<StoryText>;
    if (typeof x.title !== 'string' || typeof x.body !== 'string' || !Array.isArray(x.quotes)) return null;
    const quotes = x.quotes.filter((q): q is Quote => !!q && typeof q.who === 'string' && typeof q.text === 'string' && ['player', 'manager', 'fan', 'gm'].includes(q.role as string));
    return { title: x.title.trim(), body: x.body.trim(), quotes };
  } catch {
    return null;
  }
}
