/* The postseason bracket (1.4.0, from the 1.3 feedback): where the postseason is at a glance — the rounds in order
   with the one being played marked, every series with its seeds, wins and each game (a chip per game, coloured by
   the winner, opening the box score), the rounds to come with who waits there, and the champion. */
import { bracketView, type BracketSeries, type BracketSide } from '../league/postseason';
import type { LeagueState } from '../league/state';
import { shortName } from '../league/views';

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const STATE: Record<'done' | 'live' | 'waiting', string> = { done: '끝남', live: '진행 중', waiting: '대기' };

export function PostseasonBracket({ league, onBox, onTeam }: { league: LeagueState; onBox?: (id: string) => void; onTeam?: (id: string) => void }) {
  const v = bracketView(league);
  if (!v) return null;
  const me = league.user?.teamId ?? null;
  const color = (id: string | null) => (id ? (league.teams.find((t) => t.id === id)?.color ?? 'var(--ink-2)') : 'transparent');
  return (
    <section class="bracket" aria-labelledby="bracket-title">
      <h3 id="bracket-title">{v.year} 포스트시즌 대진</h3>
      {v.ours && (
        <p class="bracket-ours">
          우리 구단: <strong>{v.ours}</strong>
        </p>
      )}
      <ol class="bracket-steps" aria-label="라운드 진행">
        {v.rounds.map((r) => (
          <li key={r.round} class={r.state} aria-current={r.state === 'live' ? 'step' : undefined}>
            <span class="step-name">{r.label}</span>
            <span class="step-state">{STATE[r.state]}</span>
          </li>
        ))}
        <li class={v.champion ? 'done' : 'waiting'}>
          <span class="step-name">우승</span>
          <span class="step-state">{v.champion ? shortName(league, v.champion) : '미정'}</span>
        </li>
      </ol>
      <div class="bracket-grid" style={{ '--rounds': v.rounds.length + 1 }}>
        {v.rounds.map((r) => (
          <div key={r.round} class={`bracket-round ${r.state}`}>
            <h4>
              {r.label} <span class="muted small">{STATE[r.state]}</span>
            </h4>
            {r.series.map((x, i) => (
              <SeriesCard key={i} league={league} x={x} me={me} color={color} onBox={onBox} onTeam={onTeam} />
            ))}
          </div>
        ))}
        <div class={`bracket-round champion ${v.champion ? 'done' : 'waiting'}`}>
          <h4>우승</h4>
          <div class={`bracket-card${v.champion === me && me ? ' mine' : ''}`}>
            {v.champion ? (
              <p class="bracket-team winner">
                <span class="swatch" style={{ background: color(v.champion) }} aria-hidden="true" />
                <strong>{shortName(league, v.champion)}</strong>
              </p>
            ) : (
              <p class="muted">미정</p>
            )}
          </div>
        </div>
      </div>
      <p class="muted small">칸마다 한 경기입니다. 색은 이긴 구단, 숫자는 차전이며 누르면 기록지가 열립니다.</p>
    </section>
  );
}

function SeriesCard({
  league,
  x,
  me,
  color,
  onBox,
  onTeam,
}: {
  league: LeagueState;
  x: BracketSeries;
  me: string | null;
  color: (id: string | null) => string;
  onBox?: (id: string) => void;
  onTeam?: (id: string) => void;
}) {
  const mine = !!me && (x.high.teamId === me || x.low.teamId === me);
  const line = (side: BracketSide, wins: number) => {
    const won = !!x.winner && x.winner === side.teamId;
    const out = !!x.winner && !!side.teamId && x.winner !== side.teamId;
    return (
      <p class={`bracket-team${won ? ' winner' : ''}${out ? ' out' : ''}${side.teamId && side.teamId === me ? ' me' : ''}`}>
        <span class="swatch" style={{ background: color(side.teamId) }} aria-hidden="true" />
        {side.teamId ? (
          onTeam ? (
            <button type="button" class="link" onClick={() => onTeam(side.teamId!)}>
              {shortName(league, side.teamId)}
            </button>
          ) : (
            <span>{shortName(league, side.teamId)}</span>
          )
        ) : (
          <span class="muted">{side.label}</span>
        )}
        {side.teamId && side.label && <span class="muted small seed">{side.label}</span>}
        <span class="wins num">{x.state === 'waiting' ? '' : wins}</span>
      </p>
    );
  };
  const name = (id: string | null) => (id ? shortName(league, id) : '');
  return (
    <div class={`bracket-card ${x.state}${mine ? ' mine' : ''}`}>
      {line(x.high, x.hw)}
      {line(x.low, x.lw)}
      <div class="bracket-games">
        {x.games.map((g, i) => {
          const winner = g.mark === 'w' ? x.high.teamId : g.mark === 'l' ? x.low.teamId : null;
          const label = `${i + 1}차전 ${md(g.date)}: ${winner ? `${name(winner)} 승` : '무승부'} (${name(x.high.teamId)} ${g.score})`;
          return onBox && league.boxes?.[g.id] ? (
            <button key={g.id} type="button" class={`game-chip ${g.mark}`} style={{ borderColor: color(winner) }} title={label} aria-label={label} onClick={() => onBox(g.id)}>
              {i + 1}
            </button>
          ) : (
            <span key={g.id} class={`game-chip ${g.mark}`} style={{ borderColor: color(winner) }} title={label} aria-label={label}>
              {i + 1}
            </span>
          );
        })}
        <span class="muted small">
          {x.state === 'live' && x.next ? `다음 ${md(x.next.date)} ${x.next.game}차전 · ${x.need}선승` : x.state === 'waiting' ? `${x.need}선승` : ''}
          {x.round === 'wildcard' && x.state !== 'done' ? ' · 4위 1승 안고 시작' : ''}
        </span>
      </div>
    </div>
  );
}
