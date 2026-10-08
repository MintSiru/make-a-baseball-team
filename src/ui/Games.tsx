/* Games (V0.7): the user's games this season and the league's last few days; each opens its box score. */
import type { LeagueState } from '../league/state';
import { gameList } from '../league/views';
import { spoilerHidden } from './display';

type Row = ReturnType<typeof gameList>['mine'][number];

function GameTable({ rows, onOpen, mine }: { rows: Row[]; onOpen: (id: string) => void; mine: boolean }) {
  if (!rows.length) return <p class="muted">경기가 없습니다.</p>;
  return (
    <div class="table-wrap" tabIndex={0}>
      <table class="record-table games-table">
        <thead>
          <tr>
            <th>날짜</th>
            <th>원정</th>
            <th class="num">점수</th>
            <th>홈</th>
            {mine && <th>결과</th>}
            <th class="num">관중</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const hide = mine && spoilerHidden(g.id, true, !!g.pbp);
            return (
            <tr key={g.id} class="player-row">
              <td>
                {g.date.slice(5)}
                {g.post && <span class="tag">PS</span>}
              </td>
              <td class={!hide && g.as > g.hs ? 'strong' : ''}>{g.away}</td>
              <td class="num">{hide ? '? : ?' : `${g.as} : ${g.hs}`}</td>
              <td class={!hide && g.hs > g.as ? 'strong' : ''}>{g.home}</td>
              {mine && <td class={hide ? 'muted' : g.result === '승' ? 'plus' : g.result === '패' ? 'minus' : ''}>{hide ? '미관전' : g.result}</td>}
              <td class="num">{g.att ? g.att.toLocaleString('ko-KR') : '-'}</td>
              <td>
                <button type="button" class="link" onClick={() => onOpen(g.id)}>
                  {hide ? '중계 보기' : g.pbp ? '기록지 · 중계' : '기록지'}
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Games({ league, onOpen }: { league: LeagueState; onOpen: (id: string) => void }) {
  const list = gameList(league);
  return (
    <section aria-labelledby="games-title">
      <h2 id="games-title">경기</h2>
      <div class={league.user ? 'split' : undefined}>
        {league.user && (
          <div class="panel tall" tabIndex={0} aria-label="우리 구단 경기">
            <h3>우리 구단 ({league.year})</h3>
            <p class="muted">최근 10경기는 문자중계를 처음부터 다시 볼 수 있습니다.</p>
            <GameTable rows={list.mine} onOpen={onOpen} mine />
          </div>
        )}
        <div class={league.user ? 'panel tall' : undefined}>
          <h3>최근 경기</h3>
          <GameTable rows={list.recent} onOpen={onOpen} mine={false} />
        </div>
      </div>
    </section>
  );
}
