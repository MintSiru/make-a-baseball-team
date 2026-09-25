import { useEffect, useRef } from 'preact/hooks';
import { TOOL_LABELS } from '../draftroom';
import type { LeagueState } from '../league/state';
import { playerCard, positionLabel, rates } from '../league/views';
import { handedness, militaryLabel, money, toolKeysFor } from './format';

/** A league player's page: public scouting grades, contract and career records. */
export function PlayerPanel({ league, id, onClose }: { league: LeagueState; id: string; onClose: () => void }) {
  const card = playerCard(league, id);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id]);
  if (!card) return null;
  const p = card.player,
    s = p.scouting;
  const pitcher = p.role === 'SP' || p.role === 'RP';
  const rows = card.career;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="player-name">
        <button type="button" class="close" onClick={onClose} aria-label="닫기">
          닫기
        </button>
        <p class="muted">
          {card.team} · {positionLabel(p)}
          {p.origin.kind === 'foreign' ? ` · ${p.origin.asiaQuota ? '아시아쿼터' : '외국인'} (${p.origin.nationality})` : ''}
        </p>
        <h2 id="player-name" tabIndex={-1} ref={heading}>
          {p.name}
        </h2>
        {card.status && <p class="notice">{card.status}</p>}
        <dl class="facts">
          <div>
            <dt>나이</dt>
            <dd>만 {card.age}세</dd>
          </div>
          <div>
            <dt>투타</dt>
            <dd>{handedness(p)}</dd>
          </div>
          <div>
            <dt>연봉</dt>
            <dd>{money(card.salary)}</dd>
          </div>
          <div>
            <dt>병역</dt>
            <dd>{militaryLabel[p.service.military]}</dd>
          </div>
          <div>
            <dt>FA 등록 시즌</dt>
            <dd>{p.origin.kind === 'foreign' ? '-' : `${p.service.creditedSeasons}시즌`}</dd>
          </div>
          <div>
            <dt>입단</dt>
            <dd>{p.origin.overallPick ? `${p.origin.draftYear} 드래프트 전체 ${p.origin.overallPick}순위` : p.origin.kind === 'foreign' ? `${p.proSince}년` : p.origin.draftYear ? `${p.origin.draftYear} 육성선수` : '-'}</dd>
          </div>
        </dl>
        <p class="muted">{p.education.pathText}</p>

        <h3>스카우팅 등급</h3>
        <table class="grades">
          <thead>
            <tr>
              <th>능력</th>
              <th class="num">현재</th>
              <th class="num">미래</th>
            </tr>
          </thead>
          <tbody>
            {toolKeysFor(p.role).map((k) => (
              <tr key={k}>
                <th scope="row">{TOOL_LABELS[k]}</th>
                <td class="num">{s.tools[k] ?? '-'}</td>
                <td class="num">{s.futureTools[k] ?? '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">종합</th>
              <td class="num">{s.current}</td>
              <td class="num strong">{s.futureValue}</td>
            </tr>
          </tfoot>
        </table>

        <h3>통산 기록</h3>
        {rows.length === 0 ? (
          <p class="muted">1군 기록이 없습니다.</p>
        ) : (
          <div class="table-wrap" tabIndex={0}>
            {pitcher ? (
              <table class="record-table career">
                <thead>
                  <tr>
                    <th class="num">연도</th>
                    <th>구단</th>
                    <th class="num">경기</th>
                    <th class="num">승</th>
                    <th class="num">패</th>
                    <th class="num">세</th>
                    <th class="num">홀</th>
                    <th class="num">이닝</th>
                    <th class="num">삼진</th>
                    <th class="num">ERA</th>
                    <th class="num">WAR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year + r.team}>
                      <td class="num">{r.year}</td>
                      <td>{r.team}</td>
                      <td class="num">{r.pit?.g ?? 0}</td>
                      <td class="num">{r.pit?.w ?? 0}</td>
                      <td class="num">{r.pit?.l ?? 0}</td>
                      <td class="num">{r.pit?.sv ?? 0}</td>
                      <td class="num">{r.pit?.hld ?? 0}</td>
                      <td class="num">{rates.ip(r.pit?.outs ?? 0)}</td>
                      <td class="num">{r.pit?.k ?? 0}</td>
                      <td class="num">{r.pit?.outs ? rates.era(r.pit).toFixed(2) : '-'}</td>
                      <td class="num">{r.current ? '-' : r.war.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table class="record-table career">
                <thead>
                  <tr>
                    <th class="num">연도</th>
                    <th>구단</th>
                    <th class="num">경기</th>
                    <th class="num">타석</th>
                    <th class="num">타율</th>
                    <th class="num">홈런</th>
                    <th class="num">타점</th>
                    <th class="num">도루</th>
                    <th class="num">OPS</th>
                    <th class="num">WAR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year + r.team}>
                      <td class="num">{r.year}</td>
                      <td>{r.team}</td>
                      <td class="num">{r.bat?.g ?? 0}</td>
                      <td class="num">{r.bat?.pa ?? 0}</td>
                      <td class="num">{r.bat?.ab ? rates.fmt3(rates.avg(r.bat)) : '-'}</td>
                      <td class="num">{r.bat?.hr ?? 0}</td>
                      <td class="num">{r.bat?.rbi ?? 0}</td>
                      <td class="num">{r.bat?.sb ?? 0}</td>
                      <td class="num">{r.bat?.pa ? rates.fmt3(rates.ops(r.bat)) : '-'}</td>
                      <td class="num">{r.current ? '-' : r.war.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <p class="muted">WAR은 게임 내 추정치입니다. 올해 기록은 시즌이 끝나면 WAR이 계산됩니다.</p>
      </div>
    </div>
  );
}
