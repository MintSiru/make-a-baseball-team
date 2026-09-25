import type { LeagueState } from '../league/state';
import { shortName, teamOf } from '../league/views';
import { era, obp, slg } from '../league/stats';

export function History({ league }: { league: LeagueState }) {
  const seasons = [...league.history].reverse();
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">역대 시즌</h2>
      <p class="muted">2025년까지의 기록은 게임이 만든 가상 역사입니다.</p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">시즌</th>
              <th>우승</th>
              <th>정규시즌 1위</th>
              <th class="num">1위 승률</th>
              <th>퓨처스 1위</th>
              <th class="num">리그 타율</th>
              <th class="num">리그 OPS</th>
              <th class="num">리그 평균자책점</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((h) => {
              const b = h.totals.bat;
              return (
                <tr key={h.year}>
                  <td class="num">{h.year}</td>
                  <td class="strong">{h.champion ? teamOf(league, h.champion)?.name : '-'}</td>
                  <td>{shortName(league, h.table[0]!.teamId)}</td>
                  <td class="num">{h.table[0]!.pct.toFixed(3)}</td>
                  <td>{h.futures?.[0] ? shortName(league, h.futures[0].teamId) : '-'}</td>
                  <td class="num">{(b.h / b.ab).toFixed(3)}</td>
                  <td class="num">{(obp(b) + slg(b)).toFixed(3)}</td>
                  <td class="num">{era(h.totals.pit).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {seasons.find((h) => h.futures) && <FuturesTable league={league} />}
      {league.international.length > 0 && (
        <>
          <h3>국가대표</h3>
          <ul class="series-list">
            {league.international.map((e) => (
              <li key={e.year}>
                {e.year} {e.name}: {e.medal ? '병역 특례 획득' : '특례 없음'}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The latest futures league table (every club's futures squad and 상무). */
function FuturesTable({ league }: { league: LeagueState }) {
  const h = [...league.history].reverse().find((x) => x.futures)!;
  return (
    <>
      <h3>{h.year} 퓨처스리그</h3>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">순위</th>
              <th>팀</th>
              <th class="num">승</th>
              <th class="num">패</th>
              <th class="num">무</th>
              <th class="num">승률</th>
            </tr>
          </thead>
          <tbody>
            {h.futures!.map((r) => (
              <tr key={r.teamId}>
                <td class="num">{r.rank}</td>
                <td>{shortName(league, r.teamId)}</td>
                <td class="num">{r.w}</td>
                <td class="num">{r.l}</td>
                <td class="num">{r.t}</td>
                <td class="num">{r.pct.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
