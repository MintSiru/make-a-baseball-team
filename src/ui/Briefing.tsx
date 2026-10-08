import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
/* The general manager's briefing on the club overview (1.5.0): the few things that matter most now, each with what
   was seen, the choices and what they cost, and buttons to the screens that make them. */
import { briefing, type BriefGo } from '../league/briefing';
import type { LeagueState } from '../league/state';

export function Briefing({ league, onGo }: { league: LeagueState; onGo: (g: BriefGo) => void }) {
  const items = briefing(league);
  return (
    <section class="briefing" aria-labelledby="briefing-title">
      <h3 id="briefing-title">{__i18n_t("ui.briefing.briefing.e1cca07a")}</h3>
      {__i18n_display(items.length === 0 ? (
        <p class="muted">{__i18n_t("ui.briefing.briefing.cd219ff2")}</p>
      ) : (
        <ol class="brief-list">
          {__i18n_display(items.map((x) => (
            <li key={x.id} class={`brief ${x.tone}`}>
              <p class="brief-title">{__i18n_display(x.title)}</p>
              <ul class="plain small">
                {__i18n_display(x.facts.map((f) => (
                  <li key={f}>{__i18n_display(f)}</li>
                )))}
              </ul>
              <div class="brief-actions">
                {__i18n_display(x.options.map((o) => (
                  <span key={o.label} class="brief-option">
                    <button type="button" onClick={() => onGo(o.go)}>
                      {__i18n_display(o.label)}
                    </button>
                    {__i18n_display(o.note && <span class="muted small">{__i18n_display(o.note)}</span>)}
                  </span>
                )))}
              </div>
            </li>
          )))}
        </ol>
      ))}
      <p class="muted small">{__i18n_t("ui.briefing.briefing.0ae878ec")}</p>
    </section>
  );
}
