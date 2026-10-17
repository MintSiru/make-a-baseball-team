import { t as __i18n_t } from '../i18n/index';
/* 2.0.2: the ballpark layout editor (the user's request): our park's fence distance and height to each field, drawn
   over the outline of today's fences, with the home-run factor it would make and what the works cost. The new
   fences open the next season (ballpark.ts layoutOption, layout.ts). */
import { useState } from 'preact/hooks';
import { layoutOption } from '../league/ballpark';
import { LAYOUT_BOUNDS, layoutOf, type ParkLayout } from '../league/layout';
import type { Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import { money } from './format';

const ZONE_LABEL = () => [__i18n_t("ui.layoutEditor.text.62653dc7"), __i18n_t("ui.layoutEditor.text.f19bcd1a"), __i18n_t("ui.layoutEditor.text.00d61f4e"), __i18n_t("ui.layoutEditor.text.d1d124e1"), __i18n_t("ui.layoutEditor.text.39c7aac0")];
const ANGLES = [-45, -22.5, 0, 22.5, 45];

/** The fences as a line over the field (home plate at the bottom, 1 m = `k` px). */
function fencePoints(l: ParkLayout, k: number, cx: number, cy: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let a = -45; a <= 45; a += 5) {
    const i = Math.min(3, Math.floor((a + 45) / 22.5));
    const t = (a - ANGLES[i]!) / 22.5;
    const d = l.dist[i]! + (l.dist[i + 1]! - l.dist[i]!) * t;
    const r = (a * Math.PI) / 180;
    pts.push([cx + d * k * Math.sin(r), cy - d * k * Math.cos(r)]);
  }
  return pts;
}

function FieldView({ now, plan }: { now: ParkLayout; plan: ParkLayout }) {
  const k = 1.7,
    cx = 160,
    cy = 238;
  const line = (l: ParkLayout) => fencePoints(l, k, cx, cy).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const corner = (a: number, d: number) => [cx + d * k * Math.sin((a * Math.PI) / 180), cy - d * k * Math.cos((a * Math.PI) / 180)] as const;
  const [lx, ly] = corner(-45, plan.dist[0]),
    [rx, ry] = corner(45, plan.dist[4]);
  return (
    <svg class="layout-field" viewBox="0 0 320 250" role="img" aria-label={__i18n_t("ui.layoutEditor.text.2aafec51")}>
      <polygon points={`${cx},${cy} ${line(plan)}`} fill="var(--good-bg, #e3f1e3)" stroke="none" />
      <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="currentColor" stroke-width="0.8" />
      <line x1={cx} y1={cy} x2={rx} y2={ry} stroke="currentColor" stroke-width="0.8" />
      <polygon points={`${cx},${cy - 38.8 * k} ${cx + 19.4 * k},${cy - 19.4 * k} ${cx},${cy} ${cx - 19.4 * k},${cy - 19.4 * k}`} fill="none" stroke="currentColor" stroke-width="0.8" />
      <polyline points={line(now)} fill="none" stroke="currentColor" stroke-dasharray="3 3" stroke-width="1" opacity="0.6" />
      {plan.wall.map((w, i) => {
        const [x, y] = corner(ANGLES[i]!, plan.dist[i]!);
        return <circle key={i} cx={x} cy={y} r={2 + w * 0.6} fill="var(--accent, #1f6fb2)" opacity="0.8" />;
      })}
      <polyline points={line(plan)} fill="none" stroke="var(--accent, #1f6fb2)" stroke-width="2.5" />
    </svg>
  );
}

export function LayoutEditor({ league, act }: { league: LeagueState; act: (a: Action) => void }) {
  const u = league.user!;
  const base = layoutOf(league.teams.find((t) => t.id === u.teamId)!);
  const [plan, setPlan] = useState<ParkLayout>({ dist: [...base.dist], wall: [...base.wall] });
  const o = layoutOption(league, plan);
  const set = (kind: 'dist' | 'wall', i: number, v: number) => {
    const next: ParkLayout = { dist: [...plan.dist], wall: [...plan.wall] };
    next[kind][i] = v;
    setPlan(next);
  };
  const bounds = (i: number) => (i === 0 || i === 4 ? LAYOUT_BOUNDS.lines : i === 2 ? LAYOUT_BOUNDS.centre : LAYOUT_BOUNDS.alleys);
  const zones = ZONE_LABEL();
  return (
    <div class="layout-editor">
      <FieldView now={o.now} plan={plan} />
      <div class="table-wrap">
        <table class="record-table small">
          <thead>
            <tr>
              <th />
              {zones.map((z) => (
                <th key={z} class="num">
                  {z}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{__i18n_t("ui.layoutEditor.text.7d1e784b")}</th>
              {plan.dist.map((d, i) => (
                <td key={i} class="num">
                  <input type="number" step="0.5" min={bounds(i)[0]} max={bounds(i)[1]} value={d} aria-label={__i18n_t("ui.layoutEditor.text.51f0ac1e", { zone: zones[i]! })} onInput={(e) => set('dist', i, Number((e.currentTarget as HTMLInputElement).value))} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">{__i18n_t("ui.layoutEditor.text.30aa8639")}</th>
              {plan.wall.map((w, i) => (
                <td key={i} class="num">
                  <input type="number" step="0.1" min={LAYOUT_BOUNDS.wall[0]} max={LAYOUT_BOUNDS.wall[1]} value={w} aria-label={__i18n_t("ui.layoutEditor.text.5b4448b9", { zone: zones[i]! })} onInput={(e) => set('wall', i, Number((e.currentTarget as HTMLInputElement).value))} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">{__i18n_t("ui.layoutEditor.text.d07eb370")}</th>
              {o.now.dist.map((d, i) => (
                <td key={i} class="num muted">{`${d} / ${o.now.wall[i]}`}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small">
        {__i18n_t("ui.layoutEditor.text.5574e7bf", { from: o.factor.from.toFixed(2), to: o.factor.to.toFixed(2), cost: money(o.cost), opens: o.opens })}
      </p>
      <p class="inline-form">
        <button type="button" disabled={!!o.blocked} onClick={() => act({ kind: 'stadiumProject', project: 'layout', layout: plan })}>
          {__i18n_t("ui.layoutEditor.text.bde565c3")}
        </button>
        <button type="button" onClick={() => setPlan({ dist: [...o.now.dist], wall: [...o.now.wall] })}>
          {__i18n_t("ui.layoutEditor.text.660c89da")}
        </button>
        {o.blocked && <span class="muted small">{o.blocked}</span>}
      </p>
      <p class="muted small">{__i18n_t("ui.layoutEditor.text.54abb2ee", { fund: money(u.fund) })}</p>
    </div>
  );
}
