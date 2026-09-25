import { useMemo, useState } from 'preact/hooks';
import type { Role } from '../draftroom';
import type { Player, PlayerId } from '../model/types';
import { roleLabel } from './format';

type RoleFilter = 'all' | Role;
type SortKey = 'rank' | 'future' | 'current' | 'velocity';

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'SP', label: '선발' },
  { id: 'RP', label: '불펜' },
  { id: 'C', label: '포수' },
  { id: 'IF', label: '내야' },
  { id: 'OF', label: '외야' },
];

const SORTS: { id: SortKey; label: string; value: (p: Player) => number }[] = [
  { id: 'rank', label: '공개 순위', value: (p) => -p.amateur.draftRank },
  { id: 'future', label: '미래 가치', value: (p) => p.scouting.futureValue * 1000 - p.amateur.draftRank },
  { id: 'current', label: '현재 기량', value: (p) => p.scouting.current * 1000 - p.amateur.draftRank },
  { id: 'velocity', label: '최고 구속', value: (p) => (p.velocity ?? 0) * 1000 - p.amateur.draftRank },
];

interface Props {
  players: Player[];
  ageOf: (p: Player) => number;
  selectedId: PlayerId | null;
  onSelect: (id: PlayerId) => void;
}

export function DraftBoard({ players, ageOf, selectedId, onSelect }: Props) {
  const [role, setRole] = useState<RoleFilter>('all');
  const [sort, setSort] = useState<SortKey>('rank');
  const rows = useMemo(() => {
    const value = SORTS.find((s) => s.id === sort)!.value;
    return players.filter((p) => role === 'all' || p.role === role).sort((a, b) => value(b) - value(a));
  }, [players, role, sort]);

  return (
    <section class="board" aria-labelledby="board-title">
      <div class="board-head">
        <h2 id="board-title">2027 신인 드래프트 후보</h2>
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
        <label class="sort">
          정렬
          <select value={sort} onChange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="table-wrap" tabIndex={0} aria-label="후보 목록 (가로로 스크롤할 수 있습니다)">
        <table class="record-table">
          <thead>
            <tr>
              <th class="num">순위</th>
              <th>이름</th>
              <th>포지션</th>
              <th>구분</th>
              <th>소속</th>
              <th class="num">나이</th>
              <th class="num">현재</th>
              <th class="num">미래</th>
              <th class="num">구속</th>
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
