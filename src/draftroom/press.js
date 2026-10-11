import { k as __i18n_k } from '../i18n/index.js';
/* Fictional media and fans. Inputs are allowlisted public projections, never hidden ability or future results. */
// Ported from KBO-Draft-Room df4faad src/core/press.js. See docs/UPSTREAM.md.
import DraftWriter from './writer.js';
import DraftData from './prospects.js';
import DraftRules from './draft-ai.js';

const W = DraftWriter;
const D = DraftData,
  R = DraftRules,
  K = D.ko;
const OUTLETS = [
  { id: 'diamond', name: __i18n_k("draftroom.press.oUTLETS.name.ade052a3"), style: __i18n_k("draftroom.press.oUTLETS.style.137b0f85"), ready: 0.68 },
  { id: 'future', name: __i18n_k("draftroom.press.oUTLETS.name.2b099404"), style: __i18n_k("draftroom.press.oUTLETS.style.da0f8aeb"), ready: 0.25 },
];
function forecast(players, teams, local, seed) {
  return OUTLETS.map((outlet) => {
    const r = D.rng(seed + '-mock-' + outlet.id),
      text = D.rng(seed + '-mock-text-' + outlet.id), // wording only; `r` drives the picks
      used = new Set(),
      picks = [];
    for (const round of local ? [0, 1] : [1])
      for (const t of teams) {
        const list = players.filter(
          (p) => !used.has(p.id) && (round !== 0 || (p.regionalEligible && p.region === t.region)),
        );
        const prior = picks
          .filter((s) => s.teamId === t.id)
          .map((s) => players.find((p) => p.id === s.playerId).role);
        const p = list
          .map((p) => ({
            p,
            score:
              (p.ready * outlet.ready + p.scoutCeiling * (1 - outlet.ready)) * 0.7 +
              p.publicScore * 0.2 +
              R.fit(p, t) * 0.1 -
              (prior.includes(p.role) ? 3 : 0) +
              (r() - 0.5) * 4,
          }))
          .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))[0]?.p;
        if (!p) throw Error('모의 드래프트 후보가 부족합니다.');
        used.add(p.id);
        picks.push({
          teamId: t.id,
          round,
          playerId: p.id,
          reason: W.mockReason(p, outlet.id, text),
        });
      }
    return { id: outlet.id, name: outlet.name, style: outlet.style, picks };
  });
}
function news(players, teams, selection, prior, forecasts, seed) {
  const p = players.find((p) => p.id === selection.playerId),
    t = teams.find((t) => t.id === selection.teamId),
    used = new Set(prior.map((x) => x.playerId));
  const available = players
    .filter(
      (q) => !used.has(q.id) && (selection.round !== 0 || (q.regionalEligible && q.region === t.region)),
    )
    .sort((a, b) => a.rank - b.rank);
  const remainingRank = available.findIndex((q) => q.id === p.id) + 1,
    fit = R.fit(p, t),
    owned = prior.filter(
      (s) => s.teamId === t.id && players.find((q) => q.id === s.playerId).role === p.role,
    ).length;
  const matched = forecasts
    .filter((f) =>
      f.picks.some((s) => s.teamId === t.id && s.round === selection.round && s.playerId === p.id),
    )
    .map((f) => f.name);
  const reach = remainingRank > (selection.round === 0 ? 5 : 12),
    // National pick number: the regional round is not part of the order.
    nationalPick = selection.overall - prior.filter((s) => s.round === 0).length,
    value = selection.round === 1 && p.rank <= nationalPick - 5;
  const label = selection.round === 0 ? __i18n_k("draftroom.press.news.label.e8a3b15a") : __i18n_k("draftroom.press.news.label.06780eed"),
    r = D.rng(seed + '-news-' + selection.overall),
    role = D.ROLES[p.role];
  // Wording draws from its own stream; `r` below only moves fan mood.
  const written = W.draftNews(
    p,
    t,
    selection,
    { reach, value, matched, fit, owned, local: selection.round === 0, remainingRank, nationalPick },
    D.rng(seed + '-news-text-' + selection.overall),
  );
  const delta = D.clamp(
    (fit >= 80 ? 2 : fit >= 60 ? 1 : -1) +
      (matched.length ? 2 : 0) +
      (value ? 1 : 0) -
      (reach ? 2 : 0) -
      (owned ? 1 : 0) +
      Math.floor(r() * 3) -
      1,
    -5,
    5,
  );
  return {
    id: 'pick-' + selection.overall,
    overall: selection.overall,
    teamId: t.id,
    playerId: p.id,
    round: selection.round,
    label,
    ...written,
    delta,
    reason: __i18n_k("draftroom.press.news.reason.9220ef0e", { label: label, value: matched.length ? __i18n_k("draftroom.press.news.reason.f7029001") : __i18n_k("draftroom.press.news.reason.94a21c21"), value2: fit >= 60 ? __i18n_k("draftroom.press.news.reason.5abacea2") : __i18n_k("draftroom.press.news.reason.1cfdb8d4"), value3: reach ? __i18n_k("draftroom.press.news.reason.6df005ff") : '' }),
  };
}
const GM_CHOICES = [
  {
    id: 'immediate',
    title: __i18n_k("draftroom.press.gM_CHOICES.title.852ae143"),
    answer:
      __i18n_k("draftroom.press.gM_CHOICES.answer.6f43934c"),
    promise: __i18n_k("draftroom.press.gM_CHOICES.promise.4a7ac133"),
    risk: __i18n_k("draftroom.press.gM_CHOICES.risk.48018579"),
  },
  {
    id: 'development',
    title: __i18n_k("draftroom.press.gM_CHOICES.title.736e4132"),
    answer:
      __i18n_k("draftroom.press.gM_CHOICES.answer.1b0aa82e"),
    promise: __i18n_k("draftroom.press.gM_CHOICES.promise.5f7bce7d"),
    risk: __i18n_k("draftroom.press.gM_CHOICES.risk.5f13a627"),
  },
  {
    id: 'needs',
    title: __i18n_k("draftroom.press.gM_CHOICES.title.ff43ddc3"),
    answer:
      __i18n_k("draftroom.press.gM_CHOICES.answer.f0d338d9"),
    promise: __i18n_k("draftroom.press.gM_CHOICES.promise.5b324d14"),
    risk: __i18n_k("draftroom.press.gM_CHOICES.risk.4fc826a3"),
  },
  {
    id: 'core5',
    title: __i18n_k("draftroom.press.gM_CHOICES.title.4159bced"),
    answer: __i18n_k("draftroom.press.gM_CHOICES.answer.ee2a54d0"),
    promise: __i18n_k("draftroom.press.gM_CHOICES.promise.03b5f11f"),
    risk: __i18n_k("draftroom.press.gM_CHOICES.risk.2de6b69d"),
  },
];
function gmOptions(players, team) {
  const prospects = players.filter((p) => p.ready >= 45 || p.scoutCeiling >= 55).length;
  const ready = players.filter((p) => p.ready >= 45).length,
    development = players.length - ready,
    covered = team.needs.filter((role) => players.some((p) => p.role === role)).length;
  return GM_CHOICES.map((c) => ({
    ...c,
    delta:
      c.id === 'immediate'
        ? ready >= 2
          ? 5
          : -3
        : c.id === 'development'
          ? development >= Math.ceil(players.length / 2)
            ? 3
            : -1
          : c.id === 'core5'
            ? prospects >= 3
              ? 2
              : -1
            : covered === 3
            ? 4
            : covered === 2
              ? 1
              : -2,
    reaction:
      c.id === 'immediate'
        ? __i18n_k("draftroom.press.gmOptions.reaction.9bbf7c93", { ready: ready })
        : c.id === 'development'
          ? __i18n_k("draftroom.press.gmOptions.reaction.2853cf6d", { development: development })
          : c.id === 'core5'
            ? __i18n_k("draftroom.press.gmOptions.reaction.24b7839d", { prospects: prospects })
          : __i18n_k("draftroom.press.gmOptions.reaction.42cff18f", { covered: covered }),
  }));
}
function accountability(choice, players, season, team) {
  const major = season.filter((s) => s.stats.games > 0).length,
    good = season.filter((s) => s.planScore >= 70).length,
    target = Math.ceil(players.length * 0.6),
    covered = team.needs.filter((role) => players.some((p) => p.role === role)).length;
  const useful = season.filter(
    (s) => s.planScore >= 70 && team.needs.includes(players.find((p) => p.id === s.playerId).role),
  ).length;
  let bonus = 0,
    detail = '';
  if (choice === 'core5') return { bonus: 0, detail: __i18n_k("draftroom.press.accountability.detail.be0cadb2"), status: __i18n_k("draftroom.press.accountability.status.f80ebdaf") };
  if (choice === 'immediate') {
    bonus = major >= 2 ? 4 : major === 1 ? 0 : -4;
    detail = __i18n_k("draftroom.press.accountability.c3ebeb2e", { major: major });
  }
  if (choice === 'development') {
    bonus = good >= target ? 3 : good === target - 1 ? 0 : -3;
    detail = __i18n_k("draftroom.press.accountability.6fafc4ec", { good: good, target: target });
  }
  if (choice === 'needs') {
    bonus = covered === 3 && useful >= 2 ? 4 : covered >= 2 && useful >= 1 ? 0 : -3;
    detail = __i18n_k("draftroom.press.accountability.035699cc", { covered: covered, useful: useful });
  }
  return { bonus, detail, status: bonus > 0 ? __i18n_k("draftroom.press.accountability.status.c0b79311") : bonus < 0 ? __i18n_k("draftroom.press.accountability.status.fbe9680a") : __i18n_k("draftroom.press.accountability.status.3422d235") };
}
/**
 * The press conference's first two questions. `first`: our first signed pick (public projection) or null;
 * `refused`: names of our picks who refused to sign; `spentShare`: share of the budget committed.
 */
function gmQuestions({ first, firstLabel, refused, spentShare, boost, team }) {
  const out = [];
  if (first) {
    const f = R.fit(first, team);
    out.push({
      id: 'first',
      question: __i18n_k("draftroom.press.gmQuestions.question.ffd699cd", { firstLabel: firstLabel, name: first.name, value: K.particle(first.name, __i18n_k("draftroom.press.gmQuestions.question.c57d3d52")) }),
      options: [
        { id: 'now', title: __i18n_k("draftroom.press.options.title.128688ba"), answer: __i18n_k("draftroom.press.options.answer.71d94b8a"), delta: first.ready >= 45 ? 2 : -1, pledge: __i18n_k("draftroom.press.options.pledge.6e117eff", { name: first.name }) },
        { id: 'project', title: __i18n_k("draftroom.press.options.title.3f45edfa"), answer: __i18n_k("draftroom.press.options.answer.91c81b5a"), delta: first.scoutCeiling >= 55 ? 2 : 0, pledge: __i18n_k("draftroom.press.options.pledge.526677f8", { name: first.name }) },
        { id: 'fit', title: __i18n_k("draftroom.press.options.title.dc2db6ff"), answer: __i18n_k("draftroom.press.options.answer.585179ef"), delta: f >= 80 ? 3 : -2, pledge: null },
      ],
    });
  }
  if (refused.length)
    out.push({
      id: 'issue',
      question: __i18n_k("draftroom.press.gmQuestions.question.a7006970", { value: refused.join(', ') }),
      options: [
        { id: 'apologize', title: __i18n_k("draftroom.press.options.title.81162fa8"), answer: __i18n_k("draftroom.press.options.answer.e18fb342"), delta: 1, pledge: null },
        { id: 'respect', title: __i18n_k("draftroom.press.options.title.41479935"), answer: __i18n_k("draftroom.press.options.answer.ec0cc003"), delta: -1, pledge: null },
        { id: 'principle', title: __i18n_k("draftroom.press.options.title.7455c818"), answer: __i18n_k("draftroom.press.options.answer.1b48a25e"), delta: boost >= 0.05 ? 1 : -2, pledge: null },
      ],
    });
  else if (spentShare >= 0.95)
    out.push({
      id: 'issue',
      question: __i18n_k("draftroom.press.gmQuestions.question.e77f6715"),
      options: [
        { id: 'worth', title: __i18n_k("draftroom.press.options.title.401963f6"), answer: __i18n_k("draftroom.press.options.answer.867abb4d"), delta: 1, pledge: null },
        { id: 'sorry', title: __i18n_k("draftroom.press.options.title.8598773d"), answer: __i18n_k("draftroom.press.options.answer.a4b1fbac"), delta: 0, pledge: null },
      ],
    });
  else
    out.push({
      id: 'issue',
      question: __i18n_k("draftroom.press.gmQuestions.question.46fe8134"),
      options: [
        { id: 'develop', title: __i18n_k("draftroom.press.options.title.c6e7ae80"), answer: __i18n_k("draftroom.press.options.answer.f04620cc"), delta: 2, pledge: null },
        { id: 'save', title: __i18n_k("draftroom.press.options.title.7443de5d"), answer: __i18n_k("draftroom.press.options.answer.0f37e30c"), delta: -1, pledge: null },
      ],
    });
  return out;
}

const api = { OUTLETS, GM_CHOICES, forecast, news, gmOptions, gmQuestions, accountability };
export default api;
