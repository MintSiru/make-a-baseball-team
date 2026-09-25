import type { LeagueState } from '../league/state';
import { leaders } from '../league/views';

export function Leaders({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const data = leaders(league);
  const block = (title: string, rows: { id: string; name: string; team: string; value: string }[]) => (
    <div class="leader-block" key={title}>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p class="muted">기록 없음</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                {r.name}
              </button>{' '}
              <span class="muted">{r.team}</span>
              <span class="num leader-value">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <section aria-labelledby="leaders-title">
      <h2 id="leaders-title">{league.year} 개인 기록 순위</h2>
      <p class="muted">
        비율 기록은 규정타석 {data.qualifying.pa}타석, 규정이닝 {data.qualifying.innings}이닝 이상.
      </p>
      <h3>타자</h3>
      <div class="leader-grid">{data.batting.map((c) => block(c.title, c.rows))}</div>
      <h3>투수</h3>
      <div class="leader-grid">{data.pitching.map((c) => block(c.title, c.rows))}</div>
    </section>
  );
}
