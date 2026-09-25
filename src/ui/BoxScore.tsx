/* One game (V0.7): the line score, both clubs' batting and pitching, and for the user's games the text
   relay, which can be replayed play by play (관전 모드). */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { LeagueState } from '../league/state';
import { boxView } from '../league/views';

type Tab = 'box' | 'pbp';
const SPEEDS: [string, number][] = [
  ['느리게', 2200],
  ['보통', 1100],
  ['빠르게', 450],
];

export function BoxScore({ league, id, onClose, onPlayer }: { league: LeagueState; id: string; onClose: () => void; onPlayer: (id: string) => void }) {
  const v = useMemo(() => boxView(league, id), [league, id]);
  const [tab, setTab] = useState<Tab>('box');
  const [shown, setShown] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1100);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id]);
  // Replay: one more play every tick until the end.
  useEffect(() => {
    if (shown === null || !v?.plays || shown >= v.plays.length) return;
    const t = setTimeout(() => setShown(shown + 1), speed);
    return () => clearTimeout(t);
  }, [shown, speed, v]);
  if (!v) return null;
  const innings = Math.max(v.away.line.length, v.home.line.length, 9);
  const plays = v.plays ? (shown === null ? v.plays : v.plays.slice(0, shown)) : null;
  const live = shown !== null && v.plays && shown < v.plays.length;
  const last = plays?.filter((p) => p.ev.k === 'pa').at(-1)?.ev;
  const liveScore = last && last.k === 'pa' ? last.score : [0, 0];
  // Group the relay by half inning, newest first while replaying.
  const halves: { half: string; lines: string[] }[] = [];
  for (const p of plays ?? []) {
    if (!halves.length || halves[halves.length - 1]!.half !== p.half) halves.push({ half: p.half, lines: [] });
    halves[halves.length - 1]!.lines.push(p.text);
  }
  const Link = ({ pid, name }: { pid: string; name: string }) => (
    <button type="button" class="link" onClick={() => onPlayer(pid)}>
      {name}
    </button>
  );
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog box-dialog" role="dialog" aria-modal="true" aria-labelledby="box-title">
        <button type="button" class="close" onClick={onClose} aria-label="닫기">
          닫기
        </button>
        <p class="muted">
          {v.date}
          {v.att ? ` · 관중 ${v.att.toLocaleString('ko-KR')}명` : ''}
          {v.innings > 9 ? ` · 연장 ${v.innings}회` : ''}
        </p>
        <h2 id="box-title" tabIndex={-1} ref={heading}>
          {v.away.short} {live ? liveScore[0] : v.away.rhe[0]} : {live ? liveScore[1] : v.home.rhe[0]} {v.home.short}
        </h2>
        <div class="table-wrap">
          <table class="record-table linescore">
            <thead>
              <tr>
                <th />
                {Array.from({ length: innings }, (_, i) => (
                  <th key={i} class="num">
                    {i + 1}
                  </th>
                ))}
                <th class="num">R</th>
                <th class="num">H</th>
                <th class="num">E</th>
              </tr>
            </thead>
            <tbody>
              {[v.away, v.home].map((t) => (
                <tr key={t.teamId}>
                  <th scope="row">
                    <span class="swatch" style={{ background: t.color }} aria-hidden="true" /> {t.short}
                  </th>
                  {Array.from({ length: innings }, (_, i) => (
                    <td key={i} class="num">
                      {live ? '' : (t.line[i] ?? (i < t.line.length ? 0 : 'X'))}
                    </td>
                  ))}
                  <td class="num strong">{live ? '' : t.rhe[0]}</td>
                  <td class="num">{live ? '' : t.rhe[1]}</td>
                  <td class="num">{live ? '' : t.rhe[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="segmented profile-tabs" role="tablist" aria-label="경기">
          <button type="button" role="tab" aria-selected={tab === 'box'} aria-pressed={tab === 'box'} onClick={() => setTab('box')}>
            기록지
          </button>
          <button type="button" role="tab" aria-selected={tab === 'pbp'} aria-pressed={tab === 'pbp'} disabled={!v.plays} onClick={() => setTab('pbp')}>
            문자중계
          </button>
        </div>

        {tab === 'box' &&
          [v.away, v.home].map((t) => (
            <section key={t.teamId}>
              <h3>{t.name}</h3>
              <div class="table-wrap" tabIndex={0}>
                <table class="record-table career">
                  <thead>
                    <tr>
                      <th class="num">타순</th>
                      <th>타자</th>
                      <th>위치</th>
                      <th class="num">타수</th>
                      <th class="num">득점</th>
                      <th class="num">안타</th>
                      <th class="num">타점</th>
                      <th class="num">홈런</th>
                      <th class="num">4사구</th>
                      <th class="num">삼진</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.bat.map((b) => (
                      <tr key={b.id}>
                        <td class="num">{b.order}</td>
                        <td>
                          <Link pid={b.id} name={b.name} />
                          {b.d + b.t > 0 && <span class="muted small"> {b.d ? `2루타${b.d > 1 ? `×${b.d}` : ''}` : ''}{b.t ? ` 3루타` : ''}</span>}
                          {b.sb > 0 && <span class="muted small"> 도루 {b.sb}</span>}
                        </td>
                        <td>{b.pos}</td>
                        <td class="num">{b.ab}</td>
                        <td class="num">{b.r}</td>
                        <td class="num strong">{b.h}</td>
                        <td class="num">{b.rbi}</td>
                        <td class="num">{b.hr || ''}</td>
                        <td class="num">{b.bb || ''}</td>
                        <td class="num">{b.k || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="table-wrap" tabIndex={0}>
                <table class="record-table career">
                  <thead>
                    <tr>
                      <th>투수</th>
                      <th>결과</th>
                      <th class="num">이닝</th>
                      <th class="num">피안타</th>
                      <th class="num">실점</th>
                      <th class="num">자책</th>
                      <th class="num">4사구</th>
                      <th class="num">삼진</th>
                      <th class="num">피홈런</th>
                      <th class="num">투구수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.pit.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link pid={p.id} name={p.name} />
                        </td>
                        <td>{p.dec && <span class="tag">{p.dec}</span>}</td>
                        <td class="num">{p.ip}</td>
                        <td class="num">{p.h}</td>
                        <td class="num">{p.r}</td>
                        <td class="num strong">{p.er}</td>
                        <td class="num">{p.bb}</td>
                        <td class="num">{p.k}</td>
                        <td class="num">{p.hr || ''}</td>
                        <td class="num">{p.pitches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

        {tab === 'pbp' && v.plays && (
          <>
            <div class="relay-bar">
              {shown === null || !live ? (
                <button type="button" onClick={() => setShown(0)}>
                  처음부터 관전
                </button>
              ) : (
                <button type="button" onClick={() => setShown(null)}>
                  끝까지 보기
                </button>
              )}
              <label>
                속도{' '}
                <select value={String(speed)} onChange={(e) => setSpeed(Number((e.currentTarget as HTMLSelectElement).value))}>
                  {SPEEDS.map(([label, ms]) => (
                    <option key={ms} value={String(ms)}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {live && (
                <span class="muted">
                  {v.away.short} {liveScore[0]} : {liveScore[1]} {v.home.short}
                </span>
              )}
            </div>
            <div class="relay" aria-live="polite">
              {(live ? [...halves].reverse() : halves).map((h, i) => (
                <section key={h.half + i}>
                  <h4>{h.half}</h4>
                  <ol class="plain">
                    {(live && i === 0 ? [...h.lines].reverse() : h.lines).map((line, j) => (
                      <li key={j}>{line}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
