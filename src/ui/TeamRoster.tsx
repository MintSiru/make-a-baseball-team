import type { LeagueState } from '../league/state';
import { rosterView, standingsView, teamOf } from '../league/views';
import { money } from './format';

type Row = ReturnType<typeof rosterView>['active'][number];

function RosterTable({ title, rows, onPlayer }: { title: string; rows: Row[]; onPlayer: (id: string) => void }) {
  if (!rows.length) return null;
  return (
    <>
      <h3>
        {title} <span class="muted">{rows.length}명</span>
      </h3>
      <div class="table-wrap" tabIndex={0}>
        <table class="record-table roster">
          <thead>
            <tr>
              <th>이름</th>
              <th>포지션</th>
              <th class="num">나이</th>
              <th>투타</th>
              <th class="num">현재</th>
              <th class="num">미래</th>
              <th>올해 기록</th>
              <th class="num">연봉</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} class="player-row">
                <td>
                  <button type="button" class="link" onClick={() => onPlayer(r.id)}>
                    {r.name}
                  </button>
                  {r.foreign && <span class="tag">외국인</span>}
                  {r.injured && <span class="tag">부상</span>}
                </td>
                <td>{r.pos}</td>
                <td class="num">{r.age}</td>
                <td>{r.hand}</td>
                <td class="num">{r.grade}</td>
                <td class="num strong">{r.future}</td>
                <td class="line">{r.line || <span class="muted">-</span>}</td>
                <td class="num">{money(r.salary)}</td>
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
  hideChips,
}: {
  league: LeagueState;
  teamId: string;
  onTeam: (id: string) => void;
  onPlayer: (id: string) => void;
  hideChips?: boolean;
}) {
  const team = teamOf(league, teamId)!;
  const roster = rosterView(league, teamId);
  const row = standingsView(league).find((r) => r.teamId === teamId);
  return (
    <section aria-labelledby={hideChips ? undefined : 'team-title'} style={{ '--accent': team.color } as Record<string, string>}>
      {!hideChips && (
      <div class="team-chips" role="group" aria-label="구단">
        {league.teams.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === teamId} onClick={() => onTeam(t.id)}>
            {t.short}
          </button>
        ))}
      </div>
      )}
      {!hideChips && <h2 id="team-title">{team.name}</h2>}
      {!hideChips && (
        <p class="muted">
          {team.stadium.name} ({team.stadium.capacity.toLocaleString('ko-KR')}석) · {team.parent.name}
          {row && ` · ${row.rank}위 ${row.w}승 ${row.l}패 ${row.t}무`}
        </p>
      )}
      <RosterTable title="1군" rows={roster.active} onPlayer={onPlayer} />
      <RosterTable title="퓨처스" rows={roster.futures} onPlayer={onPlayer} />
      <RosterTable title="군 복무" rows={roster.military} onPlayer={onPlayer} />
    </section>
  );
}
