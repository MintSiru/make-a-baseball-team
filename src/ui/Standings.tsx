import type { LeagueState } from '../league/state';
import { lastDayScores, shortName, standingsView } from '../league/views';
import { LEAGUE_NAMES, leagueTables, seasonSeries, twelveClubs, twoLeagues } from '../league/twelve';
import { postseasonView, ROUND_LABEL } from '../league/postseason';
import type { Action } from '../league/actions';
import { PostseasonBracket } from './Bracket';

type Row = ReturnType<typeof standingsView>[number];

export function Standings({ league, onTeam, onBox, onAct }: { league: LeagueState; onTeam: (id: string) => void; onBox?: (id: string) => void; onAct?: (a: Action) => void }) {
  const rows = standingsView(league);
  const scores = lastDayScores(league);
  // Two leagues (V0.9): a table for each, ranks and games behind inside the league.
  const two = twoLeagues(league) ? leagueTables(rows, league.twelve!.leagues!) : null;
  const groups: { title: string | null; rows: Row[]; cut: number }[] = two
    ? [
        { title: LEAGUE_NAMES.dream, rows: two.dream, cut: 2 },
        { title: LEAGUE_NAMES.magic, rows: two.magic, cut: 2 },
      ]
    : [{ title: null, rows, cut: 5 }];
  const series = seasonSeries(league);
  const rival = league.twelve && twelveClubs(league) ? league.teams.find((t) => t.id === league.twelve!.teamId) : null;
  return (
    <section aria-labelledby="standings-title">
      <h2 id="standings-title">{league.year} 정규시즌 순위</h2>
      {/* 1.4.0: the postseason bracket on top while it is on and after it. */}
      <PostseasonBracket league={league} onBox={onBox} onTeam={onTeam} />
      <div class="split">
        <div>
          {groups.map((grp) => (
            <StandingsTable key={grp.title ?? 'all'} title={grp.title} rows={grp.rows} cut={grp.cut} onTeam={onTeam} />
          ))}
          <p class="muted">
            {two
              ? '각 리그 1위는 다른 리그 2위와 플레이오프(4선승)를 치릅니다. 한 리그 3위의 승률이 다른 리그 2위보다 높으면 둘이 준플레이오프(2선승)로 그 자리를 다툽니다 (1999~2000 양대 리그 방식).'
              : '5위까지 포스트시즌에 나갑니다.'}
          </p>
          {rival && league.user && series.w + series.l + series.t > 0 && (
            <p>
              라이벌전 ({rival.short}):{' '}
              <strong>
                {series.w}승 {series.l}패{series.t ? ` ${series.t}무` : ''}
              </strong>
            </p>
          )}
        </div>
        <div>
          <PostPlan league={league} onAct={onAct} />

          {scores.length > 0 && (
            <>
              <h3>{scores[0]!.date} 경기 결과</h3>
              <ul class="scores">
                {scores.map((g) => (
                  <li key={g.id} class="numbers">
                    {shortName(league, g.away)} {g.as} : {g.hs} {shortName(league, g.home)}
                    {g.as === g.hs && <span class="muted"> (무)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

/** Our next postseason game (1.3.0): the starter and an all-out plan. The series themselves are on the bracket (1.4.0). */
function PostPlan({ league, onAct }: { league: LeagueState; onAct?: (a: Action) => void }) {
  const v = postseasonView(league);
  const n = v.next;
  if (v.done || !n || !onAct) return null;
  return (
    <section class="live-postseason post-plan" aria-label="우리 다음 포스트시즌 경기">
      <h3>
        우리 다음 경기: {md(n.date)} {n.game}차전 {n.home ? '홈' : '원정'} vs {shortName(league, n.opponent)}
      </h3>
      <p>
        {ROUND_LABEL[v.live.find((x) => !x.over && (x.high === league.user?.teamId || x.low === league.user?.teamId))?.round ?? 'po']} · 시리즈{' '}
        <strong>
          {n.wins}승 {n.losses}패
        </strong>
      </p>
      <label>
        선발{' '}
        <select value={v.plan.starter ?? ''} onChange={(e) => onAct({ kind: 'postPlan', starter: (e.currentTarget as HTMLSelectElement).value || null })}>
          <option value="">감독에게 맡기기</option>
          {n.arms.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role === 'SP' ? '선발' : '불펜'}, {a.rest >= 99 ? '등판 없음' : `${a.rest}일 휴식`})
            </option>
          ))}
        </select>
      </label>
      <label class="check">
        <input type="checkbox" checked={!!v.plan.allOut} onChange={(e) => onAct({ kind: 'postPlan', allOut: (e.currentTarget as HTMLInputElement).checked })} /> 총력전
      </label>
      <p class="muted small">
        선발은 이 경기에만 적용됩니다(4일 이하 휴식이면 투구 수가 줄어듭니다). 총력전은 선발을 일찍 내리고, 이틀 안에 던지지 않은 다른 선발과 연투한 불펜까지 대기시킵니다 — 다음 경기 마운드가 지칠 수
        있습니다. 라인업은 우리 구단 → 라인업 카드에서 정합니다.
      </p>
    </section>
  );
}

function StandingsTable({ title, rows, cut, onTeam }: { title: string | null; rows: Row[]; cut: number; onTeam: (id: string) => void }) {
  return (
    <>
      {title && <h3>{title}</h3>}
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table standings">
          <thead>
            <tr>
              <th class="num">순위</th>
              <th>구단</th>
              <th class="num">경기</th>
              <th class="num">승</th>
              <th class="num">패</th>
              <th class="num">무</th>
              <th class="num">승률</th>
              <th class="num">게임차</th>
              <th class="num">득점</th>
              <th class="num">실점</th>
              <th class="num">평균 관중</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} class={r.rank === cut ? 'cutline' : ''}>
                <td class="num">{r.rank}</td>
                <td>
                  <button type="button" class="link team-link" onClick={() => onTeam(r.teamId)}>
                    <span class="swatch" style={{ background: r.color }} aria-hidden="true" />
                    {r.name}
                  </button>
                </td>
                <td class="num">{r.games}</td>
                <td class="num">{r.w}</td>
                <td class="num">{r.l}</td>
                <td class="num">{r.t}</td>
                <td class="num strong">{r.games ? r.pct.toFixed(3) : '-'}</td>
                <td class="num">{r.gb ? r.gb.toFixed(1) : '-'}</td>
                <td class="num">{r.rs}</td>
                <td class="num">{r.ra}</td>
                <td class="num">{r.crowd ? r.crowd.toLocaleString('ko-KR') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
