import { useMemo, useState } from 'preact/hooks';
import type { Role } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { roleLabel } from './format';
import { useSort } from './sort';

type RoleFilter = 'all' | Role;

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'SP', label: '선발' },
  { id: 'RP', label: '불펜' },
  { id: 'C', label: '포수' },
  { id: 'IF', label: '내야' },
  { id: 'OF', label: '외야' },
];


interface Props {
  /** The draft held in September of this year (it fills next season's rosters). */
  draftYear: number;
  players: Player[];
  ageOf: (p: Player) => number;
  selectedId: PlayerId | null;
  onSelect: (id: PlayerId) => void;
}

export function DraftBoard({ draftYear, players, ageOf, selectedId, onSelect }: Props) {
  const [role, setRole] = useState<RoleFilter>('all');
  const filtered = useMemo(() => players.filter((p) => role === 'all' || p.role === role).sort((a, b) => a.amateur.draftRank - b.amateur.draftRank), [players, role]);
  const { sorted: rows, th } = useSort(filtered, {
    rank: { value: (p) => p.amateur.draftRank, first: 1 },
    name: { value: (p) => p.name },
    role: { value: (p) => ['SP', 'RP', 'C', 'IF', 'OF'].indexOf(p.role), first: 1 },
    path: { value: (p) => p.origin.pathway },
    school: { value: (p) => p.education.school },
    age: { value: (p) => ageOf(p), first: 1 },
    current: { value: (p) => p.scouting.current },
    future: { value: (p) => p.scouting.futureValue },
    velocity: { value: (p) => p.velocity ?? 0 },
  });

  return (
    <section class="board" aria-labelledby="board-title">
      <div class="board-head">
        <h2 id="board-title">{draftYear + 1} 신인 드래프트 후보</h2>
        <p class="muted">{rows.length}명</p>
      </div>
      <div class="controls">
        <div class="segmented" role="group" aria-label="포지션">
          {ROLE_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={role === f.id} onClick={() => setRole(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div class="table-wrap" tabIndex={0} aria-label="후보 목록 (가로로 스크롤할 수 있습니다)">
        <table class="record-table">
          <thead>
            <tr>
              {th('rank', '순위', true)}
              {th('name', '이름')}
              {th('role', '포지션')}
              {th('path', '구분')}
              {th('school', '소속')}
              {th('age', '나이', true)}
              {th('current', '현재', true)}
              {th('future', '미래', true)}
              {th('velocity', '구속', true)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} class="player-row" aria-selected={p.id === selectedId}>
                <td class="num">{p.amateur.draftRank}</td>
                <td>
                  <button type="button" class="link" onClick={() => onSelect(p.id)} aria-current={p.id === selectedId ? 'true' : undefined}>
                    {p.name}
                  </button>
                  {p.twoWay && <span class="tag">이도류</span>}
                </td>
                <td>{roleLabel(p.role)}</td>
                <td>{p.origin.pathway}</td>
                <td>{p.education.school}</td>
                <td class="num">{ageOf(p)}</td>
                <td class="num">{p.scouting.current}</td>
                <td class="num strong">{p.scouting.futureValue}</td>
                <td class="num">{p.velocity ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
