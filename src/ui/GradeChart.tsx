import { t as __i18n_t } from '../i18n/index';
/* A player's grades season by season (1.7.0, from the 1.6 feedback): the public report at the start of each season
   (offseason.ts logGrades), the overall grade and any of his abilities as lines on the 20–80 scale, with the
   numbers in a table under it. */
import { useState } from 'preact/hooks';
import { TOOL_LABELS, type Role } from '../draftroom';
import { GRADE_KEYS } from '../league/offseason';
import type { GradeLogEntry } from '../model/types';
import { toolKeysFor } from './format';

const W = 340,
  H = 170,
  PAD = { l: 28, r: 10, t: 10, b: 22 };
const COLORS = ['#2f6fd6', '#d9622b', '#3d9a4f', '#a347b8', '#b8962a'];

/** 1.9.9: `proFrom`, the league's first season (a legacy game's 1982): the years before are shaded (the players' days
    before the KBO). A thin line follows the mean of his abilities, which moves while the overall grade (in fives)
    stays put through his prime. */
export function GradeChart({ log, role, proFrom }: { log: GradeLogEntry[]; role: Role; proFrom?: number }) {
  const keys = toolKeysFor(role) as readonly string[];
  const [on, setOn] = useState<string[]>([]);
  if (log.length < 2) return <p class="muted small">{__i18n_t("ui.gradeChart.text.6551f51e")}</p>;
  const seasons = log.map((e) => e[0]!);
  const x = (i: number) => PAD.l + (log.length === 1 ? 0 : (i / (log.length - 1)) * (W - PAD.l - PAD.r));
  const y = (g: number) => PAD.t + ((80 - Math.max(20, Math.min(80, g))) / 60) * (H - PAD.t - PAD.b);
  const valueOf = (e: GradeLogEntry, key: string) => (key === 'overall' ? e[1]! : e[2 + GRADE_KEYS.indexOf(key as (typeof GRADE_KEYS)[number])]!);
  const mean = (e: GradeLogEntry) => keys.reduce((a, k) => a + valueOf(e, k), 0) / keys.length;
  const path = (key: string) => log.map((e, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(key === 'mean' ? mean(e) : valueOf(e, key)).toFixed(1)}`).join(' ');
  const before = proFrom === undefined ? 0 : seasons.filter((yr) => yr < proFrom).length;
  const edge = before >= log.length ? x(log.length - 1) : before ? (x(before - 1) + x(before)) / 2 : 0;
  const first = log[0]!,
    last = log.at(-1)!;
  const toggle = (k: string) => setOn((xs) => (xs.includes(k) ? xs.filter((v) => v !== k) : [...xs, k]));
  // Every other season labelled when there are many.
  const step = Math.ceil(log.length / 8);
  return (
    <div class="grade-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={__i18n_t("ui.gradeChart.text.844353c5", { from: seasons[0], to: seasons.at(-1), a: first[1], b: last[1] })}>
        {before > 0 && (
          <g>
            <rect x={PAD.l} y={PAD.t} width={edge - PAD.l} height={H - PAD.t - PAD.b} class="chart-before" />
            <text x={(PAD.l + edge) / 2} y={PAD.t + 10} class="chart-axis" text-anchor="middle">
              {__i18n_t("ui.gradeChart.text.c73469b6")}
            </text>
          </g>
        )}
        {[20, 40, 50, 60, 80].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} class={g === 50 ? 'chart-rule mid' : 'chart-rule'} />
            <text x={PAD.l - 4} y={y(g) + 3} class="chart-axis" text-anchor="end">
              {g}
            </text>
          </g>
        ))}
        {seasons.map((yr, i) =>
          i % step === 0 || i === seasons.length - 1 ? (
            <text key={yr} x={x(i)} y={H - 6} class="chart-axis" text-anchor="middle">
              {`'${String(yr).slice(2)}`}
            </text>
          ) : null,
        )}
        {on.map((k) => (
          <path key={k} d={path(k)} fill="none" stroke={COLORS[keys.indexOf(k) % COLORS.length]} stroke-width="1.5" stroke-dasharray="4 2" />
        ))}
        <path d={path('mean')} fill="none" class="chart-mean" stroke-width="1" />
        <path d={path('overall')} fill="none" class="chart-main" stroke-width="2.5" />
        {log.map((e, i) => (
          <circle key={i} cx={x(i)} cy={y(e[1]!)} r="2.5" class="chart-dot" />
        ))}
      </svg>
      <div class="chart-legend" role="group" aria-label={__i18n_t("ui.gradeChart.text.125cde47")}>
        <span class="chip main">{__i18n_t("ui.gradeChart.text.f7c86d76")}</span>
        <span class="chip mean">{__i18n_t("ui.gradeChart.text.15547b87")}</span>
        {keys.map((k, i) => (
          <button key={k} type="button" class="chip" aria-pressed={on.includes(k)} onClick={() => toggle(k)} style={on.includes(k) ? { borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] } : undefined}>
            {TOOL_LABELS[k as keyof typeof TOOL_LABELS]}
          </button>
        ))}
      </div>
      <details>
        <summary class="small">{__i18n_t("ui.gradeChart.text.49fb12ae")}</summary>
        <div class="table-wrap">
          <table class="record-table small">
            <thead>
              <tr>
                <th>{__i18n_t("ui.gradeChart.text.b3000412")}</th>
                <th class="num">{__i18n_t("ui.gradeChart.text.f7c86d76")}</th>
                {keys.map((k) => (
                  <th key={k} class="num">
                    {TOOL_LABELS[k as keyof typeof TOOL_LABELS]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e[0]}>
                  <td>{e[0]}</td>
                  <td class="num strong">{e[1]}</td>
                  {keys.map((k) => (
                    <td key={k} class="num">
                      {valueOf(e, k) || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
