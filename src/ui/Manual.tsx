import { display as __i18n_display, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The help tab (V0.15): the game's manual — how a year goes, the screens, the words and rules a general
   manager meets, what each decision is about, and common questions. Rule numbers come from the rule book
   in code (rules/kbo2026.ts), so the help cannot drift from what the game does. */
import { DISCLAIMER } from '../core/about';
import { EXPANSION_DEFAULTS, KBO_2026 } from '../rules/kbo2026';
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE } from './Settings';
import { decisionTips } from './tutorial';
import { GROWTH_LABELS, GROWTH_NOTES, GROWTH_ORDER } from '../league/traits';
import { ALL_STAR, COMBINE } from '../league/tuning';

const K = KBO_2026;
const eok = (manwon: number) => __i18n_k("ui.manual.eok.db0fc332", { value: Math.round(manwon / 1000) / 10 });
const usd = (n: number) => __i18n_k("ui.manual.usd.f2e37495", { value: n / 10_000 });
const pct = (x: number) => `${Math.round(x * 100)}%`;
const capNow = K.salaryCap.years.find((y) => y.year === K.season)!.cap;

const SCREENS: [string, string][] = [
  [__i18n_k("ui.manual.sCREENS.2d179fd7"), __i18n_k("ui.manual.sCREENS.0e544d5f")],
  [__i18n_k("ui.manual.sCREENS.8cc09c32"), __i18n_k("ui.manual.sCREENS.90602da1")],
  [__i18n_k("ui.manual.sCREENS.e11828a8"), __i18n_k("ui.manual.sCREENS.a13b4985")],
  [__i18n_k("ui.manual.sCREENS.e0cee61a"), __i18n_k("ui.manual.sCREENS.fcf2f2ae")],
  [__i18n_k("ui.manual.sCREENS.c9763872"), __i18n_k("ui.manual.sCREENS.1cb61110")],
  [__i18n_k("ui.manual.sCREENS.58756112"), __i18n_k("ui.manual.sCREENS.4a49be5b")],
  [__i18n_k("ui.manual.sCREENS.1ab3847c"), __i18n_k("ui.manual.sCREENS.678ac80a")],
  [__i18n_k("ui.manual.sCREENS.0db7daf2"), __i18n_k("ui.manual.sCREENS.322c1d2e")],
  [__i18n_k("ui.manual.sCREENS.c14a567e"), __i18n_k("ui.manual.sCREENS.0cae1744")],
];

const GLOSSARY: [string, string][] = [
  [__i18n_k("ui.manual.gLOSSARY.28c6418c"), __i18n_k("ui.manual.gLOSSARY.fa8ce475")],
  ['WAR', __i18n_k("ui.manual.gLOSSARY.9faec22e")],
  ['wRC+', __i18n_k("ui.manual.gLOSSARY.ba2a3993")],
  ['OPS', __i18n_k("ui.manual.gLOSSARY.25338277")],
  ['FIP', __i18n_k("ui.manual.gLOSSARY.05546b18")],
  ['QS', __i18n_k("ui.manual.gLOSSARY.9603d846")],
  [__i18n_k("ui.manual.gLOSSARY.d10ef256"), __i18n_k("ui.manual.gLOSSARY.bea0fd90", { daysPerSeason: K.freeAgency.daysPerSeason, seasonsHighSchool: K.freeAgency.seasonsHighSchool, seasonsCollege: K.freeAgency.seasonsCollege })],
  [__i18n_k("ui.manual.gLOSSARY.6e374b87"), __i18n_k("ui.manual.gLOSSARY.b2a6ec7c", { rosterLimit: K.league.rosterLimit, registered: K.league.firstTeam.registered, active: K.league.firstTeam.active })],
  [__i18n_k("ui.manual.gLOSSARY.cf7b6b60"), __i18n_k("ui.manual.gLOSSARY.516fa8e9", { number: Number(K.development.registerFrom.slice(0, 2)), number2: Number(K.development.registerFrom.slice(3)) })],
  [__i18n_k("ui.manual.gLOSSARY.c26bc9f8"), __i18n_k("ui.manual.gLOSSARY.85b1428d")],
  [__i18n_k("ui.manual.gLOSSARY.23312f7a"), __i18n_k("ui.manual.gLOSSARY.b9f2913b", { protected: K.freeAgency.compensation.A.protected, pct: pct(K.freeAgency.compensation.A.withPlayer), pct2: pct(K.freeAgency.compensation.A.cashOnly), protected2: K.freeAgency.compensation.B.protected, pct3: pct(K.freeAgency.compensation.B.withPlayer), pct4: pct(K.freeAgency.compensation.B.cashOnly), pct5: pct(K.freeAgency.compensation.C.cashOnly) })],
  [__i18n_k("ui.manual.gLOSSARY.0fc4f291"), __i18n_k("ui.manual.gLOSSARY.c5a480d5", { topPlayers: K.salaryCap.topPlayers, season: K.season, eok: eok(capNow), value: K.salaryCap.levies.map(pct).join('·'), pickDropFrom: K.salaryCap.pickDropFrom, pickDrop: K.salaryCap.pickDrop })],
  [__i18n_k("ui.manual.gLOSSARY.353853ad"), __i18n_k("ui.manual.gLOSSARY.637e98ce", { regular: K.foreign.regular, asiaQuota: K.foreign.asiaQuota, usd: usd(K.foreign.newContractCapUSD), usd2: usd(K.foreign.clubTotalCapUSD), replacementsPerSeason: K.foreign.replacementsPerSeason })],
  [__i18n_k("ui.manual.gLOSSARY.6734925e"), __i18n_k("ui.manual.gLOSSARY.8d92a7f4", { seasons: K.posting.seasons, perClubPerWinter: K.posting.perClubPerWinter })],
  [__i18n_k("ui.manual.gLOSSARY.7021a262"), __i18n_k("ui.manual.gLOSSARY.3720f353", { protected: K.secondaryDraft.protected, rounds: K.secondaryDraft.rounds })],
  [__i18n_k("ui.manual.gLOSSARY.ec00e5fd"), __i18n_k("ui.manual.gLOSSARY.20aad329", { protected: EXPANSION_DEFAULTS.specialDraft.protected, eok: eok(EXPANSION_DEFAULTS.specialDraft.feePerPlayer), freeAgentSigns: EXPANSION_DEFAULTS.freeAgentSigns, benefitSeasons: EXPANSION_DEFAULTS.benefitSeasons, extraForeignPlayers: EXPANSION_DEFAULTS.extraForeignPlayers, extraFirstTeamSpots: EXPANSION_DEFAULTS.extraFirstTeamSpots })],
  [__i18n_k("ui.manual.gLOSSARY.82af035c"), __i18n_k("ui.manual.gLOSSARY.5fe68170")],
  [__i18n_k("ui.manual.gLOSSARY.4343db9f"), __i18n_k("ui.manual.gLOSSARY.dc821aaa")],
  [__i18n_k("ui.manual.gLOSSARY.0466bf9b"), __i18n_k("ui.manual.gLOSSARY.358bfad5")],
  [__i18n_k("ui.manual.gLOSSARY.8e3405be"), __i18n_k("ui.manual.gLOSSARY.cbad014e", { value: GROWTH_ORDER.map((g) => `${GROWTH_LABELS[g]}: ${GROWTH_NOTES[g]}`).join(' ') })],
  [__i18n_k("ui.manual.gLOSSARY.81aac2e1"), __i18n_k("ui.manual.gLOSSARY.ccabdbba")],
  [__i18n_k("ui.manual.gLOSSARY.2a9a4091"), __i18n_k("ui.manual.gLOSSARY.c008c9dd")],
  [__i18n_k("ui.manual.gLOSSARY.3feee32d"), __i18n_k("ui.manual.gLOSSARY.0cef9af9")],
  [__i18n_k("ui.manual.gLOSSARY.0f0b295e"), __i18n_k("ui.manual.gLOSSARY.24f1069a", { squad: ALL_STAR.squad })],
  [__i18n_k("ui.manual.gLOSSARY.cad96f9c"), __i18n_k("ui.manual.gLOSSARY.cf6dd78f")],
  [__i18n_k("ui.manual.gLOSSARY.754d4e11"), __i18n_k("ui.manual.gLOSSARY.78d0d9fa")],
  [__i18n_k("ui.manual.gLOSSARY.e1cca07a"), __i18n_k("ui.manual.gLOSSARY.a4fa2704")],
  [__i18n_k("ui.manual.gLOSSARY.e2e5d4ea"), __i18n_k("ui.manual.gLOSSARY.5be9c39f")],
  [__i18n_k("ui.manual.gLOSSARY.65049d47"), __i18n_k("ui.manual.gLOSSARY.de9cee61")],
  [__i18n_k("ui.manual.gLOSSARY.b28f9d34"), __i18n_k("ui.manual.gLOSSARY.4cda42ad")],
  [__i18n_k("ui.manual.gLOSSARY.4a4f8664"), __i18n_k("ui.manual.gLOSSARY.9be1be15")],
  [__i18n_k("ui.manual.gLOSSARY.69cdff8d"), __i18n_k("ui.manual.gLOSSARY.403bde37")],
  [__i18n_k("ui.manual.gLOSSARY.aaf72f83"), __i18n_k("ui.manual.gLOSSARY.0d419809")],
  [__i18n_k("ui.manual.gLOSSARY.0cb39bfb"), __i18n_k("ui.manual.gLOSSARY.0f27881e")],
  [__i18n_k("ui.manual.gLOSSARY.80d11806"), __i18n_k("ui.manual.gLOSSARY.0907383f", { number: Number(COMBINE.date.slice(0, 2)), number2: Number(COMBINE.date.slice(3)), invited: COMBINE.invited, workouts: COMBINE.workouts, workoutCost: COMBINE.workoutCost })],
  [__i18n_k("ui.manual.gLOSSARY.4ca5847f"), __i18n_k("ui.manual.gLOSSARY.f3ab8c09")],
  [__i18n_k("ui.manual.gLOSSARY.93ef873b"), __i18n_k("ui.manual.gLOSSARY.8eb2515f")],
  [__i18n_k("ui.manual.gLOSSARY.76e8e61d"), __i18n_k("ui.manual.gLOSSARY.ac98c0d6")],
  [__i18n_k("ui.manual.gLOSSARY.ba4e88f4"), __i18n_k("ui.manual.gLOSSARY.274ac523")],
  [__i18n_k("ui.manual.gLOSSARY.54a544ab"), __i18n_k("ui.manual.gLOSSARY.bb29cbc2")],
  [__i18n_k("ui.manual.gLOSSARY.efd6260e"), __i18n_k("ui.manual.gLOSSARY.ca87286d")],
  [__i18n_k("ui.manual.gLOSSARY.0d653027"), __i18n_k("ui.manual.gLOSSARY.9c78929a")],
  [__i18n_k("ui.manual.gLOSSARY.5672f8d9"), __i18n_k("ui.manual.gLOSSARY.ebd7f0a7")],
];

const YEAR: [string, string][] = [
  [__i18n_k("ui.manual.yEAR.3b07592a"), __i18n_k("ui.manual.yEAR.65079277")],
  [__i18n_k("ui.manual.yEAR.b60dbd37"), __i18n_k("ui.manual.yEAR.4c2b8c9a")],
  [__i18n_k("ui.manual.yEAR.720f23a6"), __i18n_k("ui.manual.yEAR.0bd4ef97", { value: ALL_STAR.dates.open.replace('-', '/'), value2: ALL_STAR.dates.close.replace('-', '/'), value3: ALL_STAR.dates.game.replace('-', '/') })],
  [__i18n_k("ui.manual.yEAR.bd910247"), __i18n_k("ui.manual.yEAR.aba5ee3b")],
  [__i18n_k("ui.manual.yEAR.7dc56a38"), __i18n_k("ui.manual.yEAR.1d4df7dd")],
  [__i18n_k("ui.manual.yEAR.bd81c062"), __i18n_k("ui.manual.yEAR.3f2e11a7")],
  [__i18n_k("ui.manual.yEAR.6a817b50"), __i18n_k("ui.manual.yEAR.ae637c3d")],
];

const FAQ: [string, string][] = [
  [__i18n_k("ui.manual.fAQ.1546e46d"), __i18n_k("ui.manual.fAQ.d13c2950")],
  [__i18n_k("ui.manual.fAQ.627a4d2a"), __i18n_k("ui.manual.fAQ.26eba32f")],
  [__i18n_k("ui.manual.fAQ.f5e3c9ee"), __i18n_k("ui.manual.fAQ.29eede56", { easy: DIFFICULTY_LABEL.easy, easy2: DIFFICULTY_NOTE.easy, hard: DIFFICULTY_LABEL.hard, hard2: DIFFICULTY_NOTE.hard })],
  [__i18n_k("ui.manual.fAQ.4b1874cd"), __i18n_k("ui.manual.fAQ.d6a9743a")],
  [__i18n_k("ui.manual.fAQ.8ca40144"), __i18n_k("ui.manual.fAQ.8b8271fb")],
  [__i18n_k("ui.manual.fAQ.216a77cd"), __i18n_k("ui.manual.fAQ.e492cd39", { dISCLAIMER: DISCLAIMER })],
];

export function Manual() {
  return (
    <section class="settings-page manual" aria-labelledby="manual-title">
      <div class="page-head">
        <div>
          <h2 id="manual-title">{__i18n_t("ui.manual.manual.e2654ac5")}</h2>
          <p class="muted">{__i18n_t("ui.manual.manual.b2c95d12")}</p>
        </div>
      </div>

      <section class="settings-block" aria-labelledby="manual-year">
        <h2 id="manual-year">{__i18n_t("ui.manual.manual.a1ec70e8")}</h2>
        <dl class="manual-list">
          {__i18n_display(YEAR.map(([k, v]) => (
            <div key={k}>
              <dt>{__i18n_display(k)}</dt>
              <dd>{__i18n_display(v)}</dd>
            </div>
          )))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-screens">
        <h2 id="manual-screens">{__i18n_t("ui.manual.manual.43c786f1")}</h2>
        <dl class="manual-list">
          {__i18n_display(SCREENS.map(([k, v]) => (
            <div key={k}>
              <dt>{__i18n_display(k)}</dt>
              <dd>{__i18n_display(v)}</dd>
            </div>
          )))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-words">
        <h2 id="manual-words">{__i18n_t("ui.manual.manual.e17dd9c5")}</h2>
        <p class="muted small">{__i18n_t("ui.manual.manual.7888bd43")}</p>
        <dl class="manual-list">
          {__i18n_display(GLOSSARY.map(([k, v]) => (
            <div key={k}>
              <dt>{__i18n_display(k)}</dt>
              <dd>{__i18n_display(v)}</dd>
            </div>
          )))}
        </dl>
      </section>

      <section class="settings-block" aria-labelledby="manual-decisions">
        <h2 id="manual-decisions">{__i18n_t("ui.manual.manual.63caaf3a")}</h2>
        {__i18n_display(decisionTips().map(([kind, tip]) => (
          <details key={kind} class="help">
            <summary>{__i18n_display(tip.title)}</summary>
            {__i18n_display(tip.body.map((line) => (
              <p key={line}>{__i18n_display(line)}</p>
            )))}
          </details>
        )))}
      </section>

      <section class="settings-block" aria-labelledby="manual-faq">
        <h2 id="manual-faq">{__i18n_t("ui.manual.manual.ae2ce921")}</h2>
        {__i18n_display(FAQ.map(([q, a]) => (
          <details key={q} class="help">
            <summary>{__i18n_display(q)}</summary>
            <p>{__i18n_display(a)}</p>
          </details>
        )))}
      </section>
    </section>
  );
}
