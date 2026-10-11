import { display as __i18n_display, t as __i18n_t } from '../i18n/index';
/* The tutorial card (V0.7.5): one lesson at a time above the screen, never in the way of the game. */
import type { Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import { nextLesson } from './tutorial';

export function TutorialCard({ league, tab, view, onAct }: { league: LeagueState; tab: string; view?: string; onAct: (a: Action) => void }) {
  const lesson = nextLesson(league, { tab, view });
  if (!lesson) return null;
  return (
    <aside class="tutorial" aria-labelledby="tutorial-title">
      <p class="tutorial-kind">{__i18n_t("ui.tutorial.tutorialCard.1d113f33", { index: lesson.index })}</p>
      <h2 id="tutorial-title">{__i18n_display(lesson.title)}</h2>
      {__i18n_display(lesson.body.map((p, i) => (
        <p key={i}>{__i18n_display(p)}</p>
      )))}
      <div class="row-actions">
        <button type="button" class="primary" onClick={() => onAct({ kind: 'tutorial', seen: lesson.id })}>{__i18n_t("ui.tutorial.tutorialCard.de96f038")}</button>
        <button type="button" class="link" onClick={() => onAct({ kind: 'tutorial', off: true })}>{__i18n_t("ui.tutorial.tutorialCard.0937d694")}</button>
      </div>
    </aside>
  );
}
