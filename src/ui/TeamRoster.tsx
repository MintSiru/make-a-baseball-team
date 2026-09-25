import type { ComponentChildren } from 'preact';
import type { LeagueState } from '../league/state';
import { rosterView, standingsView, teamOf } from '../league/views';
import { money } from './format';
import { positionKey, useSort } from './sort';

export type Row = ReturnType<typeof rosterView>['active'][number];

/** One squad's table. Every column heading sorts it. `actions` adds a column of buttons (the user's club). */
export function RosterTable({
  title,
  rows,
  onPlayer,
  actions,
  note,
}: {
  title: string;
  rows: Row[];
  onPlayer: (id: string) => void;
  actions?: (r: Row) => ComponentChildren;
  note?: ComponentChildren;
}) {
  const { sorted, th } = useSort(rows, {
    name: { value: (r) => r.name },
    pos: { value: (r) => positionKey(r.pos), first: 1 },
    age: { value: (r) => r.age, first: 1 },
    hand: { value: (r) => r.hand },
    grade: { value: (r) => r.grade },
    future: { value: (r) => r.future },
    salary: { value: (r) => r.salary },
  });
  if (!rows.length) return null;
  return (
    <>
      <h3>
        {title} <span class="muted">{rows.length}명</span>
      </h3>
      {note}
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table roster">
          <thead>
            <tr>
              {th('name', '이름')}
              {th('pos', '포지션')}
              {th('age', '나이', true)}
              {th('hand', '투타')}
              {th('grade', '현재', true)}
              {th('future', '미래', true)}
              <th>올해 기록</th>
              {th('salary', '연봉', true)}
              {actions && <th aria-label="관리" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} class="player-row">
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                    {r.name}
                  </button>
                  {r.foreign && <span class="tag">외국인</span>}
                  {r.development && <span class="tag">육성</span>}
                  {r.injured && <span class="tag">부상</span>}
                  {r.away && <span class="tag">대표팀</span>}
                </td>
                <td>{r.pos}</td>
                <td class="num">{r.age}</td>
                <td>{r.hand}</td>
                <td class="num">{r.grade}</td>
                <td class="num strong">{r.future}</td>
                <td class="line">{r.line || <span class="muted">-</span>}</td>
                <td class="num">{money(r.salary)}</td>
                {actions && <td>{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TeamRoster({
  league,
  teamId,
  onTeam,
  onPlayer,
}: {
  league: LeagueState;
  teamId: string;
  onTeam: (id: string) => void;
  onPlayer: (id: string) => void;
}) {
  const team = teamOf(league, teamId)!;
  const roster = rosterView(league, teamId);
  const row = standingsView(league).find((r) => r.teamId === teamId);
  return (
    <section aria-labelledby="team-title" style={{ '--accent': team.color } as Record<string, string>}>
      <div class="team-chips" role="group" aria-label="구단">
        {league.teams.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === teamId} onClick={() => onTeam(t.id)}>
            {t.short}
          </button>
        ))}
      </div>
      <h2 id="team-title">{team.name}</h2>
      <p class="muted">
        {team.stadium.name} ({team.stadium.capacity.toLocaleString('ko-KR')}석) · {team.parent.name}
        {row && ` · ${row.rank}위 ${row.w}승 ${row.l}패 ${row.t}무`}
      </p>
      <RosterTable title="1군" rows={roster.active} onPlayer={onPlayer} />
      <RosterTable title="퓨처스" rows={roster.futures} onPlayer={onPlayer} />
      <RosterTable title="잔류군" rows={roster.third} onPlayer={onPlayer} />
      <RosterTable title="군 복무" rows={roster.military} onPlayer={onPlayer} />
    </section>
  );
}
