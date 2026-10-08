import { k as __i18n_k } from '../i18n/index';
/* Talks with foreign players (1.3.0, from the 1.1 feedback). A new signing is no longer a price on a list: each
   candidate has an agent's ask for his guaranteed money (계약금 + 연봉), a transfer fee his club wants before it lets
   him go (이적료, part of the KBO's 100만 달러 for a new signing, never his), and now and then an offer elsewhere — a
   Japanese club, a minor-league deal with a big-league invitation, Taiwan — that he weighs ours against. The club offers
   guaranteed money and options (incentives paid after a good season); he takes it, comes back with a figure of his
   own, or walks away. Three rounds at most; between rounds some of those still talking sign somewhere else.

   A player values a dollar of options at half a guaranteed one. He takes an offer worth his floor — his ask times his
   own give, or the offer elsewhere if better — and counters one within reach; below that, or when his patience is
   gone, the talks end. Re-signing our own (the 'foreignRenew' decision) is a figure too: a loyal player takes less
   than his ask, and two years are on the table (KBO allows multi-year deals with foreign players a club re-signs).
   Everything is drawn on streams of its own, so nothing else in the league moves. */
import { hashUnit, rng } from '../draftroom';
import type { Player } from '../model/types';
import { traitsOf } from './traits';
import { FOREIGN_TALKS as T } from './tuning';

export interface ForeignTerms {
  /** Guaranteed money he asks (US dollars). */
  ask: number;
  /** His club's transfer fee (0: he is free to sign). */
  fee: number;
  /** An offer elsewhere and what it is worth to him. */
  rival: { label: string; value: number } | null;
  /** How far below his ask he will go (his floor is ask × this). */
  give: number;
  /** Rounds he will keep talking. */
  patience: number;
  /** His counter-offer from the last round (guaranteed money). */
  counter?: number;
  /** What happened last round, for the screen. */
  last?: 'counter' | 'walked' | 'signedElsewhere';
}

export interface ForeignOffer {
  /** Guaranteed money (계약금 + 연봉) and options, US dollars. */
  guaranteed: number;
  options: number;
}

const round10k = (n: number) => Math.round(n / 10_000) * 10_000;

/** A candidate's terms, drawn once per winter. `ask` is his listed total; his guaranteed ask is most of it. */
export function termsFor(seed: string, next: number, p: Player, ask: number): ForeignTerms {
  const r = rng(`${seed}|foreign-terms|${next}|${p.id}`);
  const asia = !!p.origin.asiaQuota;
  const level = p.origin.background?.level ?? 'indy';
  const F = T.fee[asia ? 'asia' : level] ?? T.fee.other!;
  const fee = r() < F.chance ? round10k(F.min + r() * (F.max - F.min)) : 0;
  const grade = p.scouting.current;
  // Elsewhere: the better he is, the likelier someone else wants him.
  const R = T.rival;
  const roll = r();
  let rival: ForeignTerms['rival'] = null;
  if (!asia && grade >= R.npb.from && roll < R.npb.chance) rival = { label: __i18n_k("league.foreigntalks.termsFor.label.dbd7cd89"), value: round10k(ask * (R.npb.value[0] + r() * (R.npb.value[1] - R.npb.value[0]))) };
  else if (!asia && roll < R.npb.chance + R.mlb.chance) rival = { label: __i18n_k("league.foreigntalks.termsFor.label.2ad02fed"), value: round10k(ask * (R.mlb.value[0] + r() * (R.mlb.value[1] - R.mlb.value[0]))) };
  else if (roll < R.npb.chance + R.mlb.chance + R.other.chance) rival = { label: asia ? __i18n_k("league.foreigntalks.termsFor.label.b7840b6a") : __i18n_k("league.foreigntalks.termsFor.label.56292372"), value: round10k(ask * (R.other.value[0] + r() * (R.other.value[1] - R.other.value[0]))) };
  return {
    ask: round10k(ask * (T.guaranteedShare[0] + r() * (T.guaranteedShare[1] - T.guaranteedShare[0]))),
    fee,
    rival,
    give: T.give[0] + r() * (T.give[1] - T.give[0]),
    patience: T.patience[0] + Math.floor(r() * (T.patience[1] - T.patience[0] + 1)),
  };
}

/** What an offer is worth to him. */
export const offerValue = (o: ForeignOffer) => o.guaranteed + o.options * T.optionValue;

/** The least he takes: his floor, or the offer elsewhere when it is better. */
export const floorOf = (t: ForeignTerms) => Math.max(t.counter ?? round10k(t.ask * t.give), t.rival?.value ?? 0);

/** All the money the deal takes under the cap: guaranteed, options and the fee. */
export const dealTotal = (t: ForeignTerms, o: ForeignOffer) => o.guaranteed + o.options + t.fee;

export type Reply = { kind: 'accept' } | { kind: 'counter'; amount: number } | { kind: 'walk' };

/** His answer to our offer this round. */
export function reply(t: ForeignTerms, o: ForeignOffer, round: number, key: string): Reply {
  const floor = floorOf(t);
  const v = offerValue(o);
  if (v >= floor) return { kind: 'accept' };
  if (round >= t.patience || v < floor * T.reach) return { kind: 'walk' };
  // A counter between the offer and his floor, nearer the floor; never below what he would take.
  const amount = round10k(Math.max(floor, floor - (floor - v) * T.counterGive * hashUnit(`${key}|counter`)));
  return { kind: 'counter', amount: Math.max(amount, round10k(floor)) };
}

/** Whether a candidate still talking signs elsewhere between rounds. */
export const signsElsewhere = (t: ForeignTerms, key: string) => hashUnit(`${key}|elsewhere`) < (t.rival ? T.elsewhere.rival : T.elsewhere.none);

/** The scouts' read of an offer (shown before it goes out): likely yes, a counter, or likely no. */
export function outlook(t: ForeignTerms, o: ForeignOffer): '수락할 듯' | '역제안 예상' | '결렬 위험' {
  const v = offerValue(o);
  const floor = floorOf(t);
  return v >= floor ? '수락할 듯' : v >= floor * T.reach ? '역제안 예상' : '결렬 위험';
}

/** The offer that meets his ask within the cap: the guaranteed money he asks, less what the fee leaves no room for. */
export function suggestedOffer(t: ForeignTerms, cap: number): ForeignOffer {
  const want = t.counter ?? t.ask;
  return { guaranteed: Math.max(0, Math.min(want, cap - t.fee)), options: 0 };
}

// ── Re-signing our own ───────────────────────────────────────────────────────────────────────────

/** Whether he re-signs for `amount` (total a season) over `years`: a loyal one takes less than he asks, an older one
    likes the second year, a younger one would rather keep his options open. */
export function renewAccepts(p: Player, ask: number, amount: number, years: 1 | 2, age: number): boolean {
  const loyalty = traitsOf(p).loyalty;
  let need = ask * (T.renew.base - (loyalty / 100) * T.renew.loyalty);
  if (years === 2) need *= age >= T.renew.olderFrom ? 1 - T.renew.twoYearsOlder : 1 + T.renew.twoYearsYounger;
  return amount >= need;
}

