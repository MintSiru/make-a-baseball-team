import type { LeagueState, SeriesResult } from '../league/state';
import { lastDayScores, shortName, standingsView } from '../league/views';

const ROUND_LABEL: Record<SeriesResult['round'], string> = { wildcard: '와일드카드 결정전', semipo: '준플레이오프', po: '플레이오프', ks: '한국시리즈' };

export function Standings({ league, onTeam }: { league: LeagueState; onTeam: (id: string) => void }) {
  const rows = standingsView(league);
  const scores = lastDayScores(league);
  return (
    <section aria-labelledby="standings-title">
      <h2 id="standings-title">{league.year} 정규시즌 순위</h2>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.teamId} class={r.rank === 5 ? 'cutline' : ''}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted">5위까지 포스트시즌에 나갑니다.</p>

      {league.postseason.length > 0 && (
        <>
          <h3>{league.year} 포스트시즌</h3>
          <ul class="series-list">
            {league.postseason.map((x) => (
              <li key={x.round}>
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
    </section>
  );
}
