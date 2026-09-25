/* Game engine: draft order, legal picks, CPU picks, phase flow, seasons and save restore.
   A game is plain JSON. Everything except the user's own choices is derived from the seed. */
// Ported from KBO-Draft-Room df4faad src/core/engine.js. See docs/UPSTREAM.md.
import DraftData from './prospects.js';
import DraftClubs from './clubs.js';
import DraftSeason from './season.js';
import DraftCareer from './career.js';
import DraftRules from './draft-ai.js';
import DraftPress from './press.js';
import DraftTuning from './tuning.js';
import DraftVoices from './voices.js';
import DraftScouting from './scouting.js';
import DraftContracts from './contracts.js';

const D = DraftData;
const TEAMS = DraftClubs;
const M = DraftSeason;
const Career = DraftCareer;
const R = DraftRules;
const Press = DraftPress;
const { ROLES, REGIONS, rng, clamp } = D;
const K = D.ko,
  Bio = D.bio;
const { TUNING } = DraftTuning;
const Voices = DraftVoices;
const S = DraftScouting;
const Deal = DraftContracts;
// Save format version. V0.6 changed the grade scale and career model, so V0.5 saves do not load.
const RELEASE = '1.0.1',
  VERSION = 6,
  ROUND_OPTIONS = [5, 8, 11], // national rounds the player can choose; 11 is the current KBO format
  ROUNDS = 11,
  POOL_SIZE = D.POOL_SIZE;
const CONFIG = Object.freeze({
  nationalRounds: ROUNDS,
  seasonCount: Career.SEASONS,
  collegeQuota: 1,
  earlyCountsForQuota: false,
});
const teamById = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
// Pools are regenerated from the seed on demand; keep the few most recent.
const cache = new Map();
function poolFor(g) {
  const seed = String(typeof g === 'string' ? g : g.seed);
  if (!cache.has(seed)) {
    cache.set(seed, D.generatePool(seed));
    if (cache.size > 3) cache.delete(cache.keys().next().value);
  }
  return cache.get(seed);
}
function getPlayer(g, id) {
  return poolFor(g).byId[id];
}
function innings(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}
function teamFor(g, id = g.teamId) {
  return { ...teamById[id], ...g.clubPlans[id] };
}
function fit(p, t) {
  return S.fit(p, t);
}
function fitLabel(p, t) {
  return fit(p, t) >= 80 ? '핵심 보강' : fit(p, t) >= 60 ? '뎁스 보강' : '여유 자원';
}
function outlook(p) {
  return p.ready >= 45 ? '1군 경쟁 후보' : p.ready >= 35 ? '적응 후 도전' : '퓨처스 육성 우선';
}
function upsideLabel(p) {
  return p.scoutCeiling >= 60
    ? '상위 주전 전망'
    : p.scoutCeiling >= 50
      ? '평균 주전 전망'
      : p.scoutCeiling >= 40
        ? '역할 확보 전망'
        : '추가 육성 필요';
}
function makeSchedule(local, rounds = ROUNDS) {
  const a = [];
  if (local) for (const t of TEAMS) a.push({ teamId: t.id, round: 0, label: '지역 1차' });
  for (let round = 1; round <= rounds; round++)
    for (const t of TEAMS) a.push({ teamId: t.id, round, label: round + 'R' });
  return a;
}
/** Public (scouting-only) view of the pool, used by the CPU clubs, the media and the scout. */
function publicPool(g) {
  const pool = poolFor(g);
  pool.publicPlayers ??= pool.players.map(R.project);
  return pool.publicPlayers;
}
function createGame(teamId, local = false, seed = 'default', difficulty = 'normal', rounds = ROUNDS) {
  if (!Object.hasOwn(teamById, teamId) || !Object.hasOwn(R.DIFFICULTIES, difficulty) || !ROUND_OPTIONS.includes(rounds))
    throw Error('구단, 난이도, 라운드 수를 확인해야 합니다.');
  const g = {
    version: VERSION,
    teamId,
    local: !!local,
    seed: String(seed),
    difficulty,
    rounds,
    draftDate: Bio.DRAFT_DATE,
    phase: 'preview',
    schedule: makeSchedule(local, rounds),
    cursor: 0,
    picks: [],
    devSigns: [],
    budgets: Deal.budgets(String(seed), TEAMS, !!local),
    offers: null, // the user's first offers, [[playerId, amount]] in pick order
    counterIds: null, // counter-offers the user accepted
    talks: [], // every club's negotiation with every pick
    news: [],
    gmChoice: null,
    season: null,
    owner: null,
    career: null,
  };
  g.clubPlans = S.plans(g.seed, TEAMS);
  g.forecasts = Press.forecast(
    publicPool(g),
    TEAMS.map((t) => teamFor(g, t.id)),
    g.local,
    g.seed,
  );
  g.scoutReport = S.recommend(publicPool(g), teamFor(g), g.local);
  return g;
}
function openScouting(g) {
  if (g.phase !== 'preview' || g.cursor !== 0) throw Error('언론 예상 다음에 추천을 확인합니다.');
  g.phase = 'scouting';
  return g.scoutReport;
}
function beginDraft(g) {
  if (g.phase !== 'scouting' || g.cursor !== 0) throw Error('이미 시작한 드래프트입니다.');
  g.phase = 'draft';
  return g;
}
function quotaStatus(g, teamId = g.teamId) {
  const byId = poolFor(g).byId;
  const count = g.picks.filter((s) => s.teamId === teamId && byId[s.playerId]?.quotaEligible).length;
  const remaining = g.schedule.slice(g.cursor).filter((s) => s.teamId === teamId && s.round > 0).length;
  return {
    count,
    required: CONFIG.collegeQuota,
    missing: Math.max(0, CONFIG.collegeQuota - count),
    remaining,
  };
}
function available(g, slot = g.schedule[g.cursor]) {
  if (!slot) return [];
  const used = new Set(g.picks.map((s) => s.playerId));
  let list = poolFor(g).players.filter((p) => !used.has(p.id));
  if (slot.round === 0) return list.filter((p) => Bio.eligible(p, teamFor(g, slot.teamId)));
  const q = quotaStatus(g, slot.teamId),
    demand = TEAMS.reduce((n, t) => n + quotaStatus(g, t.id).missing, 0),
    supply = list.filter((p) => p.quotaEligible).length;
  if (q.missing && q.remaining <= q.missing) list = list.filter((p) => p.quotaEligible);
  else if (!q.missing && supply <= demand) list = list.filter((p) => !p.quotaEligible);
  return list;
}
function addPick(g, id) {
  if (g.phase !== 'draft') throw Error('드래프트 진행 중에만 지명할 수 있습니다.');
  const slot = g.schedule[g.cursor];
  if (!slot || !available(g, slot).some((p) => p.id === id))
    throw Error('현재 순서에서 지명할 수 없는 선수입니다.');
  const p = getPlayer(g, id);
  const roundStart = g.schedule.findIndex((x) => x.round === slot.round);
  const s = { ...slot, playerId: id, overall: g.cursor + 1, fit: fit(p, teamFor(g, slot.teamId)), slot: Deal.slot(slot.round, g.cursor - roundStart) };
  if (s.round <= 1)
    g.news.push(
      Press.news(
        publicPool(g),
        TEAMS.map((t) => teamFor(g, t.id)),
        s,
        g.picks,
        g.forecasts,
        g.seed,
      ),
    );
  g.picks.push(s);
  g.cursor++;
  if (g.cursor === g.schedule.length) g.phase = 'negotiation';
  return s;
}
function aiChoice(g) {
  const slot = g.schedule[g.cursor];
  if (!slot || g.phase !== 'draft') return null;
  const t = teamFor(g, slot.teamId);
  const prior = g.picks.filter((s) => s.teamId === t.id).map((s) => R.project(getPlayer(g, s.playerId)));
  const ranked = R.aiScores(
    available(g).map(R.project),
    t,
    prior,
    g.difficulty,
    g.seed + '-ai-' + g.cursor,
  );
  return ranked.length ? getPlayer(g, ranked[0].id) : null;
}
function advanceToUser(g) {
  const out = [];
  while (g.phase === 'draft' && g.cursor < g.schedule.length && g.schedule[g.cursor].teamId !== g.teamId) {
    const p = aiChoice(g);
    if (!p) throw Error('후보 부족');
    out.push(addPick(g, p.id));
  }
  return out;
}
const myPicks = (g) => g.picks.filter((s) => s.teamId === g.teamId);
function simulatePlayer(p, s, g) {
  return M.simulatePlayer(
    p,
    s,
    g,
    teamFor(g, s.teamId || g.teamId),
    fit(p, teamFor(g, s.teamId || g.teamId)),
  );
}
function gmOptions(g) {
  return Press.gmOptions(
    mySignedPicks(g).map((s) => R.project(getPlayer(g, s.playerId))),
    teamFor(g),
  );
}
// ---------------------------------------------------------------- development contracts

// ---------------------------------------------------------------- contracts

/** Draft picks who signed (all picks until negotiations are done). */
const signedPicks = (g) => g.picks.filter((s) => !s.refused);
const mySignedPicks = (g) => signedPicks(g).filter((s) => s.teamId === g.teamId);
const isFavourite = (p, teamId) => TEAMS[p.favoriteTeam]?.id === teamId;
/** What each of a club's picks asks for. */
function asks(g, teamId = g.teamId) {
  return g.picks.filter((s) => s.teamId === teamId).map((s) => {
    const p = getPlayer(g, s.playerId);
    return { playerId: s.playerId, round: s.round, label: s.label, slot: s.slot, ask: Deal.demand(p, s, isFavourite(p, teamId)), intent: p.intent };
  });
}
/** Money a club has committed: signed bonuses plus development contracts. */
function spent(g, teamId = g.teamId) {
  const bonuses = g.talks.filter((t) => t.teamId === teamId && t.result === 'signed').reduce((n, t) => n + t.bonus, 0);
  return bonuses + (g.devSigns || []).filter((s) => s.teamId === teamId).length * TUNING.contracts.devCost;
}
const budgetLeft = (g, teamId = g.teamId) => g.budgets[teamId] - spent(g, teamId);

/**
 * The user's first offers (playerId → amount, 0 = no offer), then every CPU club's negotiations in pick order.
 * Counter-offers to the user wait for settleCounters(); otherwise the negotiations close at once.
 */
function negotiate(g, offers) {
  if (g.phase !== 'negotiation' || g.offers) throw Error('계약 협상은 드래프트가 끝난 뒤 한 번만 합니다.');
  const K = TUNING.contracts,
    mine = asks(g);
  const ok =
    offers && typeof offers === 'object' &&
    Object.keys(offers).length === mine.length &&
    mine.every((a) => Number.isInteger(offers[a.playerId]) && offers[a.playerId] >= 0 && offers[a.playerId] % K.step === 0) &&
    mine.reduce((n, a) => n + offers[a.playerId], 0) <= g.budgets[g.teamId];
  if (!ok) throw Error('제시액을 확인해야 합니다.');
  g.offers = mine.map((a) => [a.playerId, offers[a.playerId]]);
  const committed = Object.fromEntries(TEAMS.map((t) => [t.id, 0]));
  for (const s of g.picks) {
    const p = getPlayer(g, s.playerId),
      fav = isFavourite(p, s.teamId),
      ask = Deal.demand(p, s, fav);
    let offer, res;
    if (s.teamId === g.teamId) {
      offer = offers[s.playerId];
      res = offer > 0 ? Deal.respond(p, offer, ask, g.difficulty, fav, g.seed) : { result: 'refused' };
    } else {
      // Keep enough for the club's later picks at their slot value and its minimum development contracts.
      const later = g.picks.filter((x) => x.teamId === s.teamId && x.overall > s.overall).reduce((n, x) => n + x.slot, 0) * K.cpuReserve;
      const room = g.budgets[s.teamId] - committed[s.teamId] - later - TUNING.devContracts.cpuMin * K.devCost;
      offer = Math.max(K.step, Math.min(Math.round((ask * K.cpuOffer) / K.step) * K.step, Math.floor(room / K.step) * K.step));
      res = Deal.respond(p, offer, ask, g.difficulty, fav, g.seed);
      if (res.result === 'counter') res = res.counter <= room ? { result: 'signed', bonus: res.counter } : { result: 'refused' };
    }
    const talk = { teamId: s.teamId, playerId: s.playerId, ask, offer, result: res.result, counter: res.counter ?? null, bonus: res.result === 'signed' ? res.bonus ?? offer : 0 };
    g.talks.push(talk);
    committed[s.teamId] += talk.bonus;
  }
  if (!g.talks.some((t) => t.teamId === g.teamId && t.result === 'counter')) closeNegotiations(g, []);
  return g.talks.filter((t) => t.teamId === g.teamId);
}
/** Default first offers: every ask, scaled down evenly when the total would exceed the budget. */
function defaultOffers(g) {
  const list = asks(g),
    step = TUNING.contracts.step,
    k = Math.min(1, g.budgets[g.teamId] / list.reduce((n, a) => n + a.ask, 0));
  return Object.fromEntries(list.map((a) => [a.playerId, Math.max(step, Math.floor((a.ask * k) / step) * step)]));
}
/** Counter-offers the club can afford, in pick order. */
function affordableCounters(g) {
  let left = budgetLeft(g);
  const ids = [];
  for (const t of g.talks.filter((t) => t.teamId === g.teamId && t.result === 'counter'))
    if (t.counter <= left) {
      ids.push(t.playerId);
      left -= t.counter;
    }
  return ids;
}
/** Negotiates with default offers and accepts every affordable counter (tests, audits, quick play). */
function signAll(g) {
  negotiate(g, defaultOffers(g));
  if (g.phase === 'negotiation') settleCounters(g, affordableCounters(g));
}
/** The user accepts some counter-offers; the rest walk away. */
function settleCounters(g, ids) {
  const open = g.talks.filter((t) => t.teamId === g.teamId && t.result === 'counter');
  if (g.phase !== 'negotiation' || !open.length || !Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.every((id) => open.some((t) => t.playerId === id)))
    throw Error('재협상 결과를 확인해야 합니다.');
  const cost = open.filter((t) => ids.includes(t.playerId)).reduce((n, t) => n + t.counter, 0);
  if (spent(g) + cost > g.budgets[g.teamId]) throw Error('예산을 넘습니다.');
  closeNegotiations(g, ids);
}
function closeNegotiations(g, acceptedCounters) {
  for (const t of g.talks.filter((t) => t.result === 'counter')) {
    const yes = acceptedCounters.includes(t.playerId);
    t.result = yes ? 'signed' : 'refused';
    t.bonus = yes ? t.counter : 0;
  }
  for (const s of g.picks) {
    const t = g.talks.find((x) => x.playerId === s.playerId);
    s.bonus = t.bonus;
    if (t.result === 'refused') {
      s.refused = true;
      t.path = Deal.refusalPath(getPlayer(g, s.playerId), D.catalog, g.seed);
    }
  }
  g.counterIds = acceptedCounters;
  g.phase = 'signing';
}
const refusals = (g, teamId = null) => g.talks.filter((t) => t.result === 'refused' && (!teamId || t.teamId === teamId));

/** Every player tied to a club this class: signed draft picks, then development contracts. */
const signed = (g) => [...signedPicks(g), ...(g.devSigns || [])];
const mySigned = (g) => signed(g).filter((s) => s.teamId === g.teamId);
/** Pool players nobody drafted or signed, best public rank first. */
function undrafted(g) {
  const taken = new Set([...g.picks, ...(g.devSigns || [])].map((s) => s.playerId));
  return poolFor(g).players.filter((p) => !taken.has(p.id));
}
function devEntry(g, teamId, playerId) {
  const k = (g.devSigns || []).length;
  return { teamId, round: g.rounds + 1, label: '육성', dev: true, playerId, overall: g.schedule.length + k + 1, fit: fit(getPlayer(g, playerId), teamFor(g, teamId)) };
}
/**
 * The user signs up to `max` undrafted players; then each CPU club, in draft order, signs cpuMin–cpuMax more.
 * CPU clubs take turns one player at a time and only see public information.
 */
function signDevelopment(g, ids = []) {
  const D_ = TUNING.devContracts;
  if (g.phase !== 'signing') throw Error('육성선수 계약은 드래프트가 끝난 뒤에 합니다.');
  if (!Array.isArray(ids) || ids.length > D_.max || new Set(ids).size !== ids.length) throw Error('육성선수는 최대 ' + D_.max + '명입니다.');
  const free = new Set(undrafted(g).map((p) => p.id));
  if (!ids.every((id) => free.has(id))) throw Error('계약할 수 없는 선수입니다.');
  if (ids.length * TUNING.contracts.devCost > budgetLeft(g)) throw Error('육성선수 계약 예산이 부족합니다.');
  g.devSigns = [];
  for (const id of ids) g.devSigns.push(devEntry(g, g.teamId, id));
  const order = g.schedule.filter((s) => s.round === 1 && s.teamId !== g.teamId).map((s) => s.teamId);
  const quota = Object.fromEntries(order.map((id) => [id, D_.cpuMin + Math.floor(rng(g.seed + '-dev-count-' + id)() * (D_.cpuMax - D_.cpuMin + 1))]));
  for (let turn = 0; turn < D_.cpuMax; turn++)
    for (const teamId of order) {
      if (turn >= quota[teamId] || budgetLeft(g, teamId) < TUNING.contracts.devCost) continue;
      const t = teamFor(g, teamId),
        mine = signed(g).filter((s) => s.teamId === teamId).map((s) => R.project(getPlayer(g, s.playerId)));
      const ranked = R.aiScores(undrafted(g).map(R.project), t, mine, g.difficulty, `${g.seed}-dev-${teamId}-${turn}`);
      if (ranked[0]) g.devSigns.push(devEntry(g, teamId, ranked[0].id));
    }
  g.phase = 'interviews';
  return g.devSigns;
}

/** The press conference: two questions about this draft, then the first-year pledge. */
function gmQuestions(g) {
  const first = mySignedPicks(g)[0];
  const qs = Press.gmQuestions({
    first: first ? R.project(getPlayer(g, first.playerId)) : null,
    firstLabel: first ? (first.round === 0 ? '지역 1차로' : `${first.label}에서`) : '',
    refused: refusals(g, g.teamId).map((t) => getPlayer(g, t.playerId).name),
    spentShare: spent(g) / g.budgets[g.teamId],
    boost: Deal.growthBoost(budgetLeft(g), g.budgets[g.teamId]),
    team: teamFor(g),
  });
  return [...qs, { id: 'pledge', question: '이번 지명으로 무엇을 보여 주실 겁니까?', options: gmOptions(g) }];
}
/** `choice`: the pledge; `answers`: { first, issue } option ids (the first option when omitted). */
function chooseGM(g, choice, answers = {}) {
  if (g.phase !== 'interviews' || g.cursor !== g.schedule.length || g.gmChoice || g.season || !Press.GM_CHOICES.some((c) => c.id === choice))
    throw Error('인터뷰 답변은 드래프트 종료 후 한 번만 선택할 수 있습니다.');
  const picked = {};
  for (const q of gmQuestions(g).filter((q) => q.id !== 'pledge')) {
    const id = answers[q.id] ?? q.options[0].id;
    if (!q.options.some((o) => o.id === id)) throw Error('기자회견 답변을 확인해야 합니다.');
    picked[q.id] = id;
  }
  g.gmChoice = choice;
  g.gmAnswers = picked;
  return gmOptions(g).find((c) => c.id === choice);
}
/**
 * Pledges judged after later seasons: [{ yearIndex, label, delta, kept }]. Only seasons already played.
 * - first 'now': our first pick plays in the first team in year one.
 * - first 'project': he holds a regular job at our club within four seasons.
 * - pledge 'core5': three of our signed draft picks hold a regular job here within five seasons.
 */
function pledgeOutcomes(g) {
  const years = g.career?.years || [],
    out = [],
    first = mySignedPicks(g)[0],
    regularHere = (y, id) => y.records.some((r) => r.playerId === id && r.teamId === g.teamId && r.route === 'regular');
  if (first && g.gmAnswers?.first === 'now' && years[0]) {
    const kept = years[0].records.some((r) => r.playerId === first.playerId && r.stats.games > 0);
    out.push({ yearIndex: 0, label: '첫 지명 즉시 전력 약속', delta: kept ? 3 : -3, kept });
  }
  if (first && g.gmAnswers?.first === 'project') {
    const at = years.slice(0, 4).findIndex((y) => regularHere(y, first.playerId));
    if (at >= 0) out.push({ yearIndex: at, label: '첫 지명 주전 육성 약속', delta: 4, kept: true });
    else if (years.length >= 4) out.push({ yearIndex: 3, label: '첫 지명 주전 육성 약속', delta: -3, kept: false });
  }
  if (g.gmChoice === 'core5' && years.length >= 5) {
    const n = mySignedPicks(g).filter((s) => years.slice(0, 5).some((y) => regularHere(y, s.playerId))).length;
    out.push({ yearIndex: 4, label: `5년 주전 셋 약속 (${n}명)`, delta: n >= 3 ? 5 : -5, kept: n >= 3 });
  }
  return out;
}
function fanState(g) {
  const timeline = [{ label: '시작 전', delta: 0, score: 50 }];
  let score = 50;
  function entry(label, delta) {
    score = clamp(score + delta, 0, 100);
    timeline.push({ label, delta, score });
  }
  for (const n of g.news.filter((n) => n.teamId === g.teamId)) entry(n.reason, n.delta);
  if (g.phase !== 'negotiation' && g.offers) {
    const lost = refusals(g, g.teamId).length;
    entry(`계약 협상 · ${lost ? `지명 거부 ${lost}명` : '전원 계약'}`, lost ? lost * TUNING.contracts.refusalFan : 0);
  }
  if (g.gmChoice) {
    for (const q of gmQuestions(g).filter((q) => q.id !== 'pledge')) {
      const o = q.options.find((o) => o.id === g.gmAnswers?.[q.id]);
      if (o) entry('기자회견 · ' + o.title, o.delta);
    }
    const c = gmOptions(g).find((c) => c.id === g.gmChoice);
    entry('기자회견 · ' + c.title, c.delta);
  }
  if (g.season) {
    const a = Press.accountability(
      g.gmChoice,
      mySignedPicks(g).map((s) => R.project(getPlayer(g, s.playerId))),
      g.season,
      teamFor(g),
    );
    entry('첫 시즌 약속 · ' + a.status, a.bonus);
  }
  const pledges = pledgeOutcomes(g);
  // Every season: the club's finish, how many of this class held a regular job here, national medals.
  // Old feelings fade a little each year, so the score drifts back toward 50 before the new season counts.
  const F = TUNING.fans;
  for (const y of g.career?.years || []) {
    const own = new Set(myPicks(g).map((s) => s.playerId).concat(mySigned(g).map((s) => s.playerId)));
    const rank = y.league.table.find((t) => t.teamId === g.teamId).rank,
      champion = y.league.champion === g.teamId,
      regulars = y.records.filter((r) => own.has(r.playerId) && r.teamId === g.teamId && r.route === 'regular').length,
      medals = y.awards.filter((a) => a.scope === 'national' && own.has(a.playerId) && /메달/.test(a.title)).length;
    score = Math.round(clamp(score + (50 - score) * F.fade, 0, 100));
    const delta = F.byRank[rank - 1] + (champion ? F.champion : 0) + Math.min(F.maxRegulars, regulars) * F.perRegular + Math.min(F.maxMedals, medals);
    entry(`${y.year} 시즌 · ${rank}위${champion ? ' · 우승' : ''} · 동기 주전 ${regulars}명${medals ? ` · 국가대표 메달 ${medals}명` : ''}`, delta);
    for (const o of pledges.filter((o) => o.yearIndex === y.year - Bio.ENTRY_YEAR)) entry(`${o.label} · ${o.kept ? '지킴' : '못 지킴'}`, o.delta);
  }
  return {
    score,
    label: score >= 65 ? '기대 우세' : score >= 45 ? '관망' : score >= 30 ? '우려 우세' : '신뢰 회복 필요',
    timeline,
  };
}
function evaluate(g, season) {
  const players = mySignedPicks(g).map((s) => getPlayer(g, s.playerId)),
    base = M.evaluate(g, season, players, teamFor(g));
  const pledge = Press.accountability(g.gmChoice, players.map(R.project), season, teamFor(g));
  const score = clamp(base.score + pledge.bonus, 0, 100);
  return {
    ...base,
    baseScore: base.score,
    score,
    grade: score >= 89 ? 'A' : score >= 77 ? 'B' : score >= 63 ? 'C' : 'D',
    pledge,
  };
}
// ---------------------------------------------------------------- development plans

/** Focus, position and two-way options for our players before the next season (or the first one). */
function planOptions(g) {
  const byId = poolFor(g).byId;
  if (g.career && g.career.years.length >= Career.SEASONS) return [];
  return Career.planOptions(g.career || Career.create(signed(g), byId, g.seed), byId, g.career ? g.career.years.length : 0, g.teamId);
}
/**
 * Validates plans (playerId → { focus?, role?, twoWay? }) against the options, keeps only real changes and
 * records them for the save. Throws on anything the options do not allow.
 */
function takePlans(g, plans, yearIndex, options) {
  const byOption = new Map(options.map((o) => [o.playerId, o])),
    out = {};
  for (const [id, plan] of Object.entries(plans || {})) {
    const o = byOption.get(id);
    if (!o || !plan || typeof plan !== 'object' || Array.isArray(plan)) throw Error('육성 계획을 확인해야 합니다.');
    const clean = {};
    if (plan.role != null && plan.role !== o.role) {
      if (!o.roleOptions.includes(plan.role)) throw Error('바꿀 수 없는 포지션입니다.');
      clean.role = plan.role;
    }
    if (plan.focus != null) {
      const kind = Career.kindOf(clean.role || o.role);
      if (plan.focus !== 'balanced' && !Career.FOCUS_KEYS[kind].includes(plan.focus)) throw Error('육성 방향을 확인해야 합니다.');
      if (plan.focus !== o.focus || clean.role) clean.focus = plan.focus;
    }
    if (plan.twoWay != null) {
      if (typeof plan.twoWay !== 'boolean' || (plan.twoWay && !o.twoWayCapable)) throw Error('투타 겸업 여부를 확인해야 합니다.');
      if (plan.twoWay !== o.twoWay) clean.twoWay = plan.twoWay;
    }
    if (Object.keys(clean).length) out[id] = clean;
  }
  g.devPlans ??= [];
  for (const [id, c] of Object.entries(out).sort()) g.devPlans.push([yearIndex, id, c.focus ?? null, c.role ?? null, c.twoWay ?? null]);
  return out;
}
const plansFor = (list, yearIndex) =>
  Object.fromEntries(
    (list || [])
      .filter((x) => x[0] === yearIndex)
      .map(([, id, focus, role, twoWay]) => [id, Object.fromEntries(Object.entries({ focus, role, twoWay }).filter(([, v]) => v != null))]),
  );

function runSeason(g, plans = {}) {
  if (g.cursor !== g.schedule.length || !g.gmChoice)
    throw Error('드래프트와 단장 인터뷰를 먼저 완료해야 합니다.');
  const { byId } = poolFor(g);
  if (!g.career) {
    // Unspent budget becomes development support for each club's own signings.
    const boosts = Object.fromEntries(TEAMS.map((t) => [t.id, Deal.growthBoost(budgetLeft(g, t.id), g.budgets[t.id])]));
    const career = Career.create(signed(g), byId, g.seed, boosts);
    const clean = takePlans(g, plans, 0, Career.planOptions(career, byId, 0, g.teamId));
    g.career = career;
    Career.advance(g.career, signed(g), byId, g.seed, {}, clean, g.teamId);
    // First-year evaluation covers this club's signed draft picks (development contracts are judged over the career).
    const drafted = new Set(mySignedPicks(g).map((s) => s.playerId));
    g.season = g.career.years[0].records.filter((s) => s.teamId === g.teamId && drafted.has(s.playerId));
    g.owner = evaluate(g, g.season);
  }
  g.phase = 'season';
  return g.season;
}
// ---------------------------------------------------------------- military service choices

const SERVICE_CHOICES = ['auto', 'sangmu', 'army', 'defer'];
/** Our players who could enlist before the next season, with deadline and Sangmu chance. */
function serviceOptions(g) {
  if (!g.career || g.career.years.length >= Career.SEASONS) return [];
  return Career.serviceOptions(g.career, poolFor(g).byId, g.career.years.length).filter((o) => o.teamId === g.teamId);
}
/** Plays the next season. `orders`: playerId → service choice for our players ('auto' if omitted). */
function nextSeason(g, orders = {}, plans = {}) {
  if (!g.career || !['season', 'owner'].includes(g.phase)) throw Error('첫 시즌을 먼저 진행해야 합니다.');
  const options = new Map(serviceOptions(g).map((o) => [o.playerId, o]));
  for (const [id, choice] of Object.entries(orders)) {
    const o = options.get(id);
    if (!o || !SERVICE_CHOICES.includes(choice) || (choice === 'defer' && o.must)) throw Error('병역 결정을 확인해야 합니다.');
  }
  const yearIndex = g.career.years.length;
  const clean = takePlans(g, plans, yearIndex, planOptions(g));
  g.serviceOrders ??= [];
  for (const [id, choice] of Object.entries(orders).sort()) if (choice !== 'auto') g.serviceOrders.push([yearIndex, id, choice]);
  const result = Career.advance(g.career, signed(g), poolFor(g).byId, g.seed, orders, clean, g.teamId);
  g.phase = 'season';
  return result;
}
function careerReview(g) {
  // Picks who refused to sign count against the club: they are in the class size with nothing to show.
  const lost = Object.fromEntries(TEAMS.map((t) => [t.id, refusals(g, t.id).length]));
  return g.career ? Career.review(g.career, signed(g), poolFor(g).byId, lost) : [];
}
const PHASES = ['preview', 'scouting', 'draft', 'negotiation', 'signing', 'interviews', 'season', 'owner'];

/*
 * Saves
 * -----
 * A save holds only the inputs of a game: settings, seed, the user's own picks, the GM answer and how
 * many seasons were played. Everything else is recomputed by replaying, which is fast (<0.2 s for five
 * seasons) and means a save cannot be edited into a different result.
 *
 * Replaying is only faithful while the simulation behaves exactly as it did when the save was made.
 * SIM_VERSION names that behaviour: bump it whenever a change alters any simulated number or pick
 * (tests/golden.cjs fails until you do). A save from another SIM_VERSION is refused, never silently
 * replayed into a different history.
 */
const SIM_VERSION = '1.0',
  SAVE_FORMAT = 'draft-room-save',
  SAVE_VERSION = 2;

/** The compact save for a game. */
function toSave(g) {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    sim: SIM_VERSION,
    teamId: g.teamId,
    local: g.local,
    seed: g.seed,
    difficulty: g.difficulty,
    rounds: g.rounds,
    phase: g.phase,
    picks: myPicks(g).map((s) => s.playerId),
    offers: g.offers,
    counters: g.counterIds,
    dev: (g.devSigns || []).filter((s) => s.teamId === g.teamId).map((s) => s.playerId),
    gmChoice: g.gmChoice,
    gm: g.gmAnswers || null,
    seasons: g.career?.years.length ?? 0,
    service: g.serviceOrders || [],
    plans: g.devPlans || [],
  };
}

/**
 * Replays a game from compact-save inputs. Returns null if they are invalid or do not replay.
 * CPU clubs pick up to the user's next turn, as the app does; `stopAt` instead stops at that overall pick
 * (used for v0.6.0 saves, which may have been stored mid-way through CPU picks).
 */
function replay(s, stopAt = null) {
  try {
    if (
      !s ||
      !Object.hasOwn(R.DIFFICULTIES, s.difficulty) ||
      !Object.hasOwn(teamById, s.teamId) ||
      !ROUND_OPTIONS.includes(s.rounds) ||
      typeof s.seed !== 'string' ||
      !s.seed.length ||
      s.seed.length > 200 ||
      typeof s.local !== 'boolean' ||
      !PHASES.includes(s.phase) ||
      !Array.isArray(s.picks) ||
      !s.picks.every((id) => typeof id === 'string') ||
      !Number.isInteger(s.seasons) ||
      s.seasons < 0 ||
      s.seasons > Career.SEASONS ||
      (s.service != null && (!Array.isArray(s.service) || !s.service.every((o) => Array.isArray(o) && o.length === 3 && Number.isInteger(o[0]) && o[0] >= 1 && o[0] < s.seasons))) ||
      (s.plans != null && (!Array.isArray(s.plans) || !s.plans.every((o) => Array.isArray(o) && o.length === 5 && Number.isInteger(o[0]) && o[0] >= 0 && o[0] < s.seasons)))
    )
      return null;
    const g = createGame(s.teamId, s.local, s.seed, s.difficulty, s.rounds);
    const pristine = !s.picks.length && s.gmChoice == null && !s.seasons && s.offers == null;
    if (s.phase === 'preview') return pristine ? g : null;
    openScouting(g);
    if (s.phase === 'scouting') return pristine ? g : null;
    beginDraft(g);
    const cpuPicks = () => {
      while (g.phase === 'draft' && g.schedule[g.cursor].teamId !== g.teamId && (stopAt == null || g.cursor < stopAt))
        addPick(g, aiChoice(g).id);
    };
    for (const id of s.picks) {
      cpuPicks();
      if (g.phase !== 'draft' || g.schedule[g.cursor].teamId !== g.teamId) return null; // more picks than turns
      addPick(g, id); // throws on an illegal pick
    }
    cpuPicks();
    if ((s.phase === 'draft') !== (g.phase === 'draft')) return null;
    if (g.phase === 'draft') return s.offers == null && s.gmChoice == null && !s.seasons ? g : null;
    // Negotiations: first offers, then (if anyone countered) which counter-offers were accepted.
    if (s.offers == null) return s.phase === 'negotiation' && s.gmChoice == null && !s.seasons ? g : null;
    if (!Array.isArray(s.offers) || !s.offers.every((o) => Array.isArray(o) && o.length === 2)) return null;
    negotiate(g, Object.fromEntries(s.offers));
    if (g.phase === 'negotiation') {
      if (s.counters == null) return s.phase === 'negotiation' && s.gmChoice == null && !s.seasons ? g : null;
      settleCounters(g, s.counters);
    } else if (s.counters != null && s.counters.length) return null;
    if (s.phase === 'negotiation') return null;
    if (s.phase === 'signing') return s.gmChoice == null && !s.seasons && !(s.dev || []).length ? g : null;
    if (g.phase === 'signing') signDevelopment(g, s.dev || []);
    if (s.gmChoice != null) {
      if (s.gm != null && (typeof s.gm !== 'object' || Array.isArray(s.gm))) return null;
      chooseGM(g, s.gmChoice, s.gm || {});
      if (s.gm && JSON.stringify(g.gmAnswers) !== JSON.stringify(s.gm)) return null; // unknown or extra answers
    }
    if (['season', 'owner'].includes(s.phase) && !s.seasons) return null;
    if (s.seasons) {
      runSeason(g, plansFor(s.plans, 0)); // requires the GM answer
      while (g.career.years.length < s.seasons) {
        const yi = g.career.years.length;
        nextSeason(g, Object.fromEntries((s.service || []).filter((o) => o[0] === yi).map((o) => [o[1], o[2]])), plansFor(s.plans, yi));
      }
      if (JSON.stringify(g.devPlans || []) !== JSON.stringify(s.plans || [])) return null; // plans that changed nothing
    }
    if (g.phase !== 'draft') g.phase = s.phase; // e.g. revisiting interviews after season 1
    return g;
  } catch (_) {
    return null;
  }
}

/**
 * Rebuilds a v0.6.0 save, which stored the whole game object. Derived fields are ignored; the inputs
 * are replayed and the stored pick list must match the replay exactly (so CPU picks cannot be edited).
 */
function restore(g0) {
  if (!g0 || g0.version !== VERSION || g0.draftDate !== Bio.DRAFT_DATE || !Array.isArray(g0.picks)) return null;
  if (g0.cursor !== g0.picks.length || !g0.picks.every((p) => p && typeof p.playerId === 'string')) return null;
  const seasons = g0.career == null ? 0 : g0.career.years?.length;
  if (g0.career != null && !seasons) return null;
  const g = replay(
    {
      rounds: 7,
      ...g0,
      picks: g0.picks.filter((p) => p.teamId === g0.teamId).map((p) => p.playerId),
      dev: (g0.devSigns || []).filter((p) => p.teamId === g0.teamId).map((p) => p.playerId),
      counters: g0.counterIds ?? null,
      gm: g0.gmAnswers ?? null,
      seasons,
    },
    g0.picks.length,
  );
  if (!g) return null;
  const ids = (list) => list.map((p) => p.teamId + ':' + p.playerId).join();
  return ids(g.picks) === ids(g0.picks) ? g : null;
}

/**
 * Loads any supported save: a compact save, a v0.6.0 export ({format:'draft-room-v06', game}) or a bare
 * v0.6.0 game object. Returns { game } or { error: 'sim' | 'invalid', sim }.
 */
function loadSave(data) {
  if (data?.format === SAVE_FORMAT) {
    if (data.version !== SAVE_VERSION) return { error: 'invalid' };
    if (data.sim !== SIM_VERSION) return { error: 'sim', sim: String(data.sim) };
    const game = replay(data);
    return game ? { game } : { error: 'invalid' };
  }
  // v0.6.0 saves predate SIM_VERSION; their simulation is the one named '0.6'.
  const legacy = data?.format === 'draft-room-v06' ? data.game : data;
  if (legacy?.version === VERSION && SIM_VERSION !== '0.6') return { error: 'sim', sim: '0.6' };
  const game = restore(legacy);
  return game ? { game } : { error: 'invalid' };
}
const validate = (g) => restore(g) !== null;
const api = {
  scouting: S,
  grades: D.grades,
  teamFor,
  openScouting,
  CONFIG,
  Career,
  quotaStatus,
  nextSeason,
  careerReview,
  ko: K,
  bio: Bio,
  catalog: D.catalog,
  eligible: Bio.eligible,
  DRAFT_DATE: Bio.DRAFT_DATE,
  ENTRY_YEAR: Bio.ENTRY_YEAR,
  RELEASE,
  VERSION,
  rules: R,
  press: Press,
  publicPool,
  beginDraft,
  gmOptions,
  chooseGM,
  fanState,
  ROUNDS,
  ROUND_OPTIONS,
  POOL_SIZE,
  TEAMS,
  REGIONS,
  ROLES,
  teamById,
  poolFor,
  getPlayer,
  innings,
  fit,
  fitLabel,
  outlook,
  upsideLabel,
  makeSchedule,
  createGame,
  available,
  addPick,
  aiChoice,
  advanceToUser,
  myPicks,
  simulatePlayer,
  runSeason,
  evaluate,
  validate,
  restore,
  signDevelopment,
  negotiate,
  settleCounters,
  defaultOffers,
  affordableCounters,
  signAll,
  asks,
  spent,
  budgetLeft,
  refusals,
  signedPicks,
  mySignedPicks,
  gmQuestions,
  pledgeOutcomes,
  contracts: Deal,
  serviceOptions,
  SERVICE_CHOICES,
  planOptions,
  tuning: TUNING,
  undrafted,
  signed,
  mySigned,
  replay,
  toSave,
  loadSave,
  SIM_VERSION,
  SAVE_FORMAT,
  rng,
  clamp,
};
Voices.install(api);
export default api;
