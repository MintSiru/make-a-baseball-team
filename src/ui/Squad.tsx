import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* A club's players, one squad at a time (1군 / 퓨처스 / 잔류군 / 군 복무), pitchers and hitters in
   separate tables with the numbers that matter for each. Every heading sorts. The user's club adds a
   column of move buttons. */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { usd } from '../league/foreign';
import type { LeagueState } from '../league/state';
import { rates, rosterView } from '../league/views';
import { money, toolKeysFor } from './format';
import { gradeClass, rowFuture, showsFutureDetail } from './grades';
import { TOOL_LABELS } from '../draftroom';
import { positionKey, useSort } from './sort';
import { useUi } from './useDisplay';
import { NextSquad } from './next/Squad';

export type Row = ReturnType<typeof rosterView>['active'][number];
export type SquadKey = 'active' | 'futures' | 'third' | 'military';

const SQUADS: { key: SquadKey; label: string; note?: string }[] = [
  { key: 'active', label: __i18n_k("ui.squad.sQUADS.label.ef2caeba") },
  { key: 'futures', label: __i18n_k("ui.squad.sQUADS.label.e6607847") },
  { key: 'third', label: __i18n_k("ui.squad.sQUADS.label.0dce8d6b"), note: __i18n_k("ui.squad.sQUADS.note.38331eee") },
  { key: 'military', label: __i18n_k("ui.squad.sQUADS.label.285374d7") },
];

const f3 = rates.fmt3;
const salaryText = (r: Row) => (r.usd ? usd(r.usd) : money(r.salary));

function Name({ r, onPlayer }: { r: Row; onPlayer: (id: string) => void }) {
  return (
    <td class="name-cell">
      <span class="uniform">{__i18n_display(r.number ?? '')}</span>
      <button type="button" class="link" onClick={() => onPlayer(r.id)}>
        {__i18n_display(r.name)}
      </button>
      {r.captain && (
        <span class="tag captain" title={r.captain === 'C' ? __i18n_t("ui.squad.text.a6ef8381") : __i18n_t("ui.squad.text.cb8f9e32")}>
          {r.captain}
        </span>
      )}
      {/* 2.0.41 (the user's report): a development foreign player gets one tag, not two (the name column ran over the stats on a phone). */}
      {r.foreign && r.development ? (
        <span class="tag" title={__i18n_t("ui.squad.text.c8b4b844")}>{__i18n_t("ui.squad.text.82ee1a8f")}</span>
      ) : (
        <>
          {__i18n_display(r.foreign && <span class="tag">{__i18n_t("ui.squad.name.5bd804b7")}</span>)}
          {__i18n_display(r.development && <span class="tag">{__i18n_t("ui.squad.name.818f3b79")}</span>)}
        </>
      )}
      {r.twoWay && <span class="tag two-way">{__i18n_t("ui.squad.text.62cb0192")}</span>}
      {__i18n_display(r.injured && (
        <span class="tag warn" title={__i18n_displayText(r.injury)}>{__i18n_t("ui.squad.name.501fb802")}</span>
      ))}
      {__i18n_display(r.knock && (
        <span class="tag" title={__i18n_displayText(r.injury)}>{__i18n_t("ui.squad.name.7d657386")}</span>
      ))}
      {__i18n_display(r.away && <span class="tag">{__i18n_t("ui.squad.name.a567cc15")}</span>)}
    </td>
  );
}

function PitcherTable({ rows, onPlayer, actions, posControl }: { rows: Row[]; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren; posControl?: (r: Row) => ComponentChildren }) {
  const p = (r: Row) => r.stats.pit;
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      grade: { value: (r) => r.grade },
      future: { value: (r) => rowFuture(r) ?? -1 },
      g: { value: (r) => p(r)?.g ?? 0 },
      gs: { value: (r) => p(r)?.gs ?? 0 },
      wl: { value: (r) => (p(r)?.w ?? 0) - (p(r)?.l ?? 0) },
      svh: { value: (r) => (p(r)?.sv ?? 0) + (p(r)?.hld ?? 0) },
      ip: { value: (r) => p(r)?.outs ?? 0 },
      era: { value: (r) => (p(r)?.outs ? rates.era(p(r)!) : 99), first: 1 },
      whip: { value: (r) => (p(r)?.outs ? rates.whip(p(r)!) : 99), first: 1 },
      k: { value: (r) => p(r)?.k ?? 0 },
      salary: { value: (r) => r.salary + r.usd * 0.14 },
      fa: { value: (r) => r.fa.year ?? 9999, first: 1 },
    },
    { key: 'pos', dir: 1 },
  );
  if (!rows.length) return null;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table squad-table">
        <thead>
          <tr>
            {__i18n_display(th('name', '투수'))}
            {__i18n_display(th('pos', __i18n_k("ui.squad.pitcherTable.d2fcd57f")))}
            {__i18n_display(th('age', __i18n_k("ui.squad.pitcherTable.6c620e5c"), true))}
            {__i18n_display(th('grade', __i18n_k("ui.squad.pitcherTable.001e4be2"), true))}
            {__i18n_display(th('future', __i18n_k("ui.squad.pitcherTable.6e0caec5"), true))}
            {__i18n_display(th('g', __i18n_k("ui.squad.pitcherTable.e0cee61a"), true))}
            {th('gs', __i18n_t("ui.squad.text.a88271df"), true)}
            {__i18n_display(th('wl', __i18n_k("ui.squad.pitcherTable.9660dd73"), true))}
            {__i18n_display(th('svh', __i18n_k("ui.squad.pitcherTable.df8372bc"), true))}
            {__i18n_display(th('ip', __i18n_k("ui.squad.pitcherTable.639a1f2f"), true))}
            {__i18n_display(th('era', 'ERA', true))}
            {__i18n_display(th('whip', 'WHIP', true))}
            {__i18n_display(th('k', __i18n_k("ui.squad.pitcherTable.3f349ed1"), true))}
            {__i18n_display(th('salary', __i18n_k("ui.squad.pitcherTable.cbf383ec"), true))}
            {th('fa', 'FA', true)}
            {__i18n_display(actions && <th class="actions-head">{__i18n_t("ui.squad.pitcherTable.c29fba5a")}</th>)}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((r) => {
            const x = p(r);
            return (
              <tr key={r.id} class="player-row">
                <Name r={r} onPlayer={onPlayer} />
                <td>
                  {__i18n_display(posControl?.(r) ?? (
                    <>
                      {__i18n_display(r.pos.replace('투수', ''))}
                      {__i18n_display(r.penRoleSet && <span class="muted">{__i18n_t("ui.squad.pitcherTable.16b82790")}</span>)}
                    </>
                  ))}
                  {__i18n_display(r.starterInPen && <span class="muted">{__i18n_t("ui.squad.pitcherTable.811281ad")}</span>)}
                </td>
                <td class="num">{__i18n_display(r.age)}</td>
                <td class={`num ${gradeClass(r.grade)}`}>{__i18n_display(r.grade)}</td>
                <td class={`num strong ${gradeClass(rowFuture(r))}`}>{__i18n_display(rowFuture(r) ?? '-')}</td>
                <td class="num">{__i18n_display(x?.g ?? '-')}</td>
                <td class="num">{__i18n_display(x?.gs ?? '-')}</td>
                <td class="num">{__i18n_display(x ? `${x.w}-${x.l}` : '-')}</td>
                <td class="num">{__i18n_display(x ? `${x.sv}/${x.hld}` : '-')}</td>
                <td class="num">{__i18n_display(x ? rates.ip(x.outs) : '-')}</td>
                <td class="num strong">{__i18n_display(x?.outs ? rates.era(x).toFixed(2) : '-')}</td>
                <td class="num">{__i18n_display(x?.outs ? rates.whip(x).toFixed(2) : '-')}</td>
                <td class="num">{__i18n_display(x?.k ?? '-')}</td>
                <td class="num">{__i18n_display(salaryText(r))}</td>
                <td class={`num${r.fa.left === 0 || r.fa.left === 1 ? ' strong' : ''}`} title={r.fa.text}>
                  {r.fa.short}
                </td>
                {__i18n_display(actions && <td>{__i18n_display(actions(r))}</td>)}
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

function HitterTable({ rows, onPlayer, actions, posControl }: { rows: Row[]; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren; posControl?: (r: Row) => ComponentChildren }) {
  const b = (r: Row) => r.stats.bat;
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      grade: { value: (r) => r.grade },
      future: { value: (r) => rowFuture(r) ?? -1 },
      g: { value: (r) => b(r)?.g ?? 0 },
      avg: { value: (r) => (b(r)?.ab ? rates.avg(b(r)!) : 0) },
      hr: { value: (r) => b(r)?.hr ?? 0 },
      rbi: { value: (r) => b(r)?.rbi ?? 0 },
      sb: { value: (r) => b(r)?.sb ?? 0 },
      ops: { value: (r) => (b(r)?.pa ? rates.ops(b(r)!) : 0) },
      salary: { value: (r) => r.salary + r.usd * 0.14 },
      fa: { value: (r) => r.fa.year ?? 9999, first: 1 },
    },
    { key: 'pos', dir: 1 },
  );
  if (!rows.length) return null;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table squad-table">
        <thead>
          <tr>
            {__i18n_display(th('name', __i18n_k("ui.squad.hitterTable.9dac0c64")))}
            {__i18n_display(th('pos', __i18n_k("ui.squad.hitterTable.81922a91")))}
            {__i18n_display(th('age', __i18n_k("ui.squad.hitterTable.6c620e5c"), true))}
            {__i18n_display(th('grade', __i18n_k("ui.squad.hitterTable.001e4be2"), true))}
            {__i18n_display(th('future', __i18n_k("ui.squad.hitterTable.6e0caec5"), true))}
            {__i18n_display(th('g', __i18n_k("ui.squad.hitterTable.e0cee61a"), true))}
            {__i18n_display(th('avg', __i18n_k("ui.squad.hitterTable.1eb19e0a"), true))}
            {__i18n_display(th('hr', __i18n_k("ui.squad.hitterTable.9162d3a3"), true))}
            {__i18n_display(th('rbi', __i18n_k("ui.squad.hitterTable.fed1c588"), true))}
            {__i18n_display(th('sb', __i18n_k("ui.squad.hitterTable.91e54831"), true))}
            {__i18n_display(th('ops', 'OPS', true))}
            {__i18n_display(th('salary', __i18n_k("ui.squad.hitterTable.cbf383ec"), true))}
            {th('fa', 'FA', true)}
            {__i18n_display(actions && <th class="actions-head">{__i18n_t("ui.squad.hitterTable.c29fba5a")}</th>)}
          </tr>
        </thead>
        <tbody>
          {__i18n_display(sorted.map((r) => {
            const x = b(r);
            return (
              <tr key={r.id} class="player-row">
                <Name r={r} onPlayer={onPlayer} />
                <td>
                  {__i18n_display(r.pos)}
                  {__i18n_display(r.also.length > 0 && <span class="muted small"> · {__i18n_display(r.also.join('·'))}</span>)}
                  {__i18n_display(posControl?.(r) ?? (r.platoon && <span class="muted"> ({__i18n_display(r.platoon === 'L' ? __i18n_k("ui.squad.hitterTable.67500ef8") : __i18n_k("ui.squad.hitterTable.04afaad8"))})</span>))}
                </td>
                <td class="num">{__i18n_display(r.age)}</td>
                <td class={`num ${gradeClass(r.grade)}`}>{__i18n_display(r.grade)}</td>
                <td class={`num strong ${gradeClass(rowFuture(r))}`}>{__i18n_display(rowFuture(r) ?? '-')}</td>
                <td class="num">{__i18n_display(x?.g ?? '-')}</td>
                <td class="num">{__i18n_display(x?.ab ? f3(rates.avg(x)) : '-')}</td>
                <td class="num">{__i18n_display(x?.hr ?? '-')}</td>
                <td class="num">{__i18n_display(x?.rbi ?? '-')}</td>
                <td class="num">{__i18n_display(x?.sb ?? '-')}</td>
                <td class="num strong">{__i18n_display(x?.pa ? f3(rates.ops(x)) : '-')}</td>
                <td class="num">{__i18n_display(salaryText(r))}</td>
                <td class={`num${r.fa.left === 0 || r.fa.left === 1 ? ' strong' : ''}`} title={r.fa.text}>
                  {r.fa.short}
                </td>
                {__i18n_display(actions && <td>{__i18n_display(actions(r))}</td>)}
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

/** The squads of `teamId` behind a segmented control. `actions` gets the squad the row is in. */
/** 2.0.54 (the user's request: the players' ratings and potential at a glance, as in OOTP): each tool the scouts grade,
    now and (where it is shown) what they see him becoming. */
function RatingsTable({ league, rows, pitchers, onPlayer, actions }: { league: LeagueState; rows: Row[]; pitchers: boolean; onPlayer: (id: string) => void; actions?: (r: Row) => ComponentChildren }) {
  const keys = toolKeysFor(pitchers ? 'SP' : 'C');
  const player = (r: Row) => league.players[r.id]!;
  const now = (r: Row, k: (typeof keys)[number]) => player(r).scouting.tools[k] ?? 0;
  const later = (r: Row, k: (typeof keys)[number]) => (showsFutureDetail(player(r)) ? player(r).scouting.futureTools[k] : undefined);
  const { sorted, th } = useSort(
    rows,
    {
      name: { value: (r) => r.name },
      pos: { value: (r) => positionKey(r.pos), first: 1 },
      age: { value: (r) => r.age, first: 1 },
      grade: { value: (r) => r.grade },
      future: { value: (r) => rowFuture(r) ?? -1 },
      ...Object.fromEntries(keys.map((k) => [k, { value: (r: Row) => now(r, k) }])),
      velocity: { value: (r) => player(r).velocity ?? 0 },
    },
    { key: 'pos', dir: 1 },
  );
  if (!rows.length) return null;
  const cell = (n: number, f: number | undefined) => (
    <>
      <span class={gradeClass(n)}>{n}</span>
      {f != null && f !== n && <span class="muted small"> →{f}</span>}
    </>
  );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table squad-table ratings-table">
        <thead>
          <tr>
            {th('name', pitchers ? __i18n_t("ui.squad.text.ef406667") : __i18n_t("ui.squad.text.5db174c6"))}
            {th('pos', __i18n_t("ui.squad.text.81922a91"))}
            {th('age', __i18n_t("ui.squad.text.6c620e5c"), true)}
            {th('grade', __i18n_t("ui.squad.text.f7c86d76"), true)}
            {th('future', __i18n_t("ui.squad.text.6e0caec5"), true)}
            {keys.map((k) => th(k as never, __i18n_displayText(TOOL_LABELS[k]), true))}
            {pitchers && th('velocity', __i18n_t("ui.squad.text.b8c2e079"), true)}
            {actions && <th class="actions-head">{__i18n_t("ui.squad.text.c686d054")}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} class="player-row">
              <Name r={r} onPlayer={onPlayer} />
              <td>{__i18n_display(r.pos)}</td>
              <td class="num">{r.age}</td>
              <td class={`num ${gradeClass(r.grade)}`}>{r.grade}</td>
              <td class={`num strong ${gradeClass(rowFuture(r))}`}>{rowFuture(r) ?? '-'}</td>
              {keys.map((k) => (
                <td key={k} class="num">
                  {cell(now(r, k), later(r, k))}
                </td>
              ))}
              {pitchers && <td class="num">{player(r).velocity ?? '-'}</td>}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The table view the screen was left on (records or ratings). */
let lastView: 'stats' | 'ratings' = 'stats';

type SquadProps = Parameters<typeof LegacySquad>[0];

/** 2.0.63: the redesigned squad in the new UI (next/Squad.tsx), this one in the legacy UI. */
export function Squad(props: SquadProps) {
  return useUi() === 'new' ? <NextSquad {...props} /> : <LegacySquad {...props} />;
}

function LegacySquad({
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
  /** Replaces the role / position cell (bullpen role and platoon pickers). */
  posControl?: (squad: SquadKey) => ((r: Row) => ComponentChildren) | undefined;
  toolbar?: ComponentChildren;
}) {
  const roster = rosterView(league, teamId);
  // A club not in the first team yet (the expansion club's first year) opens on its futures squad.
  const [key, setKey] = useState<SquadKey>(roster.active.length ? 'active' : 'futures');
  const [view, setViewState] = useState(lastView);
  const setView = (v: typeof view) => {
    lastView = v;
    setViewState(v);
  };
  const rows = roster[key];
  const note = SQUADS.find((x) => x.key === key)?.note;
  const futuresNumbers = key === 'futures' || key === 'third' || key === 'military';
  return (
    <div class="squad">
      <div class="squad-bar">
        <div class="segmented" role="group" aria-label={__i18n_t("ui.squad.squad.5b9daec2")}>
          {__i18n_display(SQUADS.map((x) => (
            <button key={x.key} type="button" aria-pressed={key === x.key} onClick={() => setKey(x.key)}>
              {__i18n_display(x.label)} <span class="count">{__i18n_display(roster[x.key].length)}</span>
            </button>
          )))}
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.squad.text.b38d51fa")}>
          <button type="button" aria-pressed={view === 'stats'} onClick={() => setView('stats')}>
            {__i18n_t("ui.squad.text.d84b6f4b")}
          </button>
          <button type="button" aria-pressed={view === 'ratings'} onClick={() => setView('ratings')}>
            {__i18n_t("ui.squad.text.9e9117d0")}
          </button>
        </div>
        {__i18n_display(toolbar)}
      </div>
      {__i18n_display(note && <p class="muted">{__i18n_display(note)}</p>)}
      {__i18n_display(futuresNumbers && <p class="muted">{__i18n_t("ui.squad.squad.8bd0631b")}</p>)}
      {__i18n_display(!rows.length && <p class="empty">{__i18n_t("ui.squad.squad.8abc45cd")}</p>)}
      {view === 'ratings' ? (
        <>
          <RatingsTable league={league} rows={rows.filter((r) => r.pitcher)} pitchers onPlayer={onPlayer} actions={actions?.(key)} />
          <RatingsTable league={league} rows={rows.filter((r) => !r.pitcher)} pitchers={false} onPlayer={onPlayer} actions={actions?.(key)} />
          <p class="muted small">{__i18n_t("ui.squad.text.132cd595")}</p>
        </>
      ) : (
        <>
          <PitcherTable rows={rows.filter((r) => r.pitcher)} onPlayer={onPlayer} actions={actions?.(key)} posControl={posControl?.(key)} />
          <HitterTable rows={rows.filter((r) => !r.pitcher)} onPlayer={onPlayer} actions={actions?.(key)} posControl={posControl?.(key)} />
        </>
      )}
    </div>
  );
}
