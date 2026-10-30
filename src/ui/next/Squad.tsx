/* 2.0.63 (the user's mockups, 새 UI): a club's players, one squad at a time — the squad, the view (시즌 · 상세 · 능력치,
   상세 in two pages) and the captains on one bar; pitchers and hitters in two sheets whose first heading counts them.
   The numbers that need the league (ERA-, FIP-, wRC+, WAR) only for the first team's own season. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { displayText as __i18n_displayText, t as __i18n_t } from '../../i18n/index';
import { TOOL_LABELS } from '../../draftroom';
import { usd } from '../../league/foreign';
import { fieldingRuns } from '../../league/fielding';
import type { LeagueState } from '../../league/state';
import { batterWar, leagueContext, pitcherWar, type RateContext, type LeagueContext } from '../../league/stats';
import { playerPark } from '../../league/venues';
import { rateContextFor, rates, rosterView, seasonTotals } from '../../league/views';
import type { BatTotals, PitTotals } from '../../model/types';
import { money, toolKeysFor } from '../format';
import { gradeClass, rowFuture, showsFutureDetail } from '../grades';
import { positionKey, useSort } from '../sort';
import type { Row, SquadKey } from '../Squad';

type View = 'season' | 'detail' | 'ratings';
type Page = 1 | 2;

/** The view and page the screen was left on. */
let last: { view: View; page: Page } = { view: 'season', page: 1 };

interface Col {
  key: string;
  label: ComponentChildren;
  num?: boolean;
  sort?: (r: Row) => number | string;
  first?: 1 | -1;
  cell: (r: Row) => ComponentChildren;
  strong?: boolean;
}

interface Ctx {
  league: LeagueState;
  rc: RateContext | null;
  lg: LeagueContext | null;
}

const f3 = rates.fmt3;
const f2 = (x: number) => x.toFixed(2);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const dash = '-';
const salaryText = (r: Row) => (r.usd ? usd(r.usd) : money(r.salary));
/** The first team's own season: the league's numbers apply. */
const own = (r: Row) => r.group === 'active' && !r.stats.futures;

function NameCell({ r, onPlayer }: { r: Row; onPlayer: (id: string) => void }) {
  return (
    <td class="name-cell">
      <span class="uniform">{r.number ?? ''}</span>
      <button type="button" class="link" onClick={() => onPlayer(r.id)}>
        {r.name}
      </button>
      {r.captain && (
        <span class="badge captain" title={r.captain === 'C' ? __i18n_t("ui.squad.text.a6ef8381") : __i18n_t("ui.squad.text.cb8f9e32")}>
          {r.captain}
        </span>
      )}
      {r.foreign && r.development ? (
        <span class="tag" title={__i18n_t("ui.squad.text.c8b4b844")}>
          {__i18n_t("ui.squad.text.82ee1a8f")}
        </span>
      ) : (
        <>
          {r.foreign && <span class="tag">{__i18n_t("ui.next.squad.text.7eec6190")}</span>}
          {r.development && <span class="tag">{__i18n_t("ui.squad.name.818f3b79")}</span>}
        </>
      )}
      {r.twoWay && <span class="tag two-way">{__i18n_t("ui.squad.text.62cb0192")}</span>}
      {r.injured && <span class="tag hurt">{r.injury}</span>}
      {r.knock && <span class="tag hurt">{r.injury}</span>}
      {r.away && <span class="tag">{__i18n_t("ui.squad.name.a567cc15")}</span>}
    </td>
  );
}

function Sheet({ title, rows, cols, onPlayer, actions, initial }: { title: string; rows: Row[]; cols: Col[]; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren; initial: string }) {
  const sortable = Object.fromEntries([['name', { value: (r: Row) => r.name }], ...cols.filter((c) => c.sort).map((c) => [c.key, { value: c.sort!, first: c.first }])]);
  const { sorted, th } = useSort(rows, sortable, { key: initial, dir: 1 });
  if (!rows.length) return null;
  return (
    <div class="table-wrap squad-sheet" tabIndex={0}>
      <table class="record-table squad-table">
        <thead>
          <tr>
            {th('name', title)}
            {cols.map((c) => (c.sort ? th(c.key, c.label, c.num) : <th key={c.key} class={c.num ? 'num' : undefined}>{c.label}</th>))}
            {actions && <th class="actions-head">{__i18n_t("ui.next.squad.text.080d34dc")}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <NameCell r={r} onPlayer={onPlayer} />
              {cols.map((c) => (
                <td key={c.key} class={[c.num && 'num', c.strong && 'strong'].filter(Boolean).join(' ') || undefined}>
                  {c.cell(r)}
                </td>
              ))}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Name, role or position, age, the grades now and to come: every view starts with them. */
function headCols(ctx: Ctx, pitchers: boolean, posControl?: (r: Row) => ComponentChildren): Col[] {
  const hand = (r: Row) => ctx.league.players[r.id]?.throws ?? '';
  return [
    {
      key: 'pos',
      label: pitchers ? __i18n_t("ui.squad.pitcherTable.d2fcd57f") : __i18n_t("ui.squad.hitterTable.81922a91"),
      sort: (r) => positionKey(r.pos),
      first: 1,
      cell: (r) =>
        pitchers ? (
          <>
            {posControl?.(r) ?? (
              <>
                {r.pos.replace('투수', '')} <span class="muted small">({hand(r)})</span>
                {r.penRoleSet && <span class="muted">{__i18n_t("ui.squad.pitcherTable.16b82790")}</span>}
              </>
            )}
            {r.starterInPen && <span class="muted">{__i18n_t("ui.squad.pitcherTable.811281ad")}</span>}
          </>
        ) : (
          <>
            {r.pos}
            {r.also.length > 0 && <span class="muted small"> · {r.also.join(' · ')}</span>}
            {posControl?.(r) ?? (r.platoon && <span class="muted"> ({r.platoon === 'L' ? __i18n_t("ui.squad.hitterTable.67500ef8") : __i18n_t("ui.squad.hitterTable.04afaad8")})</span>)}
          </>
        ),
    },
    { key: 'age', label: __i18n_t("ui.squad.pitcherTable.6c620e5c"), num: true, sort: (r) => r.age, first: 1, cell: (r) => r.age },
    { key: 'grade', label: __i18n_t("ui.squad.pitcherTable.001e4be2"), num: true, sort: (r) => r.grade, cell: (r) => <span class={gradeClass(r.grade)}>{r.grade}</span> },
    { key: 'future', label: __i18n_t("ui.squad.pitcherTable.6e0caec5"), num: true, strong: true, sort: (r) => rowFuture(r) ?? -1, cell: (r) => <span class={gradeClass(rowFuture(r))}>{rowFuture(r) ?? dash}</span> },
  ];
}

const moneyCols: Col[] = [
  { key: 'salary', label: __i18n_t("ui.squad.pitcherTable.cbf383ec"), num: true, sort: (r) => r.salary + r.usd * 0.14, cell: salaryText },
  { key: 'fa', label: 'FA', num: true, sort: (r) => r.fa.year ?? 9999, first: 1, cell: (r) => <span title={r.fa.text} class={r.fa.left === 0 || r.fa.left === 1 ? 'strong' : undefined}>{r.fa.short}</span> },
];

function pitcherCols(ctx: Ctx, view: View, page: Page): Col[] {
  const p = (r: Row): PitTotals | null => r.stats.pit;
  const n = (f: (x: PitTotals) => number | string, sort?: (x: PitTotals) => number): Pick<Col, 'cell' | 'sort'> => ({ cell: (r) => (p(r) ? f(p(r)!) : dash), sort: (r) => (p(r) ? (sort ?? ((x: PitTotals) => Number(f(x)) || 0))(p(r)!) : -1) });
  const ip: Col = { key: 'ip', label: __i18n_t("ui.squad.pitcherTable.639a1f2f"), num: true, ...n((x) => rates.ip(x.outs), (x) => x.outs) };
  const lgOk = (r: Row) => own(r) && !!ctx.rc && !!p(r)?.outs;
  const park = () => playerPark(ctx.league, ctx.league.user?.teamId ?? '', ctx.league.year);
  if (view === 'ratings') return ratingCols(ctx, true);
  if (view === 'season')
    return [
      { key: 'g', label: __i18n_t("ui.squad.pitcherTable.e0cee61a"), num: true, ...n((x) => x.g) },
      { key: 'gs', label: __i18n_t("ui.squad.text.a88271df"), num: true, ...n((x) => x.gs) },
      { key: 'wl', label: __i18n_t("ui.squad.pitcherTable.9660dd73"), num: true, ...n((x) => `${x.w}-${x.l}`, (x) => x.w - x.l) },
      { key: 'svh', label: __i18n_t("ui.squad.pitcherTable.df8372bc"), num: true, ...n((x) => `${x.sv}/${x.hld}`, (x) => x.sv + x.hld) },
      ip,
      { key: 'era', label: 'ERA', num: true, strong: true, first: 1, ...n((x) => (x.outs ? f2(rates.era(x)) : dash), (x) => (x.outs ? rates.era(x) : 99)) },
      { key: 'whip', label: 'WHIP', num: true, first: 1, ...n((x) => (x.outs ? f2(rates.whip(x)) : dash), (x) => (x.outs ? rates.whip(x) : 99)) },
      { key: 'k', label: __i18n_t("ui.squad.pitcherTable.3f349ed1"), num: true, ...n((x) => x.k) },
      ...moneyCols,
    ];
  if (page === 1)
    return [
      ip,
      { key: 'bf', label: __i18n_t("ui.next.squad.text.cc902740"), num: true, ...n((x) => x.bf) },
      { key: 'qs', label: 'QS', num: true, ...n((x) => x.qs) },
      { key: 'cg', label: __i18n_t("ui.next.squad.text.e401a056"), num: true, ...n((x) => x.cg ?? 0) },
      { key: 'h', label: __i18n_t("ui.next.squad.text.b68b86a7"), num: true, ...n((x) => x.h) },
      { key: 'hr', label: __i18n_t("ui.next.squad.text.bf21ab80"), num: true, ...n((x) => x.hr) },
      { key: 'bb', label: __i18n_t("ui.next.squad.text.21e0537f"), num: true, ...n((x) => x.bb) },
      { key: 'hbp', label: __i18n_t("ui.next.squad.text.c1c76b37"), num: true, ...n((x) => x.hbp) },
      { key: 'r', label: __i18n_t("ui.next.squad.text.65ccc960"), num: true, ...n((x) => `${x.r} / ${x.er}`, (x) => x.r) },
      { key: 'pitches', label: __i18n_t("ui.next.squad.text.5390f3ce"), num: true, ...n((x) => x.pitches) },
    ];
  return [
    ip,
    { key: 'era', label: 'ERA', num: true, first: 1, ...n((x) => (x.outs ? f2(rates.era(x)) : dash), (x) => (x.outs ? rates.era(x) : 99)) },
    { key: 'fip', label: 'FIP', num: true, strong: true, first: 1, cell: (r) => (lgOk(r) ? f2(rates.fip(p(r)!, ctx.rc!)) : dash), sort: (r) => (lgOk(r) ? rates.fip(p(r)!, ctx.rc!) : 99) },
    { key: 'eraMinus', label: 'ERA-', num: true, first: 1, cell: (r) => (lgOk(r) ? rates.eraMinus(p(r)!, ctx.rc!, park()) : dash), sort: (r) => (lgOk(r) ? rates.eraMinus(p(r)!, ctx.rc!, park()) : 999) },
    { key: 'fipMinus', label: 'FIP-', num: true, first: 1, cell: (r) => (lgOk(r) ? rates.fipMinus(p(r)!, ctx.rc!, park()) : dash), sort: (r) => (lgOk(r) ? rates.fipMinus(p(r)!, ctx.rc!, park()) : 999) },
    { key: 'k9', label: 'K/9', num: true, ...n((x) => (x.outs ? rates.per9(x.k, x.outs).toFixed(1) : dash), (x) => rates.per9(x.k, x.outs)) },
    { key: 'bb9', label: 'BB/9', num: true, first: 1, ...n((x) => (x.outs ? rates.per9(x.bb, x.outs).toFixed(1) : dash), (x) => (x.outs ? rates.per9(x.bb, x.outs) : 99)) },
    { key: 'kbb', label: 'K/BB', num: true, ...n((x) => (x.bb ? f2(x.k / x.bb) : dash), (x) => (x.bb ? x.k / x.bb : x.k)) },
    { key: 'babip', label: 'BABIP', num: true, first: 1, ...n((x) => (x.outs ? f3(rates.babipAllowed(x)) : dash), (x) => rates.babipAllowed(x)) },
    { key: 'war', label: 'WAR', num: true, strong: true, cell: (r) => (own(r) && ctx.lg && p(r) ? pitcherWar(p(r)!, ctx.lg).toFixed(1) : dash), sort: (r) => (own(r) && ctx.lg && p(r) ? pitcherWar(p(r)!, ctx.lg) : -99) },
  ];
}

function hitterCols(ctx: Ctx, view: View, page: Page): Col[] {
  const b = (r: Row): BatTotals | null => r.stats.bat;
  const n = (f: (x: BatTotals) => number | string, sort?: (x: BatTotals) => number): Pick<Col, 'cell' | 'sort'> => ({ cell: (r) => (b(r) ? f(b(r)!) : dash), sort: (r) => (b(r) ? (sort ?? ((x: BatTotals) => Number(f(x)) || 0))(b(r)!) : -1) });
  const pa: Col = { key: 'pa', label: __i18n_t("ui.next.squad.text.0a3d002c"), num: true, ...n((x) => x.pa) };
  const ops: Col = { key: 'ops', label: 'OPS', num: true, strong: true, ...n((x) => (x.pa ? f3(rates.ops(x)) : dash), (x) => (x.pa ? rates.ops(x) : 0)) };
  const lgOk = (r: Row) => own(r) && !!ctx.rc && !!b(r)?.pa;
  const pos = (r: Row) => ctx.league.players[r.id]?.position ?? 'DH';
  const park = () => playerPark(ctx.league, ctx.league.user?.teamId ?? '', ctx.league.year);
  if (view === 'ratings') return ratingCols(ctx, false);
  if (view === 'season')
    return [
      { key: 'g', label: __i18n_t("ui.squad.hitterTable.e0cee61a"), num: true, ...n((x) => x.g) },
      pa,
      { key: 'avg', label: __i18n_t("ui.squad.hitterTable.1eb19e0a"), num: true, ...n((x) => (x.ab ? f3(rates.avg(x)) : dash), (x) => (x.ab ? rates.avg(x) : 0)) },
      { key: 'hr', label: __i18n_t("ui.squad.hitterTable.9162d3a3"), num: true, ...n((x) => x.hr) },
      { key: 'rbi', label: __i18n_t("ui.squad.hitterTable.fed1c588"), num: true, ...n((x) => x.rbi) },
      { key: 'sb', label: __i18n_t("ui.squad.hitterTable.91e54831"), num: true, ...n((x) => x.sb) },
      ops,
      ...moneyCols,
    ];
  if (page === 1)
    return [
      pa,
      { key: 'ab', label: __i18n_t("ui.next.squad.text.6e593a9b"), num: true, ...n((x) => x.ab) },
      { key: 'h', label: __i18n_t("ui.next.squad.text.1822db88"), num: true, ...n((x) => x.h) },
      { key: 'd', label: __i18n_t("ui.next.squad.text.bc4313cd"), num: true, ...n((x) => x.d) },
      { key: 't', label: __i18n_t("ui.next.squad.text.4df9a1d0"), num: true, ...n((x) => x.t) },
      { key: 'r', label: __i18n_t("ui.next.squad.text.4b4a98b9"), num: true, ...n((x) => x.r) },
      { key: 'bb', label: __i18n_t("ui.next.squad.text.21e0537f"), num: true, ...n((x) => x.bb) },
      { key: 'k', label: __i18n_t("ui.squad.pitcherTable.3f349ed1"), num: true, first: 1, ...n((x) => x.k) },
      { key: 'gdp', label: __i18n_t("ui.next.squad.text.a379af4c"), num: true, first: 1, ...n((x) => x.gdp) },
      { key: 'obp', label: __i18n_t("ui.next.squad.text.bb6ef1b2"), num: true, ...n((x) => (x.pa ? f3(rates.obp(x)) : dash), (x) => rates.obp(x)) },
      { key: 'slg', label: __i18n_t("ui.next.squad.text.7e66b88d"), num: true, ...n((x) => (x.ab ? f3(rates.slg(x)) : dash), (x) => rates.slg(x)) },
      ops,
    ];
  return [
    pa,
    { key: 'woba', label: 'wOBA', num: true, ...n((x) => (x.pa ? f3(rates.woba(x)) : dash), (x) => (x.pa ? rates.woba(x) : 0)) },
    { key: 'wrc', label: 'wRC+', num: true, strong: true, cell: (r) => (lgOk(r) ? Math.round(rates.wrcPlus(b(r)!, ctx.rc!, park())) : dash), sort: (r) => (lgOk(r) ? rates.wrcPlus(b(r)!, ctx.rc!, park()) : -999) },
    { key: 'babip', label: 'BABIP', num: true, ...n((x) => (x.ab ? f3(rates.babip(x)) : dash), (x) => rates.babip(x)) },
    { key: 'iso', label: 'ISO', num: true, ...n((x) => (x.ab ? f3(rates.slg(x) - rates.avg(x)) : dash), (x) => rates.slg(x) - rates.avg(x)) },
    { key: 'bbp', label: 'BB%', num: true, ...n((x) => (x.pa ? pct(x.bb / x.pa) : dash), (x) => (x.pa ? x.bb / x.pa : 0)) },
    { key: 'kp', label: 'K%', num: true, first: 1, ...n((x) => (x.pa ? pct(x.k / x.pa) : dash), (x) => (x.pa ? x.k / x.pa : 1)) },
    { key: 'sbcs', label: __i18n_t("ui.squad.hitterTable.91e54831"), num: true, ...n((x) => `${x.sb}/${x.sb + x.cs}`, (x) => x.sb) },
    { key: 'fld', label: __i18n_t("ui.next.squad.text.15edb98e"), num: true, ...n((x) => (x.fld ? signed(fieldingRuns(x.fld)) : dash), (x) => (x.fld ? fieldingRuns(x.fld) : -99)) },
    { key: 'war', label: 'WAR', num: true, strong: true, cell: (r) => (own(r) && ctx.lg && b(r) ? batterWar(b(r)!, pos(r), ctx.lg).toFixed(1) : dash), sort: (r) => (own(r) && ctx.lg && b(r) ? batterWar(b(r)!, pos(r), ctx.lg) : -99) },
  ];
}

const signed = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));

/** Each tool the scouts grade, now and (where shown) what they see him becoming. */
function ratingCols(ctx: Ctx, pitchers: boolean): Col[] {
  const keys = toolKeysFor(pitchers ? 'SP' : 'C');
  const player = (r: Row) => ctx.league.players[r.id]!;
  const now = (r: Row, k: (typeof keys)[number]) => player(r).scouting.tools[k] ?? 0;
  const later = (r: Row, k: (typeof keys)[number]) => (showsFutureDetail(player(r)) ? player(r).scouting.futureTools[k] : undefined);
  return [
    ...keys.map(
      (k): Col => ({
        key: k,
        label: __i18n_displayText(TOOL_LABELS[k]),
        num: true,
        sort: (r) => now(r, k),
        cell: (r) => {
          const a = now(r, k),
            f = later(r, k);
          return (
            <>
              <span class={gradeClass(a)}>{a}</span>
              {f != null && f > a && <span class="muted small"> →{f}</span>}
            </>
          );
        },
      }),
    ),
    ...(pitchers ? [{ key: 'velocity', label: __i18n_t("ui.squad.text.b8c2e079"), num: true, sort: (r: Row) => player(r).velocity ?? 0, cell: (r: Row) => (player(r).velocity ? `${player(r).velocity}km` : dash) }] : []),
    ...moneyCols,
  ];
}

export function NextSquad({
  league,
  teamId,
  onPlayer,
  actions,
  posControl,
  toolbar,
}: {
  league: LeagueState;
  teamId: string;
  onPlayer: (id: string) => void;
  actions?: (squad: SquadKey) => ((r: Row) => ComponentChildren) | undefined;
  posControl?: (squad: SquadKey) => ((r: Row) => ComponentChildren) | undefined;
  toolbar?: ComponentChildren;
}) {
  const roster = rosterView(league, teamId);
  const [key, setKey] = useState<SquadKey>(roster.active.length ? 'active' : 'futures');
  const [state, setState] = useState(last);
  const set = (x: Partial<typeof last>) => setState((last = { ...state, ...x }));
  const { view, page } = state;
  const rows = roster[key];
  const t = seasonTotals(league);
  const ctx: Ctx = { league, rc: rateContextFor(league, league.year), lg: t.bat.pa ? leagueContext(t.bat, t.pit) : null };
  const pitchers = rows.filter((r) => r.pitcher),
    hitters = rows.filter((r) => !r.pitcher);
  const minors = key !== 'active' && view !== 'ratings';
  const title = (n: number, label: string) => `${label} (${__i18n_t("ui.next.squad.text.c876675f", { n })})${minors ? ` · ${__i18n_t("ui.next.squad.text.fe953583")}` : ''}`;
  const squads: [SquadKey, string][] = [
    ['active', __i18n_t("ui.squad.sQUADS.label.ef2caeba")],
    ['futures', __i18n_t("ui.squad.sQUADS.label.e6607847")],
    ['third', __i18n_t("ui.squad.sQUADS.label.0dce8d6b")],
    ['military', __i18n_t("ui.squad.sQUADS.label.285374d7")],
  ];
  const sheetKey = `${key}-${view}-${page}`;
  return (
    <div class="squad next-squad">
      <div class="squad-bar">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.squad.squad.5b9daec2")}>
          {squads.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}>
              {label} <span class="count">({roster[k].length})</span>
            </button>
          ))}
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.squad.text.b38d51fa")}>
          {(
            [
              ['season', __i18n_t("ui.next.squad.text.b3000412")],
              ['detail', __i18n_t("ui.next.squad.text.bb446431")],
              ['ratings', __i18n_t("ui.squad.text.9e9117d0")],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => set({ view: v })}>
              {label}
            </button>
          ))}
        </div>
        {view === 'detail' && (
          <div class="segmented" role="group" aria-label={__i18n_t("ui.next.squad.text.7f604fc2")}>
            {([1, 2] as Page[]).map((x) => (
              <button key={x} type="button" aria-pressed={page === x} onClick={() => set({ page: x })}>
                {x} / 2
              </button>
            ))}
          </div>
        )}
        {toolbar && <div class="squad-aside">{toolbar}</div>}
      </div>
      {!rows.length && <p class="empty">{__i18n_t("ui.squad.squad.8abc45cd")}</p>}
      <Sheet key={`p-${sheetKey}`} title={title(pitchers.length, __i18n_t("ui.squad.text.ef406667"))} rows={pitchers} cols={[...headCols(ctx, true, posControl?.(key)), ...pitcherCols(ctx, view, page)]} onPlayer={onPlayer} actions={actions?.(key)} initial="pos" />
      <Sheet key={`h-${sheetKey}`} title={title(hitters.length, __i18n_t("ui.squad.text.5db174c6"))} rows={hitters} cols={[...headCols(ctx, false, posControl?.(key)), ...hitterCols(ctx, view, page)]} onPlayer={onPlayer} actions={actions?.(key)} initial="pos" />
    </div>
  );
}
