/* 2.0.27 (the user's request): a prospect's road to the draft as a table — each stage (high school, college,
   independent league, the leagues abroad) with its years and its record (league/amateur.ts). */
import { display as __i18n_display, t as __i18n_t } from "../i18n/index";
import type { Player } from "../model/types";
import { careerStages } from "../league/amateur";
import { innings } from "./format";

const n = (x: unknown) => (typeof x === "number" ? x : 0);
const rate3 = (x: unknown) =>
  typeof x === "number" ? x.toFixed(3).replace(/^0/, "") : "-";

export function CareerStages({
  player,
}: {
  player: Pick<
    Player,
    "id" | "role" | "scouting" | "education" | "amateur" | "origin"
  >;
}) {
  const stages = careerStages(player);
  if (!stages.length) return null;
  const pitcher = stages[0]!.record.kind === "pitcher";
  return (
    <>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career-stages">
          <thead>
            <tr>
              <th>{__i18n_t("ui.careerStages.text.af2feed6")}</th>
              <th>{__i18n_t("ui.careerStages.text.5d24a2fc")}</th>
              <th class="num">{__i18n_t("ui.careerStages.text.e0cee61a")}</th>
              {pitcher ? (
                <>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.639a1f2f")}
                  </th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.3b1908b7")}
                  </th>
                  <th class="num">ERA</th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.3f349ed1")}
                  </th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.21e0537f")}
                  </th>
                </>
              ) : (
                <>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.1eb19e0a")}
                  </th>
                  <th class="num">OPS</th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.9162d3a3")}
                  </th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.fed1c588")}
                  </th>
                  <th class="num">
                    {__i18n_t("ui.careerStages.text.91e54831")}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i}>
                <td>
                  <strong>{__i18n_display(s.label)}</strong>
                  <span class="muted small stage-period">
                    {__i18n_display(s.period)}
                  </span>
                </td>
                <td>
                  {__i18n_display(s.name)}
                  <span class="muted small stage-period">
                    {__i18n_display(s.status)}
                  </span>
                </td>
                <td class="num">{n(s.record.games)}</td>
                {pitcher ? (
                  <>
                    <td class="num">{innings(n(s.record.outs))}</td>
                    <td class="num">{n(s.record.wins)}</td>
                    <td class="num strong">
                      {typeof s.record.era === "number"
                        ? s.record.era.toFixed(2)
                        : "-"}
                    </td>
                    <td class="num">{n(s.record.k)}</td>
                    <td class="num">{n(s.record.bb)}</td>
                  </>
                ) : (
                  <>
                    <td class="num">{rate3(s.record.avg)}</td>
                    <td class="num strong">{rate3(s.record.ops)}</td>
                    <td class="num">{n(s.record.hr)}</td>
                    <td class="num">{n(s.record.rbi)}</td>
                    <td class="num">{n(s.record.sb)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stages.some((s) => s.note) && (
        <ul class="stage-notes muted small">
          {stages
            .filter((s) => s.note)
            .map((s, i) => (
              <li key={i}>
                {__i18n_display(s.name)}: {__i18n_display(s.note)}
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
