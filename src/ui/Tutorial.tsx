/* The tutorial card (V0.7.5): one lesson at a time above the screen, never in the way of the game. */
import type { Action } from '../league/actions';
import type { LeagueState } from '../league/state';
import { nextLesson } from './tutorial';

export function TutorialCard({ league, tab, view, onAct }: { league: LeagueState; tab: string; view?: string; onAct: (a: Action) => void }) {
  const lesson = nextLesson(league, { tab, view });
  if (!lesson) return null;
  return (
    <aside class="tutorial" aria-labelledby="tutorial-title">
      <p class="tutorial-kind">튜토리얼 · {lesson.index}번째 안내</p>
      <h2 id="tutorial-title">{lesson.title}</h2>
      {lesson.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <div class="row-actions">
        <button type="button" class="primary" onClick={() => onAct({ kind: 'tutorial', seen: lesson.id })}>
          알겠어요
        </button>
        <button type="button" class="link" onClick={() => onAct({ kind: 'tutorial', off: true })}>
          튜토리얼 끄기
        </button>
      </div>
    </aside>
  );
}
