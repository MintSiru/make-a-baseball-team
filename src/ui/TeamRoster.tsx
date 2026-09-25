import type { LeagueState } from '../league/state';
import { standingsView, teamOf } from '../league/views';
import { Squad } from './Squad';

/** Another club's page: its squads, one at a time. */
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
      <div class="page-head">
        <div>
          <h2 id="team-title">
            <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {team.name}
          </h2>
          <p class="muted">
            {team.stadium.name} ({team.stadium.capacity.toLocaleString('ko-KR')}석) · {team.parent.name}
          </p>
        </div>
        {row && (
          <p class="head-stat">
            <span class="card-value">{row.rank}위</span> {row.w}승 {row.l}패 {row.t}무
          </p>
        )}
      </div>
      <Squad league={league} teamId={teamId} onPlayer={onPlayer} />
    </section>
  );
}
