import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, t as __i18n_t } from '../i18n/index';
/* The user's club in three views: an overview you can read at a glance, the squads (with the general
   manager's moves), and the front office (money, ballpark, club facts). */
import { useEffect, useState } from 'preact/hooks';
import { accentStyle } from './display';
import { useDark } from './useDisplay';
import { cityById } from '../club/cities';
import { PARENT_COMPANY_TYPES } from '../club/types';
import type { Action } from '../league/actions';
import { canMove, canRegister } from '../league/entry';
import { projectedPayroll } from '../league/expansion';
import { firstTeamSize, PEN_ROLE_LABELS, PEN_ROLES } from '../league/manager';
import type { BullpenRole } from '../league/engine/types';
import { rosterLimit } from '../league/offseason';
import { isPitcher } from '../league/players';
import { developmentIds, registeredIds, type LeagueState, type Squad as SquadName } from '../league/state';
import { OFFSEASON } from '../league/tuning';
import { injuryNote, rates, shortName, standingsView } from '../league/views';
import { money } from './format';
import { Squad, type Row, type SquadKey } from './Squad';
import { Office } from './Office';
import { scenarioProgress } from '../league/scenarios';
import { startYear } from '../league/era';
import { Lineup } from './Lineup';
import { Story } from './Story';
import { Training } from './Training';
import type { NewsItem } from '../league/news';
import type { BriefGo } from '../league/briefing';
import { Briefing } from './Briefing';

export type View = 'overview' | 'squad' | 'lineup' | 'training' | 'story' | 'office';

export interface StoryHooks {
  onRewrite?: (item: NewsItem) => void;
  onRevert?: (item: NewsItem) => void;
  busyId?: string | null;
}

export function MyClub({
  league,
  onPlayer,
  onAct,
  onView,
  onGo,
  story = {},
}: {
  league: LeagueState;
  onPlayer: (id: string) => void;
  onAct: (a: Action) => void;
  /** 1.5.0: the briefing's buttons to screens outside the club (the market). */
  onGo?: (g: BriefGo) => void;
  /** Tells the page which view is open (the tutorial has a lesson for some, V0.16). */
  onView?: (view: View) => void;
  story?: StoryHooks;
}) {
  const dark = useDark();
  const [view, setView] = useState<View>('overview');
  useEffect(() => onView?.(view), [view]);
  const [msg, setMsg] = useState('');
  const u = league.user!;
  const team = league.teams.find((t) => t.id === u.teamId)!;
  const city = cityById(u.settings.cityId)!;
  return (
    <section aria-labelledby="myclub-title" style={accentStyle(team.color, dark)}>
      <div class="page-head">
        <div>
          <h2 id="myclub-title">
            <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {__i18n_display(team.name)}
          </h2>
          <p class="muted">{__i18n_t("ui.myClub.myClub.7a2d3f31", { name: city.name, label: PARENT_COMPANY_TYPES[u.settings.parentType].label, name2: team.parent.name, name3: team.stadium.name, value: team.stadium.capacity.toLocaleString('ko-KR') })}</p>
        </div>
        <div class="segmented" role="group" aria-label={__i18n_t("ui.myClub.myClub.8cd1adbf")}>
          {__i18n_display((
            [
              ['overview', __i18n_k("ui.myClub.myClub.476966c5")],
              ['squad', __i18n_k("ui.myClub.myClub.5b9daec2")],
              ['lineup', __i18n_k("ui.myClub.myClub.4c31ef82")],
              ['training', __i18n_k("ui.myClub.myClub.b4927759")],
              ['story', __i18n_k("ui.myClub.myClub.d77486d9")],
              ['office', __i18n_k("ui.myClub.myClub.6bc69497")],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {__i18n_display(label)}
            </button>
          )))}
        </div>
      </div>
      {__i18n_display(u.fired && <p class="notice warn">{__i18n_t("ui.myClub.myClub.667abded", { fired: u.fired })}</p>)}
      {__i18n_display(view === 'overview' && (
        <>
          <ScenarioCard league={league} />
          <Briefing
            league={league}
            onGo={(g) => {
              if (g.tab === 'club') setView(g.view);
              else if (g.tab === 'player') onPlayer(g.id);
              else onGo?.(g);
            }}
          />
          <Overview league={league} onPlayer={onPlayer} />
        </>
      ))}
      {__i18n_display(view === 'squad' && <Management league={league} onPlayer={onPlayer} onAct={onAct} setMsg={setMsg} />)}
      {__i18n_display(view === 'lineup' && <Lineup league={league} teamId={u.teamId} onPlayer={onPlayer} onAct={onAct} />)}
      {__i18n_display(view === 'training' && <Training league={league} onAct={onAct} onPlayer={onPlayer} />)}
      {__i18n_display(view === 'story' && <Story league={league} {...story} />)}
      {__i18n_display(view === 'office' && <Office league={league} onAct={onAct} setMsg={setMsg} onPlayer={onPlayer} />)}
      {__i18n_display(msg && (
        <p class="toast" role="status">
          {__i18n_display(msg)}
          <button type="button" class="link" onClick={() => setMsg('')} aria-label={__i18n_t("ui.myClub.myClub.94b7dba1")}>
            ✕
          </button>
        </p>
      ))}
    </section>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────────────────────

function Overview({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const me = u.teamId;
  const inFirstTeam = league.year >= u.firstTeamYear;
  const table = standingsView(league);
  const row = table.find((r) => r.teamId === me);
  const games = inFirstTeam ? league.scores.filter((g) => g.home === me || g.away === me) : (league.futures?.scores ?? []).filter((g) => g.home === me || g.away === me);
  const record = games.reduce(
    (a, g) => {
      const [mine, theirs] = g.home === me ? [g.hs, g.as] : [g.as, g.hs];
      return { w: a.w + Number(mine > theirs), l: a.l + Number(mine < theirs), t: a.t + Number(mine === theirs) };
    },
    { w: 0, l: 0, t: 0 },
  );
  const payYear = league.phase === 'offseason' && league.offseason ? league.offseason.year + 1 : league.year;
  const payroll = projectedPayroll(league, me, payYear);
  const share = Math.min(1, payroll / Math.max(1, u.payrollBudget));
  const upcoming = league.phase === 'regular' ? league.schedule.slice(league.next).filter((g) => g.home === me || g.away === me).slice(0, 6) : [];
  const steps = [
    { year: startYear(), label: __i18n_k("ui.myClub.steps.label.bc754946") },
    { year: startYear(), label: __i18n_k("ui.myClub.steps.label.f4703124") },
    ...(u.firstTeamYear === startYear() + 2 ? [{ year: startYear() + 1, label: __i18n_k("ui.myClub.steps.label.51439b09") }] : []),
    { year: u.firstTeamYear - 1, label: __i18n_k("ui.myClub.steps.label.0b486138") },
    { year: u.firstTeamYear, label: __i18n_k("ui.myClub.steps.label.48bea069") },
  ];
  return (
    <>
      <div class="cards">
        <div class="card">
          <p class="card-label">{__i18n_display(inFirstTeam ? __i18n_k("ui.myClub.overview.6b921fd2", { year: league.year }) : __i18n_k("ui.myClub.overview.b5dc6dec", { year: league.year }))}</p>
          <p class="card-value">{__i18n_display(inFirstTeam && row ? __i18n_k("ui.myClub.overview.b372d067", { rank: row.rank }) : games.length ? __i18n_k("ui.myClub.overview.44b431c7", { w: record.w, l: record.l }) : __i18n_k("ui.myClub.overview.d103f6c7"))}</p>
          <p class="card-sub">
            {__i18n_display(inFirstTeam && row ? __i18n_k("ui.myClub.overview.133887b6", { w: row.w, l: row.l, value: row.t, value2: rates.fmt3(row.pct), value3: row.gb ? __i18n_k("ui.myClub.overview.66ea1b23", { gb: row.gb }) : '' }) : __i18n_k("ui.myClub.overview.265daa15", { firstTeamYear: u.firstTeamYear }))}
          </p>
        </div>
        <div class="card">
          <p class="card-label">{__i18n_t("ui.myClub.overview.26719725", { payYear: payYear })}</p>
          <p class="card-value">{__i18n_display(money(payroll))}</p>
          <div class="bar" aria-hidden="true">
            <span style={{ width: `${Math.round(share * 100)}%` }} class={payroll > u.payrollBudget ? 'over' : ''} />
          </div>
          <p class="card-sub">{__i18n_t("ui.myClub.overview.43fc4f2a", { money: money(u.payrollBudget) })}</p>
        </div>
        <div class="card">
          <p class="card-label">{__i18n_t("ui.myClub.overview.4f7776dd")}</p>
          <p class="card-value">{__i18n_display(money(u.fund))}</p>
          <p class="card-sub">{__i18n_t("ui.myClub.overview.9af74a3f")}</p>
        </div>
        <div class="card">
          <p class="card-label">{__i18n_t("ui.myClub.overview.78280b3f")}</p>
          <p class="card-value">
            {__i18n_display(registeredIds(league, me).length)}
            <span class="card-unit">{__i18n_t("ui.myClub.overview.60cd9e6b", { rosterLimit: rosterLimit(league.year) })}</span>
          </p>
          <p class="card-sub">{__i18n_t("ui.myClub.overview.208d4895", { length: league.rosters[me]!.active.length, firstTeamSize: firstTeamSize(league, me), length2: developmentIds(league, me).length, cap: OFFSEASON.development.cap })}</p>
        </div>
      </div>

      {__i18n_display(league.year <= u.firstTeamYear && (
        <ol class="stepper" aria-label={__i18n_t("ui.myClub.overview.f0c2eeda")}>
          {__i18n_display(steps.map((st) => {
            const done = league.year > st.year || (league.year === st.year && inFirstTeam);
            return (
              <li key={st.label} class={done ? 'done' : ''}>
                <span class="num">{__i18n_display(st.year)}</span>
                {__i18n_display(st.label)}
              </li>
            );
          }))}
        </ol>
      ))}

      <div class="dash-grid">
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.8eaf05a2")}>
          <h3>{__i18n_t("ui.myClub.overview.8eaf05a2")}</h3>
          {__i18n_display(games.length ? (
            <ul class="results">
              {__i18n_display(games
                .slice(-8)
                .reverse()
                .map((g) => {
                  const home = g.home === me;
                  const [mine, theirs] = home ? [g.hs, g.as] : [g.as, g.hs];
                  const res = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
                  return (
                    <li key={g.id}>
                      <span class={`result ${res}`}>{__i18n_display(res === 'W' ? '승' : res === 'L' ? '패' : __i18n_k("ui.myClub.overview.56c5af5b"))}</span>
                      <span class="num score">
                        {__i18n_display(mine)}:{__i18n_display(theirs)}
                      </span>
                      {__i18n_display(home ? 'vs' : '@')} {__i18n_display(shortName(league, home ? g.away : g.home))} <span class="muted">{__i18n_display(g.date.slice(5).replace('-', '/'))}</span>
                    </li>
                  );
                }))}
            </ul>
          ) : (
            <p class="empty">{__i18n_t("ui.myClub.overview.b373034f")}</p>
          ))}
        </section>
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.d15876f1")}>
          <h3>{__i18n_t("ui.myClub.overview.d15876f1")}</h3>
          {__i18n_display(inFirstTeam && table.length ? (
            <table class="mini-table">
              <tbody>
                {__i18n_display(table.map((r) => (
                  <tr key={r.teamId} class={r.teamId === me ? 'mine' : ''}>
                    <td class="num">{__i18n_display(r.rank)}</td>
                    <td>{__i18n_display(shortName(league, r.teamId))}</td>
                    <td class="num">
                      {__i18n_display(r.w)}-{__i18n_display(r.l)}-{__i18n_display(r.t)}
                    </td>
                    <td class="num">{__i18n_display(rates.fmt3(r.pct))}</td>
                    <td class="num muted">{__i18n_display(r.gb ? r.gb : '-')}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          ) : (
            <p class="empty">{__i18n_t("ui.myClub.overview.1a1da1c9", { firstTeamYear: u.firstTeamYear })}</p>
          ))}
        </section>
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.e1c45f5a")}>
          <h3>{__i18n_t("ui.myClub.overview.e1c45f5a")}</h3>
          <TeamLeaders league={league} onPlayer={onPlayer} />
        </section>
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.07b747e0")}>
          <h3>{__i18n_t("ui.myClub.overview.07b747e0")}</h3>
          <Absences league={league} onPlayer={onPlayer} />
        </section>
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.62daa2c1")}>
          <h3>{__i18n_t("ui.myClub.overview.62daa2c1")}</h3>
          {__i18n_display(upcoming.length ? (
            <ul class="plain upcoming">
              {__i18n_display(upcoming.map((g) => (
                <li key={g.id}>
                  <span class="muted num">{__i18n_display(g.date.slice(5).replace('-', '/'))}</span> {__i18n_display(g.home === me ? 'vs' : '@')} {__i18n_display(shortName(league, g.home === me ? g.away : g.home))}
                  <span class="muted small">{__i18n_display(g.home === me ? __i18n_k("ui.myClub.overview.cf9acf5c") : __i18n_k("ui.myClub.overview.a8e57c97"))}</span>
                </li>
              )))}
            </ul>
          ) : (
            <p class="empty">{__i18n_display(league.phase === 'regular' ? __i18n_k("ui.myClub.overview.c372dc4c") : __i18n_k("ui.myClub.overview.974a96d9"))}</p>
          ))}
        </section>
        <section class="panel" tabIndex={0} aria-label={__i18n_t("ui.myClub.overview.433c886b")}>
          <h3>{__i18n_t("ui.myClub.overview.433c886b")}</h3>
          {__i18n_display(u.log?.length ? (
            <ul class="club-log">
              {__i18n_display([...u.log]
                .reverse()
                .slice(0, 30)
                .map((l, i) => (
                  <li key={i}>
                    <span class="num muted">{__i18n_display(l.year)}</span> {__i18n_display(l.text)}
                  </li>
                )))}
            </ul>
          ) : (
            <p class="empty">{__i18n_t("ui.myClub.overview.abed1363")}</p>
          ))}
        </section>
      </div>
    </>
  );
}

/** Who is out: the injured list and rehab (with what and until when), knocks, and military service. */
function Absences({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const me = league.user!.teamId;
  const out = Object.entries(league.injuries)
    .filter(([id]) => league.players[id]?.teamId === me)
    .sort((a, b) => Number(!!a[1].dtd) - Number(!!b[1].dtd) || a[1].until.localeCompare(b[1].until));
  const soldiers = Object.values(league.players).filter((p) => p.teamId === me && p.status === 'military');
  if (!out.length && !soldiers.length) return <p class="empty">{__i18n_t("ui.myClub.absences.7a97eb18")}</p>;
  return (
    <ul class="plain absences">
      {__i18n_display(out.map(([id, i]) => (
        <li key={id}>
          <button type="button" class="link" onClick={() => onPlayer(id)}>
            {__i18n_display(league.players[id]!.name)}
          </button>{__i18n_display(' ')}
          <span class={`tag${i.dtd ? '' : ' warn'}`}>{__i18n_display(i.dtd ? __i18n_k("ui.myClub.absences.7d657386") : i.onList ? __i18n_k("ui.myClub.absences.12d2111d") : __i18n_k("ui.myClub.absences.3a5f44c3"))}</span> <span class="muted small">{__i18n_display(injuryNote(i))}</span>
        </li>
      )))}
      {__i18n_display(soldiers.length > 0 && (
        <li class="muted small">{__i18n_t("ui.myClub.absences.83b05acc", { length: soldiers.length, value: soldiers.map((p) => __i18n_k("ui.myClub.absences.131f9845", { name: p.name, value: p.service.route === 'sangmu' ? __i18n_k("ui.myClub.absences.d2a2ca0f") : p.service.route === 'social' ? __i18n_k("ui.myClub.absences.f695b002") : __i18n_k("ui.myClub.absences.519e09aa") })).join(', ') })}</li>
      ))}
    </ul>
  );
}

/** Our best this season: batting and pitching leaders among the club's first-team (or futures) lines. */
function TeamLeaders({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const me = league.user!.teamId;
  const firstTeam = league.year >= league.user!.firstTeamYear;
  const lines = Object.entries(firstTeam ? league.lines : (league.futures?.lines ?? {})).filter(([, l]) => l.teamId === me);
  type Entry = (typeof lines)[number];
  const games = Math.max(1, ...lines.map(([, l]) => l.bat?.g ?? 0));
  const bats = lines.filter(([id, l]) => l.bat && l.bat.pa >= games * 2 && !isPitcher(league.players[id]!));
  const pits = lines.filter(([, l]) => l.pit && l.pit.outs > 0);
  const best = (xs: Entry[], key: (x: Entry) => number, low = false) => [...xs].sort((a, b) => (low ? key(a) - key(b) : key(b) - key(a)))[0];
  const items: { title: string; entry?: Entry; value: (e: Entry) => string }[] = [
    { title: __i18n_k("ui.myClub.items.title.1eb19e0a"), entry: best(bats, ([, l]) => rates.avg(l.bat!)), value: ([, l]) => rates.fmt3(rates.avg(l.bat!)) },
    { title: __i18n_k("ui.myClub.items.title.9162d3a3"), entry: best(bats, ([, l]) => l.bat!.hr), value: ([, l]) => `${l.bat!.hr}` },
    { title: 'OPS', entry: best(bats, ([, l]) => rates.ops(l.bat!)), value: ([, l]) => rates.fmt3(rates.ops(l.bat!)) },
    { title: __i18n_k("ui.myClub.items.title.f0f9146b"), entry: best(pits.filter(([, l]) => l.pit!.outs >= games * 2), ([, l]) => rates.era(l.pit!), true), value: ([, l]) => rates.era(l.pit!).toFixed(2) },
    { title: __i18n_k("ui.myClub.items.title.90e5e4d2"), entry: best(pits, ([, l]) => l.pit!.w), value: ([, l]) => `${l.pit!.w}` },
    { title: '세이브', entry: best(pits, ([, l]) => l.pit!.sv), value: ([, l]) => `${l.pit!.sv}` },
  ];
  if (!lines.length) return <p class="empty">{__i18n_t("ui.myClub.teamLeaders.be27edb9")}</p>;
  return (
    <dl class="leaders-mini">
      {__i18n_display(items.map((it) => (
        <div key={it.title}>
          <dt>{__i18n_display(it.title)}</dt>
          <dd>
            {__i18n_display(it.entry ? (
              <>
                <button type="button" class="link" onClick={() => onPlayer(it.entry![0])}>
                  {__i18n_display(league.players[it.entry[0]]?.name)}
                </button>{__i18n_display(' ')}
                <span class="num strong">{__i18n_display(it.value(it.entry))}</span>
              </>
            ) : (
              '-'
            ))}
          </dd>
        </div>
      )))}
    </dl>
  );
}

// ── Squads ───────────────────────────────────────────────────────────────────────────────────────

function Management({ league, onPlayer, onAct, setMsg }: { league: LeagueState; onPlayer: (id: string) => void; onAct: (a: Action) => void; setMsg: (m: string) => void }) {
  const u = league.user!;
  const manual = u.entry === 'manual';
  const inSeason = league.phase === 'regular';
  const move = (id: string, to: SquadName) => {
    const problem = canMove(league, id, to);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'move', id, to });
  };
  const register = (id: string) => {
    const problem = canRegister(league, id);
    setMsg(problem ?? '');
    if (!problem) onAct({ kind: 'register', id });
  };
  const buttons = (squad: SquadKey) =>
    manual && inSeason && squad !== 'military'
      ? (r: Row) => {
          const options: [string, string][] = [];
          if (squad !== 'active' && !r.development) options.push(['active', __i18n_k("ui.myClub.management.buttons.2d59a29f")]);
          if (squad === 'active') options.push(['futures', __i18n_k("ui.myClub.management.buttons.d871bf18")]);
          if (squad === 'third') options.push(['futures', __i18n_k("ui.myClub.management.buttons.83e5b1fc")]);
          if (squad !== 'third') options.push(['third', __i18n_k("ui.myClub.management.buttons.14ade685")]);
          if (r.development) options.push(['register', __i18n_k("ui.myClub.management.buttons.1f0b92a7")]);
          if (r.role === 'SP' || r.role === 'RP') options.push(['role', r.role === 'SP' ? __i18n_k("ui.myClub.management.buttons.ab8df524") : __i18n_k("ui.myClub.management.buttons.183edd64")]);
          const run = (v: string) => {
            if (v === 'register') register(r.id);
            else if (v === 'role') onAct({ kind: 'setRole', id: r.id, role: r.role === 'SP' ? 'RP' : 'SP' });
            else if (v) move(r.id, v as SquadName);
          };
          return (
            <select class="cell-select" aria-label={__i18n_displayText(__i18n_k("ui.myClub.management.buttons.106c178c", { name: r.name }))} value="" onChange={(e) => run((e.target as HTMLSelectElement).value)}>
              <option value="">{__i18n_t("ui.myClub.management.buttons.62f06e85")}</option>
              {__i18n_display(options.map(([v, label]) => (
                <option key={v + label} value={v}>
                  {__i18n_display(label)}
                </option>
              )))}
            </select>
          );
        }
      : undefined;
  const roleControl = (squad: SquadKey) =>
    manual && squad === 'active'
      ? (r: Row) =>
          r.penRole ? (
            <select
              class="cell-select"
              aria-label={__i18n_displayText(__i18n_k("ui.myClub.management.roleControl.3a9b33d3", { name: r.name }))}
              value={r.penRoleSet ? r.penRole : ''}
              onChange={(e) => onAct({ kind: 'penRole', id: r.id, role: ((e.target as HTMLSelectElement).value || null) as BullpenRole | null })}
            >
              <option value="">{__i18n_t("ui.myClub.management.roleControl.5584154c", { value: PEN_ROLE_LABELS[r.penRole] })}</option>
              {__i18n_display(PEN_ROLES.map((x) => (
                <option key={x} value={x}>
                  {__i18n_display(PEN_ROLE_LABELS[x])}
                </option>
              )))}
            </select>
          ) : !r.pitcher ? (
            <select
              class="cell-select"
              aria-label={__i18n_displayText(__i18n_k("ui.myClub.management.roleControl.9ea13513", { name: r.name }))}
              value={r.platoon ?? ''}
              onChange={(e) => onAct({ kind: 'platoon', id: r.id, side: ((e.target as HTMLSelectElement).value || null) as 'L' | 'R' | null })}
            >
              <option value="">{__i18n_t("ui.myClub.management.roleControl.5c234521")}</option>
              <option value="L">{__i18n_t("ui.myClub.management.roleControl.d27582c8")}</option>
              <option value="R">{__i18n_t("ui.myClub.management.roleControl.04eda77c")}</option>
            </select>
          ) : undefined
      : undefined;
  const toolbar = (
    <div class="segmented" role="group" aria-label={__i18n_t("ui.myClub.management.toolbar.eb9e29cc")}>
      <button type="button" aria-pressed={!manual} onClick={() => onAct({ kind: 'entryMode', mode: 'auto' })}>{__i18n_t("ui.myClub.management.toolbar.c22fc0ad")}</button>
      <button type="button" aria-pressed={manual} onClick={() => onAct({ kind: 'entryMode', mode: 'manual' })}>{__i18n_t("ui.myClub.management.toolbar.2273e06d")}</button>
    </div>
  );
  return (
    <>
      <p class="muted">
        {__i18n_display(manual
          ? __i18n_k("ui.myClub.management.33df9976")
          : __i18n_k("ui.myClub.management.c2f6f619"))}
        {__i18n_display(manual && !inSeason && __i18n_k("ui.myClub.management.04b78a59"))}
      </p>
      <Squad league={league} teamId={u.teamId} onPlayer={onPlayer} actions={buttons} posControl={roleControl} toolbar={toolbar} />
    </>
  );
}

// ── Front office ─────────────────────────────────────────────────────────────────────────────────


/** A scenario's goal and how it stands (1.6.0). */
function ScenarioCard({ league }: { league: LeagueState }) {
  const x = scenarioProgress(league);
  if (!x) return null;
  const tone = x.status === 'won' ? 'good' : x.status === 'lost' ? 'bad' : '';
  return (
    <section class={`scenario-card ${tone}`} aria-labelledby="scenario-title">
      <h3 id="scenario-title">{__i18n_t("ui.myClub.scenarioCard.fd180df4", { title: x.title, value: x.status === 'won' ? __i18n_k("ui.myClub.scenarioCard.852d48a6") : x.status === 'lost' ? __i18n_k("ui.myClub.scenarioCard.b2a76f8a") : '' })}</h3>
      <p>
        <strong>{__i18n_t("ui.myClub.scenarioCard.2fbea43b")}</strong> {__i18n_display(x.goal)}
      </p>
      <ul>
        {__i18n_display(x.lines.map((line) => (
          <li key={line}>{__i18n_display(line)}</li>
        )))}
      </ul>
    </section>
  );
}
