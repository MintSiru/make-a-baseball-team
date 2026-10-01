/* Training abroad (V0.10): the four centres, sending a player, and who went where and what came of it. */
import { useMemo, useState } from 'preact/hooks';
import { TOOL_LABELS, type ToolKey } from '../draftroom';
import type { Action } from '../league/actions';
import { ageIn, isPitcher } from '../league/players';
import { orgPlayers, type LeagueState, type SiteId } from '../league/state';
import { checkTrip, lastStartText, SITE_IDS, SITES, tripDates, tripSeason } from '../league/training';
import { TRAINING } from '../league/tuning';
import { positionLabel } from '../league/views';
import { money } from './format';

const focusText = (keys: ToolKey[] | undefined) => (keys ?? []).map((k) => TOOL_LABELS[k] ?? k).join('·');

export function Training({ league, onAct, onPlayer }: { league: LeagueState; onAct: (a: Action) => void; onPlayer: (id: string) => void }) {
  const u = league.user!;
  const [site, setSite] = useState<SiteId>('tokyo');
  const [pick, setPick] = useState('');
  const when = tripSeason(league);
  const S = SITES[site];
  const year = when?.season ?? league.year;
  const fits = useMemo(
    () =>
      orgPlayers(league, u.teamId)
        .filter((p) => p.status === 'active' && p.origin.kind !== 'foreign' && (S.who === 'all' || (S.who === 'pitcher') === isPitcher(p)))
        .sort((a, b) => ageIn(a, year) - ageIn(b, year) || b.scouting.futureValue - a.scouting.futureValue),
    [league, site, year],
  );
  const chosen = fits.find((p) => p.id === pick) ? pick : '';
  const problem = chosen ? checkTrip(league, chosen, site) : '선수를 고르세요.';
  const dates = tripDates(league, site);
  const trips = [...(u.trips ?? [])].reverse();
  const away = trips.filter((t) => !t.result);
  return (
    <div class="training">
      <p>
        시즌 중({lastStartText}까지 출발, 한 번에 {TRAINING.seasonMax}명)이나 비시즌({TRAINING.winterMax}명까지, 12월 출발)에 선수를 해외 사설 트레이닝 시설에 보냅니다. 비용은 구단 자금에서 나가고, 시즌 중에는 연수 기간 동안 경기에 나가지 못합니다. 어리고 잠재력이 많이 남은 선수일수록 효과가 크고, 데이터 분석실과 분석 코치가 좋으면 더 커집니다.
      </p>
      <div class="choice-grid">
        {SITE_IDS.map((id) => {
          const x = SITES[id];
          return (
            <button key={id} type="button" class="choice" aria-pressed={site === id} onClick={() => setSite(id)}>
              <strong>
                {x.name} <span class="muted small">{x.place}</span>
              </strong>
              <span class="muted">
                {x.who === 'pitcher' ? '투수' : x.who === 'hitter' ? '타자' : '투수·타자'} · {x.weeks}주 · 1인 {money(x.cost)}
              </span>
              <span class="muted small">
                {x.focus.pitcher ? `투수 ${focusText(x.focus.pitcher)}` : ''}
                {x.focus.pitcher && x.focus.hitter ? ' / ' : ''}
                {x.focus.hitter ? `타자 ${focusText(x.focus.hitter)}` : ''}
              </span>
              <span class="muted small">{x.note}</span>
            </button>
          );
        })}
      </div>
      <div class="inline-form trip-form">
        <label>
          보낼 선수
          <select value={chosen} onChange={(e) => setPick((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">선수 선택</option>
            {fits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {positionLabel(p)} · {ageIn(p, year)}세 · 현재 {p.scouting.current} / 미래 {p.scouting.futureValue}
              </option>
            ))}
          </select>
        </label>
        <button type="button" class="primary" disabled={!!problem} onClick={() => chosen && onAct({ kind: 'trip', id: chosen, site })}>
          {S.name}에 보내기
        </button>
        {dates && <span class="muted small">{dates.from} ~ {dates.until}</span>}
        <span class="muted small">구단 자금 {money(u.fund)}</span>
      </div>
      {problem && chosen && <p class="notice inline">{problem}</p>}
      {!when && <p class="muted">지금은 보낼 수 없습니다 ({league.phase === 'regular' ? '시즌 중 파견은 8월 15일까지' : '포스트시즌 중'}).</p>}

      <h3>연수 기록</h3>
      {trips.length ? (
        <div class="table-wrap" tabIndex={0}>
          <table class="record-table">
            <thead>
              <tr>
                <th>선수</th>
                <th>시설</th>
                <th>기간</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const p = league.players[t.id];
                return (
                  <tr key={`${t.season}-${t.id}-${t.site}`}>
                    <td>
                      {p ? (
                        <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                          {p.name}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{SITES[t.site].name}</td>
                    <td class="small">
                      {t.from} ~ {t.until}
                      {t.inSeason ? ' (시즌 중)' : ''}
                    </td>
                    <td class={t.result?.injury ? 'minus' : ''}>{t.result ? `${t.result.text}${t.result.injury ? ` · ${t.result.injury}` : ''}` : '연수 중'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">아직 보낸 선수가 없습니다.</p>
      )}
      {away.length > 0 && <p class="muted small">연수 중: {away.map((t) => league.players[t.id]?.name).join(', ')}</p>}
    </div>
  );
}
