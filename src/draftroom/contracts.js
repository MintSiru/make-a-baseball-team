/* Signing bonuses, club budgets and draft refusals. Amounts are in 백만 원 (100 = 1억).

   The user makes one offer per pick; the player signs, counters or walks away. CPU clubs offer the
   demand when their budget allows. Each response draws from the player's own stream, so a save that
   stores the offers replays the same answers. */
// Ported from KBO-Draft-Room df4faad src/core/contracts.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';
import DraftTuning from './tuning.js';

const D = DraftData;
const { TUNING } = DraftTuning;
const K = TUNING.contracts;
const { rng, clamp } = D;
const INTENT_LABELS = { college: '진학 희망', abroad: '해외 구단 관심' };

const roundTo = (n) => Math.max(K.step, Math.round(n / K.step) * K.step);
/** Slot value for a pick: `round` (0 = regional) and its position in the round (0-based). */
function slot(round, index) {
  const S = K.slot;
  if (round === 0) return S.regional;
  if (round === 1) return S.first[0] - index * S.first[1];
  if (round === 2) return S.second[0] - index * S.second[1];
  if (round === 3) return S.third[0] - index * S.third[1];
  return S.later[Math.min(round - 4, S.later.length - 1)];
}
/** The slot a player of this public rank would normally get (rank 1 = first pick). */
const slotForRank = (rank) => slot(Math.ceil(rank / 10), (rank - 1) % 10);

/** Club budgets for one game, from the seed. */
function budgets(seed, teams, local) {
  const B = K.budget;
  return Object.fromEntries(teams.map((t) => [t.id, roundTo(B.base + (rng(seed + '-budget-' + t.id)() - 0.5) * B.spread + (local ? B.local : 0))]));
}

/** What the player asks from this club. The favourite-club discount is folded in and not shown separately. */
function demand(p, pick, favourite) {
  const base = Math.max(pick.slot, pick.slot * (1 - K.rankWeight) + slotForRank(p.rank) * K.rankWeight);
  return roundTo(base * K.intentMult[p.intent || 'none'] * (favourite ? K.favouriteMult : 1));
}

/** First-offer acceptance chance from public information only (no favourite club), for the UI. */
function publicChance(p, offer, ask, difficulty) {
  return firstChance(p, offer, ask, difficulty, false);
}
function firstChance(p, offer, ask, difficulty, favourite) {
  const A = K.accept,
    ratio = offer / ask;
  return clamp(
    A.base[p.intent || 'none'] + (ratio - 1) * A.perRatio + (favourite ? A.favourite : 0) + K.difficulty[difficulty] - (ratio < A.lowball ? A.lowballPenalty : 0),
    0,
    A.max,
  );
}

/**
 * The player's answer to one offer: { result: 'signed' | 'counter' | 'refused', counter? }.
 * `favourite`: this club is the one he grew up supporting (hidden from the user outside easy mode).
 */
function respond(p, offer, ask, difficulty, favourite, seed) {
  const r = rng(seed + '-negotiation-' + p.id),
    accept = r(),
    stay = r();
  if (accept < firstChance(p, offer, ask, difficulty, favourite)) return { result: 'signed' };
  if (stay < K.counter[p.intent || 'none']) return { result: 'counter', counter: roundTo(Math.max(ask, offer) * K.counter.raise) };
  return { result: 'refused' };
}

/** Where a player who refused goes next (text only, from its own stream). */
function refusalPath(p, catalog, seed) {
  const r = rng(seed + '-refusal-' + p.id);
  if (p.intent === 'abroad') {
    const clubs = catalog.filter((x) => x.kind === 'overseas-pro' && ['A', 'AA'].includes(x.level));
    const c = clubs[Math.floor(r() * clubs.length)];
    return c ? `${c.name}(${c.level})와 계약하고 미국으로 건너갔다.` : '해외 구단과 계약했다.';
  }
  if (p.pathway === '고졸' || p.pathway === '야구 유학') {
    const colleges = catalog.filter((x) => x.kind === 'college' && x.region === p.highSchoolRegion);
    const list = colleges.length ? colleges : catalog.filter((x) => x.kind === 'college');
    return `${list[Math.floor(r() * list.length)].name}에 진학해 4년 뒤를 노린다.`;
  }
  return '독립리그에서 뛰며 다음 기회를 기다린다.';
}

/** Growth boost for a club's signings from the budget it did not spend. */
const growthBoost = (left, budget) => clamp((left / budget) * K.growthBoost.perShare, 0, K.growthBoost.max);

const api = { INTENT_LABELS, slot, slotForRank, budgets, demand, publicChance, respond, refusalPath, growthBoost, K };
export default api;
