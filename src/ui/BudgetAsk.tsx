import { t as __i18n_t } from '../i18n/index';
/* 2.0.34 (the user's request: 연봉 예산 조르기): asking the owner for more payroll budget this season, and what the
   budget is made of (budgetask.ts, userclub.ts yearlyGrant). */
import type { Action } from '../league/actions';
import { askBudgetChance, askBudgetProblem, askedAmount, BUDGET_ASK } from '../league/budgetask';
import { payrollSeason } from '../league/payroll';
import type { LeagueState } from '../league/state';
import { PARENT } from '../league/tuning';
import { money } from './format';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function BudgetAsk({ league, onAct, why = false }: { league: LeagueState; onAct?: (a: Action) => void; why?: boolean }) {
  const u = league.user;
  if (!u) return null;
  const season = payrollSeason(league);
  const asked = u.budgetAsks?.find((a) => a.season === season);
  const problem = askBudgetProblem(league);
  const w = u.budgetWhy?.season === season ? u.budgetWhy : null;
  return (
    <div class="budget-ask">
      {asked ? (
        <p class={`notice small ${asked.yes ? 'good' : ''}`}>
          {asked.yes
            ? __i18n_t("ui.budgetAsk.text.a7d69a4c", { season, amount: money(asked.amount) })
            : __i18n_t("ui.budgetAsk.text.e0bfd90e", { season })}
        </p>
      ) : onAct && !problem ? (
        <p class="inline-form small">
          <span>{__i18n_t("ui.budgetAsk.text.542db609", { season })}</span>
          {BUDGET_ASK.shares.map((share) => (
            <button key={share} type="button" onClick={() => onAct({ kind: 'askBudget', share })}>
              {__i18n_t("ui.budgetAsk.text.88f4ab2c", { amount: money(askedAmount(league, share)), pct: pct(askBudgetChance(league, share)) })}
            </button>
          ))}
          <span class="muted">{__i18n_t("ui.budgetAsk.text.364eb5ce")}</span>
        </p>
      ) : null}
      {why && w && (
        <details class="budget-why small">
          <summary>{__i18n_t("ui.budgetAsk.text.aee750a4")}</summary>
          <ul>
            <li>{__i18n_t("ui.budgetAsk.text.e127f82a", { base: money(w.base) })}</li>
            <li>
              {__i18n_t("ui.budgetAsk.text.22d8fd33", { scale: w.scale.toFixed(2) })}
              {w.scale >= PARENT.scaleMax - 1e-6 && <strong>{__i18n_t("ui.budgetAsk.text.31943366")}</strong>}
              {w.scale <= PARENT.scaleMin + 1e-6 && <strong>{__i18n_t("ui.budgetAsk.text.badd9108")}</strong>}
            </li>
            {w.dynamic !== 1 && <li>{__i18n_t("ui.budgetAsk.text.7dda6fa1", { dynamic: w.dynamic.toFixed(2) })}</li>}
            {w.base * w.scale * w.dynamic < w.floor && <li>{__i18n_t("ui.budgetAsk.text.017002f2", { floor: money(w.floor) })}</li>}
            {w.gifts > 0 && <li>{__i18n_t("ui.budgetAsk.text.8821a932", { gifts: money(w.gifts) })}</li>}
            {asked?.yes && <li>{__i18n_t("ui.budgetAsk.text.faa3254c", { amount: money(asked.amount) })}</li>}
            <li class="muted">{__i18n_t("ui.budgetAsk.text.da7f1461")}</li>
          </ul>
        </details>
      )}
    </div>
  );
}
