/* 2.0.4 (the 2.0 plan's fifth stage, the user's request): a player's Savant-style page — his percentile bars among
   the league's regulars this season, where his hits came down (drawn on his home park's fences), a pitcher's mix and
   velocity by season — and his head-to-head records against the other side's men (savant.ts, matchups.ts). */
import { displayText as __i18n_displayText, t as __i18n_t } from '../i18n/index';
import { useState } from 'preact/hooks';
import { layoutOf, angleOf, type ParkLayout } from '../league/layout';
import { meetingRates, meetingsOf, type HeadToHead } from '../league/matchups';
import { FASTBALL_LABELS, PITCH_LABELS, type PitchType } from '../league/pitches';
import { mixBySeason, percentilesOf, sprayOf, type PercentileKey } from '../league/savant';
import type { LeagueState } from '../league/state';
import { shortName } from '../league/views';

const BAT_LABEL = (): Record<PercentileKey, string> => ({
  xwoba: 'xwOBA',
  xba: 'xBA',
  xslg: 'xSLG',
  ev: __i18n_t("ui.savant.text.bae99af2"),
  barrel: __i18n_t("ui.savant.text.4c8fb2fa"),
  hard: __i18n_t("ui.savant.text.39e6623f"),
  kPct: __i18n_t("ui.savant.text.0e04dbc3"),
  bbPct: __i18n_t("ui.savant.text.4cb738d8"),
  sprint: __i18n_t("ui.savant.text.f658f79c"),
  oaa: 'OAA',
  velo: __i18n_t("ui.savant.text.fb9c1e5f"),
  gb: __i18n_t("ui.savant.text.19c79bd9"),
});
const PIT_LABEL = (): Partial<Record<PercentileKey, string>> => ({
  xwoba: __i18n_t("ui.savant.text.3cf8c92d"),
  xba: __i18n_t("ui.savant.text.ebd18378"),
  ev: __i18n_t("ui.savant.text.71f609ba"),
  barrel: __i18n_t("ui.savant.text.35f72d72"),
  hard: __i18n_t("ui.savant.text.38ddbdc2"),
});

/** Savant's colours: blue at the bottom, grey in the middle, red at the top. */
function shade(pct: number) {
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i]! - x) * t));
  const blue = [42, 110, 187],
    grey = [190, 190, 190],
    red = [210, 45, 73];
  const c = pct < 50 ? mix(blue, grey, pct / 50) : mix(grey, red, (pct - 50) / 50);
  return `rgb(${c.join(',')})`;
}

function Bars({ rows, pitcher }: { rows: { key: PercentileKey; value: string; pct: number }[]; pitcher: boolean }) {
  const labels = BAT_LABEL(),
    pit = PIT_LABEL();
  return (
    <ul class="savant-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <span class="savant-label">{(pitcher ? pit[r.key] : undefined) ?? labels[r.key]}</span>
          <span class="savant-track" role="img" aria-label={__i18n_t("ui.savant.text.c88675e1", { label: (pitcher ? pit[r.key] : undefined) ?? labels[r.key], pct: r.pct })}>
            <span class="savant-fill" style={{ width: `${r.pct}%`, background: shade(r.pct) }} />
            <span class="savant-dot" style={{ left: `${r.pct}%`, background: shade(r.pct) }}>
              {r.pct}
            </span>
          </span>
          <span class="savant-value num">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

const K = 1.45,
  CX = 160,
  CY = 238;
const at = (a: number, d: number): [number, number] => [CX + d * K * Math.sin((a * Math.PI) / 180), CY - d * K * Math.cos((a * Math.PI) / 180)];
const fence = (l: ParkLayout) =>
  l.dist
    .map((d, i) => at(angleOf(l, i), d))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
const HIT_COLOR = ['#7c8a9e', '#2f9e44', '#e8590c', '#d6336c'];
const HIT_LABEL = () => [__i18n_t("ui.savant.text.1822db88"), __i18n_t("ui.savant.text.bc4313cd"), __i18n_t("ui.savant.text.4df9a1d0"), __i18n_t("ui.savant.text.9162d3a3")];

/** Where his hits came down this season, on his home park's fences. */
function Spray({ league, id }: { league: LeagueState; id: string }) {
  const pts = sprayOf(league, id);
  const team = league.teams.find((t) => t.id === (league.lines[id]?.teamId ?? league.players[id]?.teamId));
  if (!pts.length || !team) return <p class="muted small">{__i18n_t("ui.savant.text.86eebc0a")}</p>;
  const park = layoutOf(team);
  const [lx, ly] = at(-45, park.dist[0]!),
    [rx, ry] = at(45, park.dist[park.dist.length - 1]!);
  const names = HIT_LABEL();
  const count = [0, 0, 0, 0];
  for (const p of pts) count[p.hit]!++;
  return (
    <figure class="spray">
      <svg class="layout-field" viewBox="0 0 320 250" role="img" aria-label={__i18n_t("ui.savant.text.3a75addd")}>
        <polygon points={`${CX},${CY} ${fence(park)}`} fill="var(--good-bg, #e3f1e3)" stroke="none" />
        <line x1={CX} y1={CY} x2={lx} y2={ly} stroke="currentColor" stroke-width="0.8" />
        <line x1={CX} y1={CY} x2={rx} y2={ry} stroke="currentColor" stroke-width="0.8" />
        <polygon points={`${CX},${CY - 38.8 * K} ${CX + 19.4 * K},${CY - 19.4 * K} ${CX},${CY} ${CX - 19.4 * K},${CY - 19.4 * K}`} fill="none" stroke="currentColor" stroke-width="0.8" />
        <polyline points={fence(park)} fill="none" stroke="var(--accent, #1f6fb2)" stroke-width="2" />
        {pts.map((p, i) => {
          const [x, y] = at(p.dir, Math.min(p.dist, 160));
          return <circle key={i} cx={x} cy={y} r={p.hit === 3 ? 3 : 2.2} fill={HIT_COLOR[p.hit]} fill-opacity="0.75" stroke="none" />;
        })}
      </svg>
      <figcaption class="small">
        {names.map((n, i) => (
          <span key={i} class="spray-key">
            <span class="spray-swatch" style={{ background: HIT_COLOR[i] }} /> {n} {count[i]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

const PITCH_COLOR: Record<string, string> = { '4SFB': '#d22d49', '2SFB': '#fe9d00', CUT: '#933f2c', SNK: '#fe9d00', SL: '#eee716', SW: '#ddb33a', SLV: '#c3bd0e', CB: '#00d1ed', CH: '#1dbe3a', CIR: '#3bacac', FRK: '#55ccab', SPL: '#3bacac', KN: '#867a08', SCR: '#6236cd', PLM: '#4cc9f0', SH: '#888' };
const pitchName = (t: string) => __i18n_displayText((FASTBALL_LABELS as Record<string, string>)[t] ?? PITCH_LABELS[t as PitchType] ?? t);

/** A pitcher's mix by season: one bar a season, his average velocity beside it. */
function Mix({ league, id }: { league: LeagueState; id: string }) {
  const p = league.players[id]!;
  const rows = mixBySeason(league, p);
  if (!rows.length) return <p class="muted small">{__i18n_t("ui.savant.text.0fcb4911")}</p>;
  const types = [...new Set(rows.flatMap((r) => r.mix.map(([t]) => t)))];
  return (
    <div class="pitch-mix">
      {rows.map((r) => (
        <div key={r.year} class="pitch-mix-row">
          <span class="pitch-mix-year">{r.current ? __i18n_t("ui.savant.text.04555519", { year: r.year }) : String(r.year)}</span>
          <span class="pitch-mix-bar" role="img" aria-label={r.mix.map(([t, x]) => `${pitchName(t)} ${x}%`).join(', ')}>
            {r.mix.map(([t, x]) => (
              <span key={t} style={{ width: `${x}%`, background: PITCH_COLOR[t] ?? '#999' }} title={`${pitchName(t)} ${x}%`} />
            ))}
          </span>
          <span class="pitch-mix-velo num">{r.velo == null ? '-' : `${r.velo}km/h`}</span>
        </div>
      ))}
      <p class="small">
        {types.map((t) => (
          <span key={t} class="spray-key">
            <span class="spray-swatch" style={{ background: PITCH_COLOR[t] ?? '#999' }} /> {pitchName(t)}
          </span>
        ))}
      </p>
    </div>
  );
}

export function SavantView({ league, id, pitcher }: { league: LeagueState; id: string; pitcher: boolean }) {
  const pc = percentilesOf(league, id);
  const rows = pitcher ? pc.pitching : pc.batting;
  return (
    <div class="savant">
      <h4>{__i18n_t("ui.savant.text.483f877c", { year: league.year })}</h4>
      {rows ? <Bars rows={rows} pitcher={pitcher} /> : <p class="muted small">{__i18n_t("ui.savant.text.8a2110bc")}</p>}
      <p class="muted small">{pitcher ? __i18n_t("ui.savant.text.503d5b84") : __i18n_t("ui.savant.text.6985c142")}</p>
      {!pitcher && (
        <>
          <h4>{__i18n_t("ui.savant.text.eeb111e4")}</h4>
          <Spray league={league} id={id} />
        </>
      )}
      {pitcher && (
        <>
          <h4>{__i18n_t("ui.savant.text.1ab9d4af")}</h4>
          <Mix league={league} id={id} />
        </>
      )}
    </div>
  );
}

const avg3 = (x: number) => x.toFixed(3).replace(/^0/, '');

/** His meetings with the other side's men, this season or in all (from 2.0.4), the most plate appearances first. */
export function MeetingsView({ league, id, pitcher, onPlayer }: { league: LeagueState; id: string; pitcher: boolean; onPlayer?: (id: string) => void }) {
  const [season, setSeason] = useState(false);
  const all = meetingsOf(league, id, pitcher);
  const rows = (season ? all.filter((r) => r.season).sort((a, b) => b.season![0]! - a.season![0]!) : all).slice(0, 40);
  return (
    <div class="meetings">
      <div class="segmented small" role="group" aria-label={__i18n_t("ui.savant.text.50c85ebb")}>
        <button type="button" aria-pressed={!season} onClick={() => setSeason(false)}>
          {__i18n_t("ui.savant.text.fc7fa3d0")}
        </button>
        <button type="button" aria-pressed={season} onClick={() => setSeason(true)}>
          {__i18n_t("ui.savant.text.de766445", { year: league.year })}
        </button>
      </div>
      {rows.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table small">
            <thead>
              <tr>
                <th>{pitcher ? __i18n_t("ui.savant.text.cc902740") : __i18n_t("ui.savant.text.c861cc40")}</th>
                <th>{__i18n_t("ui.savant.text.5d24a2fc")}</th>
                <th class="num">{__i18n_t("ui.savant.text.0a3d002c")}</th>
                <th class="num">{__i18n_t("ui.savant.text.6e593a9b")}</th>
                <th class="num">{__i18n_t("ui.savant.text.1822db88")}</th>
                <th class="num">{__i18n_t("ui.savant.text.9162d3a3")}</th>
                <th class="num">{__i18n_t("ui.savant.text.e9cb0b7d")}</th>
                <th class="num">{__i18n_t("ui.savant.text.3f349ed1")}</th>
                <th class="num">{__i18n_t("ui.savant.text.1eb19e0a")}</th>
                <th class="num">{__i18n_t("ui.savant.text.bb6ef1b2")}</th>
                <th class="num">{__i18n_t("ui.savant.text.7e66b88d")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = season ? r.season! : r.career;
                const x = meetingRates(m);
                const o = league.players[r.opponent];
                return (
                  <tr key={r.opponent}>
                    <td>
                      {onPlayer ? (
                        <button type="button" class="link" onClick={() => onPlayer(r.opponent)}>
                          {o?.name ?? '?'}
                        </button>
                      ) : (
                        (o?.name ?? '?')
                      )}
                    </td>
                    <td>{__i18n_displayText(shortName(league, o?.teamId ?? null))}</td>
                    <td class="num">{m[0]}</td>
                    <td class="num">{m[1]}</td>
                    <td class="num">{m[2]}</td>
                    <td class="num">{m[4]}</td>
                    <td class="num">{m[5]}</td>
                    <td class="num">{m[6]}</td>
                    <td class="num">{avg3(x.avg)}</td>
                    <td class="num">{avg3(x.obp)}</td>
                    <td class="num">{avg3(x.slg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.savant.text.f6efb5dd")}</p>
      )}
      <p class="muted small">{__i18n_t("ui.savant.text.414dc9c3")}</p>
    </div>
  );
}

/** Each club's season series against each other, this season or every season kept (from 2.0.4). */
export function HeadToHeadTable({ league, h2h, order }: { league: LeagueState; h2h: HeadToHead; order: string[] }) {
  const teams = [...order, ...Object.keys(h2h).filter((id) => !order.includes(id))].filter((id) => h2h[id]).map((id) => ({ id }));
  if (!teams.length) return <p class="muted">{__i18n_t("ui.savant.text.edeb5759")}</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table small h2h-table">
        <thead>
          <tr>
            <th>{__i18n_t("ui.savant.text.58756112")}</th>
            {teams.map((t) => (
              <th key={t.id} class="num">
                {__i18n_displayText(shortName(league, t.id))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((a) => (
            <tr key={a.id}>
              <th scope="row">{__i18n_displayText(shortName(league, a.id))}</th>
              {teams.map((b) => {
                const c = h2h[a.id]?.[b.id];
                if (a.id === b.id || !c) return <td key={b.id} class="num muted">-</td>;
                const [w, l, t] = c;
                return (
                  <td key={b.id} class={`num${w > l ? ' good' : w < l ? ' bad' : ''}`}>
                    {t ? `${w}-${l}-${t}` : `${w}-${l}`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
