import { k as __i18n_k } from '../i18n/index.js';
/* Season simulation for one drafted player: health → role → playing time → stats → growth → scores.
   Every balance number lives in tuning.js.

   Determinism: each step draws from its own seeded stream, and within the shared `perf` stream
   (role decision, playing time, futures games) the calls must stay in this order. Reordering them
   changes results, which needs a SIM_VERSION bump (see engine.js). */
// Ported from KBO-Draft-Room df4faad src/core/season.js. See docs/UPSTREAM.md.
import DraftScouting from './scouting.js';
import DraftData from './prospects.js';
import DraftTuning from './tuning.js';

const S = DraftScouting;
const D = DraftData;
const { TUNING: T, byYear, letter } = DraftTuning;
const G = D.grades;
const { rng, clamp, round, normal, mean } = D;
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const isPitcher = (p) => p.role === 'SP' || p.role === 'RP';
const span = ([base, width], r) => base + Math.floor(r() * width);

function emptyStats(p) {
  return isPitcher(p)
    ? { kind: 'pitcher', games: 0, gs: 0, qs: 0, outs: 0, er: 0, era: null, k: 0, bb: 0, wins: 0, holds: 0, saves: 0 }
    : { kind: 'hitter', games: 0, ab: 0, pa: 0, hits: 0, bb: 0, k: 0, hr: 0, doubles: 0, triples: 0, avg: null, ops: null, rbi: 0, sb: 0 };
}

function poisson(lambda, r) {
  let product = 1,
    n = 0;
  const limit = Math.exp(-lambda);
  do {
    n++;
    product *= r();
  } while (product > limit && n < 100);
  return n - 1;
}

// ---------------------------------------------------------------- counting stats

/** Plate-appearance simulation. `level`: 'regular' | 'major' (non-regular first team) | 'futures'. */
function hitterStats(games, tools, level, r, context) {
  const H = T.hitting,
    farm = level === 'futures',
    P = H.paPerGame;
  const pa = round(games * (level === 'regular' ? (context.core ? P.core : P.regular) : farm ? P.futures : context.cameo ? P.cameo : P.bench));
  let ab = 0,
    hits = 0,
    bb = 0,
    k = 0,
    hr = 0,
    doubles = 0,
    triples = 0;
  const avgTarget = clamp(H.avg.base + (tools.contact - H.avg.pivot) * H.avg.perContact + (farm ? H.avg.futuresBonus : 0) + normal(r) * H.avg.noise, H.avg.min, H.avg.max);
  const hrChance = clamp(H.hr.base + (tools.power - H.hr.pivot) * H.hr.perPower + (farm ? H.hr.futuresBonus : 0), H.hr.min, H.hr.max),
    walk = clamp(H.walk.base + (tools.eye - H.walk.pivot) * H.walk.perEye, H.walk.min, H.walk.max),
    strikeout = clamp(H.strikeout.base - (tools.contact - H.strikeout.pivot) * H.strikeout.perContact, H.strikeout.min, H.strikeout.max);
  const hitChance = clamp((avgTarget - hrChance) / (1 - hrChance), H.hitShare.min, H.hitShare.max),
    tripleChance = clamp((tools.speed - H.triple.pivot) * H.triple.perSpeed, 0, H.triple.max),
    doubleChance = H.double.base + (tools.power - H.double.pivot) * H.double.perPower,
    kChance = strikeout / Math.max(H.strikeout.minNonHitShare, 1 - avgTarget);
  for (let i = 0; i < pa; i++) {
    if (r() < walk) {
      bb++;
      continue;
    }
    ab++;
    if (r() < hrChance) {
      hr++;
      hits++;
      continue;
    }
    if (r() < hitChance) {
      hits++;
      const b = r();
      if (b < tripleChance) triples++;
      else if (b < doubleChance) doubles++;
    } else if (r() < kChance) k++;
  }
  const avg = ab ? round(hits / ab, 3) : null,
    ops = ab ? round((hits + bb) / pa + (hits + doubles + 2 * triples + 3 * hr) / ab, 3) : null;
  const steal = H.steal;
  return {
    kind: 'hitter', games, pa, ab, hits, bb, k, hr, doubles, triples, avg, ops,
    rbi: round(hits * H.rbi.perHit + hr * H.rbi.perHR),
    sb: Math.min(hits + bb, round(((games * Math.max(0, tools.speed - steal.pivot)) / steal.gamesPerUnit) * (steal.base + r() * steal.spread))),
  };
}

/** Appearance-by-appearance simulation for pitchers. */
function pitcherStats(role, games, tools, level, r, context) {
  const P = T.pitching,
    farm = level === 'futures',
    regular = level === 'regular';
  let outs = 0,
    er = 0,
    k = 0,
    bb = 0,
    wins = 0,
    holds = 0,
    saves = 0,
    qs = 0;
  const gs = role === 'SP' ? (regular || farm ? games : Math.floor(games * P.spotStartShare)) : 0;
  const E = P.era;
  const targetERA = clamp(E.base - tools.stuff * E.perStuff - tools.command * E.perCommand - tools.breaking * E.perBreaking - (farm ? E.futuresBonus : 0) + normal(r) * E.noise, E.min, E.max);
  const k9 = clamp(P.k9.base + (tools.stuff - P.k9.pivot) * P.k9.perStuff + tools.breaking * P.k9.perBreaking + (role === 'RP' ? P.k9.reliefBonus : 0), P.k9.min, P.k9.max),
    bb9 = clamp(P.bb9.base - tools.command * P.bb9.perCommand, P.bb9.min, P.bb9.max);
  const W = P.startWin,
    rank = context.teamRank || W.defaultRank;
  for (let i = 0; i < games; i++) {
    const start = i < gs;
    const ip = start
      ? clamp(P.startIP.base + tools.stamina * P.startIP.perStamina + (regular ? P.startIP.regular : P.startIP.other) + normal(r) * P.startIP.noise, P.startIP.min, P.startIP.max)
      : clamp(P.reliefIP.base + normal(r) * P.reliefIP.noise, P.reliefIP.min, P.reliefIP.max);
    const o = round(ip * 3),
      e = poisson((targetERA * o) / 27, r);
    outs += o;
    er += e;
    k += Math.min(o, poisson((o / 27) * k9, r));
    bb += poisson((o / 27) * bb9, r);
    if (start && o >= P.qualityStart.minOuts && e <= P.qualityStart.maxRuns) qs++;
    if (start) {
      if (o >= W.minOuts && r() < clamp(W.base + (W.pivotRuns - e) * W.perRun + (W.rankPivot - rank) * W.perRank, W.min, W.max) && r() < W.bullpenHold) wins++;
    } else {
      const u = r();
      if (u < P.relief.win) wins++;
      else if (regular && context.closer && u < P.relief.save) saves++;
      else if (!farm && u < P.relief.hold) holds++;
    }
  }
  return { kind: 'pitcher', games, gs, qs, outs, er, era: round((er * 27) / outs, 2), k, bb, wins, holds, saves };
}

function statsFor(p, games, tools, level, r, context = {}) {
  if (!games) return emptyStats(p);
  return isPitcher(p) ? pitcherStats(p.role, games, tools, level, r, context) : hitterStats(games, tools, level, r, context);
}

// ---------------------------------------------------------------- season steps

/** Injury for the year, from its own stream. */
function rollHealth(p, r) {
  const H = T.health;
  const limited = r() < p.risk;
  const daysLost = limited ? (r() < H.longInjuryShare ? span(H.longDays, r) : span(H.shortDays, r)) : 0;
  return { limited, daysLost };
}

/**
 * Role for the year: 'regular' | 'backup' | 'cameo' | 'futures' | 'rehab', with the reason shown to the player.
 * `impact` is this season's ability plus noise; `previous` is last year's end state (null for rookies).
 */
function decideRole({ impact, previous, yearIndex, round: pickRound, fit, daysLost, blockedRegular }, r) {
  const R = T.roles;
  const investment = (R.draftInvestment.byRound[pickRound] ?? 0) * byYear(R.draftInvestment.byYear, yearIndex);
  const priorBackup = previous?.route === 'backup';
  let route = 'futures',
    reason = 'development-first';
  if (daysLost >= T.health.rehabDays) {
    route = 'rehab';
    reason = 'long-rehab';
  } else if (previous?.route === 'regular') {
    const form = previous.performance ?? 0,
      K = R.retention;
    if (r() < clamp(K.base + (impact - K.pivot) * K.perAbility + form * K.perForm, K.min, K.max)) {
      route = 'regular';
      reason = 'role-retained';
    } else if (impact < R.demotion.maxAbility && form < R.demotion.maxForm) {
      reason = 'poor-form-and-ability';
    } else {
      route = 'backup';
      reason = form < R.demotion.poorForm ? 'poor-form' : 'role-competition';
    }
  } else {
    const U = R.callUp;
    const callUp = clamp(U.base + sigmoid((impact - U.pivot) / U.scale) * U.weight + investment + (priorBackup ? U.afterBackup : 0) + (fit >= U.needFit ? U.needBonus : 0), U.min, U.max);
    if (r() < callUp) {
      const Q = R.regular,
        B = R.backupOverCameo;
      const regularChance = clamp(sigmoid((impact - byYear(Q.pivotByYear, yearIndex)) / Q.scale) * byYear(Q.weightByYear, yearIndex) + (priorBackup ? Q.afterBackup : 0), Q.min, Q.max);
      route = r() < regularChance ? 'regular' : r() < clamp((impact - B.pivot) / B.scale, B.min, B.max) ? 'backup' : 'cameo';
      reason = route === 'regular' ? 'earned-role' : 'trial-opportunity';
    }
  }
  if (blockedRegular && route === 'regular') {
    route = 'backup';
    reason = 'cohort-competition';
  }
  const core = route === 'regular' && impact >= R.core.minAbility && yearIndex >= R.core.fromYear;
  return { route, reason, core, investment };
}

/** First-team games for the role, reduced by time lost to injury. */
function firstTeamGames(p, route, yearIndex, daysLost, r, scale = 1) {
  const M = T.games,
    kind = isPitcher(p) ? p.role : 'hitter';
  let games = 0;
  if (route === 'regular') {
    const g = M.regular[kind];
    games = byYear(g.baseByYear, yearIndex) + Math.floor(r() * byYear(g.spanByYear, yearIndex));
  }
  if (route === 'backup') games = span(M.backup[kind], r);
  if (route === 'cameo') games = span(M.cameo[isPitcher(p) ? 'pitcher' : 'hitter'], r);
  return round(games * (1 - daysLost / T.health.playingDays) * scale);
}

function futuresGames(p, route, games, daysLost, r, scale = 1) {
  const F = T.games.futures,
    kind = isPitcher(p) ? 'pitcher' : 'hitter';
  let n = route === 'rehab' ? 0 : route === 'regular' || route === 'backup' ? F[route][kind] : span(F.development[kind], r);
  n = round(n * (1 - daysLost / T.health.playingDays) * scale);
  return kind === 'hitter' ? Math.min(n, T.games.hitterSeasonCap - games) : n;
}

/** Tool growth toward each tool's hidden ceiling, minus injury and aging. */
/** Growth multiplier for one tool under a development focus ('balanced' or a tool key). */
const focusFactor = (focus, key) => (!focus || focus === 'balanced' ? 1 : key === focus ? T.focus.chosen : T.focus.others);

function developTools(p, tools, yearIndex, age, daysLost, r, boost = 0, focus = 'balanced', scale = 1) {
  const Gr = T.growth,
    C = Gr.rateByCurve,
    H = T.health;
  const rate =
    p.growthCurve === 'early'
      ? Math.max(C.early.min, C.early.start - yearIndex * C.early.perYear)
      : p.growthCurve === 'late'
        ? yearIndex < C.late.switchYear ? C.late.firstYears : C.late.later
        : C.normal;
  const A = Gr.ageTaper,
    over = age - A.fullUntil - (p.growthCurve === 'late' ? A.lateShift : 0),
    taper = clamp(1 - over / (A.zeroAt - A.fullUntil), A.floor, 1);
  const after = {};
  for (const [key, v] of Object.entries(tools)) {
    const speed = key === 'speed' ? 'speed' : 'other';
    const gap = p.potentialTools[key] - v,
      aging = Math.max(0, age - Gr.agingFrom[speed]) * Gr.agingPerYear[speed];
    const gain =
      gap * rate * taper * scale * focusFactor(focus, key) * (1 + boost) * p.developmentRate * (key === 'speed' ? Gr.speedShare : 1) * (1 - daysLost / H.growthDays) +
      normal(r) * Gr.noise -
      aging -
      (daysLost > H.heavyInjuryDays ? H.heavyInjuryGrowthPenalty : 0);
    after[key] = round(clamp(v + clamp(gain, Gr.minGain, Gr.maxGain), 20, p.potentialTools[key]), 3);
  }
  return after;
}

function performanceOf(stats) {
  const P = T.scores.performance;
  if (!stats.games) return 0;
  return stats.kind === 'pitcher' ? clamp((P.eraPivot - stats.era) / P.eraScale, -P.limit, P.limit) : clamp((stats.ops - P.opsPivot) / P.opsScale, -P.limit, P.limit);
}

function contributionOf(stats, tools) {
  const C = T.scores.contribution;
  if (!stats.games) return 0;
  return stats.kind === 'pitcher'
    ? clamp((stats.outs / 3) * C.perInning + (C.eraPivot - stats.era) * C.perEra, 0, 100)
    : clamp(stats.pa * C.perPA + (stats.ops - C.opsPivot) * C.perOps + (tools.defense - C.defensePivot) * C.perDefense, 0, 100);
}

/** 10–100: did the player grow as much as his public projection implied, and did he play? */
function planScoreOf(p, { startGrade, growth, yearIndex, games, route, daysLost }) {
  const E = T.scores.expectedGrowth,
    Pr = T.scores.progress,
    L = T.scores.plan;
  const expected = Math.max(E.min, (p.scoutCeiling - startGrade) * (p.ceilingGrade - startGrade >= E.projectGap && yearIndex < E.projectYears ? E.projectShare : E.share));
  const progress = startGrade >= p.scoutCeiling - Pr.nearCeiling ? 1 : clamp(growth / expected, 0, Pr.max);
  return round(clamp(L.base + progress * L.perProgress + (games ? L.played : 0) + (route === 'regular' ? L.regular : 0) - (daysLost > T.health.planPenaltyDays ? T.health.planPenalty : 0), L.min, L.max));
}

// ---------------------------------------------------------------- text

const ROUTE_LABELS = { backup: __i18n_k("draftroom.season.rOUTE_LABELS.backup.dc6815b7"), cameo: __i18n_k("draftroom.season.rOUTE_LABELS.cameo.54c4b0f0"), futures: __i18n_k("draftroom.season.rOUTE_LABELS.futures.b2508852"), rehab: __i18n_k("draftroom.season.rOUTE_LABELS.rehab.0e39ac51") };
function routeLabel(route, core, pitcher) {
  return route === 'regular' ? (core ? (pitcher ? __i18n_k("draftroom.season.routeLabel.29798e0d") : __i18n_k("draftroom.season.routeLabel.6307bf87")) : __i18n_k("draftroom.season.routeLabel.15ec5b66")) : ROUTE_LABELS[route];
}
const REASONS = {
  'development-first': [__i18n_k("draftroom.season.rEASONS.370febb9"), __i18n_k("draftroom.season.rEASONS.94fa45ca"), __i18n_k("draftroom.season.rEASONS.1e605419")],
  'long-rehab': [__i18n_k("draftroom.season.rEASONS.3400fabd"), __i18n_k("draftroom.season.rEASONS.0cced0e8")],
  'role-retained': [__i18n_k("draftroom.season.rEASONS.f9c1f833"), __i18n_k("draftroom.season.rEASONS.8153fef5"), __i18n_k("draftroom.season.rEASONS.05a9cd9f")],
  'poor-form-and-ability': [__i18n_k("draftroom.season.rEASONS.8461a015"), __i18n_k("draftroom.season.rEASONS.427e49e1")],
  'poor-form': [__i18n_k("draftroom.season.rEASONS.124b44d6"), __i18n_k("draftroom.season.rEASONS.8d426524")],
  'role-competition': [__i18n_k("draftroom.season.rEASONS.00d85669"), __i18n_k("draftroom.season.rEASONS.c449f8e6")],
  'cohort-competition': [__i18n_k("draftroom.season.rEASONS.29205dcb"), __i18n_k("draftroom.season.rEASONS.a85c708f")],
  'earned-role': [__i18n_k("draftroom.season.rEASONS.b5ded8ce"), __i18n_k("draftroom.season.rEASONS.8b7c5910"), __i18n_k("draftroom.season.rEASONS.a6c713ff")],
  'trial-opportunity': [__i18n_k("draftroom.season.rEASONS.6f612148"), __i18n_k("draftroom.season.rEASONS.8bcb3b5b")],
  'trial-investment': [__i18n_k("draftroom.season.rEASONS.e709637b"), __i18n_k("draftroom.season.rEASONS.00998e15")],
};
/** Why the player had this role. Text only, from its own stream. */
function reasonText(reason, daysLost, investment, r) {
  const key = reason === 'trial-opportunity' && investment > 0 ? 'trial-investment' : reason;
  const line = REASONS[key][Math.floor(r() * REASONS[key].length)].replace('{days}', daysLost);
  return line + (daysLost && reason !== 'long-rehab' ? __i18n_k("draftroom.season.reasonText.849aa2c6", { daysLost: daysLost }) : '');
}
/** Top velocity for the season (pitchers). Draws from its own stream, so it never affects results. */
function seasonVelocity(p, after, r) {
  if (!isPitcher(p) || p.velocity == null) return null;
  const V = T.velocity;
  return round(clamp(p.velocity + (after.stuff - p.trueTools.stuff) * T.generation.velocity.perStuff + normal(r) * V.noise, V.min, V.max));
}
const growthLabel = (growth) => T.scores.growthLabels.find(([min]) => growth >= min)?.[1] ?? __i18n_k("draftroom.season.growthLabel.263baf79");

const pickLine = (lines, r) => lines[Math.floor(r() * lines.length)];
const RETURN_NOTES = [__i18n_k("draftroom.season.rETURN_NOTES.571958b2"), __i18n_k("draftroom.season.rETURN_NOTES.4e83366f"), __i18n_k("draftroom.season.rETURN_NOTES.68903790")];

/**
 * Public future value after a season. Scouts blend last year's estimate with what the player now looks
 * able to reach: current ability plus the part of his ceiling that his age still leaves room for.
 * Returns the unrounded estimate (stored so next year's blend does not compound rounding).
 */
function fvUpdate(p, ability, age, yearIndex, previousRaw, r) {
  const F = T.futureValue;
  const room = clamp((F.matureAge + (p.growthCurve === 'late' ? F.lateShift : 0) - age) / F.window, 0, 1) * Math.min(1, p.developmentRate);
  const reachable = ability + Math.max(0, p.upside - ability) * room;
  const estimate = reachable + (p.observerBias || 0) / (1 + yearIndex) + normal(r) * F.noise;
  return previousRaw * (1 - F.weight) + estimate * F.weight;
}

/**
 * Wins above replacement, a simple estimate from the season line (not an official formula).
 * Hitters: linear-weight batting runs + position + fielding + steals + replacement level.
 * Pitchers: runs allowed per nine against a replacement pitcher for the role.
 */
function warOf(stats, p, tools) {
  const W = T.war;
  if (!stats.games) return 0;
  if (stats.kind === 'pitcher') {
    const P = W.pitching,
      ip = stats.outs / 3;
    if (!ip) return 0;
    const replacement = P.leagueRA9 + (stats.gs >= stats.games / 2 ? P.replacement.SP : P.replacement.RP);
    return round(((replacement - stats.era * P.eraToRA) * ip) / 9 / W.runsPerWin, 1);
  }
  const H = W.hitting,
    w = H.weights,
    singles = stats.hits - stats.doubles - stats.triples - stats.hr;
  if (!stats.pa) return 0;
  const woba = (w.bb * stats.bb + w.single * singles + w.double * stats.doubles + w.triple * stats.triples + w.hr * stats.hr) / stats.pa;
  const share = stats.games / H.seasonGames;
  const runs =
    ((woba - H.league) / H.scale) * stats.pa +
    H.position[p.role] * share +
    (tools.defense - 50) * H.perDefense * share +
    stats.sb * H.perSB +
    (H.replacementPer600 * stats.pa) / 600;
  return round(runs / W.runsPerWin, 1);
}

const SERVICE_LABELS = { sangmu: __i18n_k("draftroom.season.sERVICE_LABELS.sangmu.b6946340"), army: __i18n_k("draftroom.season.sERVICE_LABELS.army.da54d3e7"), social: __i18n_k("draftroom.season.sERVICE_LABELS.social.454485ce") };
const SERVICE_NOTES = {
  sangmu: [__i18n_k("draftroom.season.sERVICE_NOTES.sangmu.f843722d"), __i18n_k("draftroom.season.sERVICE_NOTES.sangmu.ca523a1f"), __i18n_k("draftroom.season.sERVICE_NOTES.sangmu.676e9ddc")],
  army: [__i18n_k("draftroom.season.sERVICE_NOTES.army.130edc42"), __i18n_k("draftroom.season.sERVICE_NOTES.army.3c5e6e99"), __i18n_k("draftroom.season.sERVICE_NOTES.army.c0406fae")],
  social: [__i18n_k("draftroom.season.sERVICE_NOTES.social.b7128803"), __i18n_k("draftroom.season.sERVICE_NOTES.social.ce0614b7")],
};

/** A season spent in military service. Sangmu plays a futures season; other service loses some sharpness. */
function serviceSeason(p, selection, g, team, previous, yearIndex, type, focus = 'balanced') {
  const tag = (stream) => `${g.seed}-${stream}-v6-${yearIndex}-${p.id}`;
  const tools = { ...previous.tools },
    abilityBefore = G.overall(tools, p.role);
  const age = D.bio.ageAt(p.birthday, `${D.bio.ENTRY_YEAR + yearIndex}-12-31`);
  let after, futures;
  if (type === 'sangmu') {
    after = developTools(p, tools, yearIndex, age, 0, rng(tag('growth')), 0, focus);
    futures = statsFor(p, futuresGames(p, 'futures', 0, 0, rng(tag('performance'))), tools, 'futures', rng(tag('farm')), { teamRank: team.rank });
  } else {
    const r = rng(tag('growth')),
      [base, width] = T.service.decline[type];
    after = Object.fromEntries(
      Object.entries(tools).map(([k, v]) => [k, round(clamp(v - (base + r() * width) * (k === 'stuff' || k === 'speed' ? T.service.declineHeavy : 1), 20, 80), 3)]),
    );
    futures = emptyStats(p);
  }
  const abilityAfter = G.overall(after, p.role),
    growth = round(abilityAfter - abilityBefore, 2),
    observed = G.observe(after, p.role, p, yearIndex + 1, rng(tag('report')));
  const fvRaw = fvUpdate(p, abilityAfter, age, yearIndex, previous.fvRaw ?? p.scoutCeiling, rng(tag('fv')));
  const scoutFV = Math.max(observed.ready, G.grade(fvRaw));
  return {
    playerId: p.id,
    label: selection.label,
    year: D.bio.ENTRY_YEAR + yearIndex,
    teamId: team.id,
    age,
    role: p.role,
    route: 'service',
    serviceType: type,
    roleTier: 'service',
    routeLabel: SERVICE_LABELS[type],
    stats: emptyStats(p),
    futures,
    growth,
    growthLabel: growthLabel(growth),
    velocity: seasonVelocity(p, after, rng(tag('velocity'))),
    developmentNote: __i18n_k("draftroom.season.serviceSeason.developmentNote.7605ddf8", { value: SERVICE_LABELS[type], scoutReady: previous.scoutReady, ready: observed.ready }),
    note: pickLine(SERVICE_NOTES[type], rng(tag('text'))),
    routeReason: 'service',
    limited: false,
    daysLost: 0,
    contribution: 0,
    war: 0,
    planScore: null,
    target: __i18n_k("draftroom.season.serviceSeason.target.0685b692"),
    unexpected: false,
    startGrade: previous.scoutReady,
    startTools: { ...previous.publicTools },
    publicTools: observed.tools,
    scoutReady: observed.ready,
    scoutFV,
    endState: {
      ability: round(abilityAfter, 3),
      tools: after,
      publicTools: observed.tools,
      scoutReady: observed.ready,
      scoutFV,
      fvRaw: round(fvRaw, 3),
      route: 'service',
      roleTier: 'service',
      limited: false,
      daysLost: 0,
      age,
      performance: 0,
    },
  };
}

// ---------------------------------------------------------------- one season

/**
 * Simulates one season for player `p`.
 * previous: last year's end state (null in the rookie year); context: { blockedRegular, closer }.
 */
function simulatePlayer(p, selection, g, team, fit, previous = null, yearIndex = 0, context = {}) {
  const tag = (stream, withTeam) => `${g.seed}-${stream}-v6-${yearIndex}-${p.id}${withTeam ? '-' + team.id : ''}`;
  const perf = rng(tag('performance', true)); // role, playing time, futures games (in that order)
  const tools = { ...(previous?.tools || p.trueTools) },
    abilityBefore = G.overall(tools, p.role),
    pitcher = isPitcher(p);

  // A two-way player's second side shares the injury of the first.
  const { limited, daysLost } = context.health || rollHealth(p, rng(tag('health')));
  const growR = rng(tag('growth'));
  const impact = abilityBefore + normal(perf) * T.roles.impactNoise - (context.impactShift || 0);
  const { route, reason, core, investment } = decideRole(
    { impact, previous, yearIndex, round: selection.round, fit, daysLost, blockedRegular: context.blockedRegular },
    perf,
  );
  // Days away (service ending mid-season) cut playing time and growth like injury days, but are not injuries.
  const missed = Math.min(T.health.playingDays, daysLost + (context.absentDays || 0));
  const games = firstTeamGames(p, route, yearIndex, missed, perf, context.gamesScale ?? 1);
  const stats = statsFor(p, games, tools, route === 'regular' ? 'regular' : 'major', rng(tag('counting', true)), {
    core,
    cameo: route === 'cameo',
    closer: context.closer,
    teamRank: team.rank,
  });

  const age = D.bio.ageAt(p.birthday, `${D.bio.ENTRY_YEAR + yearIndex}-12-31`);
  const after = developTools(p, tools, yearIndex, age, missed, growR, context.growthBoost || 0, context.focus, context.growthScale ?? 1);
  const abilityAfter = G.overall(after, p.role),
    growth = round(abilityAfter - abilityBefore, 2),
    observed = G.observe(after, p.role, p, yearIndex + 1, rng(tag('report')));

  const farmGames = futuresGames(p, route, games, missed, perf, context.gamesScale ?? 1);
  const futures = statsFor(p, farmGames, tools, 'futures', rng(tag('farm')), { teamRank: team.rank });

  const startGrade = previous?.scoutReady ?? p.ready,
    startTools = previous?.publicTools ?? p.tools;
  const planScore = planScoreOf(p, { startGrade, growth, yearIndex, games, route, daysLost });
  const roleTier = core ? 'core' : route;
  const bestTool = Object.keys(after).sort((a, b) => after[b] - tools[b] - (after[a] - tools[a]))[0];
  const note = (context.absentDays ? pickLine(RETURN_NOTES, rng(tag('return-text'))) + ' ' : '') + reasonText(reason, daysLost, investment, rng(tag('text')));
  const fvRaw = fvUpdate(p, abilityAfter, age, yearIndex, previous?.fvRaw ?? p.scoutCeiling, rng(tag('fv')));

  return {
    playerId: p.id,
    label: selection.label,
    year: D.bio.ENTRY_YEAR + yearIndex,
    teamId: team.id,
    role: p.role,
    age,
    route,
    roleTier,
    routeLabel: routeLabel(route, core, pitcher),
    stats,
    futures,
    growth,
    growthLabel: growthLabel(growth),
    velocity: seasonVelocity(p, after, rng(tag('velocity'))),
    developmentNote: __i18n_k("draftroom.season.simulatePlayer.developmentNote.2b6b64f7", { value: G.LABELS[bestTool], startGrade: startGrade, ready: observed.ready }),
    note,
    routeReason: reason,
    limited,
    daysLost,
    contribution: round(contributionOf(stats, tools)),
    war: warOf(stats, p, tools),
    planScore,
    target: p.ready >= 45 ? __i18n_k("draftroom.season.simulatePlayer.target.f392c1d0") : __i18n_k("draftroom.season.simulatePlayer.target.606e3b7d"),
    unexpected: route === 'regular' && selection.round >= 4,
    startGrade,
    startTools: { ...startTools },
    publicTools: observed.tools,
    scoutReady: observed.ready,
    scoutFV: Math.max(observed.ready, G.grade(fvRaw)),
    endState: {
      ability: round(abilityAfter, 3),
      tools: after,
      publicTools: observed.tools,
      scoutReady: observed.ready,
      scoutFV: Math.max(observed.ready, G.grade(fvRaw)),
      fvRaw: round(fvRaw, 3),
      route,
      roleTier,
      limited,
      daysLost,
      age,
      performance: performanceOf(stats),
    },
  };
}

/** First-year owner evaluation: need coverage, plan scores and future value. */
function evaluate(g, season, players, team) {
  const F = T.firstYear;
  const roles = new Set(players.map((p) => p.role));
  const needScore = round(S.needCoverage(players, team));
  const production = round(mean(season.map((s) => s.planScore))),
    future = round(clamp(F.future.base + (mean(players.map((p) => p.scoutCeiling)) - F.future.fvPivot) * F.future.perFV + mean(season.map((s) => s.growth)) * F.future.perGrowth, 0, 100)),
    score = round(needScore * F.weights.need + production * F.weights.plan + future * F.weights.future);
  const majorCount = season.filter((s) => s.stats.games > 0).length,
    regularCount = season.filter((s) => s.route === 'regular').length;
  return {
    score,
    grade: letter(score, F.gradeCuts),
    needScore,
    production,
    future,
    text: __i18n_k("draftroom.season.evaluate.text.dab4c292"),
    missing: team.needs.filter((role) => !roles.has(role)).map((role) => D.ROLES[role]),
    majorCount,
    regularCount,
    developmentCount: season.length - majorCount,
    planMessage: __i18n_k("draftroom.season.evaluate.planMessage.5d1fdf94", { majorCount: majorCount, regularCount: regularCount }),
  };
}

const api = { simulatePlayer, serviceSeason, warOf, focusFactor, isPitcher, SERVICE_LABELS, evaluate, emptyStats, statsFor, decideRole, developTools, planScoreOf };
export default api;
