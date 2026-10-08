import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
import { TOOL_LABELS } from '../draftroom';
import type { PublicPlayer } from '../model/player';
import type { CombineLine } from '../league/combine';
import type { TraitReport } from '../league/reports';
import { handedness, militaryLabel, recordLine, roleLabel, toolKeysFor } from './format';
import { TraitReportBox } from './PlayerPanel';

interface Props {
  player: PublicPlayer | null;
  age: number | null;
  /** 1.3.0: his combine numbers (null: did not come or not yet held), our scouts' read, and the workout button. */
  combine?: CombineLine[] | null;
  combineNote?: string;
  report?: TraitReport | null;
  workout?: { done: boolean; blocked: string | null; cost: string; onClick: () => void };
}

export function PlayerProfile({ player: p, age, combine, combineNote, report, workout }: Props) {
  if (!p) return <aside class="profile empty">{__i18n_t("ui.playerProfile.playerProfile.c2fea04a")}</aside>;
  const s = p.scouting;
  return (
    <aside class="profile" aria-labelledby="profile-name" tabIndex={0}>
      <p class="muted">{__i18n_t("ui.playerProfile.playerProfile.f376a341", { draftRank: p.amateur.draftRank, pathway: p.origin.pathway })}</p>
      <h2 id="profile-name">{__i18n_display(p.name)}</h2>
      <p class="lede">
        {__i18n_display(roleLabel(p.role))} · {__i18n_display(p.archetype)}
        {__i18n_display(p.twoWay && __i18n_k("ui.playerProfile.playerProfile.913252ca"))}
      </p>
      <dl class="facts">
        <div>
          <dt>{__i18n_t("ui.playerProfile.playerProfile.6c620e5c")}</dt>
          <dd>{__i18n_t("ui.playerProfile.playerProfile.1001e7e6", { age: age })}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.playerProfile.playerProfile.2f9a6e1f")}</dt>
          <dd>{__i18n_display(handedness(p))}</dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.playerProfile.playerProfile.691a855d")}</dt>
          <dd>
            {__i18n_display(p.height)}cm · {__i18n_display(p.weight)}kg
          </dd>
        </div>
        <div>
          <dt>{__i18n_t("ui.playerProfile.playerProfile.82af035c")}</dt>
          <dd>{__i18n_display(militaryLabel[p.service.military])}</dd>
        </div>
        {__i18n_display(p.velocity != null && (
          <div>
            <dt>{__i18n_t("ui.playerProfile.playerProfile.b2ea2c6b")}</dt>
            <dd>{__i18n_display(p.velocity)}km/h</dd>
          </div>
        ))}
        <div>
          <dt>{__i18n_t("ui.playerProfile.playerProfile.98633e27")}</dt>
          <dd>{__i18n_display(p.birthplace)}</dd>
        </div>
      </dl>
      <p>
        {__i18n_display(p.education.pathText)} <span class="muted">({__i18n_display(p.education.qualification)})</span>
      </p>

      <h3>{__i18n_t("ui.playerProfile.playerProfile.7b001924")}</h3>
      <table class="grades">
        <thead>
          <tr>
            <th>{__i18n_t("ui.playerProfile.playerProfile.8f2a4230")}</th>
            <th class="num">{__i18n_t("ui.playerProfile.playerProfile.001e4be2")}</th>
            <th class="num">{__i18n_t("ui.playerProfile.playerProfile.6e0caec5")}</th>
          </tr>
        </thead>
        <tbody>
          {__i18n_display(toolKeysFor(p.role).map((k) => (
            <tr key={k}>
              <th scope="row">{__i18n_display(TOOL_LABELS[k])}</th>
              <td class="num">{__i18n_display(s.tools[k] ?? '-')}</td>
              <td class="num">{__i18n_display(s.futureTools[k] ?? '-')}</td>
            </tr>
          )))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{__i18n_t("ui.playerProfile.playerProfile.f7c86d76")}</th>
            <td class="num">{__i18n_display(s.current)}</td>
            <td class="num strong">{__i18n_display(s.futureValue)}</td>
          </tr>
        </tfoot>
      </table>
      <p class="range">{__i18n_t("ui.playerProfile.playerProfile.f2d41e73", { floor: s.floor, ceiling: s.ceiling, uncertainty: s.uncertainty })}</p>
      {__i18n_display(s.tags.length > 0 && (
        <p>
          {__i18n_display(s.tags.map((t) => (
            <span key={t} class="tag">
              {__i18n_display(t)}
            </span>
          )))}
        </p>
      ))}

      <h3>{__i18n_t("ui.playerProfile.playerProfile.80d11806")}</h3>
      {__i18n_display(combine ? (
        <dl class="facts">
          {__i18n_display(combine.map((l) => (
            <div key={l.label}>
              <dt>{__i18n_display(l.label)}</dt>
              <dd>{__i18n_display(l.value)}</dd>
            </div>
          )))}
        </dl>
      ) : (
        <p class="muted small">{__i18n_display(combineNote ?? __i18n_k("ui.playerProfile.playerProfile.bb7eea1e"))}</p>
      ))}
      {__i18n_display(workout && (
        <p class="inline-form">
          <button type="button" disabled={workout.done || !!workout.blocked} title={__i18n_displayText(workout.blocked ?? '')} onClick={workout.onClick}>
            {__i18n_display(workout.done ? __i18n_k("ui.playerProfile.playerProfile.c272f4dc") : __i18n_k("ui.playerProfile.playerProfile.560d0493", { cost: workout.cost }))}
          </button>
          <span class="muted small">{__i18n_t("ui.playerProfile.playerProfile.f6a31c22")}</span>
        </p>
      ))}
      {__i18n_display(report && <TraitReportBox report={report} />)}

      <h3>{__i18n_t("ui.playerProfile.playerProfile.989d5649")}</h3>
      <p>{__i18n_display(s.strength)}</p>
      <p>{__i18n_display(s.weakness)}</p>

      <h3>{__i18n_t("ui.playerProfile.playerProfile.0eb04ce0")}</h3>
      <p class="numbers">{__i18n_display(recordLine(p.amateur.record))}</p>
      {__i18n_display(p.amateur.awards.length > 0 && <p class="muted">{__i18n_display(p.amateur.awards.join(' · '))}</p>)}
    </aside>
  );
}
