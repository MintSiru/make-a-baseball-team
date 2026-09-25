import { TOOL_LABELS } from '../draftroom';
import type { PublicPlayer } from '../model/player';
import { handedness, militaryLabel, recordLine, roleLabel, toolKeysFor } from './format';

interface Props {
  player: PublicPlayer | null;
  age: number | null;
}

export function PlayerProfile({ player: p, age }: Props) {
  if (!p) return <aside class="profile empty">후보를 고르면 스카우팅 리포트가 나옵니다.</aside>;
  const s = p.scouting;
  return (
    <aside class="profile" aria-labelledby="profile-name">
      <p class="muted">
        공개 순위 {p.amateur.draftRank}위 · {p.origin.pathway}
      </p>
      <h2 id="profile-name">{p.name}</h2>
      <p class="lede">
        {roleLabel(p.role)} · {p.archetype}
        {p.twoWay && ' · 이도류 유망주'}
      </p>
      <dl class="facts">
        <div>
          <dt>나이</dt>
          <dd>만 {age}세</dd>
        </div>
        <div>
          <dt>투타</dt>
          <dd>{handedness(p)}</dd>
        </div>
        <div>
          <dt>체격</dt>
          <dd>
            {p.height}cm · {p.weight}kg
          </dd>
        </div>
        <div>
          <dt>병역</dt>
          <dd>{militaryLabel[p.service.military]}</dd>
        </div>
        {p.velocity != null && (
          <div>
            <dt>최고 구속</dt>
            <dd>{p.velocity}km/h</dd>
          </div>
        )}
        <div>
          <dt>출생</dt>
          <dd>{p.birthplace}</dd>
        </div>
      </dl>
      <p>
        {p.education.pathText} <span class="muted">({p.education.qualification})</span>
      </p>

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
      <p class="range">
        플로어 {s.floor} · 실링 {s.ceiling} · 불확실성 {s.uncertainty}
      </p>
      {s.tags.length > 0 && (
        <p>
          {s.tags.map((t) => (
            <span key={t} class="tag">
              {t}
            </span>
          ))}
        </p>
      )}

      <h3>스카우트 메모</h3>
      <p>{s.strength}</p>
      <p>{s.weakness}</p>

      <h3>아마추어 기록</h3>
      <p class="numbers">{recordLine(p.amateur.record)}</p>
      {p.amateur.awards.length > 0 && <p class="muted">{p.amateur.awards.join(' · ')}</p>}
    </aside>
  );
}
