/* The general manager's briefing on the club overview (1.5.0): the few things that matter most now, each with what
   was seen, the choices and what they cost, and buttons to the screens that make them. */
import { briefing, type BriefGo } from '../league/briefing';
import type { LeagueState } from '../league/state';

export function Briefing({ league, onGo }: { league: LeagueState; onGo: (g: BriefGo) => void }) {
  const items = briefing(league);
  return (
    <section class="briefing" aria-labelledby="briefing-title">
      <h3 id="briefing-title">단장 브리핑</h3>
      {items.length === 0 ? (
        <p class="muted">지금 급한 일은 없습니다. 선수단과 라인업은 감독이 꾸려 갑니다.</p>
      ) : (
        <ol class="brief-list">
          {items.map((x) => (
            <li key={x.id} class={`brief ${x.tone}`}>
              <p class="brief-title">{x.title}</p>
              <ul class="plain small">
                {x.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div class="brief-actions">
                {x.options.map((o) => (
                  <span key={o.label} class="brief-option">
                    <button type="button" onClick={() => onGo(o.go)}>
                      {o.label}
                    </button>
                    {o.note && <span class="muted small">{o.note}</span>}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
      <p class="muted small">스카우트 등급·성적·부상·예산·모기업 목표로 고른 것입니다. 숨은 능력은 알 수 없으니 판단은 단장의 몫입니다.</p>
    </section>
  );
}
