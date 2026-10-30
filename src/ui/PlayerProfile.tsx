import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* A draft prospect's page (2.0.27, the user's request: the draft tab no longer looks like Draft Room lifted whole).
   It opens over the list as the other players' pages do: his public rank, the summary strip, then three parts —
   the scouts' grades as bars, the combine and our own reports, and his amateur days. 2.0.30 (the user's request): a
   pitcher's pitches too, as on any pitcher's page. */
import { useRef, useState } from 'preact/hooks';
import { shownFuture, showsFutureDetail, GradeBar, gradeClass } from './grades';
import { TOOL_LABELS } from '../draftroom';
import type { PublicPlayer } from '../model/player';
import type { CombineLine } from '../league/combine';
import type { TraitReport } from '../league/reports';
import { handedness, militaryLabel, roleLabel, toolKeysFor } from './format';
import { TraitReportBox } from './PlayerPanel';
import { CareerStages } from './CareerStages';
import { pathwayLabel } from '../league/amateur';
import { useFocusTrap } from './modal';
import { useUi } from './useDisplay';
import type { prospectPitches } from '../league/views';

interface Props {
  player: PublicPlayer;
  age: number | null;
  draftYear: number;
  /** Our scouts' future grade (V0.6), when there is a club. */
  ours?: number | null;
  /** 1.3.0: his combine numbers (null: did not come or not yet held), our scouts' read, and the workout button. */
  combine?: CombineLine[] | null;
  combineNote?: string;
  report?: TraitReport | null;
  workout?: { done: boolean; blocked: string | null; cost: string; onClick: () => void };
  /** 2.0.30: a pitcher's fastball and other pitches (the scouts' grades, his share of each). */
  pitches?: ProspectPitches | null;
  /** 2.0.28: the league's seed (his school's results in its year: hsevents.ts). */
  seed?: string;
  onClose: () => void;
}

type Part = 'grades' | 'combine' | 'amateur';

type ProspectPitches = NonNullable<ReturnType<typeof prospectPitches>>;

export function PlayerProfile({ player: p, age, draftYear, ours, combine, combineNote, report, workout, pitches, seed, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  const [part, setPart] = useState<Part>('grades');
  // 2.0.62 (새 UI): as a player's page — the tools on the right, the grades in boxed numbers, the parts as cards.
  const next = useUi() === 'new';
  const s = p.scouting;
  const future = shownFuture(p);
  const parts: { key: Part; label: string }[] = [
    { key: 'grades', label: __i18n_t("ui.playerProfile.text.6f36da79") },
    { key: 'amateur', label: __i18n_t("ui.playerProfile.text.f892ec34") },
    { key: 'combine', label: __i18n_t("ui.playerProfile.text.572be2e2") },
  ];
  const closeButton = (
    <button type="button" class="close" onClick={onClose} aria-label={__i18n_t("ui.playerPanel.playerPanel.94b7dba1")}>
      {__i18n_t("ui.playerPanel.playerPanel.94b7dba1")}
    </button>
  );
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={next ? 'dialog profile prospect next-profile' : 'dialog profile prospect'} role="dialog" aria-modal="true" aria-labelledby="profile-name" ref={box}>
        {!next && closeButton}
        <div class={next ? 'profile-head pp-head' : 'profile-head'}>
          <div class="prospect-rank" aria-hidden="true">
            <span class="prospect-rank-num">{__i18n_display(p.amateur.draftRank)}</span>
            <span class="prospect-rank-label">{__i18n_t("ui.playerProfile.text.ee320476")}</span>
          </div>
          <div class={next ? 'pp-id' : undefined}>
            <p class="muted">{__i18n_t("ui.playerProfile.text.c63d35fe", { year: draftYear + 1, pathway: pathwayLabel(p), school: p.education.school })}</p>
            <h2 id="profile-name" tabIndex={-1}>
              {__i18n_display(p.name)}
              {__i18n_display(p.twoWay && <span class="tag">{__i18n_t("ui.draftBoard.draftBoard.62cb0192")}</span>)}
            </h2>
            <p class={next ? 'muted pp-sub' : 'muted'}>
              {__i18n_display(roleLabel(p.role))} · {__i18n_display(p.archetype)} · {__i18n_display(handedness(p))}
              {next && ` · ${__i18n_t("ui.playerProfile.playerProfile.1001e7e6", { age: age })} · ${p.height}cm · ${p.weight}kg`}
            </p>
          </div>
          {next && <div class="pp-tools">{closeButton}</div>}
        </div>

        {next ? (
          <dl class="pp-summary prospect-summary">
            <div class="pp-grade">
              <dt>{__i18n_t("ui.playerPanel.text.0f9ec16b")}</dt>
              <dd class={gradeClass(s.current)}>{s.current}</dd>
            </div>
            <div class="pp-grade">
              <dt>{__i18n_t("ui.playerPanel.text.a7aed900")}</dt>
              <dd class={gradeClass(future)}>{future ?? '-'}</dd>
            </div>
            {ours != null && (
              <div class="pp-grade">
                <dt>{__i18n_t("ui.playerProfile.text.25269feb")}</dt>
                <dd class={gradeClass(ours)}>{ours}</dd>
              </div>
            )}
            {p.velocity != null && (
              <div class="pp-grade">
                <dt>{__i18n_t("ui.playerProfile.playerProfile.b2ea2c6b")}</dt>
                <dd>
                  {p.velocity}
                  <span class="small">km/h</span>
                </dd>
              </div>
            )}
          </dl>
        ) : (
        <dl class="summary-strip">
          <div>
            <dt>{__i18n_t("ui.playerProfile.playerProfile.6c620e5c")}</dt>
            <dd>{__i18n_t("ui.playerProfile.playerProfile.1001e7e6", { age: age })}</dd>
          </div>
          <div>
            <dt>{__i18n_t("ui.playerProfile.playerProfile.f7c86d76")}</dt>
            <dd>
              <strong class={gradeClass(s.current)}>{__i18n_display(s.current)}</strong> <span class="muted small">{__i18n_t("ui.playerProfile.text.5c356d32", { future: future ?? '-' })}</span>
            </dd>
          </div>
          {__i18n_display(ours != null && (
            <div>
              <dt>{__i18n_t("ui.playerProfile.text.25269feb")}</dt>
              <dd>
                <strong class={gradeClass(ours)}>{__i18n_display(ours)}</strong>
              </dd>
            </div>
          ))}
          {__i18n_display(p.velocity != null && (
            <div>
              <dt>{__i18n_t("ui.playerProfile.playerProfile.b2ea2c6b")}</dt>
              <dd>{__i18n_display(p.velocity)}km/h</dd>
            </div>
          ))}
          <div>
            <dt>{__i18n_t("ui.playerProfile.playerProfile.691a855d")}</dt>
            <dd>
              {__i18n_display(p.height)}cm · {__i18n_display(p.weight)}kg
            </dd>
          </div>
        </dl>
        )}

        <div class={next ? 'pp-tabs profile-parts' : 'segmented profile-tabs profile-parts'} role="tablist" aria-label={__i18n_t("ui.playerProfile.text.fb1d89be")}>
          {__i18n_display(parts.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={part === x.key} aria-pressed={next ? undefined : part === x.key} onClick={() => setPart(x.key)}>
              {__i18n_display(x.label)}
            </button>
          )))}
        </div>

        {__i18n_display(part === 'grades' && (
          <div class={next ? 'profile-part pp-report' : 'profile-part'} role="tabpanel">
            <section class={next ? 'sheet-box' : undefined}>
              {next ? (
                <div class="pp-box-head">
                  <h3>{__i18n_t("ui.playerProfile.playerProfile.7b001924")}</h3>
                  <span class="muted small">{__i18n_t("ui.playerProfile.playerProfile.f2d41e73", { floor: s.floor, ceiling: s.ceiling, uncertainty: s.uncertainty })}</span>
                </div>
              ) : (
                <h3>{__i18n_t("ui.playerProfile.playerProfile.7b001924")}</h3>
              )}
              <div class="gradebars">
                {__i18n_display(toolKeysFor(p.role).map((k) => (
                  <GradeBar key={k} label={__i18n_displayText(TOOL_LABELS[k])} now={s.tools[k]} future={showsFutureDetail(p) ? s.futureTools[k] : undefined} />
                )))}
                <GradeBar label={__i18n_t("ui.playerProfile.playerProfile.f7c86d76")} now={s.current} future={future ?? undefined} />
              </div>
              {!next && <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.40f3273a")}</p>}
              {!next && <p class="range">{__i18n_t("ui.playerProfile.playerProfile.f2d41e73", { floor: s.floor, ceiling: s.ceiling, uncertainty: s.uncertainty })}</p>}
              {__i18n_display(s.tags.length > 0 && (
                <p>
                  {__i18n_display(s.tags.map((t) => (
                    <span key={t} class="tag">
                      {__i18n_display(t)}
                    </span>
                  )))}
                </p>
              ))}
            </section>
            {__i18n_display(pitches && (
              <section class={next ? 'sheet-box pp-pitches' : 'pitch-box'}>
                <h3>{__i18n_t("ui.playerPanel.text.0685b54a")}</h3>
                <div class="gradebars">
                  <GradeBar label={`${pitches.fastball.type} ${__i18n_displayText(pitches.fastball.name)}`} now={s.tools.stuff} future={showsFutureDetail(p) ? s.futureTools.stuff : undefined} note={__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round(pitches.fastball.usage * 100) }))} />
                  {__i18n_display(pitches.list.map((x) => (
                    <GradeBar key={x.type} label={`${x.type} ${__i18n_displayText(x.name)}`} now={x.grade} future={showsFutureDetail(p) ? x.future : undefined} note={__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round(x.usage * 100) }))} />
                  )))}
                </div>
              </section>
            ))}
            <section class={next ? 'sheet-box' : undefined}>
              <h3>{__i18n_t("ui.playerProfile.playerProfile.989d5649")}</h3>
              <p>{__i18n_display(s.strength)}</p>
              <p>{__i18n_display(s.weakness)}</p>
            </section>
          </div>
        ))}

        {__i18n_display(part === 'combine' && (
          <div class={next ? 'profile-part pp-report' : 'profile-part'} role="tabpanel">
            <section class={next ? 'sheet-box' : undefined}>
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
                  <button type="button" disabled={workout.done || !!workout.blocked} title={__i18n_displayText(workout.blocked ?? (next ? __i18n_t("ui.playerProfile.playerProfile.f6a31c22") : ''))} onClick={workout.onClick}>
                    {__i18n_display(workout.done ? __i18n_k("ui.playerProfile.playerProfile.c272f4dc") : __i18n_k("ui.playerProfile.playerProfile.560d0493", { cost: workout.cost }))}
                  </button>
                  {!next && <span class="muted small">{__i18n_t("ui.playerProfile.playerProfile.f6a31c22")}</span>}
                </p>
              ))}
            </section>
            {__i18n_display(report && <TraitReportBox report={report} />)}
          </div>
        ))}

        {__i18n_display(part === 'amateur' && (
          <div class={next ? 'profile-part pp-report' : 'profile-part'} role="tabpanel">
            <section class={next ? 'sheet-box pp-wide' : undefined}>
              <h3>{__i18n_t("ui.playerProfile.text.f892ec34")}</h3>
              <CareerStages player={p} seed={seed} />
              {!next && <p class="muted small">{__i18n_t("ui.playerProfile.text.441a99b9")}</p>}
              {__i18n_display(p.amateur.awards.length > 0 && (
                <p>
                  {__i18n_display(p.amateur.awards.map((a) => (
                    <span key={a} class="tag">
                      {__i18n_display(a)}
                    </span>
                  )))}
                </p>
              ))}
            </section>
            <section class={next ? 'sheet-box' : undefined}>
              <h3>{__i18n_t("ui.playerProfile.text.3095fa46")}</h3>
              <p>
                {__i18n_display(p.education.pathText)} <span class="muted">({__i18n_display(p.education.qualification)})</span>
              </p>
              <dl class="facts">
                <div>
                  <dt>{__i18n_t("ui.playerProfile.playerProfile.98633e27")}</dt>
                  <dd>{__i18n_display(p.birthplace)}</dd>
                </div>
                <div>
                  <dt>{__i18n_t("ui.playerProfile.playerProfile.82af035c")}</dt>
                  <dd>{__i18n_display(militaryLabel[p.service.military])}</dd>
                </div>
              </dl>
            </section>
          </div>
        ))}
      </div>
    </div>
  );
}
