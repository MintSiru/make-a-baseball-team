import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
import type { LeagueState } from '../league/state';
import { exhibitionView, halfStandingsView, lastDayScores, shortName, standingsView } from '../league/views';
import { postseasonNote } from '../league/historic';
import { rulesFor } from '../rules/history';
import { LEAGUE_NAMES, leagueTables, playoffsOf, seasonSeries, sidesOf, twelveClubs } from '../league/twelve';
import { postseasonView, roundName } from '../league/postseason';
import type { Action } from '../league/actions';
import { PostseasonBracket } from './Bracket';
import { HeadToHeadTable } from './Savant';
import { headToHead, headToHeadAll } from '../league/matchups';
import { useState } from 'preact/hooks';

type Row = ReturnType<typeof standingsView>[number];

export function Standings({ league, onTeam, onBox, onAct }: { league: LeagueState; onTeam: (id: string) => void; onBox?: (id: string) => void; onAct?: (a: Action) => void }) {
  const rows = standingsView(league);
  const scores = lastDayScores(league);
  // Two leagues (V0.9): a table for each, ranks and games behind inside the league.
  const sides = sidesOf(league);
  const two = sides ? leagueTables(rows, sides) : null;
  const groups: { title: string | null; rows: Row[]; cut: number }[] = two
    ? [
        { title: LEAGUE_NAMES.dream, rows: two.dream, cut: 3 },
        { title: LEAGUE_NAMES.magic, rows: two.magic, cut: 3 },
      ]
    : [{ title: null, rows, cut: 5 }];
  // 1.9.7: a history game's split seasons (1982–1988) and its own postseason format.
  const halves = halfStandingsView(league);
  if (halves) {
    const tickets = rulesFor(league.year).postseason === 'halvesTickets' ? 2 : 1;
    groups[0] = { title: __i18n_t("ui.standings.text.b51cab9a"), rows, cut: 0 };
    groups.push({ title: __i18n_t("ui.standings.text.9e9a1dff"), rows: halves[0], cut: tickets }, { title: __i18n_t("ui.standings.text.41764652"), rows: halves[1], cut: tickets });
  } else if (league.historical && !two && postseasonNote(league.year)) groups[0] = { title: null, rows, cut: 4 };
  const note = league.historical ? postseasonNote(league.year) : null;
  const series = seasonSeries(league);
  const rival = league.twelve && twelveClubs(league) ? league.teams.find((t) => t.id === league.twelve!.teamId) : null;
  return (
    <section aria-labelledby="standings-title">
      <h2 id="standings-title">{__i18n_t("ui.standings.standings.89ee1808", { year: league.year })}</h2>
      {/* 1.4.0: the postseason bracket on top while it is on and after it. */}
      <PostseasonBracket league={league} onBox={onBox} onTeam={onTeam} />
      <div class="split">
        <div>
          {__i18n_display(groups.map((grp) => (
            <StandingsTable key={grp.title ?? 'all'} title={__i18n_displayText(grp.title)} rows={grp.rows} cut={grp.cut} onTeam={onTeam} />
          )))}
          <p class="muted">
            {__i18n_display(two
              ? playoffsOf(league) === 'npb'
                ? __i18n_t("ui.standings.text.1c606c76")
                : __i18n_t("ui.standings.text.940e69f5")
              : (note ?? __i18n_k("ui.standings.standings.83a72e8d")))}
          </p>
          <HeadToHead league={league} order={rows.map((r) => r.teamId)} />
          <ExhibitionPart league={league} onTeam={onTeam} />
          {__i18n_display(rival && league.user && series.w + series.l + series.t > 0 && (
            <p>{__i18n_rich("ui.standings.standings.2196d9ea", { short: rival.short, value: ' ', value2: <strong>{__i18n_t("ui.standings.standings.eae1f95b", { w: series.w, l: series.l, value: series.t ? __i18n_k("ui.standings.standings.136ac74d", { value: series.t }) : '' })}</strong> })}</p>
          ))}
        </div>
        <div>
          <PostPlan league={league} onAct={onAct} />

          {__i18n_display(scores.length > 0 && (
            <>
              <h3>{__i18n_t("ui.standings.standings.b7936564", { date: scores[0]!.date })}</h3>
              <ul class="scores">
                {__i18n_display(scores.map((g) => (
                  <li key={g.id} class="numbers">
                    {__i18n_display(shortName(league, g.away))} {__i18n_display(g.as)} : {__i18n_display(g.hs)} {__i18n_display(shortName(league, g.home))}
                    {__i18n_display(g.as === g.hs && <span class="muted">{__i18n_t("ui.standings.standings.214e55d9")}</span>)}
                  </li>
                )))}
              </ul>
            </>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 2.0.4: each club's record against each other, this season or every season since 2.0.4. */
function HeadToHead({ league, order }: { league: LeagueState; order: string[] }) {
  const [all, setAll] = useState(false);
  return (
    <details class="h2h">
      <summary>{__i18n_t("ui.standings.text.5bbbef90")}</summary>
      <div class="segmented small" role="group" aria-label={__i18n_t("ui.standings.text.50c85ebb")}>
        <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>
          {__i18n_t("ui.standings.text.de766445", { year: league.year })}
        </button>
        <button type="button" aria-pressed={all} onClick={() => setAll(true)}>
          {__i18n_t("ui.standings.text.fc7fa3d0")}
        </button>
      </div>
      <HeadToHeadTable league={league} h2h={all ? headToHeadAll(league) : headToHead(league.scores)} order={order} />
      <p class="muted small">{__i18n_t("ui.standings.text.b1793760")}</p>
    </details>
  );
}

/** 2.0.30 (the user's request): this spring's 시범경기 — its own table and leaders; they count for nothing. Open until
    opening day, folded away after. */
function ExhibitionPart({ league, onTeam }: { league: LeagueState; onTeam: (id: string) => void }) {
  const v = exhibitionView(league);
  if (!v) return null;
  const list = (xs: typeof v.avg) => xs.map((x) => `${x.name}(${__i18n_displayText(x.club)}) ${x.text}`).join(', ');
  return (
    <details class="exhibition" open={league.next === 0}>
      <summary>{__i18n_t("ui.standings.text.710c185c", { year: v.year, played: v.played, total: v.total })}</summary>
      <StandingsTable title={null} rows={v.rows} cut={0} onTeam={onTeam} />
      <ul class="exhibition-leaders">
        {v.avg.length > 0 && (
          <li>
            <strong>{__i18n_t("ui.standings.text.1eb19e0a")}</strong> {list(v.avg)}
          </li>
        )}
        {v.hr.length > 0 && (
          <li>
            <strong>{__i18n_t("ui.standings.text.9162d3a3")}</strong> {list(v.hr)}
          </li>
        )}
        {v.era.length > 0 && (
          <li>
            <strong>{__i18n_t("ui.standings.text.f0f9146b")}</strong> {list(v.era)}
          </li>
        )}
      </ul>
      <p class="muted small">{__i18n_t("ui.standings.text.f34dc9fe")}</p>
    </details>
  );
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

/** Our next postseason game (1.3.0): the starter and an all-out plan. The series themselves are on the bracket (1.4.0). */
function PostPlan({ league, onAct }: { league: LeagueState; onAct?: (a: Action) => void }) {
  const v = postseasonView(league);
  const n = v.next;
  if (v.done || !n || !onAct) return null;
  return (
    <section class="live-postseason post-plan" aria-label={__i18n_t("ui.standings.postPlan.c18189ff")}>
      <h3>{__i18n_t("ui.standings.postPlan.7bb8b998", { md: md(n.date), game: n.game, value: n.home ? __i18n_k("ui.standings.postPlan.13a46f96") : __i18n_k("ui.standings.postPlan.ef6b033f"), shortName: shortName(league, n.opponent) })}</h3>
      <p>{__i18n_rich("ui.standings.postPlan.483a64ec", { value: roundName(league, v.live.find((x) => !x.over && (x.high === league.user?.teamId || x.low === league.user?.teamId))?.round ?? 'po'), value2: ' ', value3: <strong>{__i18n_t("ui.standings.postPlan.a32bb25b", { wins: n.wins, losses: n.losses })}</strong> })}</p>
      <label>
        선발{__i18n_display(' ')}
        <select value={v.plan.starter ?? ''} onChange={(e) => onAct({ kind: 'postPlan', starter: (e.currentTarget as HTMLSelectElement).value || null })}>
          <option value="">{__i18n_t("ui.standings.postPlan.c22fc0ad")}</option>
          {__i18n_display(n.arms.map((a) => (
            <option key={a.id} value={a.id}>
              {__i18n_display(a.name)} ({__i18n_display(a.role === 'SP' ? __i18n_k("ui.standings.postPlan.a88271df") : __i18n_k("ui.standings.postPlan.5b8607a3"))}, {__i18n_display(a.rest >= 99 ? __i18n_k("ui.standings.postPlan.56c06a59") : __i18n_k("ui.standings.postPlan.edd5ddce", { rest: a.rest }))})
            </option>
          )))}
        </select>
      </label>
      <label class="check">
        <input type="checkbox" checked={!!v.plan.allOut} onChange={(e) => onAct({ kind: 'postPlan', allOut: (e.currentTarget as HTMLInputElement).checked })} /> 총력전
      </label>
      <p class="muted small">{__i18n_t("ui.standings.postPlan.cf2d7dea")}</p>
    </section>
  );
}

function StandingsTable({ title, rows, cut, onTeam }: { title: string | null; rows: Row[]; cut: number; onTeam: (id: string) => void }) {
  return (
    <>
      {__i18n_display(title && <h3>{__i18n_display(title)}</h3>)}
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table standings">
          <thead>
            <tr>
              <th class="num">{__i18n_t("ui.standings.standingsTable.d15876f1")}</th>
              <th>{__i18n_t("ui.standings.standingsTable.58756112")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.e0cee61a")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.3b1908b7")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.36260e2c")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.56c5af5b")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.82cc030f")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.fa5c3a53")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.4b4a98b9")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.de9718e1")}</th>
              <th class="num">{__i18n_t("ui.standings.standingsTable.ada49ec6")}</th>
            </tr>
          </thead>
          <tbody>
            {__i18n_display(rows.map((r) => (
              <tr key={r.teamId} class={r.rank === cut ? 'cutline' : ''}>
                <td class="num">{__i18n_display(r.rank)}</td>
                <td>
                  <button type="button" class="link team-link" onClick={() => onTeam(r.teamId)}>
                    <span class="swatch" style={{ background: r.color }} aria-hidden="true" />
                    {__i18n_display(r.name)}
                  </button>
                </td>
                <td class="num">{__i18n_display(r.games)}</td>
                <td class="num">{__i18n_display(r.w)}</td>
                <td class="num">{__i18n_display(r.l)}</td>
                <td class="num">{__i18n_display(r.t)}</td>
                <td class="num strong">{__i18n_display(r.games ? r.pct.toFixed(3) : '-')}</td>
                <td class="num">{__i18n_display(r.gb ? r.gb.toFixed(1) : '-')}</td>
                <td class="num">{__i18n_display(r.rs)}</td>
                <td class="num">{__i18n_display(r.ra)}</td>
                <td class="num">{__i18n_display(r.crowd ? r.crowd.toLocaleString('ko-KR') : '-')}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </>
  );
}
