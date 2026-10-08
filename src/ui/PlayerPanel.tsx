import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* A league player's page (V0.5.1 layout; in parts since 1.4.0): who he is and his latest season at a glance on top,
   then one part at a time — scouting grades as bars with positions or pitches, records, the staff's read, his
   background and injuries. Everything shown is public: grades are scouting reports, velocity is the radar gun. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import { TOOL_LABELS } from '../draftroom';
import type { Split, Splits } from '../league/engine/types';
import type { Action } from '../league/actions';
import { wagwa } from '../league/josa';
import { checkNumber, numberHolder } from '../league/numbers';
import { checkInspect } from '../league/scandals';
import { SCANDAL } from '../league/tuning';
import type { LeagueState } from '../league/state';
import { playerCard, positionLabel, rateContextFor, rates, type PlayerCard } from '../league/views';
import { usdTotal } from '../league/contracts';
import { fanAffinity, hometownOf, isMarried } from '../league/life';
import { SITES } from '../league/training';
import { usd } from '../league/foreign';
import { handedness, militaryLabel, money, toolKeysFor } from './format';
import { GradeBar } from './grades';
import { serviceNote } from '../league/military';
import type { TraitReport } from '../league/reports';
import { kboSeasons } from '../league/foreigncap';
import { postRows, postTotals, type PostRow } from '../league/poststats';

const POSITION_NAMES: Record<string, string> = { C: __i18n_k("ui.playerPanel.pOSITION_NAMES.c.5f31470d"), '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: __i18n_k("ui.playerPanel.pOSITION_NAMES.sS.3e24c7f1"), LF: __i18n_k("ui.playerPanel.pOSITION_NAMES.lF.73836db2"), CF: __i18n_k("ui.playerPanel.pOSITION_NAMES.cF.56780b2a"), RF: __i18n_k("ui.playerPanel.pOSITION_NAMES.rF.a28a0ef8") };

/** Our coaches' read of our player, our scouts' of anyone else (1.1.0): hidden traits, as sure as the staff are. */
export function TraitReportBox({ report }: { report: TraitReport }) {
  const tone = (r: TraitReport['reads'][number]) => {
    if (r.level == null || r.key === 'growth') return '';
    const bad = r.key === 'controversy' || r.key === 'injury';
    return r.level >= 4 ? (bad ? 'minus' : 'plus') : r.level <= 2 ? (bad ? 'plus' : 'minus') : '';
  };
  return (
    <section class="pitch-box trait-report">
      <h3>{__i18n_display(report.by === 'coach' ? __i18n_k("ui.playerPanel.traitReportBox.299d0a35") : __i18n_k("ui.playerPanel.traitReportBox.33ee644c"))}</h3>
      <p class="small">{__i18n_rich("ui.playerPanel.traitReportBox.31899641", { value: <strong>{__i18n_display(report.character)}</strong>, value2: <span class="muted"> · {__i18n_display(report.staff)}</span> })}</p>
      <dl class="facts">
        {__i18n_display(report.reads.map((r) => (
          <div key={r.key}>
            <dt>{__i18n_display(r.label)}</dt>
            <dd>
              <span class={tone(r)}>{__i18n_display(r.text ?? __i18n_k("ui.playerPanel.traitReportBox.da8abd91"))}</span>
              <span class="muted small">{__i18n_t("ui.playerPanel.traitReportBox.50484aa3", { sure: r.sure })}</span>
            </dd>
          </div>
        )))}
      </dl>
      {__i18n_display(report.growthNote && <p class="muted small">{__i18n_display(report.growthNote)}</p>)}
      {__i18n_display(report.notes.length > 0 && (
        <ul class="plain small">
          {__i18n_display(report.notes.map((n) => (
            <li key={n}>{__i18n_display(n)}</li>
          )))}
        </ul>
      ))}
      <p class="muted small">
        {__i18n_display(report.by === 'coach'
          ? __i18n_k("ui.playerPanel.traitReportBox.bc614e88")
          : __i18n_k("ui.playerPanel.traitReportBox.4cfba58a"))}
      </p>
    </section>
  );
}

/* 1.4.0 (from the 1.3 feedback): one part at a time — abilities, records, the staff's read, who he is, injuries —
   with the records split again into the regular season, the postseason, career highs and left/right. The part
   last opened stays open for the next player. */
type Part = 'ability' | 'records' | 'report' | 'profile' | 'injuries';
type RecordView = 'seasons' | 'post' | 'highs' | 'splits';
const PARTS: { key: Part; label: string }[] = [
  { key: 'ability', label: __i18n_k("ui.playerPanel.pARTS.label.9e9117d0") },
  { key: 'records', label: __i18n_k("ui.playerPanel.pARTS.label.d84b6f4b") },
  { key: 'report', label: __i18n_k("ui.playerPanel.pARTS.label.0ca35448") },
  { key: 'profile', label: __i18n_k("ui.playerPanel.pARTS.label.032e3f1f") },
  { key: 'injuries', label: __i18n_k("ui.playerPanel.pARTS.label.501fb802") },
];
const RECORD_VIEWS: { key: RecordView; label: string }[] = [
  { key: 'seasons', label: __i18n_k("ui.playerPanel.rECORD_VIEWS.label.b4070ed2") },
  { key: 'post', label: __i18n_k("ui.playerPanel.rECORD_VIEWS.label.a0f7a345") },
  { key: 'highs', label: __i18n_k("ui.playerPanel.rECORD_VIEWS.label.dc5975f8") },
  { key: 'splits', label: __i18n_k("ui.playerPanel.rECORD_VIEWS.label.1df210e9") },
];
let lastPart: Part = 'ability';
let lastRecords: RecordView = 'seasons';

const splitRates = (x: Split) => ({
  avg: x.ab ? x.h / x.ab : 0,
  obp: x.pa ? (x.h + x.bb + x.hbp) / Math.max(1, x.ab + x.bb + x.hbp + x.sf) : 0,
  slg: x.ab ? x.tb / x.ab : 0,
});

function SplitTable({ title, splits, pitcher }: { title: string; splits: Splits | null; pitcher: boolean }) {
  if (!splits) return null;
  const rows: [string, Split][] = pitcher
    ? [
        [__i18n_k("ui.playerPanel.splitTable.rows.85efe664"), splits.L],
        [__i18n_k("ui.playerPanel.splitTable.rows.9f7370d0"), splits.R],
      ]
    : [
        [__i18n_k("ui.playerPanel.splitTable.rows.78f330a6"), splits.L],
        [__i18n_k("ui.playerPanel.splitTable.rows.43502365"), splits.R],
      ];
  return (
    <>
      <h4>{__i18n_display(title)}</h4>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career">
          <thead>
            <tr>
              <th>{__i18n_t("ui.playerPanel.splitTable.af2feed6")}</th>
              <th class="num">{__i18n_display(pitcher ? __i18n_k("ui.playerPanel.splitTable.19d72883") : __i18n_k("ui.playerPanel.splitTable.0a3d002c"))}</th>
              <th class="num">{__i18n_display(pitcher ? __i18n_k("ui.playerPanel.splitTable.265381ba") : __i18n_k("ui.playerPanel.splitTable.1eb19e0a"))}</th>
              <th class="num">{__i18n_t("ui.playerPanel.splitTable.bb6ef1b2")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.splitTable.7e66b88d")}</th>
              <th class="num">OPS</th>
              <th class="num">{__i18n_t("ui.playerPanel.splitTable.9162d3a3")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.splitTable.21e0537f")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.splitTable.3f349ed1")}</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map(([label, x]) => {
              const r = splitRates(x);
              return (
                <tr key={label}>
                  <th scope="row">{__i18n_display(label)}</th>
                  <td class="num">{__i18n_display(x.pa)}</td>
                  <td class="num">{__i18n_display(x.ab ? rates.fmt3(r.avg) : '-')}</td>
                  <td class="num">{__i18n_display(x.pa ? rates.fmt3(r.obp) : '-')}</td>
                  <td class="num">{__i18n_display(x.ab ? rates.fmt3(r.slg) : '-')}</td>
                  <td class="num strong">{__i18n_display(x.pa ? rates.fmt3(r.obp + r.slg) : '-')}</td>
                  <td class="num">{__i18n_display(x.hr)}</td>
                  <td class="num">{__i18n_display(x.bb)}</td>
                  <td class="num">{__i18n_display(x.k)}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SeasonTable({ league, card, pitcher }: { league: LeagueState; card: PlayerCard; pitcher: boolean }) {
  const rows = card.career;
  if (!rows.length) return <p class="muted">{__i18n_t("ui.playerPanel.seasonTable.626ced4e")}</p>;
  const t = card.totals;
  if (pitcher)
    return (
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.d5bc99dd")}</th>
              <th>{__i18n_t("ui.playerPanel.seasonTable.58756112")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.e0cee61a")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.3b1908b7")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.36260e2c")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.c5e4d00d")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.10a4423a")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.639a1f2f")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.3f349ed1")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.seasonTable.21e0537f")}</th>
              <th class="num">ERA</th>
              <th class="num">WHIP</th>
              <th class="num">FIP</th>
              <th class="num">K/9</th>
              <th class="num">WAR</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map((r) => {
              const rc = rateContextFor(league, r.year);
              return (
                <tr key={r.year + r.team + r.futures} class={r.futures ? 'futures-row' : undefined}>
                  <td class="num">{__i18n_display(r.year)}</td>
                  <td>
                    {__i18n_display(r.team)}
                    {__i18n_display(r.futures && <span class="tag">{__i18n_t("ui.playerPanel.seasonTable.e6607847")}</span>)}
                  </td>
                  <td class="num">{__i18n_display(r.pit?.g ?? 0)}</td>
                  <td class="num">{__i18n_display(r.pit?.w ?? 0)}</td>
                  <td class="num">{__i18n_display(r.pit?.l ?? 0)}</td>
                  <td class="num">{__i18n_display(r.pit?.sv ?? 0)}</td>
                  <td class="num">{__i18n_display(r.pit?.hld ?? 0)}</td>
                  <td class="num">{__i18n_display(rates.ip(r.pit?.outs ?? 0))}</td>
                  <td class="num">{__i18n_display(r.pit?.k ?? 0)}</td>
                  <td class="num">{__i18n_display(r.pit?.bb ?? 0)}</td>
                  <td class="num strong">{__i18n_display(r.pit?.outs ? rates.era(r.pit).toFixed(2) : '-')}</td>
                  <td class="num">{__i18n_display(r.pit?.outs ? rates.whip(r.pit).toFixed(2) : '-')}</td>
                  <td class="num">{__i18n_display(r.pit?.outs && rc ? rates.fip(r.pit, rc).toFixed(2) : '-')}</td>
                  <td class="num">{__i18n_display(r.pit?.outs ? rates.per9(r.pit.k, r.pit.outs).toFixed(1) : '-')}</td>
                  <td class="num">{__i18n_display(r.current || r.futures ? '-' : r.war.toFixed(1))}</td>
                </tr>
              );
            }))}
          </tbody>
          {__i18n_display(t.pit && (
            <tfoot>
              <tr>
                <th colSpan={2}>{__i18n_t("ui.playerPanel.seasonTable.55972bcf", { seasons: t.seasons })}</th>
                <td class="num">{__i18n_display(t.pit.g)}</td>
                <td class="num">{__i18n_display(t.pit.w)}</td>
                <td class="num">{__i18n_display(t.pit.l)}</td>
                <td class="num">{__i18n_display(t.pit.sv)}</td>
                <td class="num">{__i18n_display(t.pit.hld)}</td>
                <td class="num">{__i18n_display(rates.ip(t.pit.outs))}</td>
                <td class="num">{__i18n_display(t.pit.k)}</td>
                <td class="num">{__i18n_display(t.pit.bb)}</td>
                <td class="num strong">{__i18n_display(t.pit.outs ? rates.era(t.pit).toFixed(2) : '-')}</td>
                <td class="num">{__i18n_display(t.pit.outs ? rates.whip(t.pit).toFixed(2) : '-')}</td>
                <td class="num">-</td>
                <td class="num">{__i18n_display(t.pit.outs ? rates.per9(t.pit.k, t.pit.outs).toFixed(1) : '-')}</td>
                <td class="num">{__i18n_display(t.war.toFixed(1))}</td>
              </tr>
            </tfoot>
          ))}
        </table>
      </div>
    );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table career">
        <thead>
          <tr>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.d5bc99dd")}</th>
            <th>{__i18n_t("ui.playerPanel.seasonTable.58756112")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.e0cee61a")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.0a3d002c")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.1822db88")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.1eb19e0a")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.bb6ef1b2")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.7e66b88d")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.9162d3a3")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.fed1c588")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.seasonTable.91e54831")}</th>
            <th class="num">OPS</th>
            <th class="num">wRC+</th>
            <th class="num">WAR</th>
          </tr>
        </thead>
        <tbody>
          {__i18n_display(rows.map((r) => {
            const rc = rateContextFor(league, r.year);
            return (
              <tr key={r.year + r.team + r.futures} class={r.futures ? 'futures-row' : undefined}>
                <td class="num">{__i18n_display(r.year)}</td>
                <td>
                  {__i18n_display(r.team)}
                  {__i18n_display(r.futures && <span class="tag">{__i18n_t("ui.playerPanel.seasonTable.e6607847")}</span>)}
                </td>
                <td class="num">{__i18n_display(r.bat?.g ?? 0)}</td>
                <td class="num">{__i18n_display(r.bat?.pa ?? 0)}</td>
                <td class="num">{__i18n_display(r.bat?.h ?? 0)}</td>
                <td class="num">{__i18n_display(r.bat?.ab ? rates.fmt3(rates.avg(r.bat)) : '-')}</td>
                <td class="num">{__i18n_display(r.bat?.pa ? rates.fmt3(rates.obp(r.bat)) : '-')}</td>
                <td class="num">{__i18n_display(r.bat?.ab ? rates.fmt3(rates.slg(r.bat)) : '-')}</td>
                <td class="num">{__i18n_display(r.bat?.hr ?? 0)}</td>
                <td class="num">{__i18n_display(r.bat?.rbi ?? 0)}</td>
                <td class="num">{__i18n_display(r.bat?.sb ?? 0)}</td>
                <td class="num strong">{__i18n_display(r.bat?.pa ? rates.fmt3(rates.ops(r.bat)) : '-')}</td>
                <td class="num">{__i18n_display(r.bat?.pa && rc && !r.futures ? rates.wrcPlus(r.bat, rc) : '-')}</td>
                <td class="num">{__i18n_display(r.current || r.futures ? '-' : r.war.toFixed(1))}</td>
              </tr>
            );
          }))}
        </tbody>
        {__i18n_display(t.bat && (
          <tfoot>
            <tr>
              <th colSpan={2}>{__i18n_t("ui.playerPanel.seasonTable.55972bcf", { seasons: t.seasons })}</th>
              <td class="num">{__i18n_display(t.bat.g)}</td>
              <td class="num">{__i18n_display(t.bat.pa)}</td>
              <td class="num">{__i18n_display(t.bat.h)}</td>
              <td class="num">{__i18n_display(t.bat.ab ? rates.fmt3(rates.avg(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.pa ? rates.fmt3(rates.obp(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.ab ? rates.fmt3(rates.slg(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.hr)}</td>
              <td class="num">{__i18n_display(t.bat.rbi)}</td>
              <td class="num">{__i18n_display(t.bat.sb)}</td>
              <td class="num strong">{__i18n_display(t.bat.pa ? rates.fmt3(rates.ops(t.bat)) : '-')}</td>
              <td class="num">-</td>
              <td class="num">{__i18n_display(t.war.toFixed(1))}</td>
            </tr>
          </tfoot>
        ))}
      </table>
    </div>
  );
}

export function PlayerPanel({
  league,
  id,
  onClose,
  onInterview,
  onAct,
}: {
  league: LeagueState;
  id: string;
  onClose: () => void;
  onInterview?: (id: string) => void;
  /** Our players' uniform number and the club's answer to warning signs (V0.12). */
  onAct?: (a: Action) => void;
}) {
  const card = playerCard(league, id);
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, onClose);
  const [part, setPartState] = useState<Part>(lastPart);
  const [records, setRecordsState] = useState<RecordView>(lastRecords);
  const setPart = (x: Part) => setPartState((lastPart = x));
  const setRecords = (x: RecordView) => setRecordsState((lastRecords = x));
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  if (!card) return null;
  const p = card.player,
    s = p.scouting;
  const pitcher = p.role === 'SP' || p.role === 'RP';
  const foreign = p.origin.kind === 'foreign';
  const ours = !!league.user && p.teamId === league.user.teamId;
  const wearing = p.number != null && p.numberTeam === p.teamId ? p.number : null;
  const hurtDays = card.injuries.reduce((a, x) => a + x.days, 0);
  // Life off the field (V0.10): today's form and his trips abroad.
  const today = league.phase === 'regular' ? (league.schedule[league.next]?.date ?? `${league.year}-10-01`) : `${league.year}-12-31`;
  const form = p.life?.form && p.life.form.until >= today && league.phase === 'regular' ? p.life.form : null;
  const trips = (league.user?.trips ?? []).filter((t) => t.id === p.id);
  const post = postRows(league, league.players[id]!);
  const postSum = postTotals(post);
  const shown = part === 'report' && !card.report ? 'ability' : part;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog profile" role="dialog" aria-modal="true" aria-labelledby="player-name" ref={box}>
        <button type="button" class="close" onClick={onClose} aria-label={__i18n_t("ui.playerPanel.playerPanel.94b7dba1")}>{__i18n_t("ui.playerPanel.playerPanel.94b7dba1")}</button>
        <div class="profile-head">
          {__i18n_display(wearing != null && <span class="profile-number">{__i18n_display(wearing)}</span>)}
          <div>
            <p class="muted">
              {__i18n_display(card.team)} · {__i18n_display(positionLabel(p))} · {__i18n_display(handedness(p))}
              {__i18n_display(foreign ? __i18n_k("ui.playerPanel.playerPanel.151173f4", { value: p.origin.asiaQuota ? __i18n_k("ui.playerPanel.playerPanel.c66942ff") : __i18n_k("ui.playerPanel.playerPanel.5bd804b7"), nationality: p.origin.nationality, archetype: p.archetype, value2: league.foreignVeteran && kboSeasons(p, league.year) >= league.foreignVeteran ? __i18n_k("ui.playerPanel.playerPanel.1cb18f2a") : '' }) : '')}
            </p>
            <h2 id="player-name" tabIndex={-1} ref={heading}>
              {__i18n_display(p.name)}
              {__i18n_display(p.contract?.kind === 'development' && <span class="tag">{__i18n_t("ui.playerPanel.playerPanel.818f3b79")}</span>)}
            </h2>
          </div>
        </div>
        <SummaryStrip card={card} pitcher={pitcher} titles={postSum.titles} />
        {__i18n_display(card.status && <p class="notice">{__i18n_display(card.status)}</p>)}
        {__i18n_display(league.suspended?.[p.id] && (
          <p class="notice warn">
            {__i18n_display(league.suspended[p.id]!.reason)}:{__i18n_display(' ')}
            {__i18n_display(league.suspended[p.id]!.games ? __i18n_k("ui.playerPanel.playerPanel.a91fae73", { games: league.suspended[p.id]!.games }) : '')}
            {__i18n_display(league.suspended[p.id]!.until ? __i18n_k("ui.playerPanel.playerPanel.165116da", { value: league.suspended[p.id]!.games ? ' · ' : '', until: league.suspended[p.id]!.until }) : '')}
          </p>
        ))}
        {__i18n_display(onInterview && ours && (
          <p>
            <button type="button" onClick={() => onInterview(p.id)}>{__i18n_t("ui.playerPanel.playerPanel.7290c766")}</button>{__i18n_display(' ')}
            <span class="muted small">{__i18n_t("ui.playerPanel.playerPanel.a1086678")}</span>
          </p>
        ))}

        <div class="segmented profile-tabs profile-parts" role="tablist" aria-label={__i18n_t("ui.playerPanel.playerPanel.243cf4c2")}>
          {__i18n_display(PARTS.filter((x) => x.key !== 'report' || card.report).map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={shown === x.key} aria-pressed={shown === x.key} onClick={() => setPart(x.key)}>
              {__i18n_display(x.key === 'report' && card.report ? (card.report.by === 'coach' ? __i18n_k("ui.playerPanel.playerPanel.299d0a35") : __i18n_k("ui.playerPanel.playerPanel.33ee644c")) : x.label)}
              {__i18n_display(x.key === 'injuries' && card.injuries.length > 0 && <span class="count">{__i18n_display(card.injuries.length)}</span>)}
            </button>
          )))}
        </div>

        {__i18n_display(shown === 'ability' && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.9e9117d0")}>
            <section>
              <h3>{__i18n_t("ui.playerPanel.playerPanel.7b001924")}</h3>
              <div class="gradebars">
                {__i18n_display(toolKeysFor(p.role).map((k) => (
                  <GradeBar key={k} label={__i18n_displayText(TOOL_LABELS[k])} now={s.tools[k]} future={s.futureTools[k]} />
                )))}
                <GradeBar label={__i18n_t("ui.playerPanel.playerPanel.f7c86d76")} now={s.current} future={s.futureValue} />
              </div>
              <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.40f3273a")}</p>
              {__i18n_display(s.moved && (
                <p class={`small ${s.moved.to > s.moved.from ? 'plus' : 'minus'}`}>{__i18n_t("ui.playerPanel.playerPanel.e3838a42", { value: s.moved.to > s.moved.from ? '▲' : '▼', from: s.moved.from, to: s.moved.to, value2: s.moved.date.slice(5).replace('-', '/') })}</p>
              ))}
            </section>
            {__i18n_display(!pitcher && card.positions.length > 0 && (
              <section class="pitch-box">
                <h3>{__i18n_t("ui.playerPanel.playerPanel.e44b2ec6")}</h3>
                <div class="gradebars">
                  {__i18n_display(card.positions.map((x) => (
                    <GradeBar key={x.pos} label={__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.b5f18a27", { value: POSITION_NAMES[x.pos], value2: x.main ? __i18n_k("ui.playerPanel.playerPanel.cc99d74f") : x.listed ? __i18n_k("ui.playerPanel.playerPanel.f2215ed8") : '' }))} now={x.grade} note={x.games ? __i18n_k("ui.playerPanel.playerPanel.42050c40", { games: x.games }) : undefined} />
                  )))}
                </div>
                <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.92af1732")}</p>
              </section>
            ))}
            {__i18n_display(pitcher && (
              <section class="pitch-box">
                <h3>{__i18n_t("ui.playerPanel.playerPanel.79ffa7f7")}</h3>
                {__i18n_display(card.velocity && (
                  <p class="velocity">
                    <span>{__i18n_rich("ui.playerPanel.playerPanel.dfeb642b", { value: <strong>{__i18n_display(card.velocity.top)}</strong> })}</span>
                    <span>{__i18n_rich("ui.playerPanel.playerPanel.f35cd13f", { value: <strong>{__i18n_display(card.velocity.average)}</strong> })}</span>
                  </p>
                ))}
                <div class="gradebars">
                  <GradeBar label={__i18n_t("ui.playerPanel.playerPanel.b17dbbc7")} now={s.tools.stuff} note={__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round((1 - card.pitches.reduce((a, x) => a + x.usage, 0)) * 100) })} />
                  {__i18n_display(card.pitches.map((x) => (
                    <GradeBar key={x.type} label={__i18n_displayText(x.label)} now={x.grade} note={__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round(x.usage * 100) })} />
                  )))}
                </div>
              </section>
            ))}
          </div>
        ))}

        {__i18n_display(shown === 'records' && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.d84b6f4b")}>
            <div class="segmented record-views" role="group" aria-label={__i18n_t("ui.playerPanel.playerPanel.493c08af")}>
              {__i18n_display(RECORD_VIEWS.map((x) => (
                <button key={x.key} type="button" aria-pressed={records === x.key} onClick={() => setRecords(x.key)}>
                  {__i18n_display(x.label)}
                  {__i18n_display(x.key === 'post' && post.length > 0 && <span class="count">{__i18n_display(post.length)}</span>)}
                </button>
              )))}
            </div>
            {__i18n_display(records === 'seasons' && (
              <>
                <SeasonTable league={league} card={card} pitcher={pitcher} />
                <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.7e2cbab5")}</p>
              </>
            ))}
            {__i18n_display(records === 'post' && (
              <>
                <PostTable rows={post} totals={postSum} pitcher={pitcher} />
                <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.fcf42cd6")}</p>
              </>
            ))}
            {__i18n_display(records === 'highs' &&
              (card.highs.length ? (
                <dl class="highs">
                  {__i18n_display(card.highs.map((h) => (
                    <div key={h.label}>
                      <dt>{__i18n_display(h.label)}</dt>
                      <dd>
                        <strong>{__i18n_display(h.value)}</strong> <span class="muted">({__i18n_display(h.year)})</span>
                      </dd>
                    </div>
                  )))}
                </dl>
              ) : (
                <p class="muted">{__i18n_t("ui.playerPanel.playerPanel.3055338b")}</p>
              )))}
            {__i18n_display(records === 'splits' &&
              (card.splits.season || card.splits.career ? (
                <>
                  <SplitTable title={__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.de766445", { year: league.year }))} splits={card.splits.season} pitcher={pitcher} />
                  <SplitTable title={__i18n_t("ui.playerPanel.playerPanel.7f3e9e67")} splits={card.splits.career} pitcher={pitcher} />
                  <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.3fbaa6d0")}</p>
                </>
              ) : (
                <p class="muted">{__i18n_t("ui.playerPanel.playerPanel.f5cd3591")}</p>
              )))}
          </div>
        ))}

        {__i18n_display(shown === 'report' && card.report && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.0ca35448")}>
            <TraitReportBox report={card.report} />
          </div>
        ))}

        {__i18n_display(shown === 'profile' && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.032e3f1f")}>
            {__i18n_display(onAct && ours && <NumberField key={`${p.id}-${wearing ?? ''}`} league={league} id={p.id} current={wearing} onAct={onAct} />)}
            {__i18n_display(onAct && ours && (p.life?.suspicion?.signs ?? 0) > 0 && (
              <p class="inline-form">
                <span class="small">{__i18n_t("ui.playerPanel.playerPanel.35b81cd9")}</span>
                <button type="button" disabled={!!checkInspect(league, p.id)} title={__i18n_displayText(checkInspect(league, p.id) ?? '')} onClick={() => onAct({ kind: 'inspect', id: p.id })}>{__i18n_t("ui.playerPanel.playerPanel.c7b1ead1", { inspectCost: SCANDAL.doping.inspectCost })}</button>
                <span class="muted small">{__i18n_t("ui.playerPanel.playerPanel.02a8cc00")}</span>
              </p>
            ))}
            <dl class="facts profile-facts">
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.6c620e5c")}</dt>
                <dd>{__i18n_t("ui.playerPanel.playerPanel.77f716cf", { age: card.age, value: p.birthday.slice(0, 4) })}</dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.98633e27")}</dt>
                <dd>{__i18n_display(p.birthplace)}</dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.691a855d")}</dt>
                <dd>
                  {__i18n_display(p.height)}cm · {__i18n_display(p.weight)}kg
                </dd>
              </div>
              <div>
                <dt>{__i18n_display(p.contract?.usd ? __i18n_k("ui.playerPanel.playerPanel.b4116369") : __i18n_k("ui.playerPanel.playerPanel.cbf383ec"))}</dt>
                <dd>
                  {__i18n_display(p.contract?.usd
                    ? __i18n_k("ui.playerPanel.playerPanel.de99127a", { usd: usd(usdTotal(p.contract)), usd2: usd(p.contract.usd.bonus), usd3: usd(p.contract.usd.salary), usd4: usd(p.contract.usd.options) })
                    : money(card.salary))}
                </dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.81af228b")}</dt>
                <dd>
                  {__i18n_display(p.origin.overallPick
                    ? __i18n_k("ui.playerPanel.playerPanel.083f725c", { draftYear: p.origin.draftYear, overallPick: p.origin.overallPick })
                    : foreign
                      ? __i18n_k("ui.playerPanel.playerPanel.117bde8b", { proSince: p.proSince })
                      : p.origin.draftYear
                        ? __i18n_k("ui.playerPanel.playerPanel.04a68f8e", { draftYear: p.origin.draftYear })
                        : '-')}
                </dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.82af035c")}</dt>
                <dd>
                  {__i18n_display(militaryLabel[p.service.military])}
                  {__i18n_display(serviceNote(p) && <span class="muted small"> · {__i18n_display(serviceNote(p))}</span>)}
                </dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.2d4db98d")}</dt>
                <dd>{__i18n_display(foreign ? '-' : __i18n_k("ui.playerPanel.playerPanel.58030cf8", { creditedSeasons: p.service.creditedSeasons }))}</dd>
              </div>
              <div>
                <dt>{__i18n_t("ui.playerPanel.playerPanel.750fc29b")}</dt>
                <dd>{__i18n_display(card.totals.seasons ? card.totals.war.toFixed(1) : '-')}</dd>
              </div>
              {__i18n_display(p.teamId && (
                <div>
                  <dt>{__i18n_t("ui.playerPanel.playerPanel.2179c84f")}</dt>
                  <dd>
                    {__i18n_display(fanAffinity(league, p))}
                    <span class="muted small"> / 100{__i18n_display(hometownOf(league, p) ? __i18n_k("ui.playerPanel.playerPanel.f028614f") : '')}</span>
                  </dd>
                </div>
              ))}
              {__i18n_display(form && (
                <div>
                  <dt>{__i18n_t("ui.playerPanel.playerPanel.15dfe118")}</dt>
                  <dd class={form.delta > 0 ? 'plus' : 'minus'}>{__i18n_t("ui.playerPanel.playerPanel.e36fe9dd", { value: form.delta > 0 ? __i18n_k("ui.playerPanel.playerPanel.5cd0d95b") : __i18n_k("ui.playerPanel.playerPanel.c89bafa8"), why: form.why, value2: form.until.slice(5).replace('-', '/') })}</dd>
                </div>
              ))}
              {__i18n_display(ours && (
                <div>
                  <dt>{__i18n_t("ui.playerPanel.playerPanel.0fc79d30")}</dt>
                  <dd>
                    {__i18n_display(p.life?.married ? __i18n_k("ui.playerPanel.playerPanel.bf7cd261", { married: p.life.married }) : isMarried(league, p) ? __i18n_k("ui.playerPanel.playerPanel.75f8dbf0") : __i18n_k("ui.playerPanel.playerPanel.703337ca"))}
                    {__i18n_display(p.life?.kids ? __i18n_k("ui.playerPanel.playerPanel.65a71a08", { kids: p.life.kids }) : '')}
                  </dd>
                </div>
              ))}
            </dl>
            <p class="muted small">{__i18n_display(p.education.pathText)}</p>
            {__i18n_display(!!p.honors?.length && (
              <>
                <h3>{__i18n_t("ui.playerPanel.playerPanel.34f8ad9e")}</h3>
                <div class="honors">
                  {__i18n_display([...p.honors].reverse().map((h) => (
                    <span key={h} class="tag">
                      {__i18n_display(h)}
                    </span>
                  )))}
                </div>
              </>
            ))}
            {__i18n_display((trips.length > 0 || (p.life?.events?.length ?? 0) > 0) && (
              <>
                <h3>{__i18n_t("ui.playerPanel.playerPanel.41861931")}</h3>
                <ul class="plain small life-list">
                  {__i18n_display(trips.map((t) => (
                    <li key={`${t.season}-${t.site}`}>{__i18n_t("ui.playerPanel.playerPanel.f236eafb", { value: t.from.slice(0, 7), name: SITES[t.site].name, value2: t.result ? t.result.text + (t.result.injury ? ` (${t.result.injury})` : '') : __i18n_k("ui.playerPanel.playerPanel.7ffd4715", { until: t.until }) })}</li>
                  )))}
                  {__i18n_display((p.life?.events ?? [])
                    .slice(-5)
                    .reverse()
                    .map((e, i) => (
                      <li key={i} class={e.tone === 'good' ? 'plus' : e.tone === 'bad' ? 'minus' : ''}>
                        {__i18n_display(e.date)} {__i18n_display(e.text)}
                      </li>
                    )))}
                </ul>
              </>
            ))}
          </div>
        ))}

        {__i18n_display(shown === 'injuries' && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.501fb802")}>
            {__i18n_display(card.injuries.length ? (
              <>
                <p class="muted">{__i18n_t("ui.playerPanel.playerPanel.75a95895", { length: card.injuries.length, hurtDays: hurtDays })}</p>
                <div class="table-wrap" tabIndex={0}>
                  <table class="record-table">
                    <thead>
                      <tr>
                        <th>{__i18n_t("ui.playerPanel.playerPanel.5caa75a8")}</th>
                        <th>{__i18n_t("ui.playerPanel.playerPanel.615225e4")}</th>
                        <th class="num">{__i18n_t("ui.playerPanel.playerPanel.2622331e")}</th>
                        <th>{__i18n_t("ui.playerPanel.playerPanel.af2feed6")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {__i18n_display(card.injuries.map((x) => (
                        <tr key={x.date + x.part}>
                          <td>{__i18n_display(x.date)}</td>
                          <td>{__i18n_display(x.part)}</td>
                          <td class="num">{__i18n_t("ui.playerPanel.playerPanel.e1aa3431", { days: x.days })}</td>
                          <td>
                            {__i18n_display(x.futures ? __i18n_k("ui.playerPanel.playerPanel.e6607847") : __i18n_k("ui.playerPanel.playerPanel.30eac4dc"))}
                            {__i18n_display(x.surgery && <span class={`tag${x.surgery === 'major' ? ' warn' : ''}`}>{__i18n_display(x.surgery === 'major' ? __i18n_k("ui.playerPanel.playerPanel.471cda0c") : __i18n_k("ui.playerPanel.playerPanel.98a2b68d"))}</span>)}
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p class="muted">{__i18n_t("ui.playerPanel.playerPanel.e966961f")}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Always on top (1.4.0): age, the grade now and to come, and his latest season in a line. */
function SummaryStrip({ card, pitcher, titles }: { card: PlayerCard; pitcher: boolean; titles: number }) {
  const s = card.player.scouting;
  const last = [...card.career].reverse().find((r) => !r.futures && (pitcher ? r.pit?.g : r.bat?.g));
  const line = !last
    ? __i18n_k("ui.playerPanel.summaryStrip.line.12ca5e35")
    : pitcher
      ? __i18n_k("ui.playerPanel.summaryStrip.line.4a6df1ba", { year: last.year, g: last.pit!.g, w: last.pit!.w, l: last.pit!.l, value: last.pit!.sv ? __i18n_k("ui.playerPanel.summaryStrip.line.3abfd8a4", { sv: last.pit!.sv }) : '', value2: last.pit!.hld ? __i18n_k("ui.playerPanel.summaryStrip.line.714b2700", { hld: last.pit!.hld }) : '', value3: last.pit!.outs ? rates.era(last.pit!).toFixed(2) : '-', value4: rates.ip(last.pit!.outs) })
      : __i18n_k("ui.playerPanel.summaryStrip.line.99ee272d", { year: last.year, g: last.bat!.g, value: last.bat!.ab ? rates.fmt3(rates.avg(last.bat!)) : '-', hr: last.bat!.hr, value2: last.bat!.pa ? rates.fmt3(rates.ops(last.bat!)) : '-' });
  return (
    <dl class="summary-strip">
      <div>
        <dt>{__i18n_t("ui.playerPanel.summaryStrip.6c620e5c")}</dt>
        <dd>{__i18n_t("ui.playerPanel.summaryStrip.1001e7e6", { age: card.age })}</dd>
      </div>
      <div>
        <dt>{__i18n_t("ui.playerPanel.summaryStrip.f7c86d76")}</dt>
        <dd>
          <strong>{__i18n_display(s.current)}</strong> <span class="muted small">{__i18n_t("ui.playerPanel.summaryStrip.92982abd", { futureValue: s.futureValue })}</span>
        </dd>
      </div>
      <div class="wide">
        <dt>{__i18n_display(last?.current ? __i18n_k("ui.playerPanel.summaryStrip.3ab6c6f3") : __i18n_k("ui.playerPanel.summaryStrip.3cb1090e"))}</dt>
        <dd>{__i18n_display(line)}</dd>
      </div>
      {__i18n_display(card.totals.seasons > 0 && (
        <div>
          <dt>{__i18n_t("ui.playerPanel.summaryStrip.7f3e9e67")}</dt>
          <dd>{__i18n_t("ui.playerPanel.summaryStrip.a14624b0", { seasons: card.totals.seasons, value: card.totals.war.toFixed(1), value2: titles ? __i18n_k("ui.playerPanel.summaryStrip.77ae974d", { titles: titles }) : '' })}</dd>
        </div>
      ))}
    </dl>
  );
}

/** His postseasons (1.4.0), one row a year with how far his club went, and the totals. */
function PostTable({ rows, totals, pitcher }: { rows: PostRow[]; totals: ReturnType<typeof postTotals>; pitcher: boolean }) {
  if (!rows.length) return <p class="muted">{__i18n_t("ui.playerPanel.postTable.2a9c2f14")}</p>;
  const t = totals;
  if (pitcher)
    return (
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table career">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.d5bc99dd")}</th>
              <th>{__i18n_t("ui.playerPanel.postTable.58756112")}</th>
              <th>{__i18n_t("ui.playerPanel.postTable.71d855ac")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.e0cee61a")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.3b1908b7")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.36260e2c")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.c5e4d00d")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.10a4423a")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.639a1f2f")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.3f349ed1")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.postTable.21e0537f")}</th>
              <th class="num">ERA</th>
              <th class="num">WHIP</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map((r) => (
              <tr key={r.year + r.team}>
                <td class="num">{__i18n_display(r.year)}</td>
                <td>{__i18n_display(r.team)}</td>
                <td>{__i18n_display(r.result === '우승' ? <strong>{__i18n_t("ui.playerPanel.postTable.894badc3")}</strong> : r.result)}</td>
                <td class="num">{__i18n_display(r.pit?.g ?? 0)}</td>
                <td class="num">{__i18n_display(r.pit?.w ?? 0)}</td>
                <td class="num">{__i18n_display(r.pit?.l ?? 0)}</td>
                <td class="num">{__i18n_display(r.pit?.sv ?? 0)}</td>
                <td class="num">{__i18n_display(r.pit?.hld ?? 0)}</td>
                <td class="num">{__i18n_display(rates.ip(r.pit?.outs ?? 0))}</td>
                <td class="num">{__i18n_display(r.pit?.k ?? 0)}</td>
                <td class="num">{__i18n_display(r.pit?.bb ?? 0)}</td>
                <td class="num strong">{__i18n_display(r.pit?.outs ? rates.era(r.pit).toFixed(2) : '-')}</td>
                <td class="num">{__i18n_display(r.pit?.outs ? rates.whip(r.pit).toFixed(2) : '-')}</td>
              </tr>
            )))}
          </tbody>
          {__i18n_display(t.pit && (
            <tfoot>
              <tr>
                <th colSpan={3}>{__i18n_t("ui.playerPanel.postTable.26da3deb", { years: t.years, value: t.titles ? __i18n_k("ui.playerPanel.postTable.77ae974d", { titles: t.titles }) : '' })}</th>
                <td class="num">{__i18n_display(t.pit.g)}</td>
                <td class="num">{__i18n_display(t.pit.w)}</td>
                <td class="num">{__i18n_display(t.pit.l)}</td>
                <td class="num">{__i18n_display(t.pit.sv)}</td>
                <td class="num">{__i18n_display(t.pit.hld)}</td>
                <td class="num">{__i18n_display(rates.ip(t.pit.outs))}</td>
                <td class="num">{__i18n_display(t.pit.k)}</td>
                <td class="num">{__i18n_display(t.pit.bb)}</td>
                <td class="num strong">{__i18n_display(t.pit.outs ? rates.era(t.pit).toFixed(2) : '-')}</td>
                <td class="num">{__i18n_display(t.pit.outs ? rates.whip(t.pit).toFixed(2) : '-')}</td>
              </tr>
            </tfoot>
          ))}
        </table>
      </div>
    );
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table career">
        <thead>
          <tr>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.d5bc99dd")}</th>
            <th>{__i18n_t("ui.playerPanel.postTable.58756112")}</th>
            <th>{__i18n_t("ui.playerPanel.postTable.71d855ac")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.e0cee61a")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.0a3d002c")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.1822db88")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.1eb19e0a")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.bb6ef1b2")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.7e66b88d")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.9162d3a3")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.fed1c588")}</th>
            <th class="num">{__i18n_t("ui.playerPanel.postTable.91e54831")}</th>
            <th class="num">OPS</th>
          </tr>
        </thead>
        <tbody>
          {__i18n_display(rows.map((r) => (
            <tr key={r.year + r.team}>
              <td class="num">{__i18n_display(r.year)}</td>
              <td>{__i18n_display(r.team)}</td>
              <td>{__i18n_display(r.result === '우승' ? <strong>{__i18n_t("ui.playerPanel.postTable.894badc3")}</strong> : r.result)}</td>
              <td class="num">{__i18n_display(r.bat?.g ?? 0)}</td>
              <td class="num">{__i18n_display(r.bat?.pa ?? 0)}</td>
              <td class="num">{__i18n_display(r.bat?.h ?? 0)}</td>
              <td class="num">{__i18n_display(r.bat?.ab ? rates.fmt3(rates.avg(r.bat)) : '-')}</td>
              <td class="num">{__i18n_display(r.bat?.pa ? rates.fmt3(rates.obp(r.bat)) : '-')}</td>
              <td class="num">{__i18n_display(r.bat?.ab ? rates.fmt3(rates.slg(r.bat)) : '-')}</td>
              <td class="num">{__i18n_display(r.bat?.hr ?? 0)}</td>
              <td class="num">{__i18n_display(r.bat?.rbi ?? 0)}</td>
              <td class="num">{__i18n_display(r.bat?.sb ?? 0)}</td>
              <td class="num strong">{__i18n_display(r.bat?.pa ? rates.fmt3(rates.ops(r.bat)) : '-')}</td>
            </tr>
          )))}
        </tbody>
        {__i18n_display(t.bat && (
          <tfoot>
            <tr>
              <th colSpan={3}>{__i18n_t("ui.playerPanel.postTable.26da3deb", { years: t.years, value: t.titles ? __i18n_k("ui.playerPanel.postTable.77ae974d", { titles: t.titles }) : '' })}</th>
              <td class="num">{__i18n_display(t.bat.g)}</td>
              <td class="num">{__i18n_display(t.bat.pa)}</td>
              <td class="num">{__i18n_display(t.bat.h)}</td>
              <td class="num">{__i18n_display(t.bat.ab ? rates.fmt3(rates.avg(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.pa ? rates.fmt3(rates.obp(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.ab ? rates.fmt3(rates.slg(t.bat)) : '-')}</td>
              <td class="num">{__i18n_display(t.bat.hr)}</td>
              <td class="num">{__i18n_display(t.bat.rbi)}</td>
              <td class="num">{__i18n_display(t.bat.sb)}</td>
              <td class="num strong">{__i18n_display(t.bat.pa ? rates.fmt3(rates.ops(t.bat)) : '-')}</td>
            </tr>
          </tfoot>
        ))}
      </table>
    </div>
  );
}

/** Our player's uniform number, set by the general manager (V0.12): a teammate wearing it swaps. */
function NumberField({ league, id, current, onAct }: { league: LeagueState; id: string; current: number | null; onAct: (a: Action) => void }) {
  // A new player or number remounts the field (keyed by both), so what is typed is never reset under the user.
  const [text, setText] = useState(current != null ? String(current) : '');
  const n = Number(text);
  const problem = text.trim() === '' ? __i18n_k("ui.playerPanel.numberField.problem.f35daaf6") : checkNumber(league, id, n);
  const holder = !problem ? numberHolder(league, league.user!.teamId, n, id) : undefined;
  return (
    <p class="inline-form number-form">
      <label>
        등번호
        <input type="number" inputMode="numeric" min={0} max={199} value={text} aria-label={__i18n_t("ui.playerPanel.numberField.7fab4c51")} onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <button type="button" disabled={!!problem || n === current} onClick={() => onAct({ kind: 'number', id, number: n })}>
        {__i18n_display(holder ? __i18n_k("ui.playerPanel.numberField.0e4ceea3", { name: wagwa(holder.name) }) : __i18n_k("ui.playerPanel.numberField.75b73b7f"))}
      </button>
      {__i18n_display(problem && text.trim() !== '' && <span class="muted small">{__i18n_display(problem)}</span>)}
    </p>
  );
}
