/* The club at a glance (V0.7): who plays where on the field today, the batting order against a
   right- or left-handed starter, the rotation (next starter marked) and the bullpen by role. */
import { useState } from 'preact/hooks';
import type { LeagueState } from '../league/state';
import { lineupView, rates } from '../league/views';

const SPOTS: Record<string, [number, number]> = {
  CF: [200, 40],
  LF: [80, 78],
  RF: [320, 78],
  SS: [145, 140],
  '2B': [255, 140],
  '3B': [70, 205],
  '1B': [330, 205],
  P: [200, 212],
  C: [200, 292],
};

/** Long names (foreign players) show their last word so they fit on the field. */
const onField = (name: string) => (name.length > 5 && name.includes(' ') ? name.split(' ').at(-1)! : name);

const f3 = (x: number | null) => (x == null ? '-' : rates.fmt3(x));

export function Lineup({ league, teamId, onPlayer }: { league: LeagueState; teamId: string; onPlayer: (id: string) => void }) {
  const [vs, setVs] = useState<'R' | 'L'>('R');
  const v = lineupView(league, teamId, vs);
  if (!v || v.lineup.length < 9) return <p class="muted">1군 선수가 모자라 라인업을 짤 수 없습니다.</p>;
  const next = v.starters.find((x) => x.next) ?? v.starters[0];
  const field = [...v.lineup.filter((b) => b.pos !== 'DH').map((b) => ({ pos: b.pos as string, id: b.id, name: b.name, number: b.number })), ...(next ? [{ pos: 'P', id: next.id, name: next.name, number: undefined }] : [])];
  const dh = v.lineup.find((b) => b.pos === 'DH');
  return (
    <div class="lineup">
      <div class="segmented" role="group" aria-label="상대 선발">
        <button type="button" aria-pressed={vs === 'R'} onClick={() => setVs('R')}>
          상대 우완 선발
        </button>
        <button type="button" aria-pressed={vs === 'L'} onClick={() => setVs('L')}>
          상대 좌완 선발
        </button>
      </div>
      <p class="muted">감독이 오늘 짤 라인업입니다 (직접 관리에서 정한 플래툰·불펜 보직 반영). 부상·대표팀 선수는 빠집니다.</p>
      <div class="lineup-grid">
        <svg viewBox="0 0 400 320" class="diamond" role="img" aria-label="수비 위치">
          <path d="M200 300 L40 140 A230 230 0 0 1 360 140 Z" class="grass" />
          <path d="M200 290 L290 200 L200 115 L110 200 Z" class="infield" />
          {field.map((f) => {
            const [x, y] = SPOTS[f.pos] ?? [0, 0];
            return (
              <g key={f.pos} class="spot" onClick={() => onPlayer(f.id)}>
                <rect x={x - 50} y={y - 16} width={100} height={32} rx={6} />
                <text x={x} y={y - 2} text-anchor="middle" class="spot-pos">
                  {f.pos === 'P' ? '선발' : f.pos}
                  {f.number != null ? ` #${f.number}` : ''}
                </text>
                <text x={x} y={y + 12} text-anchor="middle" class="spot-name">
                  {onField(f.name)}
                </text>
              </g>
            );
          })}
        </svg>
        <div>
          <h3>타순</h3>
          <table class="record-table">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>타자</th>
                <th>위치</th>
                <th>타</th>
                <th class="num">타율</th>
                <th class="num">OPS</th>
                <th class="num">홈런</th>
              </tr>
            </thead>
            <tbody>
              {v.lineup.map((b) => (
                <tr key={b.id}>
                  <td class="num">{b.order}</td>
                  <td>
                    <button type="button" class="link" onClick={() => onPlayer(b.id)}>
                      {b.name}
                    </button>
                  </td>
                  <td>{b.pos}</td>
                  <td>{b.bats}</td>
                  <td class="num">{f3(b.avg)}</td>
                  <td class="num strong">{f3(b.ops)}</td>
                  <td class="num">{b.hr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dh && <p class="muted small">지명타자: {dh.name}</p>}
        </div>
      </div>
      <div class="lineup-grid">
        <div>
          <h3>선발 로테이션</h3>
          <ol class="plain">
            {v.starters.map((p) => (
              <li key={p.id}>
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>{' '}
                <span class="muted small">
                  {p.throws}투 · {p.w}승 {p.l}패 · ERA {p.era == null ? '-' : p.era.toFixed(2)}
                </span>
                {p.next && <span class="tag">다음 등판</span>}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>불펜</h3>
          <ol class="plain">
            {v.bullpen.map((p) => (
              <li key={p.id}>
                <span class="tag">{p.role}</span>{' '}
                <button type="button" class="link" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>{' '}
                <span class="muted small">
                  {p.throws}투 · {p.sv}세 {p.hld}홀 · ERA {p.era == null ? '-' : p.era.toFixed(2)}
                </span>
              </li>
            ))}
          </ol>
          <h3>벤치</h3>
          <p>{v.bench.length ? v.bench.map((b) => `${b.name}(${b.pos}${b.injured ? '·부상' : ''})`).join(', ') : '-'}</p>
        </div>
      </div>
    </div>
  );
}
