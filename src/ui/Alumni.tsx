/* A staff member who played in the league (1.4.0): a tag that opens his player page, his career in a line. */
import { alumnusLine, isLegend } from '../league/alumni';
import type { LeagueState, StaffMember } from '../league/state';

export function AlumnusTag({ league, m, onPlayer }: { league: LeagueState; m: StaffMember | undefined; onPlayer?: (id: string) => void }) {
  if (!m?.playerId) return null;
  const label = isLegend(m) ? '레전드' : '선수 출신';
  const line = alumnusLine(league, m);
  return (
    <>
      {' '}
      {onPlayer && league.players[m.playerId] ? (
        <button type="button" class={`tag link${isLegend(m) ? ' legend' : ''}`} title={line} onClick={() => onPlayer(m.playerId!)}>
          {label}
        </button>
      ) : (
        <span class={`tag${isLegend(m) ? ' legend' : ''}`} title={line}>
          {label}
        </span>
      )}
      {line && <div class="muted small">{line}</div>}
    </>
  );
}
