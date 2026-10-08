import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k } from '../i18n/index';
/* A staff member who played in the league (1.4.0): a tag that opens his player page, his career in a line. */
import { alumnusLine, isLegend } from '../league/alumni';
import type { LeagueState, StaffMember } from '../league/state';

export function AlumnusTag({ league, m, onPlayer }: { league: LeagueState; m: StaffMember | undefined; onPlayer?: (id: string) => void }) {
  if (!m?.playerId) return null;
  const label = isLegend(m) ? __i18n_k("ui.alumni.alumnusTag.label.fc3380eb") : __i18n_k("ui.alumni.alumnusTag.label.be86217a");
  const line = alumnusLine(league, m);
  return (
    <>
      {__i18n_display(' ')}
      {__i18n_display(onPlayer && league.players[m.playerId] ? (
        <button type="button" class={`tag link${isLegend(m) ? ' legend' : ''}`} title={__i18n_displayText(line)} onClick={() => onPlayer(m.playerId!)}>
          {__i18n_display(label)}
        </button>
      ) : (
        <span class={`tag${isLegend(m) ? ' legend' : ''}`} title={__i18n_displayText(line)}>
          {__i18n_display(label)}
        </span>
      ))}
      {__i18n_display(line && <div class="muted small">{__i18n_display(line)}</div>)}
    </>
  );
}
