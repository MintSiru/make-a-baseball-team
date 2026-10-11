import { k as __i18n_k } from '../i18n/index.js';
/* Writer: scouting notes, draft news, fan comments and mock-draft blurbs.

   Rules for everything in here:
   - Only public information (the scouting projection, amateur records, velocity), never hidden ability.
   - Every choice of wording draws from a text-only random stream passed in by the caller. Text streams never
     feed the simulation, so wording can change freely without changing any result or old save.
   - Write like a scout's notebook, a sports desk or a fan forum. No hedging boilerplate. */
// Ported from KBO-Draft-Room df4faad src/core/writer.js. See docs/UPSTREAM.md.
import DraftKo from './ko.js';
import DraftGrades from './grades.js';
import DraftBio from './biography.js';

const K = DraftKo,
  G = DraftGrades,
  Bio = DraftBio;
const ROLES = G.ROLES;

const one = (list, r) => list[Math.floor(r() * list.length)];
/** Up to n distinct items, in random order. */
function some(list, n, r) {
  const pool = [...list],
    out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}
const fill = (text, vars) => text.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (_, k, pair) => (pair ? K.p(vars[k], pair) : vars[k]));
const isPitcher = (p) => p.role === 'SP' || p.role === 'RP';

// ------------------------------------------------------------ scouting notes (강점 / 과제)

// Pitch the breaking-ball line talks about, from the archetype index (see ARCHETYPES in prospects.js).
const pitchName = (p) => (p.role === 'SP' ? [__i18n_k("draftroom.writer.pitchName.18bc88bf"), __i18n_k("draftroom.writer.pitchName.18bc88bf"), __i18n_k("draftroom.writer.pitchName.49e1dacd"), __i18n_k("draftroom.writer.pitchName.c2a8d278"), __i18n_k("draftroom.writer.pitchName.2ab848c1")] : [__i18n_k("draftroom.writer.pitchName.18bc88bf"), __i18n_k("draftroom.writer.pitchName.18bc88bf"), __i18n_k("draftroom.writer.pitchName.18bc88bf"), __i18n_k("draftroom.writer.pitchName.7390f5bb"), __i18n_k("draftroom.writer.pitchName.a8a41ff9")])[p.type] ?? __i18n_k("draftroom.writer.pitchName.18bc88bf");

const GOOD = {
  stuff: [__i18n_k("draftroom.writer.gOOD.stuff.1467845b"), __i18n_k("draftroom.writer.gOOD.stuff.7516a094"), __i18n_k("draftroom.writer.gOOD.stuff.00355158"), __i18n_k("draftroom.writer.gOOD.stuff.447e6f21")],
  command: [__i18n_k("draftroom.writer.gOOD.command.a019c12f"), __i18n_k("draftroom.writer.gOOD.command.6709de76"), __i18n_k("draftroom.writer.gOOD.command.6778a5b4"), __i18n_k("draftroom.writer.gOOD.command.4ce7beba")],
  breaking: [__i18n_k("draftroom.writer.gOOD.breaking.6e6e4aa5"), __i18n_k("draftroom.writer.gOOD.breaking.3d26ec8b"), __i18n_k("draftroom.writer.gOOD.breaking.d2293971"), __i18n_k("draftroom.writer.gOOD.breaking.aab2e655")],
  stamina: [__i18n_k("draftroom.writer.gOOD.stamina.bc4f736d"), __i18n_k("draftroom.writer.gOOD.stamina.f5426a5d"), __i18n_k("draftroom.writer.gOOD.stamina.e1d0feee")],
  contact: [__i18n_k("draftroom.writer.gOOD.contact.631a2993"), __i18n_k("draftroom.writer.gOOD.contact.c8b151b6"), __i18n_k("draftroom.writer.gOOD.contact.f2962263"), __i18n_k("draftroom.writer.gOOD.contact.cdcda0c8")],
  power: [__i18n_k("draftroom.writer.gOOD.power.bce8716f"), __i18n_k("draftroom.writer.gOOD.power.1be17431"), __i18n_k("draftroom.writer.gOOD.power.e2a4956f")],
  speed: [__i18n_k("draftroom.writer.gOOD.speed.9a009331"), __i18n_k("draftroom.writer.gOOD.speed.bb544c83"), __i18n_k("draftroom.writer.gOOD.speed.d601a45c")],
  eye: [__i18n_k("draftroom.writer.gOOD.eye.2ccffce6"), __i18n_k("draftroom.writer.gOOD.eye.1f4919d9")],
  defenseC: [__i18n_k("draftroom.writer.gOOD.defenseC.010d2119"), __i18n_k("draftroom.writer.gOOD.defenseC.e2a6dbb2"), __i18n_k("draftroom.writer.gOOD.defenseC.d7ddcf0b")],
  defenseIF: [__i18n_k("draftroom.writer.gOOD.defenseIF.002cd44e"), __i18n_k("draftroom.writer.gOOD.defenseIF.02063b61"), __i18n_k("draftroom.writer.gOOD.defenseIF.ad5ad6c9")],
  defenseOF: [__i18n_k("draftroom.writer.gOOD.defenseOF.c4ae253b"), __i18n_k("draftroom.writer.gOOD.defenseOF.9b458f92"), __i18n_k("draftroom.writer.gOOD.defenseOF.d3856d51")],
};
const BAD = {
  stuff: [__i18n_k("draftroom.writer.bAD.stuff.c030f978"), __i18n_k("draftroom.writer.bAD.stuff.ebfc6afe")],
  command: [__i18n_k("draftroom.writer.bAD.command.754dd81a"), __i18n_k("draftroom.writer.bAD.command.86a3831d"), __i18n_k("draftroom.writer.bAD.command.03e04c5b")],
  breaking: [__i18n_k("draftroom.writer.bAD.breaking.3109d24f"), __i18n_k("draftroom.writer.bAD.breaking.103b702f"), __i18n_k("draftroom.writer.bAD.breaking.e9db6add")],
  stamina: [__i18n_k("draftroom.writer.bAD.stamina.d15ab983"), __i18n_k("draftroom.writer.bAD.stamina.277ae859")],
  contact: [__i18n_k("draftroom.writer.bAD.contact.4958c2c2"), __i18n_k("draftroom.writer.bAD.contact.81bc3a99"), __i18n_k("draftroom.writer.bAD.contact.318dd4a9")],
  power: [__i18n_k("draftroom.writer.bAD.power.fc173001"), __i18n_k("draftroom.writer.bAD.power.4b6f95be")],
  speed: [__i18n_k("draftroom.writer.bAD.speed.bd9d2ca9"), __i18n_k("draftroom.writer.bAD.speed.dfc6e4e4")],
  eye: [__i18n_k("draftroom.writer.bAD.eye.a424d7a4")],
  defenseC: [__i18n_k("draftroom.writer.bAD.defenseC.03e5e1a4"), __i18n_k("draftroom.writer.bAD.defenseC.c4bf77fa")],
  defenseIF: [__i18n_k("draftroom.writer.bAD.defenseIF.30546638"), __i18n_k("draftroom.writer.bAD.defenseIF.75c4348a")],
  defenseOF: [__i18n_k("draftroom.writer.bAD.defenseOF.864a0814"), __i18n_k("draftroom.writer.bAD.defenseOF.b0948177")],
};
const noteKey = (p, tool) => (tool === 'defense' ? 'defense' + (p.role === 'C' ? 'C' : p.role === 'IF' ? 'IF' : 'OF') : tool);

// Grade 45–50: solid but not a carrying tool.
const FAIR = {
  stuff: [__i18n_k("draftroom.writer.fAIR.stuff.2af6a2f0"), __i18n_k("draftroom.writer.fAIR.stuff.3efef538"), __i18n_k("draftroom.writer.fAIR.stuff.234d6a29")],
  command: [__i18n_k("draftroom.writer.fAIR.command.bca856af"), __i18n_k("draftroom.writer.fAIR.command.ae5bb10f"), __i18n_k("draftroom.writer.fAIR.command.13b0ca8c")],
  breaking: [__i18n_k("draftroom.writer.fAIR.breaking.c1fb0978"), __i18n_k("draftroom.writer.fAIR.breaking.78d6742f"), __i18n_k("draftroom.writer.fAIR.breaking.b8b761d8")],
  stamina: [__i18n_k("draftroom.writer.fAIR.stamina.270c320f"), __i18n_k("draftroom.writer.fAIR.stamina.059d1fed")],
  contact: [__i18n_k("draftroom.writer.fAIR.contact.91a37e09"), __i18n_k("draftroom.writer.fAIR.contact.4b7f0adf"), __i18n_k("draftroom.writer.fAIR.contact.f1a3d24d")],
  power: [__i18n_k("draftroom.writer.fAIR.power.3523bbe4"), __i18n_k("draftroom.writer.fAIR.power.4e1cce08")],
  speed: [__i18n_k("draftroom.writer.fAIR.speed.38a39aa2"), __i18n_k("draftroom.writer.fAIR.speed.32b5595f")],
  eye: [__i18n_k("draftroom.writer.fAIR.eye.348ffa0d")],
  defenseC: [__i18n_k("draftroom.writer.fAIR.defenseC.d7296dec"), __i18n_k("draftroom.writer.fAIR.defenseC.5e675abb")],
  defenseIF: [__i18n_k("draftroom.writer.fAIR.defenseIF.18484ea8"), __i18n_k("draftroom.writer.fAIR.defenseIF.67919083")],
  defenseOF: [__i18n_k("draftroom.writer.fAIR.defenseOF.586a8bdf"), __i18n_k("draftroom.writer.fAIR.defenseOF.95dcdf75")],
};
const PLAIN = [__i18n_k("draftroom.writer.pLAIN.3e410664"), __i18n_k("draftroom.writer.pLAIN.1f2bbe6f"), __i18n_k("draftroom.writer.pLAIN.72915dbb"), __i18n_k("draftroom.writer.pLAIN.2a09c05c")];
const UPSIDE = [__i18n_k("draftroom.writer.uPSIDE.b62ace8f"), __i18n_k("draftroom.writer.uPSIDE.a46f702a"), __i18n_k("draftroom.writer.uPSIDE.f5cc4bdb"), __i18n_k("draftroom.writer.uPSIDE.b631d88e")];
const READY = { pitcher: [__i18n_k("draftroom.writer.rEADY.pitcher.32a5164c"), __i18n_k("draftroom.writer.rEADY.pitcher.833de4d3")], hitter: [__i18n_k("draftroom.writer.rEADY.hitter.7df9ce7c"), __i18n_k("draftroom.writer.rEADY.hitter.4a7b3913")] };
const SHORT = [__i18n_k("draftroom.writer.sHORT.6d3c7db2"), __i18n_k("draftroom.writer.sHORT.6e0768cd"), __i18n_k("draftroom.writer.sHORT.b3c51ec0")];
const SLOW = [__i18n_k("draftroom.writer.sLOW.d9ef3159"), __i18n_k("draftroom.writer.sLOW.d9dd29ed"), __i18n_k("draftroom.writer.sLOW.6e72d4e7")];

/** Strength and development-task lines from the public tool grades, projections and velocity. */
function scoutNotes(p, r) {
  const pitcher = isPitcher(p);
  const tools = Object.entries(p.tools).filter(([k]) => k !== 'eye' || !pitcher);
  const byGrade = [...tools].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [bestTool, bestGrade] = byGrade[0],
    [worstTool, worstGrade] = byGrade.at(-1);
  const [growTool, growBy] = tools.map(([k, v]) => [k, (p.futureTools?.[k] ?? v) - v]).sort((a, b) => b[1] - a[1])[0];
  const vars = { pitch: pitchName(p), tool: G.LABELS[bestTool], grow: G.LABELS[growTool], v: p.velocity };

  const strength = [];
  if (pitcher && p.velocity >= 148) strength.push(__i18n_k("draftroom.writer.scoutNotes.ae54167c", { velocity: p.velocity }));
  strength.push(fill(one(bestGrade >= 55 ? GOOD[noteKey(p, bestTool)] : bestGrade >= 45 ? FAIR[noteKey(p, bestTool)] : PLAIN, r), vars));
  if (p.pickTags?.includes('즉전감')) strength.push(one(READY[pitcher ? 'pitcher' : 'hitter'], r));
  else if (growBy >= 10 || p.pickTags?.includes('실링')) strength.push(fill(one(UPSIDE, r), vars));

  let weakness;
  if (pitcher && p.velocity <= 141) weakness = fill(one(SLOW, r), vars);
  else if (pitcher && p.velocity >= 147 && p.tools.stuff <= 40 && p.tools.command > 30)
    weakness = one([__i18n_k("draftroom.writer.scoutNotes.9c856fbb"), __i18n_k("draftroom.writer.scoutNotes.d19b985d")], r);
  else if (worstGrade >= 50) weakness = __i18n_k("draftroom.writer.scoutNotes.e08573d9");
  else if (worstGrade >= 40) weakness = fill(one(SHORT, r), { ...vars, tool: G.LABELS[worstTool] });
  else weakness = fill(one(BAD[noteKey(p, worstTool)], r), vars);
  return { strength: strength.join(' '), weakness };
}

// ------------------------------------------------------------ mock drafts

const TOOL_ADJ = { stuff: __i18n_k("draftroom.writer.tOOL_ADJ.stuff.9dee11e2"), command: __i18n_k("draftroom.writer.tOOL_ADJ.command.f5f047ce"), breaking: __i18n_k("draftroom.writer.tOOL_ADJ.breaking.53040e3b"), stamina: __i18n_k("draftroom.writer.tOOL_ADJ.stamina.e2bad391"),
  contact: __i18n_k("draftroom.writer.tOOL_ADJ.contact.661891e7"), power: __i18n_k("draftroom.writer.tOOL_ADJ.power.2bdc24d8"), speed: __i18n_k("draftroom.writer.tOOL_ADJ.speed.f04b628d"), defense: __i18n_k("draftroom.writer.tOOL_ADJ.defense.f39d0532"), eye: __i18n_k("draftroom.writer.tOOL_ADJ.eye.100944ba") };
function mockReason(p, outletId, r) {
  const tag = p.pickTags[0];
  const [best] = Object.entries(p.tools).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const now = [__i18n_k("draftroom.writer.mockReason.now.1c289a6b"), __i18n_k("draftroom.writer.mockReason.now.0ae849e8"), __i18n_k("draftroom.writer.mockReason.now.829ddd39"), __i18n_k("draftroom.writer.mockReason.now.cbf263d5")];
  const later = [__i18n_k("draftroom.writer.mockReason.later.3f3bf381"), __i18n_k("draftroom.writer.mockReason.later.b2e29bd0"), __i18n_k("draftroom.writer.mockReason.later.f6aa3cee"), __i18n_k("draftroom.writer.mockReason.later.e4332752")];
  const role = isPitcher(p) && p.velocity >= 147 ? __i18n_k("draftroom.writer.mockReason.role.f72c195d", { velocity: p.velocity, value: ROLES[p.role] }) : `${TOOL_ADJ[best]} ${ROLES[p.role]}.`;
  return __i18n_k("draftroom.writer.mockReason.98d17e2c", { role: role, one: one(outletId === 'diamond' || tag === '즉전감' ? now : later, r) });
}

// ------------------------------------------------------------ draft news

const DAY = (() => {
  const [, m, d] = Bio.DRAFT_DATE.split('-').map(Number);
  return { month: m, day: d };
})();

function amateurFact(p) {
  const r = p.record;
  if (!r) return '';
  const where = p.pathway === '고졸' ? __i18n_k("draftroom.writer.amateurFact.where.11f5a65b") : ['대졸', '대학 얼리', '2년제'].includes(p.pathway) ? __i18n_k("draftroom.writer.amateurFact.where.bc85195c") : p.proExperience ? __i18n_k("draftroom.writer.amateurFact.where.4f6f556d") : __i18n_k("draftroom.writer.amateurFact.where.a6e3cbeb");
  if (r.kind === 'pitcher') {
    const ip = `${Math.floor(r.outs / 3)}${r.outs % 3 ? '⅓⅔'[r.outs % 3 - 1] : ''}`;
    return __i18n_k("draftroom.writer.amateurFact.8fd19c89", { where: where, games: r.games, ip: ip, value: r.era.toFixed(2), value2: r.k });
  }
  return __i18n_k("draftroom.writer.amateurFact.fe1bbee8", { where: where, games: r.games, value: r.avg.toFixed(3).replace(/^0/, ''), hr: r.hr, sb: r.sb });
}

/**
 * Headline, body and three fan comments for a regional or first-round pick.
 * `f` holds the situation computed by press.js (reach, value, matched outlets, fit, owned, local).
 */
function draftNews(p, t, selection, f, r) {
  const role = ROLES[p.role];
  const age = p.age ? `(${p.age})` : '';
  const where = selection.round === 0 ? __i18n_k("draftroom.writer.draftNews.where.3270c3fd") : __i18n_k("draftroom.writer.draftNews.where.c90e2158", { value: ((selection.overall - 1) % 10) + 1 });
  const hook =
    isPitcher(p) && p.velocity >= 150 ? __i18n_k("draftroom.writer.draftNews.hook.2556ad6e", { velocity: p.velocity, value: p.throwHand === '좌' ? __i18n_k("draftroom.writer.draftNews.hook.c03a5dae") : __i18n_k("draftroom.writer.draftNews.hook.5fbba1d3") })
    : f.local ? __i18n_k("draftroom.writer.draftNews.hook.029228e1")
    : p.pathway === '고졸' && p.rank <= 5 ? __i18n_k("draftroom.writer.draftNews.hook.31c2eb5f")
    : p.proExperience ? __i18n_k("draftroom.writer.draftNews.hook.79148c74")
    : p.pathway === '야구 유학' ? __i18n_k("draftroom.writer.draftNews.hook.70c7b517")
    : p.pathway === '2년제' ? __i18n_k("draftroom.writer.draftNews.hook.5ab2a0fa")
    : p.pathway === '독립구단' ? __i18n_k("draftroom.writer.draftNews.hook.049071bc")
    : role;
  const headlines = f.reach
    ? [__i18n_k("draftroom.writer.draftNews.headlines.8aa4b1d2", { short: t.short, value: selection.round === 0 ? __i18n_k("draftroom.writer.draftNews.headlines.e8a3b15a") : __i18n_k("draftroom.writer.draftNews.headlines.10f073b3"), name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.c4690102", { short: t.short, hook: hook, name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.a4f4ba46", { short: t.short, name: p.name })]
    : f.value
      ? [__i18n_k("draftroom.writer.draftNews.headlines.e287abfc", { short: t.short, hook: hook, name: p.name, value: K.particle(p.name, __i18n_k("draftroom.writer.draftNews.headlines.c57d3d52")) }), __i18n_k("draftroom.writer.draftNews.headlines.910e7e47", { short: t.short, name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.5272184a", { name: p.name, short: t.short })]
      : f.matched.length
        ? [__i18n_k("draftroom.writer.draftNews.headlines.8b7d0a36", { short: t.short, hook: hook, name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.1e705c33", { short: t.short, name: p.name })]
        : f.fit >= 80
          ? [__i18n_k("draftroom.writer.draftNews.headlines.9c6df1cb", { short: t.short, hook: hook, name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.fa224a60", { short: t.short, role: role, name: p.name })]
          : [__i18n_k("draftroom.writer.draftNews.headlines.0ebdafc6", { short: t.short, hook: hook, name: p.name }), __i18n_k("draftroom.writer.draftNews.headlines.7b87402b", { short: t.short, name: p.name })];
  const lead = __i18n_k("draftroom.writer.draftNews.lead.a80edf47", { name: t.name, value: K.particle(t.name, __i18n_k("draftroom.writer.draftNews.lead.543ff075")), month: DAY.month, day: DAY.day, eNTRY_YEAR: Bio.ENTRY_YEAR, where: where, school: p.school, role: role, name2: p.name, age: age, value2: K.particle(p.name, __i18n_k("draftroom.writer.draftNews.lead.c57d3d52")) });
  const facts = [amateurFact(p)];
  if (isPitcher(p) && p.velocity) facts.push(__i18n_k("draftroom.writer.draftNews.ede340c5", { velocity: p.velocity }));
  if (p.awards?.length) facts.push(__i18n_k("draftroom.writer.draftNews.d23b4b6c", { value: p.awards[0] }));
  const context = f.reach
    ? one([__i18n_k("draftroom.writer.draftNews.context.9e84de54", { remainingRank: f.remainingRank }), __i18n_k("draftroom.writer.draftNews.context.93a288c6", { short: t.short })], r)
    : f.value
      ? one([__i18n_k("draftroom.writer.draftNews.context.8e6e15ac", { rank: p.rank }), __i18n_k("draftroom.writer.draftNews.context.aebef258", { short: t.short })], r)
      : f.matched.length
        ? __i18n_k("draftroom.writer.draftNews.context.2ba7fa96", { value: f.matched.join('·') })
        : f.fit >= 60
          ? __i18n_k("draftroom.writer.draftNews.context.533790f5", { role: role, value: K.particle(role, __i18n_k("draftroom.writer.draftNews.context.d54d1c05")), short: t.short, value2: t.needs.indexOf(p.role) + 1 })
          : __i18n_k("draftroom.writer.draftNews.context.c1d0d8b5");
  const quote = one(
    f.fit >= 60
      ? [__i18n_k("draftroom.writer.draftNews.quote.7da54a90"), __i18n_k("draftroom.writer.draftNews.quote.1667ecb1"), __i18n_k("draftroom.writer.draftNews.quote.082d83f2", { role: role })]
      : [__i18n_k("draftroom.writer.draftNews.quote.73ecddde"), __i18n_k("draftroom.writer.draftNews.quote.d902a418"), __i18n_k("draftroom.writer.draftNews.quote.fced3391")],
    r,
  );
  const body = [lead, ...facts, context, __i18n_k("draftroom.writer.draftNews.body.1232e5b0", { short: t.short, quote: quote })].filter(Boolean).join(' ');
  return { headline: one(headlines, r), body, comments: fanComments(p, t, selection, f, r) };
}

// ------------------------------------------------------------ fan comments

const HANDLES = [__i18n_k("draftroom.writer.hANDLES.ae546754"), __i18n_k("draftroom.writer.hANDLES.dbdca31a"), __i18n_k("draftroom.writer.hANDLES.dba11a85"), __i18n_k("draftroom.writer.hANDLES.1e912b57"), __i18n_k("draftroom.writer.hANDLES.593c9d1c"), __i18n_k("draftroom.writer.hANDLES.cdf5a1bd"), __i18n_k("draftroom.writer.hANDLES.082bc285"), __i18n_k("draftroom.writer.hANDLES.aaf4be13"),
  __i18n_k("draftroom.writer.hANDLES.2bc3411f"), __i18n_k("draftroom.writer.hANDLES.e4500296"), __i18n_k("draftroom.writer.hANDLES.91ed1a09"), __i18n_k("draftroom.writer.hANDLES.7791ccd7"), __i18n_k("draftroom.writer.hANDLES.15acf25c"), __i18n_k("draftroom.writer.hANDLES.baccb556"), __i18n_k("draftroom.writer.hANDLES.95f69f47"), __i18n_k("draftroom.writer.hANDLES.868501a6"), __i18n_k("draftroom.writer.hANDLES.c9463ff6"),
  __i18n_k("draftroom.writer.hANDLES.a055b19e"), __i18n_k("draftroom.writer.hANDLES.c3fb76f6"), __i18n_k("draftroom.writer.hANDLES.79b33806"), __i18n_k("draftroom.writer.hANDLES.ef3604c8"), __i18n_k("draftroom.writer.hANDLES.53d9c2ff"), __i18n_k("draftroom.writer.hANDLES.1bfff8aa")];

function fanComments(p, t, selection, f, r) {
  const role = ROLES[p.role],
    need = ROLES[t.needs[0]];
  const says = [];
  const add = (tone, lines) => says.push({ tone, text: one(lines, r) });
  if (f.fit >= 60) add(__i18n_k("draftroom.writer.fanComments.30b00c4c"), [__i18n_k("draftroom.writer.fanComments.9ceec40f", { role: role }), __i18n_k("draftroom.writer.fanComments.f379622f", { role: role }), __i18n_k("draftroom.writer.fanComments.b2dece17")]);
  else add(__i18n_k("draftroom.writer.fanComments.dd059baf"), [__i18n_k("draftroom.writer.fanComments.85d03cfc", { need: need, role: role }), __i18n_k("draftroom.writer.fanComments.e447badc", { need: need }), __i18n_k("draftroom.writer.fanComments.5586d20b")]);
  if (f.reach) add(__i18n_k("draftroom.writer.fanComments.8dea5a91"), [__i18n_k("draftroom.writer.fanComments.3da09810"), __i18n_k("draftroom.writer.fanComments.bd6ca9ee"), __i18n_k("draftroom.writer.fanComments.ff72e2ff")]);
  if (f.value) add(__i18n_k("draftroom.writer.fanComments.24e4a7fc"), [__i18n_k("draftroom.writer.fanComments.9694d20c"), __i18n_k("draftroom.writer.fanComments.4ddd704c"), __i18n_k("draftroom.writer.fanComments.f9499a2f")]);
  if (f.matched.length) add(__i18n_k("draftroom.writer.fanComments.4fdca3a8"), [__i18n_k("draftroom.writer.fanComments.889128c2"), __i18n_k("draftroom.writer.fanComments.345f6826"), __i18n_k("draftroom.writer.fanComments.0d9a7b75")]);
  if (f.owned) add(__i18n_k("draftroom.writer.fanComments.0128ad97"), [__i18n_k("draftroom.writer.fanComments.3357457d", { role: role }), __i18n_k("draftroom.writer.fanComments.ff094da5")]);
  if (f.local) add(__i18n_k("draftroom.writer.fanComments.e216cf73"), [__i18n_k("draftroom.writer.fanComments.e2b8706d"), __i18n_k("draftroom.writer.fanComments.c5b5f85c"), __i18n_k("draftroom.writer.fanComments.b4e37e37", { school: p.school })]);
  if (isPitcher(p) && p.velocity >= 148) add(__i18n_k("draftroom.writer.fanComments.be340810"), [__i18n_k("draftroom.writer.fanComments.1ec6497b", { velocity: p.velocity }), __i18n_k("draftroom.writer.fanComments.8be7a4b0"), __i18n_k("draftroom.writer.fanComments.bb74d8f0")]);
  if (p.ready >= 45) add(__i18n_k("draftroom.writer.fanComments.be340810"), [__i18n_k("draftroom.writer.fanComments.d8d61fef"), __i18n_k("draftroom.writer.fanComments.3ea6364a")]);
  else add(__i18n_k("draftroom.writer.fanComments.4430c792"), [__i18n_k("draftroom.writer.fanComments.ee71af30"), __i18n_k("draftroom.writer.fanComments.2bb21e4d"), __i18n_k("draftroom.writer.fanComments.3dc12c0b")]);
  if (p.pathway === '독립구단') add(__i18n_k("draftroom.writer.fanComments.e37fcb1a"), [__i18n_k("draftroom.writer.fanComments.a534ad35"), __i18n_k("draftroom.writer.fanComments.92e37a67")]);
  if (p.pathway === '대졸') add(__i18n_k("draftroom.writer.fanComments.4fdca3a8"), [__i18n_k("draftroom.writer.fanComments.8c20904c"), __i18n_k("draftroom.writer.fanComments.f32088e9")]);
  if (p.pathway === '2년제') add(__i18n_k("draftroom.writer.fanComments.4fdca3a8"), [__i18n_k("draftroom.writer.fanComments.00783acd"), __i18n_k("draftroom.writer.fanComments.4c865f8a"), __i18n_k("draftroom.writer.fanComments.726ec238")]);
  if (p.pathway === '야구 유학') add(__i18n_k("draftroom.writer.fanComments.be340810"), [__i18n_k("draftroom.writer.fanComments.d9497976"), __i18n_k("draftroom.writer.fanComments.5612e92e")]);
  if (p.proExperience || p.pathway === '해외파') add(__i18n_k("draftroom.writer.fanComments.be340810"), [__i18n_k("draftroom.writer.fanComments.8cf9826d"), __i18n_k("draftroom.writer.fanComments.7d76ae02")]);
  add(__i18n_k("draftroom.writer.fanComments.e37fcb1a"), [__i18n_k("draftroom.writer.fanComments.79c0b670"), __i18n_k("draftroom.writer.fanComments.c11d9f38"), __i18n_k("draftroom.writer.fanComments.cfd7f76c"), __i18n_k("draftroom.writer.fanComments.e6333a02")]);
  const names = some(HANDLES, 3, r);
  return some(says, 3, r).map((c, i) => ({ handle: i === 0 && r() < 0.5 ? __i18n_k("draftroom.writer.fanComments.handle.16aa008c", { short: t.short, value: 10 + Math.floor(r() * 20) }) : names[i], tone: c.tone, text: c.text }));
}

const api = { one, some, fill, scoutNotes, mockReason, draftNews, fanComments };
export default api;
