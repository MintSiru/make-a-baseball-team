import type { LeagueState, SeriesResult } from '../league/state';
import { lastDayScores, shortName, standingsView } from '../league/views';
import { LEAGUE_NAMES, leagueTables, seasonSeries, twelveClubs, twoLeagues } from '../league/twelve';

const ROUND_LABEL: Record<SeriesResult['round'], string> = { wildcard: '와일드카드 결정전', semipo: '준플레이오프', po: '플레이오프', ks: '한국시리즈' };

type Row = ReturnType<typeof standingsView>[number];

export function Standings({ league, onTeam }: { league: LeagueState; onTeam: (id: string) => void }) {
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
          {league.postseason.length > 0 && (
            <>
              <h3>{league.year} 포스트시즌</h3>
              <ul class="series-list">
                {league.postseason.map((x, i) => (
                  <li key={i}>
                    <span class="series-round">{ROUND_LABEL[x.round]}</span> {shortName(league, x.high)} {x.highWins} : {x.lowWins} {shortName(league, x.low)} →{' '}
                    <strong>{shortName(league, x.winner)}</strong>
                    {x.round === 'ks' && ' 우승'}
                  </li>
                ))}
              </ul>
            </>
          )}

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
