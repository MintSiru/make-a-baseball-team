import { startYear } from '../league/era';
import { useState } from 'preact/hooks';
import { nationalView, retiredNumbersView } from '../league/legacy';
import type { LeagueState } from '../league/state';
import { awardsView, recordRoom, shortName, teamOf } from '../league/views';
import { avg, era, ip, obp, ops, slg } from '../league/stats';

type View = 'seasons' | 'awards' | 'records' | 'hall' | 'retired' | 'national';

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
            ['retired', '영구결번'],
            ['national', '국가대표'],
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
      {view === 'retired' && <Retired league={league} onPlayer={onPlayer} />}
      {view === 'national' && <National league={league} onPlayer={onPlayer} />}
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
      <p class="muted">은퇴한 선수 가운데 통산 WAR 65 이상, 또는 WAR 55 이상에 MVP·골든글러브·신인왕을 다섯 번 넘게 받은 선수가 오릅니다 (게임 속 제도).</p>
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
    </>
  );
}

function Seasons({ league }: { league: LeagueState }) {
  const seasons = [...league.history].reverse();
  return (
    <>
      <p class="muted">{startYear() - 1}년까지의 기록은 게임이 만든 가상 역사입니다.</p>
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

/** Retired numbers (1.0.1): each club's, ours first, with the player's story and his numbers with the club. */
function Retired({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const list = retiredNumbersView(league);
  if (!list.length) return <p class="muted">아직 영구결번이 없습니다. 한 구단에서 오래(10시즌 이상) 크게 활약한 선수가 은퇴하면 그 구단이 등번호를 영구결번합니다.</p>;
  return (
    <div class="retired-grid">
      {list.map((r) => (
        <article key={`${r.teamId}-${r.number}`} class={`card retired-card${r.teamId === league.user?.teamId ? ' mine' : ''}`}>
          <p class="retired-number" aria-hidden="true">
            {r.number}
          </p>
          <h3>
            <button type="button" class="link" onClick={() => onPlayer(r.id)}>
              {r.name}
            </button>{' '}
            <span class="muted small">
              {r.team} · {r.position}
            </span>
          </h3>
          <ul class="plain small retired-story">
            {r.story.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <dl class="facts small">
            {r.bat && !r.pitcher && (
              <div>
                <dt>구단 통산 (타격)</dt>
                <dd>
                  {r.bat.g}경기 타율 {avg(r.bat).toFixed(3).replace(/^0/, '')} {r.bat.h}안타 {r.bat.hr}홈런 {r.bat.rbi}타점 {r.bat.sb}도루 · OPS {ops(r.bat).toFixed(3).replace(/^0/, '')}
                </dd>
              </div>
            )}
            {r.pit && r.pitcher && (
              <div>
                <dt>구단 통산 (투구)</dt>
                <dd>
                  {r.pit.g}경기 {r.pit.w}승 {r.pit.l}패 {r.pit.sv}세이브 {r.pit.hld}홀드 · {ip(r.pit.outs)}이닝 평균자책점 {era(r.pit).toFixed(2)} 탈삼진 {r.pit.k}
                </dd>
              </div>
            )}
            <div>
              <dt>WAR</dt>
              <dd>
                구단 {r.war.toFixed(1)} · 통산 {r.careerWar.toFixed(1)}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

/** The national team (1.0.1): every finished tournament, the result, where the squad came from, ours. */
function National({ league, onPlayer }: { league: LeagueState; onPlayer: (id: string) => void }) {
  const v = nationalView(league);
  if (!v.rows.length) return <p class="muted">아직 끝난 국제대회가 없습니다.</p>;
  return (
    <>
      <p class="muted">
        대회 {v.rows.length}번 · 우승(금메달) {v.wins}번 · 입상 {v.podiums}번 · 병역 특례 {v.exemptions}번
      </p>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table">
          <caption class="sr-only">국가대표 역대 성적</caption>
          <thead>
            <tr>
              <th scope="col" class="num">
                연도
              </th>
              <th scope="col">대회</th>
              <th scope="col">성적</th>
              <th scope="col" class="num">
                엔트리
              </th>
              <th scope="col">구단별</th>
              <th scope="col">우리 선수</th>
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r) => (
              <tr key={r.id}>
                <td class="num">{r.year}</td>
                <td>{r.name}</td>
                <td class={r.result === '우승' || r.result === '금메달' ? 'strong' : ''}>
                  {r.result}
                  {r.medal && <span class="tag">병역 특례</span>}
                </td>
                <td class="num">{r.squad}</td>
                <td class="small">{r.clubs.map((c) => `${c.team} ${c.n}`).join(' · ')}</td>
                <td class="small">
                  {r.ours.length
                    ? r.ours.map((x, i) => (
                        <span key={x.id}>
                          {i > 0 && ', '}
                          <button type="button" class="link" onClick={() => onPlayer(x.id)}>
                            {x.name}
                          </button>
                        </span>
                      ))
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
