import { display as __i18n_display, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
import type { LeagueState } from '../league/state';
import { standingsView, teamOf } from '../league/views';
import { useState } from 'preact/hooks';
import { accentStyle } from './display';
import { useDark } from './useDisplay';
import { Squad } from './Squad';
import { Lineup } from './Lineup';

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
  const dark = useDark();
  const team = teamOf(league, teamId)!;
  const [view, setView] = useState<'squad' | 'lineup'>('squad');
  const row = standingsView(league).find((r) => r.teamId === teamId);
  return (
    <section aria-labelledby="team-title" style={accentStyle(team.color, dark)}>
      <div class="team-chips" role="group" aria-label={__i18n_t("ui.teamRoster.teamRoster.58756112")}>
        {__i18n_display(league.teams.map((t) => (
          <button key={t.id} type="button" aria-pressed={t.id === teamId} onClick={() => onTeam(t.id)}>
            {__i18n_display(t.short)}
          </button>
        )))}
      </div>
      <div class="page-head">
        <div>
          <h2 id="team-title">
            <span class="swatch" style={{ background: team.color }} aria-hidden="true" /> {__i18n_display(team.name)}
          </h2>
          <p class="muted">{__i18n_t("ui.teamRoster.teamRoster.05860087", { name: team.stadium.name, value: team.stadium.capacity.toLocaleString('ko-KR'), name2: team.parent.name })}</p>
          {__i18n_display(!!team.retiredNumbers?.length && (
            <p class="muted">{__i18n_t("ui.teamRoster.teamRoster.cedb54ea", { value: team.retiredNumbers.map((x) => `${x.number} ${x.name}(${x.year})`).join(', ') })}</p>
          ))}
        </div>
        {__i18n_display(row && (
          <p class="head-stat">{__i18n_rich("ui.teamRoster.teamRoster.55e5b921", { value: <span class="card-value">{__i18n_t("ui.teamRoster.teamRoster.b372d067", { rank: row.rank })}</span>, w: row.w, l: row.l, value2: row.t })}</p>
        ))}
      </div>
      <div class="segmented" role="group" aria-label={__i18n_t("ui.teamRoster.teamRoster.58d6978a")}>
        <button type="button" aria-pressed={view === 'squad'} onClick={() => setView('squad')}>{__i18n_t("ui.teamRoster.teamRoster.5b9daec2")}</button>
        <button type="button" aria-pressed={view === 'lineup'} onClick={() => setView('lineup')}>{__i18n_t("ui.teamRoster.teamRoster.4c31ef82")}</button>
      </div>
      {__i18n_display(view === 'squad' ? <Squad league={league} teamId={teamId} onPlayer={onPlayer} /> : <Lineup league={league} teamId={teamId} onPlayer={onPlayer} />)}
    </section>
  );
}
