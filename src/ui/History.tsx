import { useState } from 'preact/hooks';
import type { LeagueState } from '../league/state';
import { awardsView, recordRoom, shortName, teamOf } from '../league/views';
import { era, obp, slg } from '../league/stats';

type View = 'seasons' | 'awards' | 'records' | 'hall';

export function History({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const [view, setView] = useState<View>('seasons');
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">역대</h2>
      <div class="segmented" role="group" aria-label="역대">
        {(
          [
            ['seasons', '시즌'],
            ['awards', '시상'],
            ['records', '기록실'],
            ['hall', '명예의 전당'],
          ] as [View, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'seasons' && <Seasons league={league} />}
      {view === 'awards' && <Awards league={league} onPlayer={onPlayer} />}
      {view === 'records' && <Records league={league} onPlayer={onPlayer} />}
      {view === 'hall' && <Hall league={league} onPlayer={onPlayer} />}
    </section>
  );
}

const Who = ({ x, onPlayer }: { x: { id: string; name: string; team: string } | null; onPlayer: (id: string) => void }) =>
  x ? (
    <>
      <button type="button" class="link" onClick={() => onPlayer(x.id)}>
        {x.name}
      </button>
      <span class="muted small"> {x.team}</span>
    </>
  ) : (
    <span class="muted">-</span>
  );

function Awards({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const years = awardsView(league);
  if (!years.length) return <p class="muted">시상 기록이 없습니다.</p>;
  return (
    <>
      <p class="muted">MVP는 WAR에 소속팀 성적과 타이틀을, 골든글러브는 포지션별(60경기 이상) WAR을 봅니다. 신인왕은 KBO 규정(데뷔 5년 이내, 이전 60타석·30이닝 미만)을 따릅니다.</p>
      {years.map((y) => (
        <section key={y.year} class="award-year">
          <h3>{y.year}</h3>
          <p>
            <span class="tag">MVP</span> <Who x={y.mvp} onPlayer={onPlayer} /> · <span class="tag">신인왕</span> <Who x={y.rookie} onPlayer={onPlayer} />
          </p>
          <p class="small">
            <strong>골든글러브</strong>{' '}
            {y.gg.map((g, i) => (
              <span key={i}>
                {g.pos} <Who x={g} onPlayer={onPlayer} />
                {i < y.gg.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
          <p class="small">
            <strong>타이틀</strong>{' '}
            {y.titles.map((t, i) => (
              <span key={i}>
                {t.label} <Who x={t} onPlayer={onPlayer} /> ({t.value}){i < y.titles.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        </section>
      ))}
    </>
  );
}

function Records({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const r = recordRoom(league);
  const block = (title: string, groups: typeof r.season) => (
    <>
      <h3>{title}</h3>
      <div class="leader-grid">
        {groups.map((g) => (
          <div key={g.label} class="leader-card">
            <h4>{g.label}</h4>
            <ol class="plain">
              {g.rows.map((x) => (
                <li key={x.id + (x.year ?? '')}>
                  <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                    {x.name}
                  </button>{' '}
                  <span class="muted small">
                    {x.team}
                    {x.year ? ` ${x.year}` : ''}
                  </span>{' '}
                  <strong>{x.value}</strong>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </>
  );
  return (
    <>
      <p class="muted">게임 속 리그 기록입니다 (2015년부터의 가상 역사 포함).</p>
      {block('한 시즌 최고', r.season)}
      {block('통산', r.career)}
    </>
  );
}

function Hall({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const hall = [...(league.hallOfFame ?? [])].reverse();
  return (
    <>
      <p class="muted">은퇴한 선수 가운데 통산 WAR 50 이상, 또는 WAR 40 이상에 MVP·골든글러브·신인왕을 네 번 넘게 받은 선수가 오릅니다 (게임 속 제도).</p>
      {hall.length ? (
        <div class="table-wrap">
          <table class="record-table">
            <thead>
              <tr>
                <th class="num">헌액</th>
                <th>선수</th>
                <th>구단</th>
                <th class="num">시즌</th>
                <th class="num">WAR</th>
                <th>통산</th>
              </tr>
            </thead>
            <tbody>
              {hall.map((h) => (
                <tr key={h.id}>
                  <td class="num">{h.year}</td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(h.id)}>
                      {h.name}
                    </button>
                  </td>
                  <td>{h.teams.map((t) => shortName(league, t)).join(' · ')}</td>
                  <td class="num">{h.seasons}</td>
                  <td class="num strong">{h.war.toFixed(1)}</td>
                  <td>{h.line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p class="muted">아직 헌액된 선수가 없습니다.</p>
      )}
      {league.teams.some((t) => t.retiredNumbers?.length) && (
        <>
          <h3>영구결번</h3>
          <ul class="plain">
            {league.teams.flatMap((t) => (t.retiredNumbers ?? []).map((x) => <li key={t.id + x.number}>{t.short} {x.number}번 · {x.name} ({x.year})</li>))}
          </ul>
        </>
      )}
    </>
  );
}

function Seasons({ league }: { league: LeagueState }) {
  const seasons = [...league.history].reverse();
  return (
    <>
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
    </>
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
