import { display as __i18n_display, displayText as __i18n_displayText, k as __i18n_k, rich as __i18n_rich, t as __i18n_t } from '../i18n/index';
/* The postseason bracket (1.4.0, from the 1.3 feedback): where the postseason is at a glance — the rounds in order
   with the one being played marked, every series with its seeds, wins and each game (a chip per game, coloured by
   the winner, opening the box score), the rounds to come with who waits there, and the champion. */
import { bracketView, type BracketSeries, type BracketSide } from '../league/postseason';
import type { LeagueState } from '../league/state';
import { shortName } from '../league/views';

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
const STATE: Record<'done' | 'live' | 'waiting', string> = { done: __i18n_k("ui.bracket.sTATE.done.bfa7e0f7"), live: __i18n_k("ui.bracket.sTATE.live.7890cafc"), waiting: __i18n_k("ui.bracket.sTATE.waiting.df72a875") };

export function PostseasonBracket({ league, onBox, onTeam }: { league: LeagueState; onBox?: (id: string) => void; onTeam?: (id: string) => void }) {
  const v = bracketView(league);
  if (!v) return null;
  const me = league.user?.teamId ?? null;
  const color = (id: string | null) => (id ? (league.teams.find((t) => t.id === id)?.color ?? 'var(--ink-2)') : 'transparent');
  return (
    <section class="bracket" aria-labelledby="bracket-title">
      <h3 id="bracket-title">{__i18n_t("ui.bracket.postseasonBracket.627e461f", { year: v.year })}</h3>
      {__i18n_display(v.ours && (
        <p class="bracket-ours">{__i18n_rich("ui.bracket.postseasonBracket.28d4d2e0", { value: <strong>{__i18n_display(v.ours)}</strong> })}</p>
      ))}
      <ol class="bracket-steps" aria-label={__i18n_t("ui.bracket.postseasonBracket.b9bc0255")}>
        {__i18n_display(v.rounds.map((r) => (
          <li key={r.round} class={r.state} aria-current={r.state === 'live' ? 'step' : undefined}>
            <span class="step-name">{__i18n_display(r.label)}</span>
            <span class="step-state">{__i18n_display(STATE[r.state])}</span>
          </li>
        )))}
        <li class={v.champion ? 'done' : 'waiting'}>
          <span class="step-name">{__i18n_t("ui.bracket.postseasonBracket.894badc3")}</span>
          <span class="step-state">{__i18n_display(v.champion ? shortName(league, v.champion) : __i18n_k("ui.bracket.postseasonBracket.2ddd2127"))}</span>
        </li>
      </ol>
      <div class="bracket-grid" style={{ '--rounds': v.rounds.length + 1 }}>
        {__i18n_display(v.rounds.map((r) => (
          <div key={r.round} class={`bracket-round ${r.state}`}>
            <h4>
              {__i18n_display(r.label)} <span class="muted small">{__i18n_display(STATE[r.state])}</span>
            </h4>
            {__i18n_display(r.series.map((x, i) => (
              <SeriesCard key={i} league={league} x={x} me={me} color={color} onBox={onBox} onTeam={onTeam} />
            )))}
          </div>
        )))}
        <div class={`bracket-round champion ${v.champion ? 'done' : 'waiting'}`}>
          <h4>{__i18n_t("ui.bracket.postseasonBracket.894badc3")}</h4>
          <div class={`bracket-card${v.champion === me && me ? ' mine' : ''}`}>
            {__i18n_display(v.champion ? (
              <p class="bracket-team winner">
                <span class="swatch" style={{ background: color(v.champion) }} aria-hidden="true" />
                <strong>{__i18n_display(shortName(league, v.champion))}</strong>
              </p>
            ) : (
              <p class="muted">{__i18n_t("ui.bracket.postseasonBracket.2ddd2127")}</p>
            ))}
          </div>
        </div>
      </div>
      <p class="muted small">{__i18n_t("ui.bracket.postseasonBracket.4ae5e9fc")}</p>
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
        {__i18n_display(side.teamId ? (
          onTeam ? (
            <button type="button" class="link" onClick={() => onTeam(side.teamId!)}>
              {__i18n_display(shortName(league, side.teamId))}
            </button>
          ) : (
            <span>{__i18n_display(shortName(league, side.teamId))}</span>
          )
        ) : (
          <span class="muted">{__i18n_display(side.label)}</span>
        ))}
        {__i18n_display(side.teamId && side.label && <span class="muted small seed">{__i18n_display(side.label)}</span>)}
        <span class="wins num">{__i18n_display(x.state === 'waiting' ? '' : wins)}</span>
      </p>
    );
  };
  const name = (id: string | null) => (id ? shortName(league, id) : '');
  return (
    <div class={`bracket-card ${x.state}${mine ? ' mine' : ''}`}>
      {__i18n_display(line(x.high, x.hw))}
      {__i18n_display(line(x.low, x.lw))}
      <div class="bracket-games">
        {__i18n_display(x.games.map((g, i) => {
          const winner = g.mark === 'w' ? x.high.teamId : g.mark === 'l' ? x.low.teamId : null;
          const label = __i18n_k("ui.bracket.seriesCard.label.605ba075", { value: i + 1, md: md(g.date), value2: winner ? __i18n_k("ui.bracket.seriesCard.label.1855dd75", { name: name(winner) }) : __i18n_k("ui.bracket.seriesCard.label.ff1b1cbc"), name: name(x.high.teamId), score: g.score });
          return onBox && league.boxes?.[g.id] ? (
            <button key={g.id} type="button" class={`game-chip ${g.mark}`} style={{ borderColor: color(winner) }} title={__i18n_displayText(label)} aria-label={__i18n_displayText(label)} onClick={() => onBox(g.id)}>
              {__i18n_display(i + 1)}
            </button>
          ) : (
            <span key={g.id} class={`game-chip ${g.mark}`} style={{ borderColor: color(winner) }} title={__i18n_displayText(label)} aria-label={__i18n_displayText(label)}>
              {__i18n_display(i + 1)}
            </span>
          );
        }))}
        <span class="muted small">
          {__i18n_display(x.state === 'live' && x.next ? __i18n_k("ui.bracket.seriesCard.e3c12d3f", { md: md(x.next.date), game: x.next.game, need: x.need }) : x.state === 'waiting' ? __i18n_k("ui.bracket.seriesCard.44db72a9", { need: x.need }) : '')}
          {__i18n_display(x.round === 'wildcard' && x.state !== 'done' ? __i18n_k("ui.bracket.seriesCard.4eb4dd77") : '')}
        </span>
      </div>
    </div>
  );
}
