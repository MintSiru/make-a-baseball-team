import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* A league player's page (V0.5.1 layout; in parts since 1.4.0): who he is and his latest season at a glance on top,
   then one part at a time — scouting grades as bars with positions or pitches, records, the staff's read, his
   background and injuries. Everything shown is public: grades are scouting reports, velocity is the radar gun. */
import type { FieldTotals } from '../league/fielding';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from './modal';
import { MeetingsView, SavantView } from './Savant';
import { NationalLines } from './NationalLines';
import { nationalLinesOf } from '../league/nationalgames';
import { familyOf } from '../league/family';
import { checkSwitch, otherGrade, peekOther } from '../league/twoway';
import { isPitcher } from '../league/players';
import { checkPlayerEdit, checkTie, EDIT, editOf, findPlayers, type PlayerEdit, type Relation } from '../league/editor';
import { featsOf, featText } from '../league/feats';
import { learnedNote } from '../league/newpitch';
import { TOOL_LABELS } from '../draftroom';
import type { Split, Splits } from '../league/engine/types';
import type { Action } from '../league/actions';
import { wagwa } from '../league/josa';
import { checkNumber, numberHolder } from '../league/numbers';
import { checkNickname, NICKNAME_MAX, nicknameOf, nicknameWhy } from '../league/nicknames';
import { checkInspect } from '../league/scandals';
import { SCANDAL } from '../league/tuning';
import type { LeagueState } from '../league/state';
import { playerCard, positionLabel, rateContextFor, rates, shortName, type PlayerCard } from '../league/views';
import { usdTotal } from '../league/contracts';
import { fanAffinity, hometownOf, isMarried } from '../league/life';
import { SITES } from '../league/training';
import { usd } from '../league/foreign';
import { handedness, militaryLabel, money, toolKeysFor } from './format';
import { GradeBar, shownFuture, showsFutureDetail } from './grades';
import { GradeChart } from './GradeChart';
import { MlbTable } from './Mlb';
import { serviceNote } from '../league/military';
import type { TraitReport } from '../league/reports';
import { kboSeasons } from '../league/foreigncap';
import { extensionCooldown, extensionOptions, extensionProblem } from '../league/extensions';
import { postRows, postTotals, type PostRow } from '../league/poststats';
import { FASTBALL_LABELS, PITCH_LABELS } from '../league/pitches';
import { LEGACY_START } from '../league/era';
import type { ArmSlot, Tracking } from '../league/tracking';

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
type RecordView = 'seasons' | 'post' | 'highs' | 'splits' | 'batted' | 'fielding' | 'savant' | 'meetings' | 'national' | 'mlb';
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
  // 2.0.1: batted-ball data.
  { key: 'batted', label: __i18n_k("ui.playerPanel.text.f697b0c7") },
  // 2.0.3: fielding.
  { key: 'fielding', label: __i18n_k("ui.playerPanel.text.ed9be858") },
  // 2.0.4: his percentiles, spray chart and pitch mix; his head-to-head records.
  { key: 'savant', label: __i18n_k("ui.playerPanel.text.d5ce088d") },
  { key: 'meetings', label: __i18n_k("ui.playerPanel.text.eb71400a") },
  // 2.0.11: his national-team lines.
  { key: 'national', label: __i18n_t("ui.playerPanel.text.3243618b") },
  // 1.9.3: MLB, the minors and NPB.
  { key: 'mlb', label: __i18n_k("ui.playerPanel.text.98a07411") },
];
let lastPart: Part = 'ability';
let lastRecords: RecordView = 'seasons';

/** 2.0.6: a grade's change since last season, "▲5" or "▼5" (nothing when unchanged or unknown). */
const changeMark = (now: number | undefined, last: number | undefined) => (now == null || last == null || now === last ? '' : now > last ? ` ▲${now - last}` : ` ▼${last - now}`);

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
              <th class="num">{__i18n_t("ui.playerPanel.text.e401a056")}</th>
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
                  <td class="num">{__i18n_display(r.pit?.cg ?? 0)}</td>
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
                <td class="num">{__i18n_display(t.pit.cg ?? 0)}</td>
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
  onPlayer,
}: {
  league: LeagueState;
  id: string;
  onClose: () => void;
  /** 2.0.4: open another player (an opponent in his head-to-head records). */
  onPlayer?: (id: string) => void;
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
  const nickname = nicknameOf(league, p);
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
              {/* 2.0.14: a two-way player, plain to see. */}
              {p.twoWay && <span class="tag two-way">{__i18n_t("ui.playerPanel.text.62cb0192")}</span>}
            </h2>
            {__i18n_display(nickname && <p class="profile-nickname" title={__i18n_displayText(nicknameWhy(p) ?? '')}>“{__i18n_display(nickname)}”</p>)}
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
                  <GradeBar key={k} label={__i18n_displayText(TOOL_LABELS[k])} now={s.tools[k]} future={showsFutureDetail(p) ? s.futureTools[k] : undefined} />
                )))}
                <GradeBar label={__i18n_t("ui.playerPanel.playerPanel.f7c86d76")} now={s.current} future={shownFuture(p) ?? undefined} />
              </div>
              <p class="muted small">{__i18n_t("ui.playerPanel.playerPanel.40f3273a")}</p>
              {card.batted.profile && <p class="small">{__i18n_t("ui.playerPanel.text.b07fe0a1", { pull: PULL_LABEL()[card.batted.profile.pull + 2]!, lift: LIFT_LABEL()[card.batted.profile.lift + 2]! })}</p>}
              {__i18n_display(s.moved && showsFutureDetail(p) && (
                <p class={`small ${s.moved.to > s.moved.from ? 'plus' : 'minus'}`}>{__i18n_t("ui.playerPanel.playerPanel.e3838a42", { value: s.moved.to > s.moved.from ? '▲' : '▼', from: s.moved.from, to: s.moved.to, value2: s.moved.date.slice(5).replace('-', '/') })}</p>
              ))}
            </section>
            <section>
              <h3>{__i18n_t("ui.playerPanel.text.89a8bfe6")}</h3>
              <GradeChart log={p.gradeLog ?? []} role={p.role} proFrom={league.historical ? LEGACY_START : undefined} />
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
            {card.fielding && (
              <section class="pitch-box">
                <h3>{__i18n_t("ui.playerPanel.text.8d1966c8")}</h3>
                <div class="gradebars">
                  <GradeBar label={__i18n_t("ui.playerPanel.text.88c280f6")} now={card.fielding.parts.range} note={__i18n_t("ui.playerPanel.text.cb6177aa")} />
                  <GradeBar label={__i18n_t("ui.playerPanel.text.f06721a0")} now={card.fielding.parts.hands} />
                  <GradeBar label={__i18n_t("ui.playerPanel.text.5894110d")} now={card.fielding.parts.arm} />
                  {card.fielding.parts.lead !== null && <GradeBar label={__i18n_t("ui.playerPanel.text.f94f5492")} now={card.fielding.parts.lead} />}
                </div>
                <p class="small">
                  {__i18n_t("ui.playerPanel.text.e8f50717", { ms: card.fielding.sprint.toFixed(2), fts: (card.fielding.sprint / 0.3048).toFixed(1) })}
                  {card.fielding.pop !== null && ` · ${__i18n_t("ui.playerPanel.text.098a5b7d", { s: card.fielding.pop.toFixed(2) })}`}
                </p>
              </section>
            )}
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
                  <GradeBar label={`${card.fastball ?? '4SFB'} ${__i18n_displayText(FASTBALL_LABELS[card.fastball ?? '4SFB'])}`} now={s.tools.stuff} future={showsFutureDetail(p) ? s.futureTools.stuff : undefined} note={`${__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round((1 - card.pitches.reduce((a, x) => a + x.usage, 0)) * 100) }))}${changeMark(s.tools.stuff, card.pitchLast?.grades.FB)}`} />
                  {__i18n_display(card.pitches.map((x) => (
                    <GradeBar key={x.type} label={`${x.type} ${__i18n_displayText(x.label)}`} now={x.grade} future={showsFutureDetail(p) ? card.pitchesFuture[x.type] : undefined} note={`${__i18n_displayText(__i18n_k("ui.playerPanel.playerPanel.4c8baf31", { value: Math.round(x.usage * 100) }))}${changeMark(x.grade, card.pitchLast?.grades[x.type])}${learnedNote(league.players[p.id]!, x.type) ? ` · ${__i18n_displayText(learnedNote(league.players[p.id]!, x.type)!)}` : ''}`} />
                  )))}
                </div>
                {card.pitchLast && <p class="muted small">{__i18n_t("ui.playerPanel.text.da7d248d", { season: card.pitchLast.season })}</p>}
                {card.pitchingLift !== null && <p class="small">{__i18n_t("ui.playerPanel.text.41757042", { kind: PITCH_LIFT_LABEL()[card.pitchingLift + 2]! })}</p>}
                {card.tracking && <TrackingTable t={card.tracking} />}
              </section>
            ))}
            {/* 2.0.12: the other side — a two-way player's, or ours to turn around. */}
            <TwoWaySection league={league} id={p.id} onAct={onAct} />
          </div>
        ))}

        {__i18n_display(shown === 'records' && (
          <div class="profile-part" role="tabpanel" aria-label={__i18n_t("ui.playerPanel.playerPanel.d84b6f4b")}>
            <div class="segmented record-views" role="group" aria-label={__i18n_t("ui.playerPanel.playerPanel.493c08af")}>
              {__i18n_display(RECORD_VIEWS.filter((x) => (x.key !== 'mlb' || p.mlb) && (x.key !== 'national' || nationalLinesOf(league, p.id).length > 0)).map((x) => (
                <button key={x.key} type="button" aria-pressed={records === x.key} onClick={() => setRecords(x.key)}>
                  {__i18n_display(x.label)}
                  {__i18n_display(x.key === 'post' && post.length > 0 && <span class="count">{__i18n_display(post.length)}</span>)}
                </button>
              )))}
            </div>
            {records === 'mlb' && p.mlb && <MlbTable p={p} />}
            {__i18n_display((records === 'seasons' || (records === 'mlb' && !p.mlb)) && (
              <>
                <SeasonTable league={league} card={card} pitcher={pitcher} />
                {/* 2.0.12: a two-way player's (or a turned-around player's) other side too. */}
                {card.career.some((r) => !r.futures && (pitcher ? (r.bat?.pa ?? 0) > 0 : (r.pit?.outs ?? 0) > 0)) && (
                  <>
                    <h4>{pitcher ? __i18n_t("ui.playerPanel.text.d110c34f") : __i18n_t("ui.playerPanel.text.493471fa")}</h4>
                    <SeasonTable league={league} card={{ ...card, career: card.career.filter((r) => (pitcher ? (r.bat?.pa ?? 0) > 0 : (r.pit?.outs ?? 0) > 0)) }} pitcher={!pitcher} />
                  </>
                )}
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
            {records === 'batted' && <BattedTable batted={card.batted} pitcher={pitcher} />}
            {records === 'savant' && <SavantView league={league} id={id} pitcher={pitcher} />}
            {records === 'meetings' && <MeetingsView league={league} id={id} pitcher={pitcher} onPlayer={onPlayer} />}
            {records === 'national' && <NationalLines league={league} id={id} pitcher={pitcher} />}
            {records === 'fielding' && (card.fielding ? <FieldingTable fielding={card.fielding} /> : <p class="muted">{__i18n_t("ui.playerPanel.text.189e71c9")}</p>)}
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
            {__i18n_display(nickname && !(onAct && ours) && (
              <p class="small">{__i18n_display(__i18n_t("ui.playerPanel.text.b144acf5", { nickname }))}{__i18n_display(nicknameWhy(p) ? __i18n_t("ui.playerPanel.text.06bea072", { why: nicknameWhy(p)!, year: p.nickname!.year }) : '')}</p>
            ))}
            {onAct && ours && <NicknameField key={`${p.id}-${p.nicknameOwn ?? ''}`} league={league} id={p.id} onAct={onAct} />}
            {onAct && ours && <ExtensionOffer league={league} id={p.id} onAct={onAct} />}
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
              {/* 2.0.7: his great single-game feats. */}
              {featsOf(league, p.id).length > 0 && (
                <div>
                  <dt>{__i18n_t("ui.playerPanel.text.1e2a5100")}</dt>
                  <dd>
                    <ul class="plain feats">
                      {featsOf(league, p.id).map((f, i) => (
                        <li key={i}>{featText(league, f)}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {/* 2.0.6: his relatives in the game. */}
              {familyOf(league, p.id).length > 0 && (
                <div>
                  <dt>{__i18n_t("ui.playerPanel.text.0fc79d30")}</dt>
                  <dd>
                    {familyOf(league, p.id).map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && ' · '}
                        {__i18n_displayText(f.relation)}{' '}
                        {onPlayer ? (
                          <button type="button" class="link" onClick={() => onPlayer(f.id)}>
                            {f.name}
                          </button>
                        ) : (
                          f.name
                        )}
                        {f.team && <span class="muted small"> ({__i18n_displayText(f.team)})</span>}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
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
                  {__i18n_display(p.origin.preLeague
                    ? __i18n_t("ui.playerPanel.text.03bc4d29")
                    : p.origin.territorial
                    ? __i18n_t("ui.playerPanel.text.5c04ff7e", { draftYear: p.origin.draftYear })
                    : p.origin.secondPick
                    ? __i18n_t("ui.playerPanel.text.384f9d5e", { draftYear: p.origin.draftYear, n: p.origin.secondPick })
                    : p.origin.overallPick
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
              <div class="fact-wide">
                <dt>{__i18n_t("ui.playerPanel.text.eb55a24f")}</dt>
                <dd>{card.fa.text}</dd>
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
            {/* 2.0.9: the editor (no abilities). */}
            {onAct && <PlayerEditor league={league} id={p.id} onAct={onAct} />}
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
          <strong>{__i18n_display(s.current)}</strong> <span class="muted small">{__i18n_t("ui.playerPanel.summaryStrip.92982abd", { futureValue: shownFuture(card.player) ?? '-' })}</span>
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

/** 1.9.3: our player's nickname — the fans' (and why), or one the general manager gives him. */
function NicknameField({ league, id, onAct }: { league: LeagueState; id: string; onAct: (a: Action) => void }) {
  const p = league.players[id]!;
  const [text, setText] = useState(p.nicknameOwn ?? '');
  const problem = checkNickname(league, id, text);
  const fans = p.nickname ? nicknameOf(league, { ...p, nicknameOwn: undefined }) : null;
  return (
    <p class="inline-form nickname-form">
      <label>
        {__i18n_t("ui.playerPanel.text.0aceafa3")}
        <input type="text" maxLength={NICKNAME_MAX} value={text} placeholder={fans ?? ''} aria-label={__i18n_t("ui.playerPanel.text.0aceafa3")} onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <button type="button" disabled={!!problem || text.trim() === (p.nicknameOwn ?? '')} onClick={() => onAct({ kind: 'nickname', id, text })}>
        {text.trim() ? __i18n_t("ui.playerPanel.text.4a49fb33") : __i18n_t("ui.playerPanel.text.13627b09")}
      </button>
      <span class="muted small">{__i18n_display(problem ?? (fans ? __i18n_t("ui.playerPanel.text.b88d4106", { fans, why: nicknameWhy({ ...p, nicknameOwn: undefined }) ?? '', year: p.nickname!.year }) : __i18n_t("ui.playerPanel.text.f6fc8202")))}</span>
    </p>
  );
}

/** 2.0.9 (editor.ts): any player's name, hometown, school and nickname, and his family ties — not his abilities. */
function PlayerEditor({ league, id, onAct }: { league: LeagueState; id: string; onAct: (a: Action) => void }) {
  const p = league.players[id]!;
  const [draft, setDraft] = useState<PlayerEdit>(() => editOf(p));
  // Applied (or another player opened): start again from what he has now, the editor staying open.
  const current = JSON.stringify(editOf(p));
  useEffect(() => setDraft(editOf(p)), [current]);
  const [rel, setRel] = useState<Relation>('brother');
  const [query, setQuery] = useState('');
  const problem = checkPlayerEdit(league, id, draft);
  const changed = JSON.stringify(draft) !== current;
  const set = (k: keyof PlayerEdit, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const fans = p.nickname ? nicknameOf(league, { ...p, nicknameOwn: undefined }) : null;
  const fields: [keyof PlayerEdit, string, number][] = [
    ['name', __i18n_t("ui.playerPanel.text.9aa18e50"), EDIT.name.max],
    ['birthplace', __i18n_t("ui.playerPanel.text.71479e57"), EDIT.birthplace.max],
    ['school', __i18n_t("ui.playerPanel.text.add2f441"), EDIT.school.max],
    ['nickname', __i18n_t("ui.playerPanel.text.0aceafa3"), NICKNAME_MAX],
  ];
  const relations: [Relation, string][] = [
    ['brother', __i18n_t("ui.playerPanel.text.fb1a4346")],
    ['twin', __i18n_t("ui.playerPanel.text.f6c8856c")],
    ['father', __i18n_t("ui.playerPanel.text.7e3ccf68")],
    ['son', __i18n_t("ui.playerPanel.text.bb28b624")],
  ];
  const ties = familyOf(league, id);
  const found = findPlayers(league, query, id);
  return (
    <details class="player-editor">
      <summary>{__i18n_t("ui.playerPanel.text.6caa09f7")}</summary>
      <p class="muted small">{__i18n_t("ui.playerPanel.text.4f0d937d")}</p>
      <div class="editor-fields">
        {fields.map(([k, label, max]) => (
          <label key={k}>
            {__i18n_display(label)}
            <input type="text" value={draft[k]} maxLength={max} placeholder={k === 'nickname' ? (fans ?? '') : ''} onInput={(e) => set(k, (e.currentTarget as HTMLInputElement).value)} />
          </label>
        ))}
      </div>
      {problem && (
        <p class="notice warn small" role="alert">
          {__i18n_display(problem)}
        </p>
      )}
      <div class="row-actions">
        <button type="button" class="primary" disabled={!changed || !!problem} onClick={() => onAct({ kind: 'editPlayer', id, edit: draft })}>
          {__i18n_t("ui.playerPanel.text.e01dd02f")}
        </button>
        <button type="button" disabled={!changed} onClick={() => setDraft(editOf(p))}>
          {__i18n_t("ui.playerPanel.text.8bd9b45e")}
        </button>
      </div>
      <h4>{__i18n_t("ui.playerPanel.text.38576d81")}</h4>
      {ties.length > 0 ? (
        <ul class="plain small editor-ties">
          {ties.map((f) => (
            <li key={f.id}>
              {__i18n_displayText(f.relation)} {f.name}{' '}
              <button type="button" class="link" onClick={() => onAct({ kind: 'familyTie', id, other: f.id, rel: null })}>
                {__i18n_t("ui.playerPanel.text.d1278f7c")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted small">{__i18n_t("ui.playerPanel.text.c2b7072b")}</p>
      )}
      <p class="inline-form">
        <label>
          {__i18n_t("ui.playerPanel.text.84be6e37")}
          <select value={rel} onChange={(e) => setRel((e.currentTarget as HTMLSelectElement).value as Relation)}>
            {relations.map(([k, label]) => (
              <option key={k} value={k}>
                {__i18n_display(label)}
              </option>
            ))}
          </select>
        </label>
        <input type="search" value={query} placeholder={__i18n_t("ui.playerPanel.text.869e9874")} aria-label={__i18n_t("ui.playerPanel.text.869e9874")} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
      </p>
      {found.length > 0 && (
        <ul class="plain small editor-found">
          {found.map((o) => {
            const why = checkTie(league, id, o.id, rel);
            return (
              <li key={o.id}>
                {o.name}{' '}
                <span class="muted">
                  ({o.birthday.slice(0, 4)} · {__i18n_display(o.status === 'retired' ? __i18n_t("ui.playerPanel.text.5b170d3c") : shortName(league, o.teamId))})
                </span>{' '}
                <button type="button" disabled={!!why} onClick={() => onAct({ kind: 'familyTie', id, other: o.id, rel })}>
                  {__i18n_t("ui.playerPanel.text.9e4bc2a2")}
                </button>
                {why && <span class="muted"> {__i18n_display(why)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

/** 2.0.12 (twoway.ts): a two-way player's other side (public), and for ours the scouts' read of it with the choices:
    turn him around in the winter, or start or stop two-way play. */
function TwoWaySection({ league, id, onAct }: { league: LeagueState; id: string; onAct?: (a: Action) => void }) {
  const p = league.players[id];
  if (!p || p.status === 'retired') return null;
  const ours = !!league.user && p.teamId === league.user.teamId;
  if (!p.twoWay && !ours && !p.switched?.length) return null;
  const o = peekOther(p);
  const convert = checkSwitch(league, id, 'convert');
  const start = checkSwitch(league, id, p.twoWay ? 'twoWayOff' : 'twoWayOn');
  return (
    <section class="two-way-side">
      <h3>{p.twoWay ? __i18n_t("ui.playerPanel.text.a48acae7") : __i18n_t("ui.playerPanel.text.097bc996")}</h3>
      {(p.twoWay || ours) && (
        <div class="gradebars">
          {toolKeysFor(o.role).map((k) => (
            <GradeBar key={k} label={__i18n_displayText(TOOL_LABELS[k])} now={o.tools[k]!} />
          ))}
          <GradeBar label={__i18n_t("ui.playerPanel.text.513dde66")} now={otherGrade(p)} />
        </div>
      )}
      {o.velocity && isPitcher(p) === false && <p class="small">{__i18n_t("ui.playerPanel.text.558fd868", { v: o.velocity })}</p>}
      {(p.switched ?? []).map((x) => (
        <p key={x.year} class="muted small">
          {x.to === 'pitcher' ? __i18n_t("ui.playerPanel.text.263832fa", { year: x.year }) : __i18n_t("ui.playerPanel.text.62c13080", { year: x.year })}
        </p>
      ))}
      {ours && onAct && (
        <div class="row-actions">
          <button type="button" disabled={!!convert} onClick={() => onAct({ kind: 'switchSide', id, what: 'convert' })}>
            {isPitcher(p) ? __i18n_t("ui.playerPanel.text.182d5f0f") : __i18n_t("ui.playerPanel.text.b6343da6")}
          </button>
          <button type="button" disabled={!!start} onClick={() => onAct({ kind: 'switchSide', id, what: p.twoWay ? 'twoWayOff' : 'twoWayOn' })}>
            {p.twoWay ? __i18n_t("ui.playerPanel.text.fc2f4b16") : __i18n_t("ui.playerPanel.text.f6d88d41")}
          </button>
          <span class="muted small">{__i18n_display(convert ?? start ?? __i18n_t("ui.playerPanel.text.8ffc8419"))}</span>
        </div>
      )}
    </section>
  );
}

/** 1.7.0: a multi-year deal before free agency (extensions.ts), two to six years. */
function ExtensionOffer({ league, id, onAct }: { league: LeagueState; id: string; onAct: (a: Action) => void }) {
  const problem = extensionProblem(league, id);
  const [years, setYears] = useState(4);
  // Only a recent no is worth telling; otherwise he is not someone to offer one to.
  if (problem && problem !== extensionCooldown(league, id)) return null;
  const options = problem ? [] : extensionOptions(league, id);
  const pick = options.find((x) => x.years === years) ?? options.at(-1);
  return (
    <div class="inline-form extension">
      <span class="small">
        <strong>{__i18n_t("ui.playerPanel.text.e03ccaea")}</strong>
      </span>
      {problem ? (
        <span class="muted small">{problem}</span>
      ) : (
        <>
          <select value={String(pick?.years ?? years)} onChange={(e) => setYears(Number((e.currentTarget as HTMLSelectElement).value))} aria-label={__i18n_t("ui.playerPanel.text.e52c8464")}>
            {options.map((x) => (
              <option key={x.years} value={String(x.years)}>
                {__i18n_t("ui.playerPanel.text.bcc042ee", { years: x.years, annual: money(x.annual), total: money(x.total) })}
              </option>
            ))}
          </select>
          <button type="button" disabled={!pick} onClick={() => pick && onAct({ kind: 'extend', id, years: pick.years })}>
            {__i18n_t("ui.playerPanel.text.6ef251ee")}
          </button>
          <span class="muted small">{__i18n_t("ui.playerPanel.text.9d415c3d")}</span>
        </>
      )}
    </div>
  );
}

/** 2.0.3: his fielding by season — chances, outs, errors, outs above average, an outfielder's arm, a catcher's
    throwing and game-calling, the runs they make and his defensive WAR (fielding.ts). */
function FieldingTable({ fielding }: { fielding: NonNullable<PlayerCard['fielding']> }) {
  const one = (x: number) => (x / 1000).toFixed(1);
  const signed = (x: number) => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));
  const catcher = fielding.seasons.some((x) => x.f.cpa > 0);
  const row = (key: string, label: string, pos: string, f: FieldTotals, runs: number, dwar: number | null) => (
    <tr key={key}>
      <td>{label}</td>
      <td>{pos}</td>
      <td class="num">{f.ch}</td>
      <td class="num">{f.po}</td>
      <td class="num">{f.e}</td>
      <td class="num">{signed(f.oaa / 1000)}</td>
      <td class="num">{one(f.arm)}</td>
      {catcher && <td class="num">{f.sba ? `${f.cs}/${f.sba}` : '-'}</td>}
      {catcher && <td class="num">{signed(f.csaa / 1000)}</td>}
      {catcher && <td class="num">{signed(f.lead / 100000)}</td>}
      <td class="num">{signed(runs)}</td>
      <td class="num">{dwar === null ? '-' : signed(dwar)}</td>
    </tr>
  );
  return (
    <div class="tracking">
      {fielding.seasons.length ? (
        <div class="table-wrap">
          <table class="record-table small">
            <thead>
              <tr>
                <th>{__i18n_t("ui.playerPanel.text.d5bc99dd")}</th>
                <th>{__i18n_t("ui.playerPanel.text.f8fce955")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.9c19ac98")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.d5edec7e")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.8d9aaf03")}</th>
                <th class="num">OAA</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.8c0849d0")}</th>
                {catcher && <th class="num">{__i18n_t("ui.playerPanel.text.482a43eb")}</th>}
                {catcher && <th class="num">{__i18n_t("ui.playerPanel.text.bb6b6d8a")}</th>}
                {catcher && <th class="num">{__i18n_t("ui.playerPanel.text.2f4b81c5")}</th>}
                <th class="num">{__i18n_t("ui.playerPanel.text.e980cd4b")}</th>
                <th class="num">dWAR</th>
              </tr>
            </thead>
            <tbody>
              {fielding.seasons.map((x) => row(String(x.year), x.current ? __i18n_t("ui.playerPanel.text.04555519", { year: x.year }) : String(x.year), x.pos, x.f, x.runs, x.dwar))}
              {fielding.career && fielding.seasons.length > 1 && row('career', __i18n_t("ui.playerPanel.text.fc7fa3d0"), '', fielding.career.f, fielding.career.runs, null)}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.playerPanel.text.9c069f6d")}</p>
      )}
      <p class="muted small">{__i18n_t("ui.playerPanel.text.d281e340")}</p>
    </div>
  );
}

const PITCH_LIFT_LABEL = () => [__i18n_t("ui.playerPanel.text.c2c26ac4"), __i18n_t("ui.playerPanel.text.3209d10f"), __i18n_t("ui.playerPanel.text.2179da2c"), __i18n_t("ui.playerPanel.text.d8e32136"), __i18n_t("ui.playerPanel.text.45f504a1")];
const PULL_LABEL = () => [__i18n_t("ui.playerPanel.text.e089203f"), __i18n_t("ui.playerPanel.text.e6c78e11"), __i18n_t("ui.playerPanel.text.b90fdaf4"), __i18n_t("ui.playerPanel.text.8ba5121a"), __i18n_t("ui.playerPanel.text.e8f4ff7e")];
const LIFT_LABEL = () => [__i18n_t("ui.playerPanel.text.0402d4de"), __i18n_t("ui.playerPanel.text.2716bc95"), __i18n_t("ui.playerPanel.text.2179da2c"), __i18n_t("ui.playerPanel.text.2d6dbf09"), __i18n_t("ui.playerPanel.text.6f7bed73")];

/** 2.0.1: his batted balls by season (a pitcher's: the balls hit off him), and his tendencies (battedball.ts). */
function BattedTable({ batted, pitcher }: { batted: PlayerCard['batted']; pitcher: boolean }) {
  const pct = (x: number) => x.toFixed(1);
  const three = (x: number) => x.toFixed(3).replace(/^0/, '');
  const row = (key: string, label: string, r: NonNullable<PlayerCard['batted']['career']>) => (
    <tr key={key}>
      <td>{label}</td>
      <td class="num">{r.n}</td>
      <td class="num">{r.ev.toFixed(1)}</td>
      <td class="num">{r.evMax.toFixed(1)}</td>
      <td class="num">{r.la.toFixed(1)}</td>
      <td class="num">{pct(r.hard)}</td>
      <td class="num">{pct(r.barrel)}</td>
      <td class="num">{pct(r.sweet)}</td>
      <td class="num">{`${Math.round(r.gb)}/${Math.round(r.ld)}/${Math.round(r.fb)}/${Math.round(r.pu)}`}</td>
      <td class="num">{`${Math.round(r.pull)}/${Math.round(r.cent)}/${Math.round(r.oppo)}`}</td>
      <td class="num">{three(r.xba)}</td>
      <td class="num">{three(r.xslg)}</td>
      <td class="num">{three(r.xwcon)}</td>
      <td class="num">{r.hrDist == null ? '-' : `${r.hrDist}/${r.hrMax}`}</td>
    </tr>
  );
  return (
    <div class="tracking">
      {batted.profile && <p class="small">{__i18n_t("ui.playerPanel.text.b07fe0a1", { pull: PULL_LABEL()[batted.profile.pull + 2]!, lift: LIFT_LABEL()[batted.profile.lift + 2]! })}</p>}
      {batted.seasons.length ? (
        <div class="table-wrap">
          <table class="record-table small">
            <thead>
              <tr>
                <th>{__i18n_t("ui.playerPanel.text.d5bc99dd")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.f697b0c7")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.ecee66d3")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.50922e57")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.9fd86f4d")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.4408711e")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.4c8fb2fa")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.9f032c27")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.27309da6")}</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.e3351339")}</th>
                <th class="num">xBA</th>
                <th class="num">xSLG</th>
                <th class="num">xwOBAcon</th>
                <th class="num">{__i18n_t("ui.playerPanel.text.c10f6806")}</th>
              </tr>
            </thead>
            <tbody>
              {batted.seasons.map((x) => row(String(x.year), x.current ? __i18n_t("ui.playerPanel.text.04555519", { year: x.year }) : String(x.year), x.rates))}
              {batted.career && batted.seasons.length > 1 && row('career', __i18n_t("ui.playerPanel.text.fc7fa3d0"), batted.career)}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">{__i18n_t("ui.playerPanel.text.2d6b42aa")}</p>
      )}
      <p class="muted small">
        {pitcher
          ? __i18n_t("ui.playerPanel.text.159d875f")
          : __i18n_t("ui.playerPanel.text.32fd6cf4")}
      </p>
    </div>
  );
}

const SLOT_LABEL: Record<ArmSlot, string> = { over: __i18n_t("ui.playerPanel.text.d5ac5440"), three: __i18n_t("ui.playerPanel.text.c1b3afb7"), side: __i18n_t("ui.playerPanel.text.db8562f5"), under: __i18n_t("ui.playerPanel.text.fecd8c93") };

/** 2.0.0: his arm slot and each pitch as a tracking system reads it (tracking.ts). */
function TrackingTable({ t }: { t: Tracking }) {
  const side = (h: number) => (h > 0 ? __i18n_t("ui.playerPanel.text.e3519768", { cm: h }) : h < 0 ? __i18n_t("ui.playerPanel.text.2fb60458", { cm: -h }) : '0');
  return (
    <div class="tracking">
      <p class="small">
        {__i18n_t("ui.playerPanel.text.c2d86648", { slot: SLOT_LABEL[t.slot], angle: t.angle, release: t.release.toFixed(2), extension: t.extension.toFixed(2) })}
      </p>
      <div class="table-wrap">
        <table class="record-table small">
          <thead>
            <tr>
              <th>{__i18n_t("ui.playerPanel.text.0685b54a")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.text.b8c2e079")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.text.c2b703dc")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.text.b49c6966")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.text.9514ce6d")}</th>
              <th class="num">{__i18n_t("ui.playerPanel.text.b7347eea")}</th>
            </tr>
          </thead>
          <tbody>
            {t.pitches.map((x) => (
              <tr key={x.type}>
                <td>{x.type === 'FB' ? FASTBALL_LABELS['4SFB'] : PITCH_LABELS[x.type]}</td>
                <td class="num">{x.velocity}</td>
                <td class="num">{x.spin.toLocaleString('ko-KR')}</td>
                <td class="num">{x.axis}</td>
                <td class="num">{__i18n_t("ui.playerPanel.text.b3c5351e", { cm: x.vertical })}</td>
                <td class="num">{side(x.horizontal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">{__i18n_t("ui.playerPanel.text.45a4d44e")}</p>
    </div>
  );
}
