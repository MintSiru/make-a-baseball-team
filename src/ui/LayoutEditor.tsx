import { t as __i18n_t } from '../i18n/index';
/* 2.0.2: the ballpark layout editor (the user's request): our park's fence distance and height, drawn over the
   outline of today's fences, with the home-run factor it would make and what the works cost. The new fences open
   the next season (ballpark.ts layoutOption, layout.ts).

   Five points (left, left-centre, centre, right-centre, right) or, in the fine mode, one every 5° — enough for the
   odd shapes of the old major-league parks (a short corner behind a high wall, a deep alley). A point can be dragged
   along its line on the drawing; with "좌우 대칭" its mirror moves with it. The real parks, ours and some famous
   major-league ones can be loaded as a start. */
import { useRef, useState } from 'preact/hooks';
import { layoutOption } from '../league/ballpark';
import { angleOf, homeRunFactor, LAYOUT_BOUNDS, LAYOUTS, layoutOf, MLB_PRESETS, NEUTRAL, refine, type ParkLayout } from '../league/layout';
import type { Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import { money } from './format';

const ZONE_LABEL = () => [__i18n_t("ui.layoutEditor.text.62653dc7"), __i18n_t("ui.layoutEditor.text.f19bcd1a"), __i18n_t("ui.layoutEditor.text.00d61f4e"), __i18n_t("ui.layoutEditor.text.d1d124e1"), __i18n_t("ui.layoutEditor.text.39c7aac0")];

const PRESET_LABEL = (): Record<string, string> => ({
  lg: __i18n_t("ui.layoutEditor.text.fa42e37f"),
  kiwoom: __i18n_t("ui.layoutEditor.text.0287dd66"),
  ssg: __i18n_t("ui.layoutEditor.text.22e5e643"),
  kt: __i18n_t("ui.layoutEditor.text.08ccbbe9"),
  lotte: __i18n_t("ui.layoutEditor.text.1369d986"),
  samsung: __i18n_t("ui.layoutEditor.text.7ed5277e"),
  kia: __i18n_t("ui.layoutEditor.text.51d9696d"),
  nc: __i18n_t("ui.layoutEditor.text.d517715a"),
  hanwha: __i18n_t("ui.layoutEditor.text.b385d89b"),
  neutral: __i18n_t("ui.layoutEditor.text.d9b060bf"),
  fenway: __i18n_t("ui.layoutEditor.text.49779429"),
  yankee: __i18n_t("ui.layoutEditor.text.a7746e75"),
  oracle: __i18n_t("ui.layoutEditor.text.25345671"),
  wrigley: __i18n_t("ui.layoutEditor.text.ac78272c"),
  houston: __i18n_t("ui.layoutEditor.text.3e877e65"),
  coors: __i18n_t("ui.layoutEditor.text.215aa164"),
  dodger: __i18n_t("ui.layoutEditor.text.9e56ff2b"),
});
const presetOf = (key: string): ParkLayout | undefined => (key === 'neutral' ? NEUTRAL : (LAYOUTS[key] ?? MLB_PRESETS[key]));

const copy = (l: ParkLayout): ParkLayout => ({ dist: [...l.dist], wall: [...l.wall] });
const boundsAt = (l: ParkLayout, i: number) => (Math.abs(angleOf(l, i)) >= 40 ? LAYOUT_BOUNDS.lines : LAYOUT_BOUNDS.field);
const clamp = (x: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, x));

const K = 1.45,
  CX = 160,
  CY = 238;
const at = (a: number, d: number): [number, number] => [CX + d * K * Math.sin((a * Math.PI) / 180), CY - d * K * Math.cos((a * Math.PI) / 180)];
const line = (l: ParkLayout) =>
  l.dist
    .map((d, i) => at(angleOf(l, i), d))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

/** The drawing: today's fences dashed, the plan solid (thicker where the wall is higher), points to drag. */
function FieldView({ now, plan, onDrag }: { now: ParkLayout; plan: ParkLayout; onDrag: (i: number, dist: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [held, setHeld] = useState<number | null>(null);
  const move = (e: PointerEvent) => {
    if (held === null || !svg.current) return;
    const box = svg.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 320 - CX,
      y = CY - ((e.clientY - box.top) / box.height) * 250;
    const a = (angleOf(plan, held) * Math.PI) / 180;
    // How far along the point's own line the pointer is.
    onDrag(held, Math.round(((x * Math.sin(a) + y * Math.cos(a)) / K) * 2) / 2);
  };
  const [lx, ly] = at(-45, plan.dist[0]!),
    [rx, ry] = at(45, plan.dist[plan.dist.length - 1]!);
  return (
    <svg ref={svg} class="layout-field" viewBox="0 0 320 250" role="img" aria-label={__i18n_t("ui.layoutEditor.text.2aafec51")} onPointerMove={move} onPointerUp={() => setHeld(null)} onPointerLeave={() => setHeld(null)}>
      <polygon points={`${CX},${CY} ${line(plan)}`} fill="var(--good-bg, #e3f1e3)" stroke="none" />
      <line x1={CX} y1={CY} x2={lx} y2={ly} stroke="currentColor" stroke-width="0.8" />
      <line x1={CX} y1={CY} x2={rx} y2={ry} stroke="currentColor" stroke-width="0.8" />
      <polygon points={`${CX},${CY - 38.8 * K} ${CX + 19.4 * K},${CY - 19.4 * K} ${CX},${CY} ${CX - 19.4 * K},${CY - 19.4 * K}`} fill="none" stroke="currentColor" stroke-width="0.8" />
      <polyline points={line(now)} fill="none" stroke="currentColor" stroke-dasharray="3 3" stroke-width="1" opacity="0.6" />
      {plan.dist.slice(1).map((d, j) => {
        const [x1, y1] = at(angleOf(plan, j), plan.dist[j]!),
          [x2, y2] = at(angleOf(plan, j + 1), d);
        const h = (plan.wall[j]! + plan.wall[j + 1]!) / 2;
        return <line key={j} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent, #1f6fb2)" stroke-width={1.5 + h * 0.45} stroke-linecap="round" />;
      })}
      {plan.dist.map((d, i) => {
        const [x, y] = at(angleOf(plan, i), d);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={held === i ? 6 : 4.5}
            class="layout-handle"
            fill={held === i ? 'var(--accent, #1f6fb2)' : 'var(--bg, #fff)'}
            stroke="var(--accent, #1f6fb2)"
            stroke-width="1.5"
            onPointerDown={(e) => {
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              setHeld(i);
            }}
          >
            <title>{__i18n_t("ui.layoutEditor.text.8165f0f9", { angle: angleOf(plan, i), dist: d, wall: plan.wall[i]! })}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export function LayoutEditor({ league, act }: { league: LeagueState; act: (a: Action) => void }) {
  const u = league.user!;
  const base = layoutOf(league.teams.find((t) => t.id === u.teamId)!);
  const [plan, setPlan] = useState<ParkLayout>(copy(base));
  const [mirror, setMirror] = useState(false);
  const [preset, setPreset] = useState('');
  const o = layoutOption(league, plan);
  const fine = plan.dist.length > 5;
  const n = plan.dist.length;
  const set = (kind: 'dist' | 'wall', i: number, v: number) => {
    const next = copy(plan);
    const value = kind === 'dist' ? clamp(v, boundsAt(plan, i)) : clamp(v, LAYOUT_BOUNDS.wall);
    next[kind][i] = value;
    if (mirror) next[kind][n - 1 - i] = value;
    setPlan(next);
  };
  const labels = ZONE_LABEL();
  const label = (i: number) => (fine ? `${angleOf(plan, i) > 0 ? '+' : ''}${angleOf(plan, i)}°` : labels[i]!);
  const presets = PRESET_LABEL();
  return (
    <div class="layout-editor">
      <FieldView now={o.now} plan={plan} onDrag={(i, d) => set('dist', i, d)} />
      <p class="layout-options small">
        <label>
          {__i18n_t("ui.layoutEditor.text.f01a5a52")}{' '}
          <select
            value={preset}
            onChange={(e) => {
              const key = (e.currentTarget as HTMLSelectElement).value;
              setPreset(key);
              const p = presetOf(key);
              if (p) setPlan(fine ? refine(p) : copy(p));
            }}
          >
            <option value="">{__i18n_t("ui.layoutEditor.text.5c9cf21a")}</option>
            {Object.entries(presets).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
                {presetOf(k) ? ` (${homeRunFactor(presetOf(k)!).toFixed(2)})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={fine} onChange={(e) => setPlan((e.currentTarget as HTMLInputElement).checked ? refine(plan) : plan)} disabled={fine} /> {__i18n_t("ui.layoutEditor.text.a277e3a1")}
        </label>
        <label>
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror((e.currentTarget as HTMLInputElement).checked)} /> {__i18n_t("ui.layoutEditor.text.4e24b561")}
        </label>
      </p>
      {preset && MLB_PRESETS[preset] && <p class="muted small">{__i18n_t("ui.layoutEditor.text.9a2dddbe")}</p>}
      <div class="table-wrap">
        <table class="record-table small layout-table">
          <thead>
            <tr>
              <th>{__i18n_t("ui.layoutEditor.text.d57ae193")}</th>
              <th class="num">{__i18n_t("ui.layoutEditor.text.7d1e784b")}</th>
              <th class="num">{__i18n_t("ui.layoutEditor.text.30aa8639")}</th>
              <th class="num">{__i18n_t("ui.layoutEditor.text.d07eb370")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.dist.map((d, i) => {
              const b = boundsAt(plan, i);
              const was = o.now.dist.length === n ? `${o.now.dist[i]} / ${o.now.wall[i]}` : '';
              return (
                <tr key={i}>
                  <th scope="row">{label(i)}</th>
                  <td class="num">
                    <input type="number" step="0.5" min={b[0]} max={b[1]} value={d} aria-label={__i18n_t("ui.layoutEditor.text.51f0ac1e", { zone: label(i) })} onChange={(e) => set('dist', i, Number((e.currentTarget as HTMLInputElement).value))} />
                  </td>
                  <td class="num">
                    <input type="number" step="0.1" min={LAYOUT_BOUNDS.wall[0]} max={LAYOUT_BOUNDS.wall[1]} value={plan.wall[i]} aria-label={__i18n_t("ui.layoutEditor.text.5b4448b9", { zone: label(i) })} onChange={(e) => set('wall', i, Number((e.currentTarget as HTMLInputElement).value))} />
                  </td>
                  <td class="num muted">{was}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="small">{__i18n_t("ui.layoutEditor.text.5574e7bf", { from: o.factor.from.toFixed(2), to: o.factor.to.toFixed(2), cost: money(o.cost), opens: o.opens })}</p>
      <p class="inline-form">
        <button type="button" disabled={!!o.blocked} onClick={() => act({ kind: 'stadiumProject', project: 'layout', layout: plan })}>
          {__i18n_t("ui.layoutEditor.text.bde565c3")}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlan(copy(o.now));
            setPreset('');
          }}
        >
          {__i18n_t("ui.layoutEditor.text.660c89da")}
        </button>
        {o.blocked && <span class="muted small">{o.blocked}</span>}
      </p>
      <p class="muted small">
        {__i18n_t("ui.layoutEditor.text.c2d28afa", {
          a: LAYOUT_BOUNDS.lines[0],
          b: LAYOUT_BOUNDS.lines[1],
          c: LAYOUT_BOUNDS.field[0],
          d: LAYOUT_BOUNDS.field[1],
          e: LAYOUT_BOUNDS.wall[0],
          f: LAYOUT_BOUNDS.wall[1],
          fund: money(u.fund),
        })}
      </p>
    </div>
  );
}
