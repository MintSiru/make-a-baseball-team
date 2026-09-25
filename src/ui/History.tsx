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
                  <td class="num">{(b.h / b.ab).toFixed(3)}</td>
                  <td class="num">{(obp(b) + slg(b)).toFixed(3)}</td>
                  <td class="num">{era(h.totals.pit).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
